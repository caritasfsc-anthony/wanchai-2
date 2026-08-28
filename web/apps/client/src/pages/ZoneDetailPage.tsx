import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Page } from "@/components/FieldworkShell";
import { landmarks, tasks, zones, type Landmark, type ZoneId } from "@/data/fieldwork";
import { useLanguage } from "@/i18n/LanguageContext";
import { getMySubmissions, hydrateSubmissions } from "@/lib/fieldworkApi";
import { zoneBackgroundStyle } from "@/lib/submissionDisplay";

const ZoneLeafletMap = lazy(() => import("@/components/ZoneLeafletMap"));
const taskPathToStorageKey: Record<string, string> = { building: "building", environment: "environment", "social-cultural": "social-cultural", economic: "economic", "shop-tally": "shop-tally" };

function readTaskCompletion(zoneId: string): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  if (typeof window === "undefined") return state;
  try {
    const completed = JSON.parse(localStorage.getItem("fieldwork_completed") || "{}");
    tasks.forEach(task => { const key = taskPathToStorageKey[task.path] ?? task.path; state[task.path] = Boolean(completed[`${zoneId}_${key}`]) || localStorage.getItem(`fieldwork_zone_${zoneId}_${key}_submitted`) === "true"; });
  } catch { tasks.forEach(task => { state[task.path] = false; }); }
  return state;
}

