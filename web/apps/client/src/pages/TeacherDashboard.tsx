import { useEffect, useMemo, useState } from "react";
import { Page } from "@/components/FieldworkShell";
import { useLanguage } from "@/i18n/LanguageContext";
import { clearAllFieldworkData, exportGroupDataToGoogleSheet, groupsFromSubmissions, getTeacherSubmissionHistory, getTeacherSubmissions, taskForApiType, type FieldworkRevision } from "@/lib/fieldworkApi";
import { tasks } from "@/data/fieldwork";
import { submissionFields } from "@/lib/submissionDisplay";

const zones = ["A", "B", "C", "D"];
const apiTaskTypes = ["building-scores", "environment", "social-cultural", "socioeconomic", "shop-tally"];

function csvCell(value: string) { return `"${value.replace(/"/g, '""')}"`; }

export default function TeacherDashboard(){
  const {t, lang}=useLanguage();
  const [groups,setGroups]=useState<any[]>([]);
  const [subs,setSubs]=useState<any[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [activeTab, setActiveTab] = useState<"overview"|"data">("overview");
  const [filterZone, setFilterZone] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterTask, setFilterTask] = useState("");
  const [history, setHistory] = useState<Record<string, FieldworkRevision[]>>({});
  const [historyOpen, setHistoryOpen] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(){ const submissionData = await getTeacherSubmissions(); setGroups(groupsFromSubmissions(submissionData.submissions).groups); setSubs(submissionData.submissions); }
  async function refreshDashboard(){ setRefreshing(true); setError(""); try { await loadDashboard(); } catch (err) { setError(err instanceof Error ? err.message : t("noData")); } finally { setRefreshing(false); } }
  useEffect(()=>{ void refreshDashboard(); const timer=window.setInterval(()=>{ loadDashboard().catch(()=>{}); },15000); return()=>window.clearInterval(timer); },[]);

  const activeGroups = useMemo(()=>groups.filter(g=>zones.some(zone=>apiTaskTypes.some(type=>Boolean(g.matrix?.[zone]?.[type])))).length,[groups]);
  const completed=useMemo(()=>groups.reduce((total,g)=>total+zones.filter(zone=>apiTaskTypes.every(type=>Boolean(g.matrix?.[zone]?.[type]))).length,0),[groups]);
  const today=new Date().toISOString().slice(0,10);
  const allGroupNumbers = useMemo(()=>[...new Set(groups.map(g=>g.groupNumber))].sort(),[groups]);
  const taskLabel = (apiType: string) => { const path = taskForApiType(apiType); const item = tasks.find(x => x.path === path); return item ? t(item.key) : apiType; };
  const studentLabel = (s: any) => `${s.groupNumber ?? ""} · ${s.studentName ?? s.name ?? ""}`;

  const filteredSubmissions = useMemo(()=>subs
    .filter(s=>!selected||s.studentId===selected)
    .filter(s=>!filterZone||s.zone===filterZone)
    .filter(s=>!filterGroup||s.groupNumber===filterGroup)
    .filter(s=>!filterTask||s.type===filterTask),[subs,selected,filterZone,filterGroup,filterTask]);


  function exportCsv(){
    const header = [t("studentName"), t("groupNumber"), t("filterZone"), t("filterTask"), t("submittedAt"), t("dataDetails")];
    const rows = filteredSubmissions.map(s => [s.studentName ?? "", s.groupNumber ?? "", `Zone ${s.zone}`, taskLabel(s.type), new Date(s.submittedAt).toLocaleString(lang === "zh" ? "zh-HK" : "en-HK"), submissionFields(s.type, s.data, lang, t).map(f=>`${f.label}: ${f.value}`).join("; ")]);
    const csv = "\uFEFF" + [header, ...rows].map(row => row.map(cell => csvCell(String(cell))).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `wanchai-fieldwork-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  async function toggleHistory(submission: any){
    if(historyOpen===submission.id){ setHistoryOpen(""); return; }
    setHistoryOpen(submission.id); setError("");
    if(!history[submission.id]){ try{ const data=await getTeacherSubmissionHistory(submission.id); setHistory(prev=>({...prev,[submission.id]:data.revisions})); } catch(err){ setError(err instanceof Error ? err.message : t("noData")); } }
  }

  async function exportToSheet(){ setActionBusy("export"); setError(""); try { const result = await exportGroupDataToGoogleSheet(); window.alert(lang === "zh" ? `已送出 ${result.count} 項組別資料到 Google Sheet。` : `Sent ${result.count} group records to Google Sheet.`); } catch (err) { setError(err instanceof Error ? err.message : t("noData")); } finally { setActionBusy(""); } }
  async function clearAll(){ setConfirmClear(false); setActionBusy("clear"); setError(""); try { await clearAllFieldworkData(); await loadDashboard(); window.alert(lang === "zh" ? "已清空 Firebase 的本次考察資料。" : "Firebase fieldwork data have been cleared."); } catch (err) { setError(err instanceof Error ? err.message : t("noData")); } finally { setActionBusy(""); } }

  return <Page>
    {/* @section: teacher-dashboard-heading */}<div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black text-primary">{t("dashboard")}</h1><div className="flex flex-wrap gap-2"><button type="button" disabled={refreshing || Boolean(actionBusy)} onClick={refreshDashboard} className="secondary-btn min-h-[44px]">{refreshing ? "…" : (lang === "zh" ? "更新資料" : "Refresh data")}</button><button type="button" disabled={Boolean(actionBusy)} onClick={exportToSheet} className="primary-btn min-h-[44px]">{actionBusy === "export" ? "…" : (lang === "zh" ? "送出到 Google Sheet" : "Send to Google Sheet")}</button><button type="button" disabled={Boolean(actionBusy)} onClick={()=>setConfirmClear(true)} className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60">{actionBusy === "clear" ? "…" : (lang === "zh" ? "清除已有學生資料" : "Clear existing student data")}</button></div></div>
    <div className="mt-4 grid grid-cols-3 gap-2">{([[(lang === "zh" ? "已有資料小組" : "Groups with data"),activeGroups],[t("zonesCompleted"),completed],[t("submissionsToday"),subs.filter(s=>String(s.submittedAt).startsWith(today)).length]] as [string,number][]).map(([k,v])=><div className="field-card text-center" key={k}><p className="text-xs text-muted-foreground">{k}</p><b className="text-2xl text-primary">{v}</b></div>)}</div>
    <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">{([["overview",t("completionMatrix")],["data",t("submissions")]] as [string,string][]).map(([id,label])=><button key={id} onClick={()=>setActiveTab(id as any)} className={`min-h-[44px] rounded-xl py-2 text-sm font-semibold transition ${activeTab===id?"bg-white text-primary shadow-sm":"text-muted-foreground hover:text-foreground"}`}>{label}</button>)}</div>

    {activeTab==="overview" && <section className="mt-4 space-y-3">
      <div className="field-card bg-white/90"><p className="text-sm font-bold text-primary">{t("taskLegend")}</p><div className="mt-2 grid gap-1 text-xs sm:grid-cols-5">{apiTaskTypes.map((type,index)=><span key={type} className="rounded-lg bg-muted px-2 py-1"><b>{index+1}</b> · {taskLabel(type)}</span>)}</div></div>
      <div className="overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full min-w-[980px] text-xs"><thead className="bg-primary/10"><tr><th className="p-3 text-left font-semibold">{t("studentName")}</th>{zones.map(z=><th key={z} className="p-3 text-left font-semibold">Zone {z} · 1–5</th>)}<th className="p-3 text-left font-semibold">{t("lastActive")}</th></tr></thead><tbody>{groups.map(g=><tr key={g.studentId} className="border-t hover:bg-muted/50"><td className="p-3 font-semibold">{g.groupNumber} · {g.name}</td>{zones.map(z=><td className="p-2" key={z}><div className="grid grid-cols-5 gap-1" aria-label={`Zone ${z} completion`}>{apiTaskTypes.map((type,index)=><span key={type} title={`${index+1}. ${taskLabel(type)}`} className={`rounded px-1 py-1 text-center font-bold ${g.matrix?.[z]?.[type]?"bg-green-100 text-green-700":"bg-muted text-muted-foreground"}`}>{g.matrix?.[z]?.[type]?"✓":index+1}</span>)}</div></td>)}<td className="p-3 text-xs text-muted-foreground">{g.lastActive?.slice(0,16)}</td></tr>)}</tbody></table>
      </div>
    </section>}

    {activeTab==="data" && <section className="mt-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        <select className="field-input max-w-[180px] min-h-[44px]" value={selected??""} onChange={e=>setSelected(e.target.value||null)}><option value="">{t("allStudents")}</option>{groups.map(g=><option key={g.studentId} value={g.studentId}>{g.groupNumber} · {g.name}</option>)}</select>
        <select className="field-input max-w-[140px] min-h-[44px]" value={filterZone} onChange={e=>setFilterZone(e.target.value)}><option value="">{t("allZones")}</option>{zones.map(z=><option key={z} value={z}>Zone {z}</option>)}</select>
        <select className="field-input max-w-[160px] min-h-[44px]" value={filterGroup} onChange={e=>setFilterGroup(e.target.value)}><option value="">{t("allGroups")}</option>{allGroupNumbers.map(g=><option key={g} value={g}>{g}</option>)}</select>
        <select className="field-input max-w-[210px] min-h-[44px]" value={filterTask} onChange={e=>setFilterTask(e.target.value)}><option value="">{t("allTasks")}</option>{apiTaskTypes.map(type=><option key={type} value={type}>{taskLabel(type)}</option>)}</select>
        <button type="button" onClick={exportCsv} className="secondary-btn min-h-[44px]">{t("exportCsv")}</button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      {filteredSubmissions.slice(0,80).map(s=>{ const fields = submissionFields(s.type, s.data, lang, t); const revs=history[s.id]??[]; return <article key={s.id} className="field-card">
        <div className="flex flex-wrap justify-between gap-3 mb-2"><div><b className="text-primary">{studentLabel(s)}</b><p className="text-xs text-muted-foreground">Zone {s.zone} · {taskLabel(s.type)} · {new Date(s.submittedAt).toLocaleString(lang === "zh" ? "zh-HK" : "en-HK")}</p></div><div className="flex gap-2"><button type="button" onClick={()=>toggleHistory(s)} className="secondary-btn min-h-[44px] px-3 py-2 text-sm">{historyOpen===s.id?t("hideHistory"):t("viewHistory")}</button></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-sm"><tbody>{fields.map(field=><tr key={field.label} className="border-t"><th className="w-2/5 bg-muted/40 p-3 text-left align-top font-semibold">{field.label}</th><td className="break-words p-3">{field.value}</td></tr>)}</tbody></table></div>
        {historyOpen===s.id && <div className="mt-3 rounded-2xl border bg-muted/20 p-3"><h3 className="font-bold text-primary">{t("revisionHistory")}</h3>{!revs.length&&<p className="text-sm text-muted-foreground">{t("noData")}</p>}{revs.map((r,index)=><div key={r.id} className="mt-2 rounded-xl bg-white p-2 text-sm"><b>{t("revision")} {revs.length-index}</b><span className="ml-2 text-xs text-muted-foreground">{new Date(r.revisedAt).toLocaleString(lang === "zh" ? "zh-HK" : "en-HK")}</span><div className="mt-2 max-h-72 overflow-y-auto rounded-lg border bg-muted/20"><table className="w-full min-w-[520px] text-xs"><tbody>{submissionFields(r.type, r.data, lang, t).map(f=><tr key={f.label} className="border-t first:border-t-0"><th className="w-2/5 p-2 text-left align-top font-semibold">{f.label}</th><td className="break-words p-2">{f.value}</td></tr>)}</tbody></table></div></div>)}</div>}
      </article>; })}
      {!filteredSubmissions.length&&<p className="text-muted-foreground">{t("noFilteredData")}</p>}
    </section>}

    {confirmClear && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="clear-data-title">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="clear-data-title" className="text-xl font-black text-primary">{lang === "zh" ? "確定清除所有學生資料？" : "Clear all student data?"}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{lang === "zh" ? "此操作會永久清空 Firebase 內所有本次考察資料，不能復原。" : "This permanently clears all fieldwork data in Firebase and cannot be undone."}</p>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={()=>setConfirmClear(false)} className="secondary-btn min-h-[44px]">{lang === "zh" ? "否" : "No"}</button><button type="button" onClick={clearAll} className="min-h-[44px] rounded-xl bg-red-700 px-5 py-2 font-bold text-white hover:bg-red-800">{lang === "zh" ? "是" : "Yes"}</button></div>
      </section>
    </div>}
  </Page>;
}
