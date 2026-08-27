import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/components/FieldworkShell";
import { zones, type ZoneId } from "@/data/fieldwork";
import { useLanguage } from "@/i18n/LanguageContext";
import { apiTypeForTask, getMySubmissions } from "@/lib/fieldworkApi";

const taskKeys = ["building", "environment", "social-cultural", "economic", "shop-tally"];

export default function ZoneMapPage(){
  const {t}=useLanguage();
  const [completedZones, setCompletedZones] = useState<Record<ZoneId, boolean>>({ A: false, B: false, C: false, D: false });
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const { submissions } = await getMySubmissions();
        const next = (Object.keys(zones) as ZoneId[]).reduce((state, zoneId) => {
          state[zoneId] = taskKeys.every(task => submissions.some(item => item.zone === zoneId && item.type === apiTypeForTask(task)));
          return state;
        }, {} as Record<ZoneId, boolean>);
        if (active) setCompletedZones(next);
      } catch { if (active) setCompletedZones({ A: false, B: false, C: false, D: false }); }
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("fieldwork-submitted", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("fieldwork-submitted", refresh); };
  }, []);

  return <Page>
    {/* @section: collected-data-entry */}
    <Link to="/data" className="field-card mt-5 flex min-h-[64px] items-center justify-between border-primary bg-primary/5">
      <div><h2 className="text-lg font-black text-primary">{t("collectedData")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("dataTableIntro")}</p></div><span className="ml-3 text-2xl text-primary">→</span>
    </Link>

    {/* @section: accessible-zone-grid */}
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {Object.values(zones).map(z=>{
        const zoneComplete=completedZones[z.id];
        return <Link key={z.id} to={`/zone/${z.id}`} className="field-card border-primary transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 text-xl font-bold leading-snug text-primary">{t(z.nameKey)}</h2>
            <span className={`inline-flex min-h-[44px] min-w-[64px] flex-shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 py-1 text-sm font-semibold ${zoneComplete ? "bg-cyan-500 text-white" : "bg-accent"}`}>{zoneComplete?t("completed"):t("open")}</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t("openZone")}</p>
        </Link>;
      })}
    </div>
  </Page>;
}
