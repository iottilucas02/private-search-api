import { createHash, randomBytes } from "node:crypto";

import { HttpError } from "@/lib/http-error";
import { createServiceRoleClient, type AppSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type ApiKeyRow = Database["public"]["Tables"]["api_keys"]["Row"];

export function generatePlainApiKey() {
  return `sk_search_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function getApiKeyFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = request.headers.get("x-api-key");
  const apiKey = bearerToken ?? headerToken;

  if (!apiKey) {
    throw new HttpError(401, "Missing API key", "missing_api_key");
  }

  return apiKey.trim();
}

export async function authenticateApiKey(request: Request) {
  const plainKey = getApiKeyFromRequest(request);
  const keyHash = hashApiKey(plainKey);
  const supabase = createServiceRoleClient();

  const { data: apiKey, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("active", true)
    .is("revoked_at", null)
    .single();

  if (error || !apiKey) {
    throw new HttpError(401, "Invalid API key", "invalid_api_key");
  }

  await ensureApiKeyWithinLimits(supabase, apiKey);

  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id);

  return { apiKey, supabase };
}

export async function ensureApiKeyWithinLimits(
  supabase: AppSupabaseClient,
  apiKey: ApiKeyRow
) {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [minuteCount, dailyCount, monthlyCount] = await Promise.all([
    countTasksSince(supabase, apiKey.id, oneMinuteAgo),
    countTasksSince(supabase, apiKey.id, startOfDay.toISOString()),
    countTasksSince(supabase, apiKey.id, startOfMonth.toISOString())
  ]);

  if (minuteCount >= apiKey.requests_per_minute) {
    throw new HttpError(429, "Requests per minute limit exceeded", "rate_limit_minute");
  }

  if (dailyCount >= apiKey.daily_limit) {
    throw new HttpError(429, "Daily limit exceeded", "rate_limit_daily");
  }

  if (monthlyCount >= apiKey.monthly_limit) {
    throw new HttpError(429, "Monthly limit exceeded", "rate_limit_monthly");
  }
}

async function countTasksSince(
  supabase: AppSupabaseClient,
  apiKeyId: string,
  since: string
) {
  const { count, error } = await supabase
    .from("search_tasks")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gte("created_at", since);

  if (error) {
    throw new HttpError(500, "Unable to evaluate API key limits", "rate_limit_error");
  }

  return count ?? 0;
}
