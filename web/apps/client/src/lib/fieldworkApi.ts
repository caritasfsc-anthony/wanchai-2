import { setAuthToken, clearAuthToken, getAuthToken } from "@/lib/auth";
import { tasks, type ZoneId } from "@/data/fieldwork";

export type Role = "student" | "teacher";
export type FieldworkSubmission = { id: string; studentId: string; zone: ZoneId; type: string; data: Record<string, unknown>; submittedAt: string; studentName?: string; groupNumber?: string; memberNumber?: number };
type RuntimeConfig = { googleSheetWebAppUrl?: string; fieldworkSheetUrl?: string; apiBaseUrl?: string };
type Session = { role: Role; groupNumber: number; memberNumber: number; name: string; expiresAt: number };
declare global { interface Window { __SKYBASE_APP_CONFIG__?: RuntimeConfig; } }

const SUBMISSIONS_KEY = "fieldwork_static_submissions";
const PHOTOS_KEY = "fieldwork_static_photos";
const SESSION_KEY = "fieldwork_group_session";
const PENDING_SUBMISSIONS_KEY = "fieldwork_pending_submissions";
const GROUP_COUNT = 8;
const MEMBER_COUNT = 5;
type PendingSubmission = { id: string; groupNumber: number; zone: ZoneId; type: string; data: unknown; queuedAt: string; attempts: number };
let pendingSyncTimer: number | undefined;
let pendingSyncRunning = false;

export function setRole(role: Role) { localStorage.setItem("fieldwork_role", role); }
export function getRole(): Role | null { return localStorage.getItem("fieldwork_role") as Role | null; }
export function logout() { clearAuthToken(); localStorage.removeItem("fieldwork_role"); localStorage.removeItem(SESSION_KEY); }
export function hasToken() { return Boolean(getAuthToken()); }
function session(): Session | null { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "") as Session; } catch { return null; } }
function currentStudentId() { const value = session(); return value?.role === "student" ? `group-${value.groupNumber}-member-${value.memberNumber}` : ""; }
function groupNumberFromSession() { const value = session(); return value?.groupNumber ? `Group ${value.groupNumber}` : ""; }
function studentNameFromSession() { return session()?.name || ""; }
export function identityLabel(lang: "zh" | "en" = "zh") { const value = session(); if (!value || value.role !== "student") return ""; return lang === "zh" ? `第${value.groupNumber}組・${value.name || `成員${value.memberNumber}`}` : `Group ${value.groupNumber} · ${value.name || `Member ${value.memberNumber}`}`; }

export const apiTypeForTask = (task: string) => task === "building" ? "building-scores" : task === "economic" ? "socioeconomic" : task;
export const taskForApiType = (type: string) => type === "building-scores" ? "building" : type === "socioeconomic" ? "economic" : type;
export const storageKey = (zone: ZoneId, task: string) => `fieldwork_zone_${zone}_${task}`;
const activeStorageKey = (zone: ZoneId, task: string) => `fieldwork_group_${groupNumberFromSession().replace(/\D/g, "") || "local"}_zone_${zone}_${task}`;
const metaKey = (key: string) => `${key}_meta`;
function readMetaUpdatedAt(key: string) { try { return Number(JSON.parse(localStorage.getItem(metaKey(key)) || "{}").updatedAt || 0); } catch { return 0; } }
function writeDraft(key: string, data: unknown, updatedAt = Date.now()) { localStorage.setItem(key, JSON.stringify(data)); localStorage.setItem(metaKey(key), JSON.stringify({ updatedAt })); }
function readJson<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; } }
function writeJson(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); }
function allSubmissions() { return readJson<FieldworkSubmission[]>(SUBMISSIONS_KEY, []); }

