import { Hono } from "hono";
import { z } from "zod";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { DatabaseError } from "../_core/db";
import { studentLogin, teacherLogin } from "../services/fieldwork";

export const isPublic = true;
export const fieldworkAuthRouter = new Hono();

const StudentLoginSchema = z.object({
  groupNumber: z.number().int().min(1).max(8),
  memberNumber: z.number().int().min(1).max(5)
});
const TeacherLoginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

fieldworkAuthRouter.post("/student-login", async (c) => {
  const parsed = StudentLoginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(apiFailure("INVALID_INPUT", "Group must be 1–8 and member must be 1–5"), 400);
  try {
    return c.json(apiSuccess(await studentLogin(parsed.data)), 200);
  } catch (error) {
    if (error instanceof DatabaseError) return c.json(apiFailure(error.code, error.message), error.status === 401 ? 401 : 400);
    throw error;
  }
});

fieldworkAuthRouter.post("/teacher-login", async (c) => {
  const parsed = TeacherLoginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(apiFailure("INVALID_INPUT", "Username and password are required"), 400);
  try {
    return c.json(apiSuccess(await teacherLogin(parsed.data)), 200);
  } catch (error) {
    if (error instanceof DatabaseError) return c.json(apiFailure(error.code, error.message), error.status === 401 ? 401 : 400);
    throw error;
  }
});
