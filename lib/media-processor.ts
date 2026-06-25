import type { AppSupabaseClient } from "@/lib/supabase";
import { searchMedia, type MediaKind, type MediaSourceMode } from "@/lib/media-search";
import type { Database, Json } from "@/types/database";

type MediaTask = Database["public"]["Tables"]["media_tasks"]["Row"];
type MediaResultInsert = Database["public"]["Tables"]["media_results"]["Insert"];

export async function processMediaTask(supabase: AppSupabaseClient, taskId: string) {
  const { data: task, error: taskError } = await supabase
    .from("media_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    throw taskError ?? new Error(`Media task not found: ${taskId}`);
  }

  try {
    await updateMediaTask(supabase, task.id, {
      status: "processing",
      started_at: new Date().toISOString(),
      error_message: null
    });

    await recordMediaEvent(supabase, task.id, "processing_started", "Media search started");

    const results = await searchMedia({
      query: task.query,
      eventName: task.event_name,
      eventDate: task.event_date,
      location: task.location,
      eventDescription: task.event_description,
      desiredMedia: task.desired_media,
      sourceMode: parseSourceMode(task.source_preference),
      mediaKind: parseMediaKind(task.media_kind),
      maxResults: task.requested_results
    });

    await recordMediaEvent(supabase, task.id, "media_search_completed", "Media search returned results", {
      result_count: results.length
    });

    await supabase.from("media_results").delete().eq("media_task_id", task.id);

    const inserts: MediaResultInsert[] = results.map((result, index) => ({
      media_task_id: task.id,
      position: index + 1,
      title: result.title,
      source_url: result.sourceUrl,
      media_url: result.mediaUrl,
      thumbnail_url: result.thumbnailUrl,
      source_domain: result.sourceDomain,
      source_type: result.sourceType,
      media_kind: result.mediaKind,
      description: result.description,
      published_at: result.publishedAt,
      relevance_score: result.relevanceScore,
      license_note: result.licenseNote
    }));

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("media_results").insert(inserts);

      if (insertError) {
        throw insertError;
      }
    }

    const now = new Date().toISOString();

    await updateMediaTask(supabase, task.id, {
      status: "completed",
      successful_results: inserts.length,
      failed_results: 0,
      completed_at: now
    });

    await recordMediaEvent(supabase, task.id, "media_task_completed", "Media task completed", {
      successful_results: inserts.length
    });

    return { taskId: task.id, successfulResults: inserts.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await updateMediaTask(supabase, task.id, {
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString()
    });

    await recordMediaEvent(supabase, task.id, "media_task_failed", "Media task failed", {
      error: message
    });

    throw error;
  }
}

export async function recordMediaEvent(
  supabase: AppSupabaseClient,
  taskId: string,
  eventType: string,
  message?: string,
  metadata: Json = {}
) {
  const { error } = await supabase.from("media_task_events").insert({
    media_task_id: taskId,
    event_type: eventType,
    message: message ?? null,
    metadata
  });

  if (error) {
    console.error("Failed to record media event", error);
  }
}

async function updateMediaTask(
  supabase: AppSupabaseClient,
  taskId: string,
  patch: Database["public"]["Tables"]["media_tasks"]["Update"]
) {
  const { data, error } = await supabase
    .from("media_tasks")
    .update(patch)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function parseSourceMode(value: string): MediaSourceMode {
  if (value === "news" || value === "youtube" || value === "x" || value === "official") {
    return value;
  }

  return "all";
}

function parseMediaKind(value: string): MediaKind {
  if (value === "images" || value === "videos") {
    return value;
  }

  return "both";
}
