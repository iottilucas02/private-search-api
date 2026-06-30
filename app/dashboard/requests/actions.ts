"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase";
import type { Json } from "@/types/database";

export async function deleteSearchResult(formData: FormData) {
  const user = await requireUser();
  const resultId = String(formData.get("result_id") ?? "");
  const requestId = String(formData.get("request_id") ?? "");

  if (!resultId || !requestId) {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: result } = await supabase
    .from("search_results")
    .select("id, task_id")
    .eq("id", resultId)
    .single();

  if (!result) {
    return;
  }

  const { data: task } = await supabase
    .from("search_tasks")
    .select("id, user_id")
    .eq("id", result.task_id)
    .single();

  if (!task || task.user_id !== user.id) {
    return;
  }

  await supabase.from("search_results").delete().eq("id", resultId);
  await updateTaskResultCount(supabase, result.task_id);
  await removeResultFromFinalReport(supabase, result.task_id, resultId);

  revalidatePath(`/dashboard/requests/${requestId}`);
  revalidatePath(`/dashboard/tasks/${result.task_id}`);
  revalidatePath(`/creditos/${requestId}`);
}

async function updateTaskResultCount(supabase: ReturnType<typeof createServiceRoleClient>, taskId: string) {
  const { count } = await supabase
    .from("search_results")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);

  await supabase
    .from("search_tasks")
    .update({ successful_results: count ?? 0 })
    .eq("id", taskId);
}

async function removeResultFromFinalReport(
  supabase: ReturnType<typeof createServiceRoleClient>,
  taskId: string,
  resultId: string
) {
  const { data: report } = await supabase
    .from("final_reports")
    .select("id, source_ids")
    .eq("task_id", taskId)
    .maybeSingle();

  if (!report || !Array.isArray(report.source_ids)) {
    return;
  }

  const sourceIds = report.source_ids.filter((id) => id !== resultId) as Json;

  await supabase
    .from("final_reports")
    .update({ source_ids: sourceIds, updated_at: new Date().toISOString() })
    .eq("id", report.id);
}
