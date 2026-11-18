"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages, Moon, Sun } from "lucide-react";
import { store, useStore } from "@/lib/store";
import { isCloud } from "@/lib/config";
import { Logo, useApplyDocPrefs } from "@/components/AppShell";
import { Button, Field, IconButton, Input } from "@/components/ui";

export default function LoginPage() {
  const s = useStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  useEffect(() => store.init(), []);
  useApplyDocPrefs();
  useEffect(() => {
    if (!isCloud && s.ready && s.s.user) router.replace("/");
  }, [s.ready, s.s.user, router]);
  const t = s.t;
  const dark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    if (!isCloud) {
      s.login(name, email);
      router.replace("/");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { supabaseBrowser } = await import("@/lib/supabase/client");
      const sb = supabaseBrowser();
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({
          email,
          password: pw,
          options: { data: { name }, emailRedirectTo: `${location.origin}/auth/confirm` },
        });
        if (error) throw error;
        const { data } = await sb.auth.getSession();
        if (data.session) {
          window.location.href = "/";
        } else {
          setMsg({ text: t("login.checkEmail"), ok: true });
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        window.location.href = "/";
      }
    } catch (err) {
      setMsg({ text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-semibold">{t("app.name")}</span>
          </div>
          <div className="flex gap-1">
            <IconButton label={t("top.lang")} onClick={() => s.setLang(s.s.lang === "ar" ? "en" : "ar")}>
              <Languages size={18} />
            </IconButton>
            <IconButton label={t("top.theme")} onClick={() => s.setTheme(dark ? "light" : "dark")}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{isCloud && mode === "signup" ? t("login.signup") : t("login.title")}</h1>
          <p className="mt-1.5 text-sm text-ink-2">{t("login.subtitle")}</p>
          <form className="mt-8 space-y-4" onSubmit={submit}>
            {(!isCloud || mode === "signup") && (
              <Field label={t("login.name")}>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            <Field label={t("login.email")}>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" />
            </Field>
            <Field label={t("login.password")}>
              <Input type="password" required={isCloud} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} dir="ltr" />
            </Field>
            {msg && <p className={`rounded-xl px-3 py-2 text-[13px] ${msg.ok ? "bg-brand-soft text-good-ink" : "bg-critical-soft text-critical"}`}>{msg.text}</p>}
            <Button variant="primary" className="w-full" type="submit" disabled={busy}>
              {busy ? "…" : isCloud && mode === "signup" ? t("login.signup") : t("login.submit")}
            </Button>
          </form>
          {isCloud ? (
            <button className="mt-4 text-[13px] text-brand hover:underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}>
              {mode === "signin" ? t("login.toSignup") : t("login.toSignin")}
            </button>
          ) : (
            <p className="mt-6 rounded-xl bg-brand-soft px-3 py-2.5 text-[13px] text-ink-2">{t("login.demo")}</p>
          )}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-soft lg:block">
        <LoginArt />
      </div>
    </div>
  );
}

function LoginArt() {
  return (
    <svg viewBox="0 0 600 700" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="lg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-soft)" />
          <stop offset="1" stopColor="var(--surface)" />
        </linearGradient>
      </defs>
      <rect width="600" height="700" fill="url(#lg-sky)" />
      <circle cx="450" cy="170" r="60" fill="var(--s4)" opacity="0.85" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${60 + i * 120} 360)`}>
          <path d="M0 140 V60 L60 0 L120 60 V140 Z" fill="var(--glass)" stroke="var(--brand)" strokeWidth="2" opacity="0.9" />
          {[0, 1, 2].map((r) => (
            <rect key={r} x={14 + r * 34} y={95} width="22" height="45" rx="8" fill="var(--plant)" opacity="0.85" />
          ))}
        </g>
      ))}
      <rect x="0" y="500" width="600" height="200" fill="var(--soil)" opacity="0.5" />
      <path d="M40 300 C 160 250, 280 330, 400 280 S 560 260, 600 300" fill="none" stroke="var(--brand)" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
