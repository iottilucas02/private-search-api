import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

loadEnv();

const supabase = createClient(
  mustGetEnv("NEXT_PUBLIC_SUPABASE_URL"),
  mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const pollIntervalMs = Number(process.env.LOCAL_WORKER_POLL_INTERVAL_MS ?? 5000);
const once = process.argv.includes("--once");
let stopped = false;

process.on("SIGINT", () => {
  stopped = true;
  console.log("\nStopping local worker...");
});

console.log("Private Search API local worker started.");
console.log(`Polling queued tasks every ${pollIntervalMs}ms.`);

do {
  const processedSearchTask = await processNextTask();

  if (!processedSearchTask) {
    await processNextMediaTask();
  }

  if (!once && !stopped) {
    await sleep(pollIntervalMs);
  }
} while (!once && !stopped);

async function processNextTask() {
  const { data: tasks, error } = await supabase
    .from("search_tasks")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Could not fetch queued tasks:", error.message);
    return false;
  }

  const task = tasks?.[0];

  if (!task) {
    return false;
  }

  console.log(`Processing task ${task.id}: ${task.query}`);

  try {
    await updateTask(task.id, {
      status: "processing",
      started_at: new Date().toISOString(),
      error_message: null
    });
    await recordEvent(task.id, "processing_started", "Local worker started processing");

    const { data: apiKey } = await supabase
      .from("api_keys")
      .select("*")
      .eq("id", task.api_key_id)
      .maybeSingle();
    const scrapingEnabled = isScrapingEnabled(task, apiKey?.scraping_enabled !== false);

    const searchResponse = await searchWithTavily(task);

    await recordEvent(task.id, "search_completed", "Search provider returned results", {
      result_count: searchResponse.results.length
    });

    await supabase.from("search_results").delete().eq("task_id", task.id);
    await recordEvent(task.id, "scraping_started", "Page extraction started", {
      scraping_enabled: scrapingEnabled
    });

    const storedResults = [];
    let successfulResults = 0;
    let failedResults = 0;

    for (const [index, result] of searchResponse.results.entries()) {
      const inserted = await insertBaseResult(task.id, index + 1, result);

      if (!scrapingEnabled) {
        successfulResults += 1;
        storedResults.push(inserted);
        continue;
      }

      try {
        const scraped = await scrapeWithFirecrawl(result.url);
        const rawContent =
          scraped.data?.markdown ??
          scraped.data?.html ??
          result.raw_content ??
          result.content ??
          "";
        const cleanedContent = cleanContent(rawContent);

        const { data: updatedResult, error: updateError } = await supabase
          .from("search_results")
          .update({
            raw_content: rawContent,
            cleaned_content: cleanedContent,
            canonical_url: scraped.data?.metadata?.sourceURL ?? scraped.data?.metadata?.url ?? result.url,
            title: scraped.data?.metadata?.title ?? result.title ?? null,
            scrape_status: "scraped",
            error_message: null
          })
          .eq("id", inserted.id)
          .select("*")
          .single();

        if (updateError) {
          throw updateError;
        }

        successfulResults += 1;
        storedResults.push(updatedResult);

        await recordEvent(task.id, "page_scraped", "Page scraped successfully", {
          url: result.url,
          result_id: updatedResult.id
        });
      } catch (scrapeError) {
        failedResults += 1;
        const message = getErrorMessage(scrapeError);

        const { data: failedResult } = await supabase
          .from("search_results")
          .update({
            scrape_status: "failed",
            error_message: message
          })
          .eq("id", inserted.id)
          .select("*")
          .single();

        storedResults.push(failedResult ?? inserted);

        await recordEvent(task.id, "page_failed", "Page scraping failed", {
          url: result.url,
          error: message
        });
      }
    }

    const report = buildFinalReport(task.query, storedResults);

    if (report.sourceIds.length > 0) {
      await supabase
        .from("search_results")
        .update({ selected_for_final_answer: true })
        .in("id", report.sourceIds);
    }

    const now = new Date().toISOString();
    const { data: finalReport, error: reportError } = await supabase
      .from("final_reports")
      .upsert(
        {
          task_id: task.id,
          summary: report.summary,
          key_findings: report.keyFindings,
          final_answer: report.finalAnswer,
          source_ids: report.sourceIds,
          updated_at: now
        },
        { onConflict: "task_id" }
      )
      .select("*")
      .single();

    if (reportError) {
      throw reportError;
    }

    await recordEvent(task.id, "analysis_completed", "Final report prepared", {
      selected_source_ids: report.sourceIds
    });

    const completedTask = await updateTask(task.id, {
      status: "completed",
      successful_results: successfulResults,
      failed_results: failedResults,
      completed_at: now
    });

    await recordEvent(task.id, "task_completed", "Task completed", {
      successful_results: successfulResults,
      failed_results: failedResults
    });

    if (completedTask.callback_url && completedTask.callback_secret) {
      const { data: callbackResults, error: callbackResultsError } = await supabase
        .from("search_results")
        .select("*")
        .eq("task_id", task.id)
        .order("position");

      if (callbackResultsError) {
        throw callbackResultsError;
      }

      const { callback_secret: _secret, ...safeTask } = completedTask;
      await sendTaskCallback(completedTask.callback_url, completedTask.callback_secret, {
        task: safeTask,
        results: callbackResults ?? [],
        final_report: finalReport
      });

      await recordEvent(task.id, "callback_sent", "Callback sent", {
        callback_url: completedTask.callback_url
      });
    }

    console.log(`Completed task ${task.id}.`);
    return true;
  } catch (taskError) {
    const message = getErrorMessage(taskError);
    console.error(`Task ${task.id} failed:`, message);

    await updateTask(task.id, {
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString()
    });

    await recordEvent(task.id, "task_failed", "Task failed", {
      error: message
    });
    return true;
  }
}

