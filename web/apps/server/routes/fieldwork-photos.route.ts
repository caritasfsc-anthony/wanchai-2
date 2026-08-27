import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { getDb } from "../_core/db";
import { fieldworkPhotos } from "../db/schema";
import { StorageError, storagePut, storageErrorResponse } from "../services/s3_storage";
import { verifyFieldworkToken } from "../services/fieldwork";

export const fieldworkPhotosRouter = new Hono();
export const isPublic = false;

async function requireStudent(c: Context) {
  const token = await verifyFieldworkToken(c.req.header("Authorization"));
  if (!token || token.role !== "student") return null;
  return token;
}

// POST /api/fieldwork-photos/upload — multipart/form-data: file, zone, promptKey
fieldworkPhotosRouter.post("/upload", async (c) => {
  const token = await requireStudent(c);
  if (!token) return c.json(apiFailure("UNAUTHORIZED", "Student login required"), 401);

  let body: FormData;
  try {
    body = await c.req.formData();
  } catch {
    return c.json(apiFailure("INVALID_INPUT", "Expected multipart/form-data"), 400);
  }

  const file = body.get("file");
  const zone = body.get("zone");
  const promptKey = body.get("promptKey");

  if (!(file instanceof File)) return c.json(apiFailure("INVALID_INPUT", "File is required"), 400);
  if (typeof zone !== "string" || !["A", "B", "C", "D"].includes(zone)) return c.json(apiFailure("INVALID_INPUT", "Valid zone required"), 400);
  if (typeof promptKey !== "string" || !promptKey) return c.json(apiFailure("INVALID_INPUT", "promptKey required"), 400);

  const ext = file.name.split(".").pop() ?? "jpg";
  const relKey = `fieldwork/photos/${token.sub}/${zone}_${promptKey}_${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  let storedFile;
  try {
    storedFile = await storagePut(relKey, bytes, file.type, { userId: token.sub });
  } catch (err) {
    if (err instanceof StorageError) {
      const { body: errBody, status } = storageErrorResponse(err);
      return c.json(errBody, status);
    }
    throw err;
  }

  const db = getDb();
  const [photo] = await db.insert(fieldworkPhotos).values({
    studentId: token.sub,
    zone,
    promptKey,
    downloadUrl: storedFile.downloadUrl,
    storageFileId: storedFile.id,
  }).returning();

  return c.json(apiSuccess({
    id: photo.id,
    zone: photo.zone,
    promptKey: photo.promptKey,
    downloadUrl: photo.downloadUrl,
    groupNumber: token.groupNumber ?? "",
    studentName: token.name ?? "",
    uploadedAt: photo.uploadedAt
  }), 200);
});

// GET /api/fieldwork-photos/my?zone=A — student's own photos for a zone
fieldworkPhotosRouter.get("/my", async (c) => {
  const token = await requireStudent(c);
  if (!token) return c.json(apiFailure("UNAUTHORIZED", "Student login required"), 401);

  const zone = c.req.query("zone");
  const db = getDb();
  const rows = await db.select().from(fieldworkPhotos).where(eq(fieldworkPhotos.studentId, token.sub));
  const filtered = zone ? rows.filter(r => r.zone === zone) : rows;

  const photos = filtered.map(r => ({
    id: r.id,
    zone: r.zone,
    promptKey: r.promptKey,
    downloadUrl: r.downloadUrl,
    groupNumber: token.groupNumber ?? "",
    studentName: token.name ?? "",
    uploadedAt: r.uploadedAt
  }));

  return c.json(apiSuccess({ photos }), 200);
});

export default fieldworkPhotosRouter;
