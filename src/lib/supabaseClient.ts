import { createClient, SupabaseClient } from "@supabase/supabase-js";

type TokenGetter = () => Promise<string | null>;

let client: SupabaseClient | null | undefined;
let getToken: TokenGetter | null = null;

/** True when the Supabase project URL and anon key are configured in the environment. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Supplies the signed-in user's Clerk session token for database requests (null when signed out). */
export function setSupabaseTokenGetter(getter: TokenGetter | null): void {
  getToken = getter;
}

/**
 * Browser Supabase client used only as the database. Sign-in is handled by Clerk: each request
 * carries the Clerk session token, which Supabase verifies through its Clerk third-party auth
 * integration, so row-level security can restrict rows to their owner. Returns null when Supabase
 * is not configured, in which case analyses are not saved.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && anonKey
    ? createClient(url, anonKey, { accessToken: async () => (getToken ? await getToken() : null) })
    : null;
  return client;
}
