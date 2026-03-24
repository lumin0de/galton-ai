import { createClient, type SupabaseClient } from "@supabase/supabase-js"

function getDb(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, key).schema("galton")
}

let _db: SupabaseClient | null = null
export function db(): SupabaseClient {
  if (!_db) _db = getDb()
  return _db
}
