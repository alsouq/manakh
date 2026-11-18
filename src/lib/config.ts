// Dual-mode: with Supabase env present the app runs in "cloud" mode (real auth + Postgres);
// without it, "demo" mode (the in-browser digital twin). Keeping both means the app always runs.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const isCloud = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const mode: "cloud" | "demo" = isCloud ? "cloud" : "demo";