async function processNextMediaTask() {
  const { data: tasks, error } = await supabase
    .from("media_tasks")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    if (error.message.includes("relation") || error.message.includes("schema cache")) {
      return false;
    }

    console.error("Could not fetch queued media tasks:", error.message);
    return false;
  }

  const task = tasks?.[0];

  if (!task) {
    return false;
  }

  console.log(`Processing media task ${task.id}: ${task.event_name ?? task.query}`);

  try {
    await updateMediaTask(task.id, {
      status: "processing",
      started_at: new Date().toISOString(),
      error_message: null
    });
    await recordMediaEvent(task.id, "processing_started", "Local worker started media processing");

    const mediaResults = await searchMediaWithTavily(task);

    await recordMediaEvent(task.id, "media_search_completed", "Media search returned results", {
      result_count: mediaResults.length
    });

    await supabase.from("media_results").delete().eq("media_task_id", task.id);

    if (mediaResults.length > 0) {
      const { error: insertError } = await supabase.from("media_results").insert(
        mediaResults.map((result, index) => ({
          media_task_id: task.id,
          position: index + 1,
          title: result.title,
          source_url: result.sourceUrl,
          media_url: result.mediaUrl,
          thumbnail_url: result.thumbnailUrl,
          source_domain: result.sourceDomain,
          source_type: result.sourceType,
          media_kind: result.mediaKind,
          description: result.description,
          published_at: result.publishedAt,
          relevance_score: result.relevanceScore,
          license_note: result.licenseNote
        }))
      );

      if (insertError) {
        throw insertError;
      }
    }

    await updateMediaTask(task.id, {
      status: "completed",
      successful_results: mediaResults.length,
      failed_results: 0,
      completed_at: new Date().toISOString()
    });

    await recordMediaEvent(task.id, "media_task_completed", "Media task completed", {
      successful_results: mediaResults.length
    });

    console.log(`Completed media task ${task.id}.`);
    return true;
  } catch (taskError) {
    const message = getErrorMessage(taskError);
    console.error(`Media task ${task.id} failed:`, message);

    await updateMediaTask(task.id, {
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString()
    });

    await recordMediaEvent(task.id, "media_task_failed", "Media task failed", {
      error: message
    });

    return true;
  }
}

