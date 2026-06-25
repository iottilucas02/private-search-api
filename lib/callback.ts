import { createHmac } from "node:crypto";

import type { Database } from "@/types/database";

type SearchTask = Database["public"]["Tables"]["search_tasks"]["Row"];
type FinalReport = Database["public"]["Tables"]["final_reports"]["Row"] | null;
type SearchResult = Database["public"]["Tables"]["search_results"]["Row"];
type SafeSearchTask = Omit<SearchTask, "callback_secret">;

type CallbackPayload = {
  task: SafeSearchTask;
  results: SearchResult[];
  final_report: FinalReport;
};

export async function sendTaskCallback(
  callbackUrl: string,
  callbackSecret: string,
  payload: CallbackPayload
) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", callbackSecret).update(body).digest("hex");

  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-search-task-id": payload.task.id,
      "x-search-signature": signature
    },
    body
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Callback failed: ${response.status} ${responseBody}`);
  }
}
