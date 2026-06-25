import type { AppSupabaseClient } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";

export async function recordTaskEvent(
  supabase: AppSupabaseClient,
  taskId: string,
  eventType: string,
  message?: string,
  metadata: Json = {}
) {
  const { error } = await supabase.from("task_events").insert({
    task_id: taskId,
    event_type: eventType,
    message: message ?? null,
    metadata
  });

  if (error) {
    console.error("Failed to record task event", error);
  }
}
