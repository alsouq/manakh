"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

let singleton: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client (anon key + the signed-in user's session; RLS enforced). */
export function supabaseBrowser() {
  if (!singleton) singleton = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return singleton;
}
