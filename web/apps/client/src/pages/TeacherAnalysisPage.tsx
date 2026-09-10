import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/components/FieldworkShell";
import { getTeacherSubmissions, type FieldworkSubmission } from "@/lib/fieldworkApi";

export const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1bQ9ZaepwZOcjbuY9Kv5ANebK66S2x1L2beDL_PzPMjs/edit";
const groups = Array.from({ length: 8 }, (_, i) => i + 1);
const zones = ["A", "B", "C", "D"];
const metrics = [
  ["住宅樓宇外觀評分", "building-scores", "average"],
  ["環境可持續性", "environment", "average"],
  ["社會文化", "social-cultural", "score"],
  ["社會經濟可持續性", "socioeconomic", "index"],
];
const shops = [["fashionable", "時尚店舖"], ["chain", "連鎖店舖"], ["traditional", "傳統店舖"], ["vacant", "空置店舖"]];
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value); return Number.isFinite(result) ? result : null;
}
function display(value: number | null) { return value === null ? "—" : value.toLocaleString("zh-HK", { maximumFractionDigits: 2 }); }

export default function TeacherAnalysisPage() {
  const [records, setRecords] = useState<FieldworkSubmission[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [updated, setUpdated] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true, running = false;
    async function refresh() {
      if (running) return; running = true;
      if (active) setBusy(true);
      try {
        const result = await getTeacherSubmissions();
        if (active) { setRecords(result.submissions); setUpdated(new Date().toLocaleTimeString("zh-HK")); setError(""); }
      } catch (err) { if (active) setError(err instanceof Error ? err.message : "讀取失敗，請重試。"); }
      finally { running = false; if (active) setBusy(false); }
    }
    void refresh(); const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [reload]);
  function value(group: number, zone: string, type: string, field: string, count = false) {
    const submission = records.find(s => Number(String(s.groupNumber).match(/\d+/)?.[0]) === group && s.zone === zone && s.type === type);
    const data = submission?.data as Record<string, any> | undefined;
    return numeric(count ? data?.counts?.[field] : data?.[field]);
  }
  function table(rows: { label: string; values: (number | null)[] }[]) {
    return <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[780px] text-sm"><thead><tr className="bg-primary/10"><th className="p-3 text-left">街區／類別</th>{groups.map(g => <th className="p-3" key={g}>第{g}組</th>)}<th className="p-3">已填組別平均</th></tr></thead><tbody>{rows.map(row => {
      const present = row.values.filter((n): n is number => n !== null);
      return <tr key={row.label} className="border-b"><th className="p-3 text-left">{row.label}</th>{row.values.map((n, i) => <td key={i} className="p-3 text-center tabular-nums">{display(n)}</td>)}<td className="p-3 text-center font-bold text-primary">{display(present.length ? present.reduce((a,b) => a+b,0) / present.length : null)}</td></tr>;
    })}</tbody></table></div>;
  }
  return <Page>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black text-primary">學生數據分析</h1><div className="flex flex-wrap gap-2"><Link className="secondary-btn" to="/teacher">返回教師儀表板</Link><a className="secondary-btn" href={GOOGLE_SHEET_URL} target="_blank" rel="noopener noreferrer">查看 Google Sheet</a><button className="primary-btn" disabled={busy} onClick={() => setReload(n => n+1)}>{busy ? "讀取中…" : "更新資料"}</button></div></div>
    <p className="my-4 text-sm">資料來源：Firebase，每 15 秒更新。下表對應 Google Sheet 的分析輸入數值；Google Sheet 只在老師送出後更新。最後成功讀取：{updated || "尚未讀取"}。</p>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error} 以下如有資料，為上次成功讀取的版本。</p>}
    {!busy && !records.length && !error && <p className="field-card">目前沒有學生資料。</p>}
    <p className="mb-4 text-sm text-muted-foreground">「—」代表未填寫，0 為已填寫零值。平均只計算已填組別，不把未填當作零；此平均欄為網頁摘要。</p>
    {metrics.map(([label, type, field]) => <section key={type} className="field-card mb-5"><h2 className="text-xl font-bold text-primary">{label}</h2>{table(zones.map(zone => ({ label: `街區 ${zone}`, values: groups.map(g => value(g, zone, type, field)) })))}</section>)}
    <section className="field-card"><h2 className="text-xl font-bold text-primary">地舖格調統計</h2>{zones.map(zone => <div key={zone} className="mt-5"><h3 className="font-bold">街區 {zone}</h3>{table(shops.map(([key, label]) => ({ label, values: groups.map(g => value(g, zone, "shop-tally", key, true)) })))}</div>)}</section>
  </Page>;
}
