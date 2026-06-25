"use server";

import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { recordMediaEvent } from "@/lib/media-processor";
import { createServiceRoleClient } from "@/lib/supabase";
import type { processMediaSearchTask } from "@/trigger/media-task";
import type { Json } from "@/types/database";

const mediaTaskSchema = z.object({
  event_name: z.string().trim().min(3).max(240),
  event_date: z.string().trim().optional(),
  location: z.string().trim().max(180).optional(),
  event_description: z.string().trim().min(10).max(1200),
  desired_media: z.string().trim().max(600).optional(),
  media_kind: z.enum(["images", "videos", "both"]).default("both"),
  source_preference: z.enum(["all", "news", "youtube", "x", "official"]).default("all"),
  requested_results: z.coerce.number().int().min(1).max(30).default(10)
});

export async function createMediaTask(formData: FormData) {
  const user = await requireUser();
  const supabase = createServiceRoleClient();
  const parsed = mediaTaskSchema.safeParse({
    event_name: formData.get("event_name"),
    event_date: formData.get("event_date"),
    location: formData.get("location"),
    event_description: formData.get("event_description"),
    desired_media: formData.get("desired_media"),
    media_kind: formData.get("media_kind"),
    source_preference: formData.get("source_preference"),
    requested_results: formData.get("requested_results")
  });

  if (!parsed.success) {
    redirect(`/dashboard/media?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados invalidos")}`);
  }

  const input = parsed.data;
  const query = [
    input.event_name,
    input.event_date ? `em ${input.event_date}` : "",
    input.location,
    input.event_description,
    input.desired_media
  ]
    .filter(Boolean)
    .join(" ");

  const { data: task, error } = await supabase
    .from("media_tasks")
    .insert({
      user_id: user.id,
      mode: "real_event",
      query,
      event_name: input.event_name,
      event_date: input.event_date || null,
      location: input.location || null,
      event_description: input.event_description,
      desired_media: input.desired_media || null,
      media_kind: input.media_kind,
      source_preference: input.source_preference,
      requested_results: input.requested_results,
      metadata: {
        source: "dashboard",
        version: "real_event_mvp"
      } as Json
    })
    .select("*")
    .single();

  if (error || !task) {
    redirect(`/dashboard/media?error=${encodeURIComponent(error?.message ?? "Nao foi possivel criar a solicitacao")}`);
  }

  await recordMediaEvent(supabase, task.id, "media_task_created", "Media task created from dashboard");

  try {
    await tasks.trigger<typeof processMediaSearchTask>(
      "process-media-search-task",
      { taskId: task.id },
      {
        idempotencyKey: task.id,
        tags: [`user:${user.id}`, `media-task:${task.id}`],
        maxAttempts: 2
      }
    );

    await recordMediaEvent(supabase, task.id, "media_task_queued", "Background media job queued");
  } catch (triggerError) {
    await recordMediaEvent(supabase, task.id, "media_task_queued", "Task saved, but Trigger.dev was not reached", {
      error: triggerError instanceof Error ? triggerError.message : String(triggerError)
    });
  }

  revalidatePath("/dashboard/media");
  redirect(`/dashboard/media?open=${task.id}`);
}

export async function deleteMediaTask(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("task_id") ?? "");
  const supabase = createServiceRoleClient();

  if (!taskId) return;

  await supabase.from("media_tasks").delete().eq("id", taskId).eq("user_id", user.id);
  revalidatePath("/dashboard/media");
}

export async function toggleMediaResultSelected(formData: FormData) {
  const user = await requireUser();
  const resultId = String(formData.get("result_id") ?? "");
  const selected = String(formData.get("selected") ?? "") !== "true";
  const supabase = createServiceRoleClient();

  if (!resultId) return;

  const { data: result } = await supabase
    .from("media_results")
    .select("id, media_task_id")
    .eq("id", resultId)
    .single();

  if (!result) {
    return;
  }

  const { data: task } = await supabase
    .from("media_tasks")
    .select("id, user_id")
    .eq("id", result.media_task_id)
    .single();

  if (!task || task.user_id !== user.id) {
    return;
  }

  await supabase
    .from("media_results")
    .update({ selected_for_video: selected })
    .eq("id", resultId);

  revalidatePath("/dashboard/media");
}