function LandmarkCard({ landmark }: { landmark: Landmark }) {
  const { lang } = useLanguage();
  const [active, setActive] = useState(0);
  const zh = lang === "zh";
  const label = (z: string, e: string) => zh ? z : e;
  const images = landmark.images ?? [];
  return <article className="field-card overflow-hidden bg-white/95 p-0 shadow-lg backdrop-blur-sm">
    {/* @section: bilingual-landmark-gallery */}
    {images.length > 0 ? <div className="bg-neutral-100 p-2">
      <img src={images[active]} alt={`${landmark.titleZh} / ${landmark.titleEn}, ${active + 1}`} className="h-64 w-full rounded-xl object-contain md:h-80" />
      <div className="mt-2 grid grid-cols-2 gap-2">{images.map((src, i) => <button type="button" key={src} onClick={() => setActive(i)} className={`min-h-[72px] overflow-hidden rounded-xl border-2 ${active === i ? "border-primary" : "border-transparent"}`} aria-label={`${label("查看相片", "View photo")} ${i + 1}`}><img src={src} alt="" className="h-20 w-full object-contain bg-white" /></button>)}</div>
    </div> : <div className="grid h-40 place-items-center bg-neutral-100 p-4 text-center text-sm text-muted-foreground">{label("暫未提供參考相片，請參閱下方資料來源。", "Reference photo is not yet available. Please see the sources below.")}</div>}
    <div className="p-4">
      <div className="flex items-start justify-between gap-2"><h2 className="text-xl font-black text-primary">{label(landmark.titleZh, landmark.titleEn)}<span className="mt-1 block text-sm font-semibold text-muted-foreground">{label(landmark.titleEn, landmark.titleZh)}</span></h2>{landmark.built && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{landmark.built}</span>}</div>
      <p className="mt-3 text-sm"><b>{label("地址", "Address")}:</b> {label(landmark.addressZh, landmark.addressEn)}</p>
      <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><h3 className="text-sm font-bold text-amber-800">{label("歷史及保育價值", "Heritage value")}</h3><p className="mt-1 text-sm text-amber-950">{label(landmark.heritageZh, landmark.heritageEn)}</p></section>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{label(landmark.textZh, landmark.textEn)}</p>
      <section className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><h3 className="text-sm font-bold text-blue-800">{label("市區更新脈絡", "Urban-renewal context")}</h3><p className="mt-1 text-sm text-blue-950">{label(landmark.renewalZh, landmark.renewalEn)}</p></section>
      {landmark.currentUseEn && <p className="mt-3 text-sm"><b>{label("現時用途", "Current use")}:</b> {label(landmark.currentUseZh ?? "", landmark.currentUseEn)}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{landmark.references.map(ref => <a key={ref.url} href={ref.url} target="_blank" rel="noopener noreferrer" className="secondary-btn min-h-[44px] text-sm">{ref.label} ↗</a>)}</div>
    </div>
  </article>;
}

export default function ZoneDetailPage() {
  const { zoneId = "A" } = useParams();
  const zone = zones[zoneId as ZoneId] ?? zones.A;
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [tab, setTab] = useState("map");
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const refreshCompletedTasks = useCallback(() => setCompletedTasks(readTaskCompletion(zone.id)), [zone.id]);

  useEffect(() => {
    const syncGroupData = () => getMySubmissions().then(({ submissions }) => { hydrateSubmissions(submissions); refreshCompletedTasks(); }).catch(refreshCompletedTasks);
    syncGroupData();
    const timer = window.setInterval(syncGroupData, 15000);
    window.addEventListener("fieldwork-submitted", refreshCompletedTasks); window.addEventListener("storage", refreshCompletedTasks);
    return () => { window.clearInterval(timer); window.removeEventListener("fieldwork-submitted", refreshCompletedTasks); window.removeEventListener("storage", refreshCompletedTasks); };
  }, [refreshCompletedTasks]);

  return <Page className="bg-cover bg-fixed bg-center" style={zoneBackgroundStyle(zone.id)}>
    {/* @section: zone-context-background */}
    {/* @section: zone-detail-heading */}
    <button type="button" onClick={() => navigate("/map")} className="mb-2 min-h-[44px] text-sm font-semibold text-gray-600 hover:text-primary">← {t("map")}</button>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-black text-primary">{t(zone.nameKey)}</h1><Link to="/data" className="secondary-btn min-h-[44px]">{t("collectedData")}</Link></div>
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={lang === "zh" ? "切換考察街區" : "Switch fieldwork zone"}>{(Object.keys(zones) as ZoneId[]).map(id => <button key={id} type="button" onClick={() => navigate(`/zone/${id}`, { replace: true })} className={`min-h-[44px] min-w-12 rounded-full border px-4 py-2 text-sm font-bold ${id === zone.id ? "border-primary bg-primary text-white" : "border-primary bg-white text-primary"}`} aria-current={id === zone.id ? "page" : undefined}>{id}</button>)}</div>

    {tab === "map" && <div className="mt-4"><div className="field-card overflow-hidden bg-white/95 shadow-lg backdrop-blur-sm"><Suspense fallback={<div className="grid h-[360px] place-items-center text-muted-foreground">{t("loadingData")}</div>}><ZoneLeafletMap zoneId={zone.id} /></Suspense></div></div>}
    {tab === "tasks" && <div className="mt-4 grid gap-3">{tasks.map(task => { const done = Boolean(completedTasks[task.path]); return <Link className={`field-card flex min-h-[64px] items-center justify-between bg-white/95 shadow-lg backdrop-blur-sm ${done ? "border-green-200 bg-green-50" : ""}`} key={task.id} to={done ? `/zone/${zone.id}/task/${task.path}?review=true` : `/zone/${zone.id}/task/${task.path}`}><b>{t(task.key)}{done && <span className="ml-2 rounded-full bg-green-500 px-2 py-0.5 text-xs text-white">✓</span>}</b><span className={done ? "text-green-700" : "text-primary"}>{done ? t("completed") : "→"}</span></Link>; })}</div>}
    {tab === "info" && <div className="mt-4 grid gap-4">{landmarks[zone.id].map(l => <LandmarkCard landmark={l} key={l.titleEn} />)}</div>}

    {/* @section: zone-bottom-navigation */}
    <nav className="bottom-tabs">{[["map", "map"], ["tasks", "tasks"], ["info", "info"]].map(([id, key]) => <button key={id} onClick={() => setTab(id)} className={`tab-btn min-h-[44px] ${tab === id ? "tab-btn-active" : ""}`}>{t(key as any)}</button>)}</nav>
  </Page>;
}
