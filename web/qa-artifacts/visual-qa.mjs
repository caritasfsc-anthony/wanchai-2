import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const baseURL = 'http://127.0.0.1:3100';
const outDir = 'qa-artifacts/visual-qa';
await fs.mkdir(outDir, { recursive: true });
const results = [];

const now = new Date().toISOString();
const submissionId = 'sub-env-a-g1m1';
const sampleGroups = [
  { studentId:'group-1-member-1', groupNumber:'1', name:'Group 1 – Member 1 / 第1組－成員1', zones:{A:true,B:false,C:false,D:false}, matrix:{A:{'building-scores':true,environment:true,'social-cultural':true,socioeconomic:true,'shop-tally':true},B:{'building-scores':false,environment:false,'social-cultural':false,socioeconomic:false,'shop-tally':false},C:{},D:{}}, lastActive: now },
  { studentId:'group-2-member-3', groupNumber:'2', name:'Group 2 – Member 3 / 第2組－成員3', zones:{A:true,B:true,C:false,D:false}, matrix:{A:{'building-scores':true,environment:false,'social-cultural':true,socioeconomic:false,'shop-tally':true},B:{'building-scores':true,environment:true,'social-cultural':false,socioeconomic:false,'shop-tally':false},C:{},D:{}}, lastActive: now },
];
const envData = { scores: { air:10, noise:7, hw:4, wind:10, green:7, cleanliness:4 }, total:42, average:7 };
const longSocialData = { items: { education:{count:2,description:'Library, school, after-school activity centre. 圖書館、學校、課後活動中心。'}, medical:{count:1,description:'Clinic with bilingual signage. 診所設有中英雙語標示。'}, arts:{count:3,description:'Community murals, small gallery, heritage display with lengthy descriptive notes to test wrapping and history scrolling. 社區壁畫、小型畫廊、歷史展示，加入較長描述以測試換行及歷史捲動。'.repeat(6)}, publicSpace:{count:2,description:'Pocket park and shaded seating.'}, historic:{count:4,description:'Declared monument and graded buildings nearby.'} }, total:12, score:10 };
const submissions = [
  { id: submissionId, studentId:'group-1-member-1', studentName:'Group 1 – Member 1 / 第1組－成員1', groupNumber:'1', zone:'A', type:'environment', data: envData, submittedAt: now },
  { id:'sub-social-long', studentId:'group-2-member-3', studentName:'Group 2 – Member 3 / 第2組－成員3', groupNumber:'2', zone:'B', type:'social-cultural', data: longSocialData, submittedAt: now }
];
const revisions = Array.from({length:5}, (_,i)=>({ id:`rev-${i+1}`, submissionId, studentId:'group-1-member-1', studentName:'Group 1 – Member 1 / 第1組－成員1', groupNumber:'1', zone:'A', type:'environment', data:{ scores:{ air:10-i, noise:7, hw:4, wind:10, green:7, cleanliness:i }, total:38+i, average:6.3+i/10 }, revisedAt:new Date(Date.now()-i*60000).toISOString() }));

async function setupPage(context) {
  const page = await context.newPage();
  const logs = [];
  page.on('console', msg => { if (['error','warning'].includes(msg.type())) logs.push({type: msg.type(), text: msg.text()}); });
  page.on('pageerror', err => logs.push({type:'pageerror', text: err.message}));
  await page.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const ok = data => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ ok:true, data }) });
    const fail = (status=500, message='mock failure') => route.fulfill({ status, contentType:'application/json', body: JSON.stringify({ ok:false, error:{ message } }) });
    if (path.includes('/fieldwork-auth/student-login')) return ok({ token:'student-token', student:{ id:'group-1-member-1', name:'Group 1 – Member 1', nameZh:'第1組－成員1', groupNumber:'1', memberNumber:1 }});
    if (path.includes('/fieldwork-auth/teacher-login')) return ok({ token:'teacher-token', teacher:{ id:'teacher-default', username:'teacher' }});
    if (path.includes('/submissions/my')) return ok({ submissions:[], latestByTask:{} });
    if (path.includes('/submissions/environment')) {
      const body = req.postDataJSON?.() || {};
      if (body?.data?.forceFail) return fail(503, 'forced pending state');
      return ok({ submission: submissions[0] });
    }
    if (path.includes('/teacher/groups')) return ok({ groups: sampleGroups });
    if (path.includes('/teacher/submissions/') && path.endsWith('/history')) return ok({ revisions });
    if (path.includes('/teacher/submissions')) return ok({ submissions });
    if (path.includes('/teacher/photos')) return ok({ photos: [] });
    return ok({});
  });
  return { page, logs };
}

async function injectAuth(page, role='student') {
  await page.goto(baseURL + '/', { waitUntil:'domcontentloaded' });
  await page.evaluate(({role}) => { localStorage.setItem('fieldwork_role', role); localStorage.setItem('better-auth-token', role+'-token'); if(role==='student') localStorage.setItem('fieldwork_student_id','group-1-member-1'); }, {role});
}
async function screenshot(page, name) { const p = `${outDir}/${name}.png`; await page.screenshot({ path:p, fullPage:true }); return p; }
async function visibleText(page, re) { return await page.getByText(re).first().isVisible().catch(()=>false); }
async function minControlSize(page) { return await page.evaluate(() => Array.from(document.querySelectorAll('button,input,select,textarea')).map(el => { const r=el.getBoundingClientRect(); return { tag:el.tagName, text:(el.textContent||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'').trim().slice(0,60), width:Math.round(r.width), height:Math.round(r.height), ok:r.height>=44 || ['TEXTAREA'].includes(el.tagName) }; }).filter(x => x.width>0 && x.height>0)); }
async function addResult(name, page, logs, extra={}) { const controls = await minControlSize(page); results.push({ name, url: page.url(), title: await page.title().catch(()=>''), consoleIssues: logs, smallControls: controls.filter(c=>!c.ok), ...extra }); }

