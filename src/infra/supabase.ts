import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}

export function persistenceMode(): "supabase" | "memoria" {
  return supabase() ? "supabase" : "memoria";
}

export function productionDatabaseUnavailable(): boolean {
  return process.env.NODE_ENV === "production" && !supabase();
}
