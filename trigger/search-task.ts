import { logger, task } from "@trigger.dev/sdk";

import { buildFinalReport, cleanContent, domainFromUrl } from "@/lib/content";
import { sendTaskCallback } from "@/lib/callback";
import { scrapeWithFirecrawl } from "@/lib/firecrawl";
import type { SearchRequest } from "@/lib/search-schema";
import { createServiceRoleClient } from "@/lib/supabase";
import { recordTaskEvent } from "@/lib/task-events";
import { searchWithTavily, type TavilyResult } from "@/lib/tavily";
import type { Database, Json } from "@/types/database";

type SearchTaskRow = Database["public"]["Tables"]["search_tasks"]["Row"];
type SearchResultRow = Database["public"]["Tables"]["search_results"]["Row"];
type ApiKeyRow = Database["public"]["Tables"]["api_keys"]["Row"];

export const processSearchTask = task({
  id: "process-search-task",
  queue: {
    concurrencyLimit: 5
  },
  retry: {
    maxAttempts: 3
  },
  run: async (payload: { taskId: string }) => {
    const supabase = createServiceRoleClient();
    const taskId = payload.taskId;
    let taskRow: SearchTaskRow | null = null;

    try {
      const { data: taskData, error: taskError } = await supabase
        .from("search_tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (taskError || !taskData) {
        throw new Error(`Task not found: ${taskId}`);
      }

      taskRow = taskData;

      let apiKey: ApiKeyRow | null = null;

      if (taskRow.api_key_id) {
        const { data: apiKeyData, error: apiKeyError } = await supabase
          .from("api_keys")
          .select("*")
          .eq("id", taskRow.api_key_id)
          .maybeSingle();

        if (apiKeyError) {
          throw apiKeyError;
        }

        apiKey = apiKeyData;
      }

      await supabase
        .from("search_tasks")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          error_message: null
        })
        .eq("id", taskId);

      await recordTaskEvent(supabase, taskId, "processing_started", "Background processing started");

      const searchInput = toSearchRequest(taskRow);
      const scrapingEnabled = isScrapingEnabled(taskRow, apiKey?.scraping_enabled !== false);

      logger.info("Running Tavily search", {
        taskId,
        query: taskRow.query,
        requestedResults: taskRow.requested_results
      });

      const searchResponse = await searchWithTavily(searchInput);

      await recordTaskEvent(supabase, taskId, "search_completed", "Search provider returned results", {
        result_count: searchResponse.results.length,
        request_id: searchResponse.request_id ?? null,
        response_time: searchResponse.response_time ?? null
      });

      await supabase.from("search_results").delete().eq("task_id", taskId);
      await recordTaskEvent(supabase, taskId, "scraping_started", "Page extraction started", {
        scraping_enabled: scrapingEnabled
      });

      const storedResults: SearchResultRow[] = [];
      let successfulResults = 0;
      let failedResults = 0;

      for (const [index, result] of searchResponse.results.entries()) {
        const baseResult = await insertSearchResult(supabase, taskId, index + 1, result);

        if (!scrapingEnabled) {
          successfulResults += 1;
          storedResults.push(baseResult);
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
            .eq("id", baseResult.id)
            .select("*")
            .single();

          if (updateError || !updatedResult) {
            throw updateError ?? new Error("Unable to update scraped result");
          }

          successfulResults += 1;
          storedResults.push(updatedResult);

          await recordTaskEvent(supabase, taskId, "page_scraped", "Page scraped successfully", {
            url: result.url,
            result_id: updatedResult.id
          });
        } catch (error) {
          failedResults += 1;

          const message = error instanceof Error ? error.message : String(error);
          const { data: failedResult } = await supabase
            .from("search_results")
            .update({
              scrape_status: "failed",
              error_message: message
            })
            .eq("id", baseResult.id)
            .select("*")
            .single();

          storedResults.push(failedResult ?? baseResult);

          await recordTaskEvent(supabase, taskId, "page_failed", "Page scraping failed", {
            url: result.url,
            error: message
          });
        }
      }

      const report = buildFinalReport(taskRow.query, storedResults);

      if (report.sourceIds.length > 0) {
        await supabase
          .from("search_results")
          .update({ selected_for_final_answer: true })
          .in("id", report.sourceIds);
      }

      const now = new Date().toISOString();
      const { data: finalReport, error: finalReportError } = await supabase
        .from("final_reports")
        .upsert(
          {
            task_id: taskId,
            summary: report.summary,
            key_findings: report.keyFindings as Json,
            final_answer: report.finalAnswer,
            source_ids: report.sourceIds as Json,
            updated_at: now
          },
          { onConflict: "task_id" }
        )
        .select("*")
        .single();

      if (finalReportError || !finalReport) {
        throw finalReportError ?? new Error("Unable to write final report");
      }

      await recordTaskEvent(supabase, taskId, "analysis_completed", "Final report prepared", {
        selected_source_ids: report.sourceIds
      });

      const { data: completedTask, error: completedError } = await supabase
        .from("search_tasks")
        .update({
          status: "completed",
          successful_results: successfulResults,
          failed_results: failedResults,
          completed_at: now
        })
        .eq("id", taskId)
        .select("*")
        .single();

      if (completedError || !completedTask) {
        throw completedError ?? new Error("Unable to complete task");
      }

      await recordTaskEvent(supabase, taskId, "task_completed", "Task completed", {
        successful_results: successfulResults,
        failed_results: failedResults
      });

      if (completedTask.callback_url && completedTask.callback_secret) {
        const { data: callbackResults, error: callbackResultsError } = await supabase
          .from("search_results")
          .select("*")
          .eq("task_id", taskId)
          .order("position");

        if (callbackResultsError) {
          throw callbackResultsError;
        }

        const { callback_secret: _callbackSecret, ...safeTask } = completedTask;

        await sendTaskCallback(completedTask.callback_url, completedTask.callback_secret, {
          task: safeTask,
          results: callbackResults ?? [],
          final_report: finalReport
        });

        await recordTaskEvent(supabase, taskId, "callback_sent", "Callback sent to n8n", {
          callback_url: completedTask.callback_url
        });
      }

      return {
        taskId,
        successfulResults,
        failedResults
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Search task failed", { taskId, error: message });

      await supabase
        .from("search_tasks")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString()
        })
        .eq("id", taskId);

      await recordTaskEvent(supabase, taskId, "task_failed", "Task failed", {
        error: message
      });

      if (taskRow?.callback_url && taskRow.callback_secret) {
        try {
          const { data: failedTask } = await supabase
            .from("search_tasks")
            .select("*")
            .eq("id", taskId)
            .single();

          if (failedTask) {
            const { callback_secret: _callbackSecret, ...safeTask } = failedTask;
            await sendTaskCallback(taskRow.callback_url, taskRow.callback_secret, {
              task: safeTask,
              results: [],
              final_report: null
            });
          }
        } catch (callbackError) {
          logger.error("Failure callback failed", {
            taskId,
            error: callbackError instanceof Error ? callbackError.message : String(callbackError)
          });
        }
      }

      throw error;
    }
  }
});

async function insertSearchResult(
  supabase: ReturnType<typeof createServiceRoleClient>,
  taskId: string,
  position: number,
  result: TavilyResult
) {
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

  if (error || !data) {
    throw error ?? new Error("Unable to insert search result");
  }

  return data;
}

function toSearchRequest(taskRow: SearchTaskRow): SearchRequest {
  const metadata = asRecord(taskRow.metadata);

  return {
    query: taskRow.query,
    search_type: isSearchType(taskRow.search_type) ? taskRow.search_type : "web",
    max_results: taskRow.requested_results,
    include_domains: asStringArray(metadata.include_domains),
    exclude_domains: asStringArray(metadata.exclude_domains),
    country: typeof metadata.country === "string" ? metadata.country : undefined,
    metadata
  };
}

function asRecord(value: Json): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function isSearchType(value: string): value is SearchRequest["search_type"] {
  return value === "web" || value === "news" || value === "finance";
}

function isScrapingEnabled(taskRow: SearchTaskRow, apiKeyAllowsScraping: boolean) {
  const metadata = asRecord(taskRow.metadata);
  return apiKeyAllowsScraping && metadata.scraping_enabled !== false;
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