async function searchWithTavily(task) {
  const metadata = isPlainObject(task.metadata) ? task.metadata : {};
  const topic = task.search_type === "web" ? "general" : task.search_type;

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mustGetEnv("TAVILY_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: task.query,
      topic,
      max_results: task.requested_results,
      search_depth: "advanced",
      chunks_per_source: 3,
      include_answer: false,
      include_raw_content: false,
      include_domains: Array.isArray(metadata.include_domains) ? metadata.include_domains : undefined,
      exclude_domains: Array.isArray(metadata.exclude_domains) ? metadata.exclude_domains : undefined,
      country: typeof metadata.country === "string" ? metadata.country : undefined,
      include_usage: true
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function searchMediaWithTavily(task) {
  const input = {
    query: task.query,
    eventName: task.event_name,
    eventDate: task.event_date,
    location: task.location,
    eventDescription: task.event_description,
    desiredMedia: task.desired_media,
    sourceMode: parseMediaSourceMode(task.source_preference),
    mediaKind: parseMediaKind(task.media_kind),
    maxResults: task.requested_results
  };
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mustGetEnv("TAVILY_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: buildEventMediaQuery(input),
      topic: input.sourceMode === "news" ? "news" : "general",
      max_results: input.maxResults,
      search_depth: "advanced",
      include_images: input.mediaKind !== "videos",
      include_image_descriptions: input.mediaKind !== "videos",
      include_answer: false,
      include_raw_content: false,
      include_domains: getMediaIncludeDomains(input.sourceMode),
      include_usage: true
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily media search failed: ${response.status} ${await response.text()}`);
  }

  return normalizeMediaResults(await response.json(), input);
}

const mediaNewsDomains = [
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "cnn.com",
  "aljazeera.com",
  "theguardian.com",
  "nytimes.com",
  "washingtonpost.com",
  "defensenews.com",
  "militarytimes.com",
  "theaviationist.com",
  "twz.com"
];

const mediaOfficialDomains = [
  "dvidshub.net",
  "defense.gov",
  "army.mil",
  "navy.mil",
  "af.mil",
  "marines.mil",
  "spaceforce.mil",
  "nato.int",
  "commons.wikimedia.org"
];

function buildEventMediaQuery(input) {
  const mediaIntent =
    input.mediaKind === "videos"
      ? "real video footage eyewitness video social media video news footage"
      : input.mediaKind === "images"
        ? "real photos images eyewitness photos news images"
        : "real photos video footage eyewitness media news social media";
  const sourceIntent =
    input.sourceMode === "youtube"
      ? "site:youtube.com"
      : input.sourceMode === "x"
        ? "site:x.com OR site:twitter.com"
        : input.sourceMode === "official"
          ? "official military public affairs archive"
          : input.sourceMode === "news"
            ? "news agency published images video"
            : "YouTube X Twitter news agency social media";

  return [
    input.eventName,
    input.query,
    input.eventDate ? `date ${input.eventDate}` : "",
    input.location,
    input.eventDescription,
    input.desiredMedia,
    mediaIntent,
    sourceIntent
  ]
    .filter(Boolean)
    .join(" ");
}

function getMediaIncludeDomains(sourceMode) {
  if (sourceMode === "news") return mediaNewsDomains;
  if (sourceMode === "youtube") return ["youtube.com"];
  if (sourceMode === "x") return ["x.com", "twitter.com"];
  if (sourceMode === "official") return mediaOfficialDomains;
  return undefined;
}

function normalizeMediaResults(payload, input) {
  const items = new Map();
  const response = isPlainObject(payload) ? payload : {};
  const results = Array.isArray(response.results) ? response.results : [];

  if (input.mediaKind !== "videos") {
    const topImages = Array.isArray(response.images) ? response.images : [];

    for (const image of topImages) {
      const record = isPlainObject(image) ? image : {};
      const imageUrl = getNonEmptyString(record.url);
      if (!imageUrl) continue;

      items.set(imageUrl, {
        title: getNonEmptyString(record.description) ?? input.query,
        mediaUrl: imageUrl,
        thumbnailUrl: imageUrl,
        sourceUrl: imageUrl,
        sourceDomain: domainFromUrl(imageUrl) ?? "imagem",
        sourceType: "image",
        description: getNonEmptyString(record.description),
        mediaKind: "image",
        publishedAt: null,
        relevanceScore: null,
        licenseNote: "Verificar licenca, credito e permissao de uso na fonte original."
      });
    }
  }

  for (const result of results) {
    const record = isPlainObject(result) ? result : {};
    const sourceUrl = getNonEmptyString(record.url);
    if (!sourceUrl) continue;

    const sourceDomain = domainFromUrl(sourceUrl) ?? "fonte";
    const sourceType = inferMediaSourceType(sourceUrl);
    const pageKind = inferMediaKind(sourceUrl, input.mediaKind);
    const title = getNonEmptyString(record.title) ?? sourceDomain;
    const description = getNonEmptyString(record.content);
    const publishedAt = normalizeDate(getNonEmptyString(record.published_date));
    const relevanceScore = typeof record.score === "number" ? record.score : null;

    items.set(sourceUrl, {
      title,
      mediaUrl: null,
      thumbnailUrl: null,
      sourceUrl,
      sourceDomain,
      sourceType,
      description,
      mediaKind: pageKind,
      publishedAt,
      relevanceScore,
      licenseNote: buildMediaLicenseNote(sourceType)
    });

    if (input.mediaKind === "videos") continue;

    const images = Array.isArray(record.images) ? record.images : [];
    for (const image of images) {
      const imageRecord = isPlainObject(image) ? image : {};
      const imageUrl = getNonEmptyString(imageRecord.url);
      if (!imageUrl) continue;

      items.set(`${sourceUrl}::${imageUrl}`, {
        title: getNonEmptyString(imageRecord.description) ?? title,
        mediaUrl: imageUrl,
        thumbnailUrl: imageUrl,
        sourceUrl,
        sourceDomain,
        sourceType,
        description: getNonEmptyString(imageRecord.description) ?? description,
        mediaKind: "image",
        publishedAt,
        relevanceScore,
        licenseNote: buildMediaLicenseNote(sourceType)
      });
    }
  }

  return Array.from(items.values()).slice(0, Math.min(60, input.maxResults * 4));
}

function parseMediaSourceMode(value) {
  return ["all", "news", "youtube", "x", "official"].includes(value) ? value : "all";
}

function parseMediaKind(value) {
  return ["images", "videos", "both"].includes(value) ? value : "both";
}

function inferMediaSourceType(url) {
  const domain = domainFromUrl(url) ?? "";
  if (domain.includes("youtube.com") || domain.includes("youtu.be")) return "youtube";
  if (domain === "x.com" || domain === "twitter.com") return "x";
  if (mediaOfficialDomains.some((officialDomain) => domain.endsWith(officialDomain))) return "official";
  if (mediaNewsDomains.some((newsDomain) => domain.endsWith(newsDomain))) return "news";
  return "web";
}

function inferMediaKind(url, requested) {
  const sourceType = inferMediaSourceType(url);
  if (requested === "videos") return sourceType === "youtube" || sourceType === "x" ? "video" : "page";
  if (requested === "images") return "page";
  return sourceType === "youtube" || sourceType === "x" ? "video" : "page";
}

function buildMediaLicenseNote(sourceType) {
  if (sourceType === "official") {
    return "Fonte publica/oficial: ainda verificar credito, contexto e restricoes especificas.";
  }

  if (sourceType === "youtube" || sourceType === "x") {
    return "Rede social: usar como referencia; verificar permissao, autoria e direitos antes de reutilizar.";
  }

  if (sourceType === "news") {
    return "Fonte jornalistica: normalmente exige licenca ou embed/autorizacao.";
  }

  return "Verificar licenca, credito e permissao de uso na fonte original.";
}

function getNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function scrapeWithFirecrawl(url) {
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mustGetEnv("FIRECRAWL_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      removeBase64Images: true,
      blockAds: true,
      timeout: 60000
    })
  });

  if (!response.ok) {
    throw new Error(`Firecrawl scrape failed: ${response.status} ${await response.text()}`);
  }

  const parsed = await response.json();

  if (!parsed.success) {
    throw new Error(parsed.data?.metadata?.error ?? "Firecrawl scrape did not succeed");
  }

  return parsed;
}

async function insertBaseResult(taskId, position, result) {
  const rawContent = result.raw_content ?? result.content ?? "";
  const { data, error } = await supabase
    .from("search_results")
    .insert({
      task_id: taskId,
      position,
      title: result.title ?? null,
      url: result.url,
      canonical_url: result.url,
      domain: domainFromUrl(result.url),
      snippet: result.content ?? null,
      raw_content: rawContent,
      cleaned_content: cleanContent(rawContent),
      published_at: normalizeDate(result.published_date),
      relevance_score: result.score ?? null,
      scrape_status: "skipped"
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateTask(taskId, patch) {
  const { data, error } = await supabase
    .from("search_tasks")
    .update(patch)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function recordEvent(taskId, eventType, message, metadata = {}) {
  const { error } = await supabase.from("task_events").insert({
    task_id: taskId,
    event_type: eventType,
    message,
    metadata
  });

  if (error) {
    console.error("Could not record event:", error.message);
  }
}

async function updateMediaTask(taskId, patch) {
  const { data, error } = await supabase
    .from("media_tasks")
    .update(patch)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function recordMediaEvent(taskId, eventType, message, metadata = {}) {
  const { error } = await supabase.from("media_task_events").insert({
    media_task_id: taskId,
    event_type: eventType,
    message,
    metadata
  });

  if (error) {
    console.error("Could not record media event:", error.message);
  }
}

async function sendTaskCallback(callbackUrl, callbackSecret, payload) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", callbackSecret).update(body).digest("hex");

  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-search-task-id": payload.task.id,
      "x-search-signature": signature
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Callback failed: ${response.status} ${await response.text()}`);
  }
}

function buildFinalReport(query, results) {
  const selectedSources = results
    .filter((result) => result.scrape_status !== "failed")
    .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
    .slice(0, Math.min(5, results.length));

  const keyFindings = selectedSources.map((source) => ({
    source_id: source.id,
    title: source.title,
    url: source.url,
    domain: source.domain,
    finding: source.cleaned_content || source.snippet || "Fonte coletada sem trecho textual suficiente."
  }));

  const sourceList = selectedSources
    .map((source, index) => `${index + 1}. ${source.title ?? source.domain ?? source.url}: ${source.url}`)
    .join("\n");

  return {
    summary:
      selectedSources.length > 0
        ? `${selectedSources.length} fonte(s) selecionada(s) para analise final.`
        : "Nenhuma fonte selecionada para analise final.",
    keyFindings,
    finalAnswer:
      selectedSources.length > 0
        ? [
            `Pesquisa consolidada: ${query}`,
            "",
            "Resumo: as fontes abaixo foram coletadas, limpas e selecionadas como base inicial para a resposta final.",
            "",
            "Fontes usadas:",
            sourceList
          ].join("\n")
        : `Pesquisa consolidada: ${query}\n\nNenhuma fonte utilizavel foi coletada.`,
    sourceIds: selectedSources.map((source) => source.id)
  };
}

function cleanContent(content) {
  if (!content) return "";

  return String(content)
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24000);
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function loadEnv() {
  const envFile = readFileSync(".env.local", "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const name = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();

    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}

function mustGetEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isScrapingEnabled(task, apiKeyAllowsScraping) {
  const metadata = isPlainObject(task.metadata) ? task.metadata : {};
  return apiKeyAllowsScraping && metadata.scraping_enabled !== false;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
