import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type AppSupabaseClient = SupabaseClient<Database, "public">;

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function createSupabaseServerClient(): Promise<AppSupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies; middleware refreshes them.
          }
        }
      }
    }
  ) as unknown as AppSupabaseClient;
}

export function createServiceRoleClient(): AppSupabaseClient {
  return createClient<Database>(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  ) as AppSupabaseClient;
}
