import bcrypt from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { DatabaseError, executeSql, getDb } from "../_core/db";
import { env } from "../_core/env";
import { students, submissionRevisions, submissions, teachers } from "../db/schema";

export type TokenPayload = { role: "student" | "teacher"; sub: string; name?: string; nameZh?: string; groupNumber?: string; memberNumber?: number; username?: string; exp: number };
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
export const GROUP_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const MEMBER_NUMBERS = [1, 2, 3, 4, 5] as const;

function b64u(input: string) { return Buffer.from(input).toString("base64url"); }
function unb64u(input: string) { return Buffer.from(input, "base64url").toString("utf8"); }
function tokenSecret() { return env.BETTER_AUTH_SECRET; }
async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(tokenSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Buffer.from(sig).toString("base64url");
}

export async function createFieldworkToken(payload: Omit<TokenPayload, "exp">) {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }));
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${await hmac(unsigned)}`;
}

export async function verifyFieldworkToken(authorization?: string | null): Promise<TokenPayload | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const unsigned = `${parts[0]}.${parts[1]}`;
  if ((await hmac(unsigned)) !== parts[2]) return null;
  const payload = JSON.parse(unb64u(parts[1])) as TokenPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function fixedStudentIdentity(groupNumber: number, memberNumber: number) {
  if (!GROUP_NUMBERS.includes(groupNumber as (typeof GROUP_NUMBERS)[number]) || !MEMBER_NUMBERS.includes(memberNumber as (typeof MEMBER_NUMBERS)[number])) {
    throw new DatabaseError("DATABASE_QUERY_FAILED", "Group must be 1–8 and member must be 1–5", 400);
  }
  return { id: `group-${groupNumber}-member-${memberNumber}`, name: `Group ${groupNumber} – Member ${memberNumber}`, nameZh: `第${groupNumber}組－成員${memberNumber}`, groupNumber: String(groupNumber), memberNumber };
}

export async function studentLogin(input: { groupNumber: number; memberNumber: number }) {
  const identity = fixedStudentIdentity(input.groupNumber, input.memberNumber);
  const db = getDb();
  const existing = await db.select().from(students).where(eq(students.id, identity.id)).limit(1);
  const student = existing[0] ?? (await db.insert(students).values({ id: identity.id, name: identity.name, groupNumber: identity.groupNumber, classCode: "2026-27" }).returning())[0];
  const token = await createFieldworkToken({ role: "student", sub: student.id, name: identity.name, nameZh: identity.nameZh, groupNumber: identity.groupNumber, memberNumber: identity.memberNumber });
  return { student: { ...student, nameZh: identity.nameZh, memberNumber: identity.memberNumber }, token };
}

export async function teacherLogin(input: { username: string; password: string }) {
  const rows = await getDb().select().from(teachers).where(eq(teachers.username, input.username.trim())).limit(1);
  const teacher = rows[0];
  if (!teacher || !bcrypt.compareSync(input.password, teacher.passwordHash)) throw new DatabaseError("DATABASE_QUERY_FAILED", "Invalid teacher credentials", 401);
  return { teacher: { id: teacher.id, username: teacher.username }, token: await createFieldworkToken({ role: "teacher", sub: teacher.id, username: teacher.username }) };
}

function parseSubmissionRows<T extends { dataJson: string }>(rows: T[]) { return rows.map((row) => ({ ...row, data: JSON.parse(row.dataJson) })); }

export async function saveSubmission(studentId: string, zone: string, type: string, data: unknown) {
  const submittedAt = new Date().toISOString();
  const dataJson = JSON.stringify(data);
  await executeSql("BEGIN IMMEDIATE");
  try {
    const result = await executeSql(
      `INSERT INTO submissions (id, student_id, zone, type, data_json, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, zone, type) DO UPDATE SET data_json = excluded.data_json, submitted_at = excluded.submitted_at
       RETURNING id, student_id, zone, type, data_json, submitted_at`,
      [crypto.randomUUID(), studentId, zone, type, dataJson, submittedAt]
    );
    const row = result.rows[0] as unknown as { id: string; student_id: string; zone: string; type: string; data_json: string; submitted_at: string };
    await executeSql(
      "INSERT INTO submission_revisions (id, submission_id, student_id, zone, type, data_json, revised_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), row.id, studentId, zone, type, dataJson, submittedAt]
    );
    await executeSql("COMMIT");
    return { id: row.id, studentId: row.student_id, zone: row.zone, type: row.type, dataJson: row.data_json, submittedAt: row.submitted_at };
  } catch (error) {
    await executeSql("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function listStudentSubmissions(studentId: string) {
  const rows = await getDb().select().from(submissions).where(eq(submissions.studentId, studentId)).orderBy(desc(submissions.submittedAt));
  return rows;
}

export async function deleteSubmissionById(id: string) {
  await executeSql("BEGIN IMMEDIATE");
  try {
    await executeSql("DELETE FROM submission_revisions WHERE submission_id = ?", [id]);
    const result = await executeSql("DELETE FROM submissions WHERE id = ? RETURNING id, student_id, zone, type, data_json, submitted_at", [id]);
    await executeSql("COMMIT");
    const row = result.rows[0] as unknown as { id: string; student_id: string; zone: string; type: string; data_json: string; submitted_at: string } | undefined;
    return row ? { id: row.id, studentId: row.student_id, zone: row.zone, type: row.type, dataJson: row.data_json, submittedAt: row.submitted_at } : null;
  } catch (error) {
    await executeSql("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function listAllSubmissions() {
  const rows = await getDb().select({ id: submissions.id, studentId: submissions.studentId, zone: submissions.zone, type: submissions.type, dataJson: submissions.dataJson, submittedAt: submissions.submittedAt, studentName: students.name, groupNumber: students.groupNumber })
    .from(submissions)
    .leftJoin(students, eq(submissions.studentId, students.id))
    .orderBy(desc(submissions.submittedAt));
  return parseSubmissionRows(rows);
}

export async function listSubmissionHistory(submissionId: string) {
  const rows = await getDb().select({ id: submissionRevisions.id, submissionId: submissionRevisions.submissionId, studentId: submissionRevisions.studentId, zone: submissionRevisions.zone, type: submissionRevisions.type, dataJson: submissionRevisions.dataJson, revisedAt: submissionRevisions.revisedAt, studentName: students.name, groupNumber: students.groupNumber })
    .from(submissionRevisions)
    .leftJoin(students, eq(submissionRevisions.studentId, students.id))
    .where(eq(submissionRevisions.submissionId, submissionId))
    .orderBy(desc(submissionRevisions.revisedAt), desc(submissionRevisions.id));
  return parseSubmissionRows(rows);
}

export async function listGroupStatus() {
  const allStudents = await getDb().select().from(students).orderBy(students.groupNumber, students.name);
  const allSubs = await getDb().select().from(submissions).orderBy(desc(submissions.submittedAt));
  return allStudents.map((student) => {
    const studentSubs = allSubs.filter((item) => item.studentId === student.id);
    const zones = ["A", "B", "C", "D"].reduce<Record<string, boolean>>((acc, zone) => { acc[zone] = studentSubs.some((item) => item.zone === zone); return acc; }, {});
    const matrix = ["A", "B", "C", "D"].reduce<Record<string, Record<string, boolean>>>((acc, zone) => {
      acc[zone] = ["building-scores", "environment", "social-cultural", "socioeconomic", "shop-tally"].reduce<Record<string, boolean>>((tasks, type) => { tasks[type] = studentSubs.some((item) => item.zone === zone && item.type === type); return tasks; }, {});
      return acc;
    }, {});
    return { studentId: student.id, name: student.name, groupNumber: student.groupNumber, zones, matrix, lastActive: studentSubs[0]?.submittedAt ?? student.createdAt, submissionCount: studentSubs.length };
  });
}