function endpoint() { const url = (window.__SKYBASE_APP_CONFIG__?.googleSheetWebAppUrl || window.__SKYBASE_APP_CONFIG__?.fieldworkSheetUrl || "").trim(); if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(url)) throw new Error("Google Sheet endpoint is not configured. Please set googleSheetWebAppUrl in app-config.js."); return url; }
function requestId() { return `fieldworkJsonp${Date.now()}${Math.random().toString(36).slice(2)}`; }
async function remoteRead<T>(params: Record<string, string | number>) {
  const callback = requestId(); const url = new URL(endpoint()); Object.entries({ ...params, callback }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("同步服務暫時沒有回應。")), 12000);
    const script = document.createElement("script");
    const finish = (error?: Error, result?: T) => { window.clearTimeout(timeout); script.remove(); delete (window as any)[callback]; error ? reject(error) : resolve(result as T); };
    (window as any)[callback] = (result: any) => { if (result?.ok === false) finish(new Error(result.error || "同步失敗")); else finish(undefined, result?.result ?? result); };
    script.onerror = () => finish(new Error("未能連接同步服務。")); script.src = url.toString(); document.head.appendChild(script);
  });
}
async function remoteWrite(payload: Record<string, unknown>) {
  // Apps Script does not expose CORS response headers.  A resolved no-cors request
  // only means the browser handed it off, so every write is confirmed by a later read.
  await fetch(endpoint(), { method: "POST", mode: "no-cors", cache: "no-store", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
}
function authPayload() { const token = getAuthToken(); if (!token) throw new Error("登入已過期，請重新登入"); return { token }; }

function pendingSubmissions() { return readJson<PendingSubmission[]>(PENDING_SUBMISSIONS_KEY, []); }
function savePendingSubmissions(items: PendingSubmission[]) { writeJson(PENDING_SUBMISSIONS_KEY, items); }
function queueSubmission(zone: ZoneId, type: string, data: unknown) {
  const s = session(); if (!s || s.role !== "student") throw new Error("登入已過期，請重新登入");
  const id = `group-${s.groupNumber}-${zone}-${type}`;
  const item: PendingSubmission = { id, groupNumber: s.groupNumber, zone, type, data, queuedAt: new Date().toISOString(), attempts: 0 };
  // A newer edit to the same group task replaces the older item, while unrelated work stays queued.
  savePendingSubmissions([item, ...pendingSubmissions().filter(existing => existing.id !== id)]);
  return item;
}
function sameData(left: unknown, right: unknown) { try { return JSON.stringify(left) === JSON.stringify(right); } catch { return false; } }
function wait(ms: number) { return new Promise<void>(resolve => window.setTimeout(resolve, ms)); }
async function sendAndConfirm(item: PendingSubmission) {
  await remoteWrite({ action: "submit-group", ...authPayload(), zone: item.zone, type: item.type, data: item.data });
  await wait(700);
  const result = await remoteRead<{ submissions: any[] }>({ action: "group-data", ...authPayload() });
  return (result.submissions || []).some(raw => raw.zone === item.zone && raw.type === item.type && sameData(raw.data || {}, item.data));
}
export async function syncPendingSubmissions() {
  const s = session(); const pendingForCurrentGroup = pendingSubmissions().filter(item => item.groupNumber === s?.groupNumber);
  if (pendingSyncRunning || !navigator.onLine || !pendingForCurrentGroup.length) return false;
  pendingSyncRunning = true;
  try {
    // Work one item at a time so a busy Google Sheet never receives competing writes from this phone.
    const next = pendingForCurrentGroup[0];
    try {
      const confirmed = await sendAndConfirm(next);
      const current = pendingSubmissions();
      savePendingSubmissions(confirmed ? current.filter(item => item.id !== next.id) : current.map(item => item.id === next.id ? { ...item, attempts: item.attempts + 1 } : item));
      if (confirmed) window.dispatchEvent(new Event("fieldwork-submitted"));
      return confirmed;
    } catch {
      savePendingSubmissions(pendingSubmissions().map(item => item.id === next.id ? { ...item, attempts: item.attempts + 1 } : item));
      return false;
    }
  } finally { pendingSyncRunning = false; }
}
function startPendingSync() {
  if (pendingSyncTimer !== undefined) return;
  const run = () => { void syncPendingSubmissions(); };
  window.addEventListener("online", run);
  pendingSyncTimer = window.setInterval(run, 10000);
  run();
}
if (typeof window !== "undefined" && session()?.role === "student") startPendingSync();

export async function studentLogin(groupNumber: number, memberNumber: number) {
  const result = await remoteRead<{ token: string; session: Session }>({ action: "login", role: "student", groupNumber, memberNumber });
  setAuthToken(result.token); setRole("student"); localStorage.setItem(SESSION_KEY, JSON.stringify(result.session)); startPendingSync(); return { token: result.token, student: { id: `group-${result.session.groupNumber}-member-${result.session.memberNumber}`, name: result.session.name, groupNumber: `Group ${result.session.groupNumber}`, memberNumber: result.session.memberNumber } };
}
export async function teacherLogin(_username: string, password: string) {
  const result = await remoteRead<{ token: string; session: Session }>({ action: "login", role: "teacher", passcode: password });
  setAuthToken(result.token); setRole("teacher"); localStorage.setItem(SESSION_KEY, JSON.stringify(result.session)); return { token: result.token, teacher: { username: result.session.name } };
}

function normalize(raw: any): FieldworkSubmission { return { ...raw, studentId: raw.studentId || `group-${String(raw.groupNumber || "").replace(/\D/g, "")}`, data: raw.data || {}, groupNumber: raw.groupNumber || groupNumberFromSession() }; }
function cache(records: FieldworkSubmission[]) { writeJson(SUBMISSIONS_KEY, records); }
function clearLocalGroupData() { const group = groupNumberFromSession().replace(/\D/g, ""); const keys: string[] = []; for (let index = 0; index < localStorage.length; index += 1) { const key = localStorage.key(index); if (key && (key.startsWith(`fieldwork_group_${group}_`) || key.startsWith("fieldwork_zone_") || key === "fieldwork_completed" || key === SUBMISSIONS_KEY)) keys.push(key); } keys.forEach(key => localStorage.removeItem(key)); }
export async function getMySubmissions() { const result = await remoteRead<{ submissions: any[] }>({ action: "group-data", ...authPayload() }); const submissions = (result.submissions || []).map(normalize).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)); if (!submissions.length) clearLocalGroupData(); cache(submissions); const latestByTask: Record<string, FieldworkSubmission> = {}; for (const item of submissions) latestByTask[`${item.zone}_${item.type}`] ??= item; return { submissions, latestByTask }; }
export function hydrateSubmissions(submissions: FieldworkSubmission[]) { const completed = JSON.parse(localStorage.getItem("fieldwork_completed") || "{}"); for (const submission of submissions) { const task = taskForApiType(submission.type); const payload = submission.data ?? {}; const formData = task === "building" ? payload.buildings : task === "environment" ? payload.scores : task === "social-cultural" ? payload.items : task === "economic" ? payload.prices : payload; const key = activeStorageKey(submission.zone, task); const serverTime = new Date(submission.submittedAt).getTime() || 0; if (formData !== undefined && readMetaUpdatedAt(key) <= serverTime) writeDraft(key, formData, serverTime); completed[`${submission.zone}_${task}`] = true; localStorage.setItem(`fieldwork_zone_${submission.zone}_${task}_submitted`, "true"); } localStorage.setItem("fieldwork_completed", JSON.stringify(completed)); window.dispatchEvent(new Event("fieldwork-submitted")); }
export async function submitData(zone: ZoneId, type: string, data: unknown) {
  const apiType = apiTypeForTask(type); const s = session(); if (!s || s.role !== "student") throw new Error("登入已過期，請重新登入");
  const record: FieldworkSubmission = { id: `group-${s.groupNumber}-${zone}-${apiType}`, studentId: currentStudentId(), zone, type: apiType, data: (data ?? {}) as Record<string, unknown>, submittedAt: new Date().toISOString(), studentName: s.name, groupNumber: `Group ${s.groupNumber}`, memberNumber: s.memberNumber };
  queueSubmission(zone, apiType, data);
  const confirmed = await syncPendingSubmissions();
  if (!confirmed) throw new Error("同步服務暫時沒有確認收到資料");
  const others = allSubmissions().filter(item => item.id !== record.id); cache([record, ...others]); return { submission: record };
}

