"use server";

import { revalidatePath } from "next/cache";

import { generatePlainApiKey, hashApiKey } from "@/lib/api-keys";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";

export type CreateApiKeyState = {
  key?: string;
  error?: string;
};

export async function createApiKey(
  _previousState: CreateApiKeyState,
  formData: FormData
): Promise<CreateApiKeyState> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const key = generatePlainApiKey();

  const name = String(formData.get("name") ?? "n8n").trim();
  const requestsPerMinute = clamp(Number(formData.get("requests_per_minute") ?? 20), 1, 500);
  const dailyLimit = clamp(Number(formData.get("daily_limit") ?? 1000), 1, 100000);
  const monthlyLimit = clamp(Number(formData.get("monthly_limit") ?? 10000), 1, 1000000);
  const maxResults = clamp(Number(formData.get("max_results_per_task") ?? 10), 1, 20);
  const scrapingEnabled = formData.get("scraping_enabled") === "on";

  if (!name) {
    return { error: "Informe um nome para a chave." };
  }

  const { error } = await supabase.from("api_keys").insert({
    user_id: user.id,
    name,
    key_hash: hashApiKey(key),
    prefix: key.slice(0, 18),
    requests_per_minute: requestsPerMinute,
    daily_limit: dailyLimit,
    monthly_limit: monthlyLimit,
    max_results_per_task: maxResults,
    scraping_enabled: scrapingEnabled
  });

  if (error) {
    return { error: "Nao foi possivel criar a chave." };
  }

  revalidatePath("/dashboard/api-keys");
  return { key };
}

export async function revokeApiKey(formData: FormData) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const keyId = String(formData.get("key_id") ?? "");

  if (!keyId) return;

  await supabase
    .from("api_keys")
    .update({
      active: false,
      revoked_at: new Date().toISOString()
    })
    .eq("id", keyId);

  revalidatePath("/dashboard/api-keys");
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
