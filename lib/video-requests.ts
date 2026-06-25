import type { Database, Json } from "@/types/database";

export type SearchTaskRow = Database["public"]["Tables"]["search_tasks"]["Row"];

export type VideoRequest = {
  id: string;
  title: string;
  context?: string;
  createdAt: string;
  tasks: SearchTaskRow[];
};

export function groupTasksByVideoRequest(tasks: SearchTaskRow[]) {
  const groups = new Map<string, VideoRequest>();

  for (const task of tasks) {
    const metadata = getMetadata(task.metadata);
    const id = getMetaString(metadata, "request_group_id") ?? task.id;
    const title = getMetaString(metadata, "video_title") ?? task.query;
    const context = getMetaString(metadata, "video_context");
    const createdAt = getMetaString(metadata, "request_created_at") ?? task.created_at;
    const existing = groups.get(id);

    if (existing) {
      existing.tasks.push(task);
      if (new Date(task.created_at).getTime() < new Date(existing.createdAt).getTime()) {
        existing.createdAt = task.created_at;
      }
      continue;
    }

    groups.set(id, {
      id,
      title,
      context,
      createdAt,
      tasks: [task]
    });
  }

  return Array.from(groups.values())
    .map((request) => ({
      ...request,
      tasks: request.tasks.sort((a, b) => {
        const aIndex = getMetaNumber(getMetadata(a.metadata), "row_index") ?? 999;
        const bIndex = getMetaNumber(getMetadata(b.metadata), "row_index") ?? 999;

        if (aIndex !== bIndex) return aIndex - bIndex;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
    }))
    .sort((a, b) => getNewestTaskTime(b) - getNewestTaskTime(a));
}

export function getRequestStats(request: VideoRequest) {
  const completed = request.tasks.filter((task) => task.status === "completed").length;
  const queued = request.tasks.filter((task) => task.status === "queued").length;
  const processing = request.tasks.filter((task) => task.status === "processing").length;
  const failed = request.tasks.filter((task) => task.status === "failed").length;
  const requestedResults = request.tasks.reduce((total, task) => total + task.requested_results, 0);
  const successfulResults = request.tasks.reduce((total, task) => total + task.successful_results, 0);

  return {
    completed,
    queued,
    processing,
    failed,
    requestedResults,
    successfulResults,
    allCompleted: completed === request.tasks.length
  };
}

export function getMetadata(metadata: Json): Record<string, Json | undefined> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata;
}

export function getMetaString(metadata: Record<string, Json | undefined>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function getMetaNumber(metadata: Record<string, Json | undefined>, key: string) {
  const value = metadata[key];
  return typeof value === "number" ? value : undefined;
}

export function getMetaStringArray(metadata: Record<string, Json | undefined>, key: string) {
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function formatSearchType(value: string) {
  if (value === "news") return "Notícias";
  if (value === "finance") return "Financeiro";
  return "Web";
}

function getNewestTaskTime(request: VideoRequest) {
  return Math.max(...request.tasks.map((task) => new Date(task.created_at).getTime()));
}
