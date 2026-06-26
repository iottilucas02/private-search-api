import { createServiceRoleClient } from "@/lib/supabase";
import {
  getMetadata,
  getMetaString,
  groupTasksByVideoRequest,
  type SearchTaskRow,
  type VideoRequest
} from "@/lib/video-requests";
import type { Database } from "@/types/database";

type SearchResultRow = Database["public"]["Tables"]["search_results"]["Row"];

export type CreditsSource = {
  id: string;
  taskId: string;
  taskIndex: number;
  query: string;
  position: number;
  title: string;
  url: string;
  domain: string | null;
};

export type CreditsDocument = {
  request: VideoRequest;
  sources: CreditsSource[];
};

export async function getCreditsDocument(requestId: string): Promise<CreditsDocument | null> {
  const supabase = createServiceRoleClient();
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

  const request = groupTasksByVideoRequest(tasks)[0];
  const taskIds = request.tasks.map((task) => task.id);
  const results = await supabase
    .from("search_results")
    .select("*")
    .in("task_id", taskIds)
    .order("position", { ascending: true });

  if (results.error) throw results.error;

  return {
    request,
    sources: buildCreditsSources(request.tasks, results.data ?? [])
  };
}

function buildCreditsSources(tasks: SearchTaskRow[], results: SearchResultRow[]) {
  const taskIndexById = new Map(tasks.map((task, index) => [task.id, index]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const sources: CreditsSource[] = [];

  const orderedResults = [...results].sort((a, b) => {
    const aTaskIndex = taskIndexById.get(a.task_id) ?? 999;
    const bTaskIndex = taskIndexById.get(b.task_id) ?? 999;

    if (aTaskIndex !== bTaskIndex) return aTaskIndex - bTaskIndex;
    return a.position - b.position;
  });

  for (const result of orderedResults) {
    const normalizedUrl = normalizeSourceUrl(result.canonical_url ?? result.url);

    if (seen.has(normalizedUrl)) {
      continue;
    }

    const task = taskById.get(result.task_id);
    if (!task) continue;

    seen.add(normalizedUrl);
    sources.push({
      id: result.id,
      taskId: result.task_id,
      taskIndex: taskIndexById.get(result.task_id) ?? 0,
      query: task.query,
      position: result.position,
      title: result.title ?? result.domain ?? result.url,
      url: result.canonical_url ?? result.url,
      domain: result.domain
    });
  }

  return sources;
}

function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().toLowerCase().replace(/\/$/, "");
  }
}
