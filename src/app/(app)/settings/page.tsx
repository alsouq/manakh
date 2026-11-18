"use client";
import { useStore } from "@/lib/store";
import { SITE } from "@/sim/seed";
import { Button, Card, CardHeader, PageHeader, Segmented } from "@/components/ui";

export default function SettingsPage() {
  const s = useStore();
  const t = s.t;
  return (
    <div className="max-w-3xl">
      <PageHeader title={t("set.title")} />
      <div className="space-y-4">
        <Card>
          <CardHeader title={t("set.profile")} />
          <div className="px-4 pb-4 text-sm">
            <div className="font-medium text-ink">{s.s.user?.name}</div>
            <div className="text-muted" dir="ltr">
              {s.s.user?.email}
            </div>
          </div>
        </Card>
        <Card>
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">{t("set.language")}</span>
              <Segmented value={s.s.lang} onChange={(v) => s.setLang(v)} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">{t("set.theme")}</span>
              <Segmented
                value={s.s.theme}
                onChange={(v) => s.setTheme(v)}
                options={[
                  { value: "light", label: t("set.light") },
                  { value: "dark", label: t("set.dark") },
                  { value: "system", label: t("set.system") },
                ]}
              />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title={t("set.siteInfo")} />
          <dl className="num grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-4 pb-4 text-sm">
            <dt className="text-ink-2">{t("common.site")}</dt>
            <dd>{s.s.lang === "ar" ? SITE.nameAr : SITE.name}</dd>
            <dt className="text-ink-2">{t("set.location")}</dt>
            <dd>
              {SITE.geo.lat}, {SITE.geo.lon}
            </dd>
            <dt className="text-ink-2">{t("set.timezone")}</dt>
            <dd>{SITE.geo.tz}</dd>
          </dl>
        </Card>
        <Card>
          <CardHeader title={t("set.sim")} sub={t("set.simHint")} />
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4">
            <Segmented value={s.s.speed} onChange={(v) => s.setSpeed(v)} options={[1, 60, 600].map((v) => ({ value: v, label: `${v}×` }))} />
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm(t("set.resetConfirm"))) s.reset();
              }}
            >
              {t("set.reset")}
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title={t("set.about")} sub={t("set.aboutText")} />
          <div className="h-2" />
        </Card>
      </div>
    </div>
  );
}
