import { getEnv } from "@/lib/env";

export type MediaSourceMode = "all" | "news" | "youtube" | "x" | "official";
export type MediaKind = "images" | "videos" | "both";

export type MediaSearchInput = {
  query: string;
  eventName?: string | null;
  eventDate?: string | null;
  location?: string | null;
  eventDescription?: string | null;
  desiredMedia?: string | null;
  sourceMode: MediaSourceMode;
  mediaKind: MediaKind;
  maxResults: number;
};

export type MediaSearchItem = {
  title: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  description: string | null;
  mediaKind: "image" | "video" | "page";
  publishedAt: string | null;
  relevanceScore: number | null;
  licenseNote: string;
};

const newsDomains = [
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

const officialDomains = [
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

export async function searchMedia(input: MediaSearchInput) {
  const query = buildEventMediaQuery(input);
  const includeDomains = getIncludeDomains(input.sourceMode);

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getEnv("TAVILY_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      topic: input.sourceMode === "news" ? "news" : "general",
      max_results: input.maxResults,
      search_depth: "advanced",
      include_images: input.mediaKind !== "videos",
      include_image_descriptions: input.mediaKind !== "videos",
      include_answer: false,
      include_raw_content: false,
      include_domains: includeDomains,
      include_usage: true
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily media search failed: ${response.status} ${await response.text()}`);
  }

  return normalizeMediaResults(await response.json(), input);
}

function buildEventMediaQuery(input: MediaSearchInput) {
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

function getIncludeDomains(sourceMode: MediaSourceMode) {
  if (sourceMode === "news") return newsDomains;
  if (sourceMode === "youtube") return ["youtube.com"];
  if (sourceMode === "x") return ["x.com", "twitter.com"];
  if (sourceMode === "official") return officialDomains;
  return undefined;
}

function normalizeMediaResults(payload: unknown, input: MediaSearchInput) {
  const items = new Map<string, MediaSearchItem>();
  const response = asRecord(payload);
  const results = Array.isArray(response.results) ? response.results : [];

  if (input.mediaKind !== "videos") {
    const topImages = Array.isArray(response.images) ? response.images : [];

    for (const image of topImages) {
      const record = asRecord(image);
      const imageUrl = getString(record.url);
      if (!imageUrl) continue;

      items.set(imageUrl, {
        title: getString(record.description) ?? input.query,
        mediaUrl: imageUrl,
        thumbnailUrl: imageUrl,
        sourceUrl: imageUrl,
        sourceDomain: domainFromUrl(imageUrl) ?? "imagem",
        sourceType: "image",
        description: getString(record.description),
        mediaKind: "image",
        publishedAt: null,
        relevanceScore: null,
        licenseNote: "Verificar licenca, credito e permissao de uso na fonte original."
      });
    }
  }

  for (const result of results) {
    const resultRecord = asRecord(result);
    const sourceUrl = getString(resultRecord.url);
    if (!sourceUrl) continue;

    const sourceDomain = domainFromUrl(sourceUrl) ?? "fonte";
    const sourceTitle = getString(resultRecord.title) ?? sourceDomain;
    const description = getString(resultRecord.content);
    const sourceType = inferSourceType(sourceUrl);
    const pageKind = inferMediaKind(sourceUrl, input.mediaKind);
    const publishedAt = normalizeDate(getString(resultRecord.published_date));
    const relevanceScore = getNumber(resultRecord.score);

    items.set(sourceUrl, {
      title: sourceTitle,
      mediaUrl: null,
      thumbnailUrl: null,
      sourceUrl,
      sourceDomain,
      sourceType,
      description,
      mediaKind: pageKind,
      publishedAt,
      relevanceScore,
      licenseNote: buildLicenseNote(sourceType)
    });

    if (input.mediaKind === "videos") {
      continue;
    }

    const images = Array.isArray(resultRecord.images) ? resultRecord.images : [];

    for (const image of images) {
      const imageRecord = asRecord(image);
      const imageUrl = getString(imageRecord.url);
      if (!imageUrl) continue;

      items.set(`${sourceUrl}::${imageUrl}`, {
        title: getString(imageRecord.description) ?? sourceTitle,
        mediaUrl: imageUrl,
        thumbnailUrl: imageUrl,
        sourceUrl,
        sourceDomain,
        sourceType,
        description: getString(imageRecord.description) ?? description,
        mediaKind: "image",
        publishedAt,
        relevanceScore,
        licenseNote: buildLicenseNote(sourceType)
      });
    }
  }

  return Array.from(items.values())
    .filter((item) => {
      if (input.mediaKind === "videos") return item.mediaKind === "video" || item.mediaKind === "page";
      if (input.mediaKind === "images") return item.mediaKind === "image" || item.mediaKind === "page";
      return true;
    })
    .slice(0, Math.min(60, input.maxResults * 4));
}

function inferSourceType(url: string) {
  const domain = domainFromUrl(url) ?? "";

  if (domain.includes("youtube.com") || domain.includes("youtu.be")) return "youtube";
  if (domain === "x.com" || domain === "twitter.com") return "x";
  if (officialDomains.some((officialDomain) => domain.endsWith(officialDomain))) return "official";
  if (newsDomains.some((newsDomain) => domain.endsWith(newsDomain))) return "news";
  return "web";
}

function inferMediaKind(url: string, requested: MediaKind): "image" | "video" | "page" {
  const sourceType = inferSourceType(url);

  if (requested === "videos") return sourceType === "youtube" || sourceType === "x" ? "video" : "page";
  if (requested === "images") return "page";
  return sourceType === "youtube" || sourceType === "x" ? "video" : "page";
}

function buildLicenseNote(sourceType: string) {
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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
