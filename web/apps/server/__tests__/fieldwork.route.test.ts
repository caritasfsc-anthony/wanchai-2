import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../_core/create-app";
import { createFieldworkToken } from "../services/fieldwork";
import { applyMigrations, resetDatabase } from "../_test/helpers";

beforeAll(async () => { await applyMigrations(); });
beforeEach(async () => { await resetDatabase(); });

async function login(groupNumber = 1, memberNumber = 1) {
  const response = await app.fetch(new Request("http://localhost/api/fieldwork-auth/student-login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ groupNumber, memberNumber })
  }));
  const body = await response.json() as { data?: { token?: string; student?: { id: string; name: string; nameZh: string; memberNumber: number } } };
  return { response, token: body.data?.token ?? "", student: body.data?.student };
}

async function submit(token: string, data: unknown) {
  return app.fetch(new Request("http://localhost/api/submissions/environment", {
    method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ zone: "A", data })
  }));
}

async function list(token: string) {
  return app.fetch(new Request("http://localhost/api/submissions/my", { headers: { Authorization: `Bearer ${token}` } }));
}

describe("fieldwork fixed identity login", () => {
  it("creates the deterministic bilingual Group 1–8 / Member 1–5 identity", async () => {
    const { response, student } = await login(8, 5);
    expect(response.status).toBe(200);
    expect(student).toMatchObject({ id: "group-8-member-5", name: "Group 8 – Member 5", nameZh: "第8組－成員5", memberNumber: 5 });
  });

  it("rejects a group or member outside the fixed range", async () => {
    const response = await app.fetch(new Request("http://localhost/api/fieldwork-auth/student-login", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ groupNumber: 9, memberNumber: 1 })
    }));
    expect(response.status).toBe(400);
  });
});

describe("fieldwork durable submissions", () => {
  it("requires a valid student token", async () => {
    const response = await app.fetch(new Request("http://localhost/api/submissions/my"));
    expect(response.status).toBe(401);
  });

  it("upserts the latest value, stores immutable revisions, and restores the latest after a fresh login", async () => {
    const first = await login(2, 3);
    expect((await submit(first.token, { scores: { air: 4 }, total: 4 })).status).toBe(200);
    expect((await submit(first.token, { scores: { air: 10 }, total: 10 })).status).toBe(200);

    const second = await login(2, 3);
    const response = await list(second.token);
    expect(response.status).toBe(200);
    const body = await response.json() as { data?: { submissions?: Array<{ id: string; zone: string; type: string; data: unknown }>; latestByTask?: Record<string, unknown> } };
    expect(body.data?.submissions).toHaveLength(1);
    expect(body.data?.submissions?.[0]).toMatchObject({ zone: "A", type: "environment", data: { scores: { air: 10 }, total: 10 } });
    expect(body.data?.latestByTask?.["A:environment"]).toBeTruthy();

    const token = await teacherToken();
    const id = body.data?.submissions?.[0]?.id ?? "missing";
    const history = await app.fetch(new Request(`http://localhost/api/teacher/submissions/${id}/history`, { headers: { Authorization: `Bearer ${token}` } }));
    expect(history.status).toBe(200);
    const historyBody = await history.json() as { data?: { revisions?: Array<{ data: unknown }> } };
    expect(historyBody.data?.revisions).toHaveLength(2);
    expect(historyBody.data?.revisions?.map(r => (r.data as { total: number }).total).sort((a, b) => a - b)).toEqual([4, 10]);
  });

  it("isolates one fixed identity from another", async () => {
    const a = await login(1, 1);
    const b = await login(1, 2);
    await submit(a.token, { total: 7 });
    const body = await (await list(b.token)).json() as { data?: { submissions?: unknown[] } };
    expect(body.data?.submissions).toHaveLength(0);
  });
});


async function teacherToken() {
  return createFieldworkToken({ role: "teacher", sub: "teacher-test", username: "teacher" });
}

describe("teacher submission deletion", () => {
  it("denies anonymous and student DELETE/history requests", async () => {
    const student = await login(3, 1);
    await submit(student.token, { scores: { air: 7 }, total: 7 });
    const body = await (await list(student.token)).json() as { data?: { submissions?: Array<{ id: string }> } };
    const id = body.data?.submissions?.[0]?.id ?? "missing";

    const anonymous = await app.fetch(new Request(`http://localhost/api/teacher/submissions/${id}`, { method: "DELETE" }));
    expect(anonymous.status).toBe(401);
    const anonymousHistory = await app.fetch(new Request(`http://localhost/api/teacher/submissions/${id}/history`));
    expect(anonymousHistory.status).toBe(401);

    const asStudent = await app.fetch(new Request(`http://localhost/api/teacher/submissions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${student.token}` } }));
    expect(asStudent.status).toBe(401);
    const studentHistory = await app.fetch(new Request(`http://localhost/api/teacher/submissions/${id}/history`, { headers: { Authorization: `Bearer ${student.token}` } }));
    expect(studentHistory.status).toBe(401);
  });

  it("allows a teacher to delete one submission entry and its retained history", async () => {
    const student = await login(4, 2);
    await submit(student.token, { scores: { air: 10 }, total: 10 });
    const before = await (await list(student.token)).json() as { data?: { submissions?: Array<{ id: string }> } };
    const id = before.data?.submissions?.[0]?.id ?? "missing";
    const token = await teacherToken();
    const historyBefore = await app.fetch(new Request(`http://localhost/api/teacher/submissions/${id}/history`, { headers: { Authorization: `Bearer ${token}` } }));
    expect(((await historyBefore.json()) as { data?: { revisions?: unknown[] } }).data?.revisions).toHaveLength(1);

    const deleted = await app.fetch(new Request(`http://localhost/api/teacher/submissions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }));
    expect(deleted.status).toBe(200);

    const after = await (await list(student.token)).json() as { data?: { submissions?: unknown[] } };
    expect(after.data?.submissions).toHaveLength(0);
    const historyAfter = await app.fetch(new Request(`http://localhost/api/teacher/submissions/${id}/history`, { headers: { Authorization: `Bearer ${token}` } }));
    expect(((await historyAfter.json()) as { data?: { revisions?: unknown[] } }).data?.revisions).toHaveLength(0);
  });
});
