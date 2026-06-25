import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { authenticateApiKey } from "@/lib/api-keys";
import { getAppUrl } from "@/lib/env";
import { errorToResponse, HttpError } from "@/lib/http-error";
import { searchRequestSchema } from "@/lib/search-schema";
import { recordTaskEvent } from "@/lib/task-events";
import type { processSearchTask } from "@/trigger/search-task";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { apiKey, supabase } = await authenticateApiKey(request);
    const json = await request.json().catch(() => {
      throw new HttpError(400, "Invalid JSON body", "invalid_json");
    });
    const input = searchRequestSchema.parse(json);

    if (input.max_results > apiKey.max_results_per_task) {
      throw new HttpError(
        422,
        `This API key allows up to ${apiKey.max_results_per_task} results per task`,
        "max_results_exceeded"
      );
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const metadata = {
      ...input.metadata,
      ...(input.include_domains ? { include_domains: input.include_domains } : {}),
      ...(input.exclude_domains ? { exclude_domains: input.exclude_domains } : {}),
      ...(input.country ? { country: input.country } : {})
    };
    const { data: task, error } = await supabase
      .from("search_tasks")
      .insert({
        user_id: apiKey.user_id,
        api_key_id: apiKey.id,
        query: input.query,
        search_type: input.search_type,
        status: "queued",
        requested_results: input.max_results,
        callback_url: input.callback_url ?? null,
        callback_secret: input.callback_secret ?? null,
        metadata,
        expires_at: expiresAt
      })
      .select("*")
      .single();

    if (error || !task) {
      throw new HttpError(500, "Unable to create search task", "task_create_failed");
    }

    await recordTaskEvent(supabase, task.id, "task_created", "Task created by API request", {
      api_key_id: apiKey.id
    });

    let jobQueued = true;

    try {
      await tasks.trigger<typeof processSearchTask>(
        "process-search-task",
        { taskId: task.id },
        {
          idempotencyKey: task.id,
          tags: [`user:${apiKey.user_id}`, `task:${task.id}`],
          maxAttempts: 3
        }
      );
    } catch (triggerError) {
      jobQueued = false;

      await recordTaskEvent(supabase, task.id, "task_queued", "Task saved, but Trigger.dev was not reached", {
        error: triggerError instanceof Error ? triggerError.message : String(triggerError)
      });
    }

    if (jobQueued) {
      await recordTaskEvent(supabase, task.id, "task_queued", "Background job queued");
    }

    return NextResponse.json(
      {
        task_id: task.id,
        status: "queued",
        job_queued: jobQueued,
        result_url: `${getAppUrl()}/api/v1/search/${task.id}`
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Invalid request body",
            issues: error.issues
          }
        },
        { status: 400 }
      );
    }

    return errorToResponse(error);
  }
}
