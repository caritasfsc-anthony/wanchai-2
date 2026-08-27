# 灣仔再生實地考察 2.0

GitHub Pages 測試版本。學生以預設的「第幾組・成員幾」及個人登入碼登入；同組資料會儲存在 Google Apps Script 所連接的 Google Sheet，並自動同步。

## 首次設定

1. 將 `google-apps-script/Code.gs` 貼入現有 Google Sheet 的 Apps Script，建立新版本並重新部署 Web App。
2. 保持 `apps/client/public/app-config.js` 的 `/exec` URL 為該部署網址。
3. 在首次登入後建立的 `Fieldwork accounts` 工作表中，填入學生姓名與登入碼。

預設測試登入碼：第 1 組・成員 1 是 `G1M1-2026`；教師密碼是 `teacher-2026`。請在正式使用前更改。
