"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase";

export async function deleteSearchTaskBlock(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("task_id") ?? "");
  const requestId = String(formData.get("request_id") ?? "");

  if (!taskId || !requestId) {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: task } = await supabase
    .from("search_tasks")
    .select("id, user_id")
    .eq("id", taskId)
    .single();

  if (!task || task.user_id !== user.id) {
    return;
  }

  await supabase.from("search_tasks").delete().eq("id", taskId);

  revalidatePath(`/dashboard/requests/${requestId}`);
  revalidatePath(`/dashboard/tasks/${taskId}`);
  revalidatePath(`/creditos/${requestId}`);

  const { count: remainingCount } = await supabase
    .from("search_tasks")
    .select("id", { count: "exact", head: true })
    .eq("metadata->>request_group_id", requestId);

  if ((remainingCount ?? 0) === 0) {
    redirect("/dashboard");
  }
}
