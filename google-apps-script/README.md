# Google Apps Script setup

1. Open the Google Sheet converted from `Data for UR analysis B (students).xlsx`.
2. Go to Extensions > Apps Script.
3. Paste `Code.gs` into the script editor.
4. Deploy > New deployment > Web app.
5. Execute as: Me.
6. Who has access: Anyone.
7. Copy the Web app `/exec` URL.
8. Paste it into `web-html/app-config.js` as `googleSheetWebAppUrl`.

This 2.0 version creates and uses these sheets automatically:

- `Fieldwork accounts`: pre-set student identities and passcodes. Edit the names and passcodes before the fieldwork day. The starter login for `第1組・成員1` is `G1M1-2026`; the teacher passcode is `teacher-2026`.
- `Group data`: one shared latest record per group, zone and task. All group members can read it after login.
- `Group data history`: every update, including who changed it and when.

Only the teacher dashboard can export data or clear all records. Student phones save group data directly to the shared data sheet and refresh their group data every 15 seconds.

When you have pasted the new `Code.gs`, choose **Deploy > Manage deployments > Edit**, create a **new version**, and deploy it again. The existing `/exec` URL can remain the same.

Teacher export writes to:

- `Submissions`: full raw records for backup.
- `Part 1 Building`: building average by zone and group.
- `Part 2 Sustainability`: environment, social-cultural and socioeconomic scores by zone and group.
- `Part 2 Shop style`: shop-type counts by zone and group.
