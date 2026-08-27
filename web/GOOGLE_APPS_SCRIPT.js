/**
 * GOOGLE APPS SCRIPT — Wan Chai Fieldwork Data Receiver
 * =======================================================
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheets: https://docs.google.com/spreadsheets/d/1PSYsgMf2Yl9FY26JmIjtc8fGUWz1iq5BgdoaMLvpUac/edit
 * 2. Click Extensions → Apps Script
 * 3. Delete all existing code and paste the entire content of this file
 * 4. Click Save (Ctrl+S / Cmd+S)
 * 5. Click Deploy → New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone (required for webhook)
 * 6. Click Deploy → Copy the Web App URL
 * 7. In the Skywork project settings, add environment variable:
 *    GOOGLE_SHEET_WEBHOOK_URL = <paste the Web App URL here>
 * 8. Redeploy the Skywork app so the env var takes effect.
 *
 * SHEET STRUCTURE:
 * The script auto-creates sheets: Building_Scores, Environment, Social_Cultural, Economic, Shop_Tally, Photos, Raw
 * Each sheet gets headers on first use and new rows appended per submission.
 */

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Always append to Raw sheet for full audit trail
    appendToRaw(ss, payload);

    // Append to typed sheet
    const type = (payload.type || "").toLowerCase().replace(/-/g, "");
    if (type === "buildingscores") {
      appendBuilding(ss, payload);
    } else if (type === "environment") {
      appendEnvironment(ss, payload);
    } else if (type === "socialcultural") {
      appendSocial(ss, payload);
    } else if (type === "socioeconomic" || type === "economic") {
      appendEconomic(ss, payload);
    } else if (type === "shoptally") {
      appendShop(ss, payload);
    } else if (type === "photos") {
      appendPhotos(ss, payload);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#A22221").setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ts(payload) {
  return payload.submittedAt || new Date().toISOString();
}

function appendToRaw(ss, payload) {
  const sheet = getOrCreateSheet(ss, "Raw", ["submissionId","studentName","groupNumber","zone","type","data","submittedAt"]);
  sheet.appendRow([
    payload.submissionId || "",
    payload.studentName || "",
    payload.groupNumber || "",
    payload.zone || "",
    payload.type || "",
    JSON.stringify(payload.data || {}),
    ts(payload)
  ]);
}

function appendBuilding(ss, payload) {
  const headers = ["studentName","groupNumber","zone","submittedAt","B1","B2","B3","B4","B5","avg"];
  const sheet = getOrCreateSheet(ss, "Building_Scores", headers);
  const data = payload.data || {};
  const totals = data.totals || [0,0,0,0,0];
  const avg = data.average || 0;
  sheet.appendRow([
    payload.studentName, payload.groupNumber, payload.zone, ts(payload),
    totals[0]||0, totals[1]||0, totals[2]||0, totals[3]||0, totals[4]||0,
    Math.round(avg * 10) / 10
  ]);
}

function appendEnvironment(ss, payload) {
  const headers = ["studentName","groupNumber","zone","submittedAt","air","noise","hw","wind","green","cleanliness","total","average"];
  const sheet = getOrCreateSheet(ss, "Environment", headers);
  const d = (payload.data || {}).scores || {};
  sheet.appendRow([
    payload.studentName, payload.groupNumber, payload.zone, ts(payload),
    d.air||0, d.noise||0, d.hw||0, d.wind||0, d.green||0, d.cleanliness||0,
    (payload.data||{}).total||0,
    Math.round(((payload.data||{}).average||0)*10)/10
  ]);
}

function appendSocial(ss, payload) {
  const headers = ["studentName","groupNumber","zone","submittedAt","education","medical","arts","publicSpace","historic","total","score"];
  const sheet = getOrCreateSheet(ss, "Social_Cultural", headers);
  const items = (payload.data||{}).items || {};
  sheet.appendRow([
    payload.studentName, payload.groupNumber, payload.zone, ts(payload),
    (items.education||{}).count||0,
    (items.medical||{}).count||0,
    (items.arts||{}).count||0,
    (items.publicSpace||{}).count||0,
    (items.historic||{}).count||0,
    (payload.data||{}).total||0,
    (payload.data||{}).score||0
  ]);
}

function appendEconomic(ss, payload) {
  const headers = ["studentName","groupNumber","zone","submittedAt","bread_avg","lunch_avg","haircut_avg","zone_avg","affordability"];
  const sheet = getOrCreateSheet(ss, "Economic", headers);
  const avgs = (payload.data||{}).averages || [0,0,0];
  sheet.appendRow([
    payload.studentName, payload.groupNumber, payload.zone, ts(payload),
    Math.round(avgs[0]*10)/10,
    Math.round(avgs[1]*10)/10,
    Math.round(avgs[2]*10)/10,
    Math.round(((payload.data||{}).zoneAverage||0)*10)/10,
    (payload.data||{}).index||0
  ]);
}

function appendShop(ss, payload) {
  const headers = ["studentName","groupNumber","zone","submittedAt","fashionable","chain","traditional","vacant","total","grade"];
  const sheet = getOrCreateSheet(ss, "Shop_Tally", headers);
  const counts = (payload.data||{}).counts || {};
  sheet.appendRow([
    payload.studentName, payload.groupNumber, payload.zone, ts(payload),
    counts.fashionable||0, counts.chain||0, counts.traditional||0, counts.vacant||0,
    (payload.data||{}).total||0,
    (payload.data||{}).grade||""
  ]);
}

function appendPhotos(ss, payload) {
  const headers = ["timestamp","studentName","groupNumber","zone","promptIndex","fileUrl"];
  const sheet = getOrCreateSheet(ss, "Photos", headers);
  const data = payload.data || {};
  sheet.appendRow([
    ts(payload),
    payload.studentName || "",
    payload.groupNumber || "",
    payload.zone || "",
    data.promptIndex || data.promptKey || "",
    data.fileUrl || data.downloadUrl || ""
  ]);
}
