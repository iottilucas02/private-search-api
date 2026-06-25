import { NextResponse } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys";
import { errorToResponse, HttpError } from "@/lib/http-error";
import { taskIdSchema } from "@/lib/search-schema";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await context.params;
    const parsedTaskId = taskIdSchema.parse(taskId);
    const { apiKey, supabase } = await authenticateApiKey(request);

    const { data: task, error: taskError } = await supabase
      .from("search_tasks")
      .select("*")
      .eq("id", parsedTaskId)
      .eq("user_id", apiKey.user_id)
      .single();

    if (taskError || !task) {
      throw new HttpError(404, "Task not found", "task_not_found");
    }

    const [results, events, finalReport] = await Promise.all([
      supabase.from("search_results").select("*").eq("task_id", task.id).order("position"),
      supabase.from("task_events").select("*").eq("task_id", task.id).order("created_at"),
      supabase.from("final_reports").select("*").eq("task_id", task.id).maybeSingle()
    ]);

    if (results.error) throw new HttpError(500, "Unable to load results", "results_load_failed");
    if (events.error) throw new HttpError(500, "Unable to load events", "events_load_failed");
    if (finalReport.error) throw new HttpError(500, "Unable to load final report", "report_load_failed");

    const { callback_secret: _callbackSecret, ...safeTask } = task;

    return NextResponse.json({
      task: safeTask,
      results: results.data ?? [],
      events: events.data ?? [],
      final_report: finalReport.data
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
