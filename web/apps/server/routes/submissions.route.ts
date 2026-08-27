import { Hono, type Context } from "hono";
import { z } from "zod";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { listStudentSubmissions, saveSubmission, verifyFieldworkToken } from "../services/fieldwork";
import { env } from "../_core/env";

export const submissionsRouter = new Hono();
const PayloadSchema = z.object({ zone: z.enum(["A", "B", "C", "D"]), data: z.unknown() });
const routes = [
  ["/building-scores", "building-scores"],
  ["/environment", "environment"],
  ["/social-cultural", "social-cultural"],
  ["/socioeconomic", "socioeconomic"],
  ["/shop-tally", "shop-tally"]
] as const;

async function student(c: Context) {
  const token = await verifyFieldworkToken(c.req.header("Authorization"));
  if (!token || token.role !== "student") return null;
  return token;
}

function fireSheetWebhook(payload: Record<string, unknown>) {
  // Set GOOGLE_SHEET_WEBHOOK_URL in the project environment settings panel.
  // See GOOGLE_APPS_SCRIPT.js at project root for setup instructions.
  const url = env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) {
    console.warn("[GoogleSheet] GOOGLE_SHEET_WEBHOOK_URL not configured — skipping sheet sync");
    return;
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch((err: Error) => {
    console.warn("[GoogleSheet] webhook failed:", err.message);
  });
}

for (const [path, type] of routes) {
  submissionsRouter.post(path, async (c) => {
    const token = await student(c);
    if (!token) return c.json(apiFailure("UNAUTHORIZED", "Student login required"), 401);
    const parsed = PayloadSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json(apiFailure("INVALID_INPUT", "Zone and data are required"), 400);
    const submission = await saveSubmission(token.sub, parsed.data.zone, type, parsed.data.data);
    // Fire-and-forget to Google Sheets
    fireSheetWebhook({
      submissionId: submission.id,
      studentName: token.name ?? "",
      groupNumber: token.groupNumber ?? "",
      zone: parsed.data.zone,
      type,
      data: parsed.data.data,
      submittedAt: new Date().toISOString()
    });
    return c.json(apiSuccess({ submission }), 200);
  });
}

submissionsRouter.get("/my", async (c) => {
  const token = await student(c);
  if (!token) return c.json(apiFailure("UNAUTHORIZED", "Student login required"), 401);
  const rows = await listStudentSubmissions(token.sub);
  const normalized = rows.map((row) => ({ ...row, data: JSON.parse(row.dataJson) }));
  const latestByTask = Object.fromEntries(normalized.map((row) => [`${row.zone}:${row.type}`, row]));
  return c.json(apiSuccess({ submissions: normalized, latestByTask }), 200);
});
