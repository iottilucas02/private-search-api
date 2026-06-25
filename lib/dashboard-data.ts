import { createSupabaseServerClient } from "@/lib/supabase";
import type { TaskStatus } from "@/types/database";
import { getMetaString, getMetadata, groupTasksByVideoRequest } from "@/lib/video-requests";

export async function getTaskCounts() {
  const supabase = await createSupabaseServerClient();
  const statuses: TaskStatus[] = ["queued", "processing", "completed", "failed", "expired"];

  const [total, ...statusCounts] = await Promise.all([
    supabase.from("search_tasks").select("id", { count: "exact", head: true }),
    ...statuses.map((status) =>
      supabase.from("search_tasks").select("id", { count: "exact", head: true }).eq("status", status)
    )
  ]);

  return {
    total: total.count ?? 0,
    queued: statusCounts[0].count ?? 0,
    processing: statusCounts[1].count ?? 0,
    completed: statusCounts[2].count ?? 0,
    failed: statusCounts[3].count ?? 0,
    expired: statusCounts[4].count ?? 0
  };
}

export async function getRecentTasks(limit = 10) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("search_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getApiKeys() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getTaskDetail(taskId: string) {
  const supabase = await createSupabaseServerClient();
  const [task, results, events, finalReport] = await Promise.all([
    supabase.from("search_tasks").select("*").eq("id", taskId).single(),
    supabase.from("search_results").select("*").eq("task_id", taskId).order("position"),
    supabase.from("task_events").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
    supabase.from("final_reports").select("*").eq("task_id", taskId).maybeSingle()
  ]);

  if (task.error) throw task.error;
  if (results.error) throw results.error;
  if (events.error) throw events.error;
  if (finalReport.error) throw finalReport.error;

  return {
    task: task.data,
    results: results.data ?? [],
    events: events.data ?? [],
    finalReport: finalReport.data
  };
}

export async function getVideoRequestDetail(requestId: string) {
  const supabase = await createSupabaseServerClient();

  const groupedTasks = await supabase
    .from("search_tasks")
    .select("*")
    .eq("metadata->>request_group_id", requestId)
    .order("created_at", { ascending: true });

  let tasks = groupedTasks.data ?? [];

  if (groupedTasks.error || tasks.length === 0) {
    const taskById = await supabase.from("search_tasks").select("*").eq("id", requestId).maybeSingle();

    if (taskById.error) throw taskById.error;
    if (taskById.data) {
      const metadata = getMetadata(taskById.data.metadata);
      const groupId = getMetaString(metadata, "request_group_id");

      if (groupId && groupId !== requestId) {
        const siblingTasks = await supabase
          .from("search_tasks")
          .select("*")
          .eq("metadata->>request_group_id", groupId)
          .order("created_at", { ascending: true });

        if (siblingTasks.error) throw siblingTasks.error;
        tasks = siblingTasks.data ?? [taskById.data];
      } else {
        tasks = [taskById.data];
      }
    }
  }

  if (tasks.length === 0) {
    return null;
  }

  const taskIds = tasks.map((task) => task.id);
  const [results, finalReports] = await Promise.all([
    supabase.from("search_results").select("*").in("task_id", taskIds).order("position"),
    supabase.from("final_reports").select("*").in("task_id", taskIds)
  ]);

  if (results.error) throw results.error;
  if (finalReports.error) throw finalReports.error;

  const request = groupTasksByVideoRequest(tasks)[0];
  const resultsByTask = new Map<string, NonNullable<typeof results.data>>();
  const reportsByTask = new Map<string, NonNullable<typeof finalReports.data>[number]>();

  for (const result of results.data ?? []) {
    const current = resultsByTask.get(result.task_id) ?? [];
    current.push(result);
    resultsByTask.set(result.task_id, current);
  }

  for (const report of finalReports.data ?? []) {
    reportsByTask.set(report.task_id, report);
  }

  return {
    request,
    resultsByTask,
    reportsByTask
  };
}
