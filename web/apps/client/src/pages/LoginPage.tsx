import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { studentLogin } from "@/lib/fieldworkApi";
import { SchoolLogo } from "@/components/FieldworkShell";

export default function LoginPage() {
  const { t, lang, toggleLang } = useLanguage();
  const nav = useNavigate();
  const [groupNumber, setGroup] = useState(1);
  const [memberNumber, setMember] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await studentLogin(groupNumber, memberNumber);
      nav("/map");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  const identity = lang === "zh" ? `第${groupNumber}組－成員${memberNumber}` : `Group ${groupNumber} – Member ${memberNumber}`;

  return <div className="app-shell min-h-screen bg-cover bg-center bg-fixed p-4 text-slate-950" style={{ backgroundImage: "linear-gradient(rgba(248,250,247,.28), rgba(248,250,247,.38)), url('images/zone-b-background_2.png')" }}>
    {/* @section: worksheet-cover-login-layout */}
    <div className="mx-auto grid min-h-screen max-w-5xl items-center py-6 md:grid-cols-[1fr_420px] md:gap-8">
      {/* @section: cover-art-fidelity-panel */}
      <section className="hidden rounded-3xl bg-white/70 p-5 shadow-xl ring-1 ring-black/5 backdrop-blur-sm md:block">
        <img src="images/worksheet-cover-2026-page1.jpg" alt="2026–27 worksheet cover artwork" className="max-h-[78vh] w-full rounded-2xl object-contain" />
      </section>
      {/* @section: fixed-student-login-card */}
      <form onSubmit={submit} className="field-card w-full space-y-5 bg-white/92 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          {/* @section: student-login-logo-lockup */}
          <div className="max-w-[260px] rounded-2xl bg-white/90 p-2 shadow-sm ring-1 ring-primary/10"><SchoolLogo className="max-h-12" /></div>
          <button type="button" className="secondary-btn px-3" onClick={toggleLang}>{lang === "zh" ? "EN" : "中"}</button>
        </div>
        <div className="rounded-2xl bg-primary/95 p-5 text-primary-foreground"><h1 className="text-3xl font-black">{t("appTitle")}</h1><p>{t("subtitle")}</p></div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-primary">{t("fixedIdentityHint")}</p>
          <p className="mt-1 text-xl font-black">{identity}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="font-semibold">{t("groupNumber")}</span><select className="field-input mt-1 min-h-[44px]" value={groupNumber} onChange={e => setGroup(Number(e.target.value))}>{Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>{lang === "zh" ? `第${i + 1}組` : `Group ${i + 1}`}</option>)}</select></label>
          <label className="block"><span className="font-semibold">{t("memberNumber")}</span><select className="field-input mt-1 min-h-[44px]" value={memberNumber} onChange={e => setMember(Number(e.target.value))}>{Array.from({ length: 5 }, (_, i) => <option key={i + 1} value={i + 1}>{lang === "zh" ? `成員${i + 1}` : `Member ${i + 1}`}</option>)}</select></label>
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <button disabled={busy} className="primary-btn w-full min-h-[44px]">{busy ? t("loadingData") : t("startFieldwork")}</button>
        <Link className="block min-h-[44px] py-2 text-center font-semibold text-primary underline" to="/teacher-login">{t("teacherLogin")}</Link>
      </form>
    </div>
  </div>;
}