export async function exportGroupDataToGoogleSheet() { const result = await remoteRead<{ count: number }>({ action: "export", ...authPayload() }); return { count: result.count || 0 }; }
export async function clearAllFieldworkData() { return remoteRead<{ cleared: boolean }>({ action: "clear-all", ...authPayload() }); }
export type FieldworkRevision = FieldworkSubmission & { submissionId: string; revisedAt: string };
export async function getGroups() { const { submissions } = await getTeacherSubmissions(); const groups = Array.from({ length: GROUP_COUNT }, (_, index) => { const groupNumber = `Group ${index + 1}`; const groupSubs = submissions.filter(s => s.groupNumber === groupNumber); const matrix: Record<string, Record<string, boolean>> = {}; for (const zone of ["A", "B", "C", "D"]) { matrix[zone] = {}; for (const task of tasks) matrix[zone][apiTypeForTask(task.path)] = groupSubs.some(s => s.zone === zone && s.type === apiTypeForTask(task.path)); } return { studentId: `group-${index + 1}`, groupNumber, name: "共用資料", matrix, zones: matrix, lastActive: groupSubs[0]?.submittedAt ?? "" }; }); return { groups }; }
export async function getTeacherSubmissions() { const result = await remoteRead<{ submissions: any[] }>({ action: "teacher-data", ...authPayload() }); return { submissions: (result.submissions || []).map(normalize).sort((a: FieldworkSubmission, b: FieldworkSubmission) => b.submittedAt.localeCompare(a.submittedAt)) }; }
export async function getTeacherSubmissionHistory(id: string) { const current = (await getTeacherSubmissions()).submissions.find(item => item.id === id); return { revisions: current ? [{ ...current, submissionId: current.id, revisedAt: current.submittedAt }] : [] }; }
export async function deleteTeacherSubmission() { throw new Error("2.0 不提供逐項刪除；請在教師頁使用「清空本次資料」。"); }
export function saveLocal(zone: ZoneId, task: string, data: unknown) { writeDraft(activeStorageKey(zone, task), data); return true; }
export function loadLocal<T>(zone: ZoneId, task: string, fallback: T): T { return readJson(activeStorageKey(zone, task), fallback); }
export function hasLocalDraft(zone: ZoneId, task: string) { return localStorage.getItem(activeStorageKey(zone, task)) !== null; }

export type FieldworkPhoto = { id: string; zone: string; promptKey: string; downloadUrl: string; groupNumber: string; studentName: string; uploadedAt: string };
function allPhotos() { return readJson<FieldworkPhoto[]>(PHOTOS_KEY, []); }
function fileToDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
export async function uploadPhoto(zone: ZoneId, promptKey: string, file: File): Promise<FieldworkPhoto> { const item: FieldworkPhoto = { id: `${currentStudentId()}-${zone}-${promptKey}-${Date.now()}`, zone, promptKey, downloadUrl: await fileToDataUrl(file), groupNumber: groupNumberFromSession(), studentName: studentNameFromSession(), uploadedAt: new Date().toISOString() }; writeJson(PHOTOS_KEY, [item, ...allPhotos().filter(p => !(p.zone === zone && p.promptKey === promptKey && p.groupNumber === item.groupNumber))]); return item; }
export async function getMyPhotos(zone: ZoneId) { return allPhotos().filter(p => p.zone === zone && p.groupNumber === groupNumberFromSession()); }
export async function getTeacherPhotos(zone?: string, group?: string) { return allPhotos().filter(p => (!zone || p.zone === zone) && (!group || p.groupNumber === group)); }
