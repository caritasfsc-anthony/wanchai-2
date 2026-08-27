import { Link } from "react-router-dom";
import { Page } from "@/components/FieldworkShell";
import { zones, type ZoneId } from "@/data/fieldwork";
import { useLanguage } from "@/i18n/LanguageContext";

const taskKeys = ["building", "environment", "social-cultural", "economic", "shop-tally"];

function isZoneComplete(zoneId: ZoneId): boolean {
  if (typeof window === "undefined") return false;
  try {
    const completed = JSON.parse(localStorage.getItem("fieldwork_completed") || "{}");
    return taskKeys.every((task) =>
      Boolean(completed[`${zoneId}_${task}`]) ||
      localStorage.getItem(`fieldwork_zone_${zoneId}_${task}_submitted`) === "true"
    );
  } catch {
    return false;
  }
}

export default function ZoneMapPage(){
  const {t}=useLanguage();

  return <Page>
    {/* @section: manual-zone-selection */}
    <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
      <p className="text-sm opacity-90">{t("currentZone")}</p>
      <h1 className="text-3xl font-black">{t("chooseAnyZone")}</h1>
      <p className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
        {t("openZone")}
      </p>
    </section>

    {/* @section: collected-data-entry */}
    <Link to="/data" className="field-card mt-5 flex min-h-[64px] items-center justify-between border-primary bg-primary/5">
      <div><h2 className="text-lg font-black text-primary">{t("collectedData")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("dataTableIntro")}</p></div><span className="ml-3 text-2xl text-primary">→</span>
    </Link>

    {/* @section: accessible-zone-grid */}
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {Object.values(zones).map(z=>{
        const zoneComplete=isZoneComplete(z.id);
        return <Link key={z.id} to={`/zone/${z.id}`} className="field-card border-primary transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 text-xl font-bold leading-snug text-primary">{t(z.nameKey)}</h2>
            <span className="inline-flex min-h-[44px] min-w-[64px] flex-shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-accent px-4 py-1 text-sm font-semibold">{zoneComplete?t("completed"):t("open")}</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t("openZone")}</p>
        </Link>;
      })}
    </div>
  </Page>;
}