const browser = await chromium.launch({ headless:true });
try {
  for (const vp of [{name:'mobile', width:390, height:844}, {name:'desktop', width:1366, height:900}]) {
    const context = await browser.newContext({ viewport:{width:vp.width,height:vp.height}, deviceScaleFactor:1 });
    let {page, logs} = await setupPage(context);
    await injectAuth(page,'student');
    await page.goto(`${baseURL}/zone/A/task/environment`, { waitUntil:'networkidle' });
    await page.waitForTimeout(300);
    const noDraftShot = await screenshot(page, `${vp.name}-student-no-draft-idle`);
    const idleSeen = await visibleText(page, /No local draft yet|尚未有本機草稿|not edited/i);
    await addResult(`${vp.name} student no-draft idle`, page, logs, { screenshot:noDraftShot, idleSeen });

    await page.getByRole('button', { name:/0–25|0-25/ }).first().click();
    await page.waitForTimeout(100);
    const savingShot = await screenshot(page, `${vp.name}-student-autosave-saving`);
    const savingSeen = await visibleText(page, /Saving|儲存中|保存中/i);
    await page.waitForTimeout(900);
    const savedShot = await screenshot(page, `${vp.name}-student-autosave-saved`);
    const savedSeen = await visibleText(page, /Saved|已儲存|已保存/i);
    await addResult(`${vp.name} student autosave saving/saved`, page, logs, { screenshot:savedShot, interimScreenshot:savingShot, savingSeen, savedSeen });

    await page.reload({ waitUntil:'networkidle' });
    const restoredShot = await screenshot(page, `${vp.name}-student-restored`);
    const restoredSeen = await visibleText(page, /Restored|已恢復|已還原/i);
    await addResult(`${vp.name} student restored draft`, page, logs, { screenshot:restoredShot, restoredSeen });

    await page.evaluate(() => { const orig = window.fetch.bind(window); window.fetch = (input, init) => { if (String(input).includes('/api/submissions/environment')) return Promise.resolve(new Response(JSON.stringify({ok:false,error:{message:'forced pending state'}}), {status:503, headers:{'content-type':'application/json'}})); return orig(input, init); }; });
    await page.getByRole('button', { name:/Submit|提交/ }).click();
    await page.waitForTimeout(500);
    const pendingShot = await screenshot(page, `${vp.name}-student-pending-failure`);
    const pendingSeen = await visibleText(page, /Pending|待同步|failed|失敗|稍後/i);
    await addResult(`${vp.name} student pending after server failure`, page, logs, { screenshot:pendingShot, pendingSeen });
    await context.close();
  }

  for (const vp of [{name:'mobile', width:390, height:844}, {name:'desktop', width:1366, height:900}]) {
    const context = await browser.newContext({ viewport:{width:vp.width,height:vp.height}, deviceScaleFactor:1 });
    let {page, logs} = await setupPage(context);
    await injectAuth(page,'teacher');
    await page.goto(`${baseURL}/teacher`, { waitUntil:'networkidle' });
    await page.waitForTimeout(500);
    const overviewShot = await screenshot(page, `${vp.name}-teacher-overview-matrix`);
    const legendSeen = await visibleText(page, /Task legend|任務圖例|1.*Building|1.*建築/i);
    const matrixInfo = await page.evaluate(() => ({ zoneHeaders: Array.from(document.querySelectorAll('th')).map(th=>th.textContent?.trim()).filter(t=>t?.includes('Zone')), numberedCells: Array.from(document.querySelectorAll('[aria-label^="Zone"] span')).map(s=>s.textContent?.trim()).slice(0,20) }));
    await addResult(`${vp.name} teacher overview matrix`, page, logs, { screenshot:overviewShot, legendSeen, matrixInfo });

    await page.getByRole('button', { name:/Submissions|提交|紀錄/i }).click();
    await page.waitForTimeout(300);
    const dataShot = await screenshot(page, `${vp.name}-teacher-data-filters`);
    const exportSeen = await visibleText(page, /Export|匯出|CSV/i);
    const filterCounts = await page.locator('select').count();
    await page.getByRole('button', { name:/View history|檢視歷史|查看歷史/i }).first().click();
    await page.waitForTimeout(500);
    const historyShot = await screenshot(page, `${vp.name}-teacher-revision-history`);
    const historyInfo = await page.evaluate(() => { const box = document.querySelector('.max-h-72.overflow-y-auto'); if (!box) return null; return { clientHeight: box.clientHeight, scrollHeight: box.scrollHeight, canScroll: box.scrollHeight > box.clientHeight, text: box.textContent?.slice(0,300) }; });
    await addResult(`${vp.name} teacher data/history`, page, logs, { screenshot:historyShot, dataScreenshot:dataShot, exportSeen, filterCounts, historyInfo });
    await context.close();
  }
} finally { await browser.close(); }

await fs.writeFile(`${outDir}/qa-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ outDir, results }, null, 2));
