import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/components/FieldworkShell";
import { tasks, type ZoneId } from "@/data/fieldwork";
import { useLanguage } from "@/i18n/LanguageContext";
import { getMySubmissions, hydrateSubmissions, taskForApiType, type FieldworkSubmission } from "@/lib/fieldworkApi";
import { submissionFields } from "@/lib/submissionDisplay";

export default function CollectedDataPage() {
  const { t, lang } = useLanguage();
  const [rows, setRows] = useState<FieldworkSubmission[]>([]);
  const [zone, setZone] = useState("all");
  const [task, setTask] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { const data = await getMySubmissions(); hydrateSubmissions(data.submissions); setRows(data.submissions); }
    catch (err) { setError(err instanceof Error ? err.message : t("noData")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => rows.filter(r => (zone === "all" || r.zone === zone) && (task === "all" || taskForApiType(r.type) === task)), [rows, zone, task]);
  const taskLabel = (apiType: string) => { const path = taskForApiType(apiType); const item = tasks.find(x => x.path === path); return item ? t(item.key) : apiType; };

  return <Page>
    {/* @section: collected-data-heading */}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-black text-primary">{t("collectedData")}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("dataTableIntro")}</p></div><Link to="/map" className="secondary-btn min-h-[44px]">← {t("map")}</Link></div>
    {/* @section: collected-data-filters */}
    <section className="field-card mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="font-semibold">{t("filterZone")}<select className="field-input mt-1 min-h-[44px]" value={zone} onChange={e=>setZone(e.target.value)}><option value="all">{t("allZones")}</option>{(["A","B","C","D"] as ZoneId[]).map(z=><option key={z} value={z}>{t((`zone${z}`) as any)}</option>)}</select></label>
      <label className="font-semibold">{t("filterTask")}<select className="field-input mt-1 min-h-[44px]" value={task} onChange={e=>setTask(e.target.value)}><option value="all">{t("allTasks")}</option>{tasks.map(item=><option key={item.path} value={item.path}>{t(item.key)}</option>)}</select></label>
      <button className="secondary-btn min-h-[44px] self-end" type="button" onClick={load}>{t("refresh")}</button>
    </section>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    {loading ? <div className="field-card mt-4 text-center">{t("loadingData")}</div> : visible.length === 0 ? <div className="field-card mt-4 text-center text-muted-foreground">{t("noFilteredData")}</div> : <div className="mt-4 grid gap-4">{visible.map(row=>{ const fields = submissionFields(row.type, row.data, lang, t); return <article className="field-card" key={row.id}>
      {/* @section: localized-submission-card */}
      <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-primary">{lang === "zh" ? `街區 ${row.zone}` : `Zone ${row.zone}`}</b><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{taskLabel(row.type)}</span><Link to={`/zone/${row.zone}/task/${taskForApiType(row.type)}?edit=true`} className="secondary-btn min-h-[44px] px-3 text-sm">✎ {t("amendData")}</Link></div></div>
      <p className="mt-2 text-xs text-muted-foreground">{new Date(row.submittedAt).toLocaleString(lang === "zh" ? "zh-HK" : "en-HK")}</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-sm"><tbody>{fields.map(field=><tr key={field.label} className="border-t"><th className="w-2/5 bg-muted/40 p-3 text-left align-top font-semibold">{field.label}</th><td className="break-words p-3">{field.value}</td></tr>)}</tbody></table></div>
    </article>; })}</div>}
  </Page>;
}
