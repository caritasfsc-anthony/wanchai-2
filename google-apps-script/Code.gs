const FIELDWORK_SPREADSHEET_ID = "1bQ9ZaepwZOcjbuY9Kv5ANebK66S2x1L2beDL_PzPMjs";
const GROUP_DATA_SHEET = "Group data";
const GROUP_HISTORY_SHEET = "Group data history";
const ACCOUNT_SHEET = "Fieldwork accounts";
const FIELDWORK_RAW_SHEET = "Submissions";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function doGet(e) {
  try { return jsonp_(handleRequest_(e && e.parameter ? e.parameter : {}), e && e.parameter && e.parameter.callback); }
  catch (error) { return jsonp_({ ok: false, error: String(error) }, e && e.parameter && e.parameter.callback); }
}
function doPost(e) {
  try { return json_({ ok: true, result: handleRequest_(JSON.parse((e && e.postData && e.postData.contents) || "{}")) }); }
  catch (error) { return json_({ ok: false, error: String(error) }); }
}
function handleRequest_(payload) {
  const action = String(payload.action || "legacy-submit");
  const ss = SpreadsheetApp.openById(FIELDWORK_SPREADSHEET_ID); ensureSheets_(ss);
  if (action === "login") return login_(ss, payload);
  if (action === "group-data") return groupData_(ss, requireSession_(payload));
  if (action === "teacher-data") return teacherData_(ss, requireTeacher_(payload));
  if (action === "submit-group") return saveGroupSubmission_(ss, requireSession_(payload), payload);
  if (action === "clear-all") return clearAll_(ss, requireTeacher_(payload));
  if (action === "export") return exportToAnalysis_(ss, requireTeacher_(payload));
  if (action === "legacy-submit") return legacySubmit_(ss, payload.submission || payload);
  throw new Error("Unknown action");
}
function ensureSheets_(ss) {
  const accounts = ss.getSheetByName(ACCOUNT_SHEET) || ss.insertSheet(ACCOUNT_SHEET);
  if (accounts.getLastRow() === 0) {
    accounts.appendRow(["groupNumber", "memberNumber", "studentName", "passcode", "role"]);
    const rows = [];
    for (let g = 1; g <= 8; g += 1) for (let m = 1; m <= 5; m += 1) rows.push([g, m, "成員" + m, "G" + g + "M" + m + "-2026", "student"]);
    rows.push(["", "", "Teacher", "teacher-2026", "teacher"]); accounts.getRange(2, 1, rows.length, rows[0].length).setValues(rows); accounts.setFrozenRows(1);
  }
  [[GROUP_DATA_SHEET, ["id", "groupNumber", "zone", "type", "dataJson", "updatedAt", "updatedBy", "memberNumber"]], [GROUP_HISTORY_SHEET, ["revisionId", "submissionId", "groupNumber", "zone", "type", "dataJson", "updatedAt", "updatedBy", "memberNumber"]]].forEach(function(entry) {
    const sheet = ss.getSheetByName(entry[0]) || ss.insertSheet(entry[0]); if (sheet.getLastRow() === 0) { sheet.appendRow(entry[1]); sheet.setFrozenRows(1); }
  });
}
function login_(ss, payload) {
  const role = String(payload.role || "student"); const rows = ss.getSheetByName(ACCOUNT_SHEET).getDataRange().getValues();
  const match = rows.slice(1).find(function(row) { return String(row[4]) === role && (role === "student" ? (Number(row[0]) === Number(payload.groupNumber) && Number(row[1]) === Number(payload.memberNumber)) : String(row[3]) === String(payload.passcode || "")); });
  if (!match) throw new Error("登入資料不正確");
  const session = { role: role, groupNumber: Number(match[0]) || 0, memberNumber: Number(match[1]) || 0, name: String(match[2]), expiresAt: Date.now() + SESSION_TTL_MS }; const token = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty("fieldwork-session-" + token, JSON.stringify(session)); return { token: token, session: session };
}
function requireSession_(payload) { const raw = PropertiesService.getScriptProperties().getProperty("fieldwork-session-" + String(payload.token || "")); if (!raw) throw new Error("登入已過期，請重新登入"); const session = JSON.parse(raw); if (Number(session.expiresAt) < Date.now()) throw new Error("登入已過期，請重新登入"); return session; }
function requireTeacher_(payload) { const session = requireSession_(payload); if (session.role !== "teacher") throw new Error("只限教師使用"); return session; }
function groupData_(ss, session) { const values = ss.getSheetByName(GROUP_DATA_SHEET).getDataRange().getValues().slice(1); return { groupNumber: session.groupNumber, submissions: values.filter(function(row) { return Number(row[1]) === session.groupNumber; }).map(normalizeSubmission_) }; }
function teacherData_(ss) { return { submissions: ss.getSheetByName(GROUP_DATA_SHEET).getDataRange().getValues().slice(1).map(normalizeSubmission_) }; }
function normalizeSubmission_(row) { return { id: row[0], groupNumber: "Group " + row[1], zone: row[2], type: row[3], data: JSON.parse(row[4] || "{}"), submittedAt: row[5], studentName: row[6], memberNumber: Number(row[7]) }; }
function saveGroupSubmission_(ss, session, payload) {
  if (session.role !== "student") throw new Error("只限學生提交"); const zone = String(payload.zone || "").toUpperCase(); const type = String(payload.type || ""); if (["A", "B", "C", "D"].indexOf(zone) === -1 || !type) throw new Error("資料不完整");
  const lock = LockService.getDocumentLock(); lock.waitLock(10000);
  try { const id = "group-" + session.groupNumber + "-" + zone + "-" + type; const dataJson = JSON.stringify(payload.data || {}); const now = new Date().toISOString(); const sheet = ss.getSheetByName(GROUP_DATA_SHEET); const values = sheet.getDataRange().getValues(); const rowNumber = values.findIndex(function(row, i) { return i > 0 && String(row[0]) === id; }); const row = [id, session.groupNumber, zone, type, dataJson, now, session.name, session.memberNumber];
    if (rowNumber > 0) sheet.getRange(rowNumber + 1, 1, 1, row.length).setValues([row]); else sheet.appendRow(row); ss.getSheetByName(GROUP_HISTORY_SHEET).appendRow([Utilities.getUuid(), id, session.groupNumber, zone, type, dataJson, now, session.name, session.memberNumber]); return { submission: normalizeSubmission_(row) };
  } finally { lock.releaseLock(); }
}
function clearAll_(ss) {
  [GROUP_DATA_SHEET, GROUP_HISTORY_SHEET, FIELDWORK_RAW_SHEET].forEach(function(name) { const sheet = ss.getSheetByName(name); if (sheet && sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1); });
  const building = ss.getSheetByName("Part 1 Building"); if (building) building.getRange("B6:I9").clearContent();
  const sustainability = ss.getSheetByName("Part 2 Sustainability"); if (sustainability) sustainability.getRange("C6:J23").clearContent();
  const shop = ss.getSheetByName("Part 2 Shop style"); if (shop) shop.getRange("C6:J33").clearContent();
  return { cleared: true };
}
function exportToAnalysis_(ss) { const values = ss.getSheetByName(GROUP_DATA_SHEET).getDataRange().getValues().slice(1).map(normalizeSubmission_); values.forEach(function(item) { appendRawSubmission_(ss, item); writeToAnalysisSheets_(ss, item); }); return { count: values.length }; }
function legacySubmit_(ss, submission) { if (!submission || !submission.id) throw new Error("Missing submission"); appendRawSubmission_(ss, submission); writeToAnalysisSheets_(ss, submission); return { id: submission.id }; }
function appendRawSubmission_(ss, s) { const sh = ss.getSheetByName(FIELDWORK_RAW_SHEET) || ss.insertSheet(FIELDWORK_RAW_SHEET); if (sh.getLastRow() === 0) sh.appendRow(["id", "submittedAt", "studentId", "groupNumber", "studentName", "zone", "type", "dataJson"]); const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat() : []; if (ids.indexOf(s.id) === -1) sh.appendRow([s.id, s.submittedAt || "", s.studentId || s.id, s.groupNumber || "", s.studentName || "", s.zone || "", s.type || "", JSON.stringify(s.data || {})]); }
function writeToAnalysisSheets_(ss, s) {
  const group = Number(String(s.groupNumber || "").match(/(\d+)/)?.[1]); const zone = String(s.zone || "").toUpperCase(); if (!group || !zone) return; const groupCol = group + 1; const zoneRows = { A: 6, B: 7, C: 8, D: 9 }; const sustainabilityRows = { environment: { A: 6, B: 7, C: 8, D: 9 }, "social-cultural": { A: 13, B: 14, C: 15, D: 16 }, socioeconomic: { A: 20, B: 21, C: 22, D: 23 } }; const shopRows = { A: 6, B: 14, C: 22, D: 30 };
  if (s.type === "building-scores") { const sh = ss.getSheetByName("Part 1 Building"); if (sh) sh.getRange(zoneRows[zone], groupCol).setValue(numberOrBlank_(s.data && s.data.average)); }
  if (sustainabilityRows[s.type]) { const sh = ss.getSheetByName("Part 2 Sustainability"); const value = s.type === "environment" ? s.data.average : s.type === "social-cultural" ? s.data.score : s.data.index; if (sh) sh.getRange(sustainabilityRows[s.type][zone], groupCol + 1).setValue(numberOrBlank_(value)); }
  if (s.type === "shop-tally") { const sh = ss.getSheetByName("Part 2 Shop style"); const counts = s.data.counts || {}; const offsets = { fashionable: 0, chain: 1, traditional: 2, vacant: 3 }; if (sh) Object.keys(offsets).forEach(function(key) { sh.getRange(shopRows[zone] + offsets[key], groupCol + 1).setValue(numberOrBlank_(counts[key])); }); }
}
function numberOrBlank_(value) { const number = Number(value); return Number.isFinite(number) ? number : ""; }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function jsonp_(data, callback) { const json = JSON.stringify(data); return ContentService.createTextOutput(callback ? String(callback).replace(/[^a-zA-Z0-9_$]/g, "") + "(" + json + ")" : json).setMimeType(ContentService.MimeType.JAVASCRIPT); }
