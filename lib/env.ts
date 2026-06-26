type EnvName =
  | "NEXT_PUBLIC_APP_URL"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "TRIGGER_SECRET_KEY"
  | "TAVILY_API_KEY"
  | "FIRECRAWL_API_KEY"
  | "GOOGLE_SERVICE_ACCOUNT_EMAIL"
  | "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
  | "GOOGLE_SERVICE_ACCOUNT_JSON"
  | "GOOGLE_DRIVE_FOLDER_ID"
  | "NEXT_PUBLIC_ENABLE_MEDIA_SEARCH"
  | "SENTRY_DSN";

export function getEnv(name: EnvName): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function getOptionalEnv(name: EnvName): string | undefined {
  return process.env[name];
}

export function getAppUrl() {
  return getOptionalEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
}

export function isMediaSearchEnabled() {
  return getOptionalEnv("NEXT_PUBLIC_ENABLE_MEDIA_SEARCH") === "true";
}
