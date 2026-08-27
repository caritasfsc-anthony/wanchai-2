import { Hono, type Context } from "hono";
import { eq, desc } from "drizzle-orm";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { deleteSubmissionById, listAllSubmissions, listGroupStatus, listSubmissionHistory, verifyFieldworkToken } from "../services/fieldwork";
import { getDb } from "../_core/db";
import { fieldworkPhotos, students } from "../db/schema";

export const teacherRouter = new Hono();

async function requireTeacher(c: Context) {
  const token = await verifyFieldworkToken(c.req.header("Authorization"));
  if (!token || token.role !== "teacher") return null;
  return token;
}

teacherRouter.get("/groups", async (c) => {
  if (!(await requireTeacher(c))) return c.json(apiFailure("UNAUTHORIZED", "Teacher login required"), 401);
  return c.json(apiSuccess({ groups: await listGroupStatus() }), 200);
});

teacherRouter.get("/submissions", async (c) => {
  if (!(await requireTeacher(c))) return c.json(apiFailure("UNAUTHORIZED", "Teacher login required"), 401);
  return c.json(apiSuccess({ submissions: await listAllSubmissions() }), 200);
});

teacherRouter.get("/submissions/:id/history", async (c) => {
  if (!(await requireTeacher(c))) return c.json(apiFailure("UNAUTHORIZED", "Teacher login required"), 401);
  return c.json(apiSuccess({ revisions: await listSubmissionHistory(c.req.param("id")) }), 200);
});

teacherRouter.delete("/submissions/:id", async (c) => {
  if (!(await requireTeacher(c))) return c.json(apiFailure("UNAUTHORIZED", "Teacher login required"), 401);
  const deleted = await deleteSubmissionById(c.req.param("id"));
  if (!deleted) return c.json(apiFailure("NOT_FOUND", "Submission not found"), 404);
  return c.json(apiSuccess({ deletedId: deleted.id }), 200);
});

teacherRouter.get("/photos", async (c) => {
  if (!(await requireTeacher(c))) return c.json(apiFailure("UNAUTHORIZED", "Teacher login required"), 401);
  const zone = c.req.query("zone");
  const group = c.req.query("group");
  const db = getDb();

  // Join photos with students to get group info
  const allPhotos = await db.select({
    id: fieldworkPhotos.id,
    zone: fieldworkPhotos.zone,
    promptKey: fieldworkPhotos.promptKey,
    downloadUrl: fieldworkPhotos.downloadUrl,
    uploadedAt: fieldworkPhotos.uploadedAt,
    studentName: students.name,
    groupNumber: students.groupNumber,
  })
    .from(fieldworkPhotos)
    .innerJoin(students, eq(fieldworkPhotos.studentId, students.id))
    .orderBy(desc(fieldworkPhotos.uploadedAt));

  let filtered = allPhotos;
  if (zone) filtered = filtered.filter(p => p.zone === zone);
  if (group) filtered = filtered.filter(p => p.groupNumber === group);

  return c.json(apiSuccess({ photos: filtered }), 200);
});
