"use server";

import { tasks } from "@trigger.dev/sdk";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase";
import { searchRequestSchema, type SearchRequest } from "@/lib/search-schema";
import { recordTaskEvent } from "@/lib/task-events";
import type { Json } from "@/types/database";
import type { processSearchTask } from "@/trigger/search-task";

const maxRowsPerRequest = 8;

export async function createDashboardSearchTask(formData: FormData) {
  const user = await requireUser();
  const supabase = createServiceRoleClient();
  const redirectTo = getSafeRedirect(formData);

  const now = new Date().toISOString();
  const requestGroupId = getOptionalText(formData, "request_group_id") ?? crypto.randomUUID();
  const queries = formData.getAll("query").map((value) => String(value ?? ""));
  const searchTypes = formData.getAll("search_type").map((value) => String(value ?? "web"));
  const maxResults = formData.getAll("max_results").map((value) => Number(value ?? 5));
  const countries = formData.getAll("country").map((value) => String(value ?? ""));
  const includeDomains = formData.getAll("include_domains").map((value) => String(value ?? ""));
  const excludeDomains = formData.getAll("exclude_domains").map((value) => String(value ?? ""));
  const scrapingModes = formData.getAll("scraping_enabled").map((value) => String(value ?? "true"));

  const videoTitle =
    getOptionalText(formData, "video_title") ??
    queries.find((query) => query.trim().length >= 3)?.trim().slice(0, 120) ??
    "Solicitacao de pesquisa";
  const videoContext = getOptionalText(formData, "video_context");
  const rowOffset = Number(formData.get("row_offset") ?? 0) || 0;

  const rows = queries
    .map((query, index) => ({
      query,
      search_type: searchTypes[index] ?? "web",
      max_results: maxResults[index] || 5,
      country: getOptionalString(countries[index]),
      include_domains: parseDomains(includeDomains[index]),
      exclude_domains: parseDomains(excludeDomains[index]),
      scraping_enabled: scrapingModes[index] !== "false",
      row_index: rowOffset + index + 1
    }))
    .filter((row) => row.query.trim().length > 0)
    .slice(0, maxRowsPerRequest);

  if (rows.length === 0) {
    redirect(withCreateError(redirectTo, "Adicione pelo menos uma pesquisa"));
  }

  let inputs: SearchRequest[];

  try {
    inputs = rows.map((row) =>
      searchRequestSchema.parse({
        query: row.query,
        search_type: row.search_type,
        max_results: row.max_results,
        country: row.country,
        include_domains: row.include_domains,
        exclude_domains: row.exclude_domains,
        metadata: {
          source: "dashboard",
          request_group_id: requestGroupId,
          request_created_at: now,
          video_title: videoTitle,
          video_context: videoContext,
          scraping_enabled: row.scraping_enabled,
          row_index: row.row_index
        }
      })
    );
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message ?? "Dados invalidos"
        : "Dados invalidos";
    redirect(withCreateError(redirectTo, message));
  }

  for (const [index, input] of inputs.entries()) {
    const metadata = {
      ...input.metadata,
      ...(input.include_domains ? { include_domains: input.include_domains } : {}),
      ...(input.exclude_domains ? { exclude_domains: input.exclude_domains } : {}),
      ...(input.country ? { country: input.country } : {})
    };

    const { data: task, error } = await supabase
      .from("search_tasks")
      .insert({
        user_id: user.id,
        api_key_id: null,
        query: input.query,
        search_type: input.search_type,
        status: "queued",
        requested_results: input.max_results,
        metadata: metadata as Json,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select("*")
      .single();

    if (error || !task) {
      redirect(withCreateError(redirectTo, error?.message ?? "Nao foi possivel criar a tarefa"));
    }

    await recordTaskEvent(supabase, task.id, "task_created", "Task created from dashboard", {
      request_group_id: requestGroupId,
      row_index: index + 1
    });

    try {
      await tasks.trigger<typeof processSearchTask>(
        "process-search-task",
        { taskId: task.id },
        {
          idempotencyKey: task.id,
          tags: [`user:${user.id}`, `task:${task.id}`, `request:${requestGroupId}`],
          maxAttempts: 3
        }
      );

      await recordTaskEvent(supabase, task.id, "task_queued", "Background job queued");
    } catch (triggerError) {
      await recordTaskEvent(supabase, task.id, "task_queued", "Task saved, but Trigger.dev was not reached", {
        error: triggerError instanceof Error ? triggerError.message : String(triggerError)
      });
    }
  }

  redirect(redirectTo);
}

function getOptionalText(formData: FormData, name: string) {
  return getOptionalString(String(formData.get(name) ?? ""));
}

function getOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseDomains(value: string | undefined) {
  const domains = getOptionalString(value)
    ?.split(/[,\n]/)
    .map((domain) => domain.trim())
    .filter(Boolean)
    .map((domain) =>
      domain
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .split("/")[0]
        .toLowerCase()
    )
    .filter(Boolean);

  return domains?.length ? domains : undefined;
}

function getSafeRedirect(formData: FormData) {
  const redirectTo = getOptionalText(formData, "redirect_to");

  if (redirectTo?.startsWith("/dashboard")) {
    return redirectTo;
  }

  return "/dashboard";
}

function withCreateError(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}create_error=${encodeURIComponent(message)}`;
}
