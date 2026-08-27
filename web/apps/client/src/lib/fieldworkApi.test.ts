import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureCurrentFieldworkDate, getTeacherSubmissions, hasLocalDraft, hydrateSubmissions, loadLocal, saveLocal, studentLogin, submitData, submitMySubmissionsToGoogleSheet } from "./fieldworkApi";

describe("fieldwork scoped local drafts", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.__SKYBASE_APP_CONFIG__ = undefined;
  });

  it("isolates drafts by fixed student identity on shared devices", async () => {
    await studentLogin(1, 1);
    expect(saveLocal("A", "environment", { air: 7 })).toBe(true);
    localStorage.setItem("fieldwork_student_id", "group-1-member-2");
    expect(hasLocalDraft("A", "environment")).toBe(false);
    expect(loadLocal("A", "environment", { air: 0 })).toEqual({ air: 0 });
    localStorage.setItem("fieldwork_student_id", "group-1-member-1");
    expect(loadLocal("A", "environment", { air: 0 })).toEqual({ air: 7 });
  });

  it("does not overwrite a newer local draft with older server hydration", () => {
    localStorage.setItem("fieldwork_student_id", "group-2-member-1");
    saveLocal("A", "environment", { air: 10 });
    hydrateSubmissions([{ id: "s1", studentId: "group-2-member-1", zone: "A", type: "environment", data: { scores: { air: 4 } }, submittedAt: "2000-01-01T00:00:00.000Z" }]);
    expect(loadLocal("A", "environment", { air: 0 })).toEqual({ air: 10 });
  });

  it("falls back to legacy unscoped drafts when no scoped draft exists", () => {
    ensureCurrentFieldworkDate();
    localStorage.setItem("fieldwork_zone_B_shop-tally", JSON.stringify({ counts: { vacant: 2 }, grade: "midGrade" }));
    localStorage.setItem("fieldwork_student_id", "group-3-member-1");
    expect(loadLocal("B", "shop-tally", { counts: {}, grade: "lowGrade" })).toEqual({ counts: { vacant: 2 }, grade: "midGrade" });
  });

  it("clears previous-day fieldwork data before loading a new daily form", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T12:00:00"));
    localStorage.setItem("fieldwork_session_date", "2026-08-24");
    localStorage.setItem("fieldwork_student_id", "group-4-member-1");
    localStorage.setItem("fieldwork_student_group-4-member-1_zone_C_environment", JSON.stringify({ air: 10 }));
    localStorage.setItem("fieldwork_student_group-4-member-1_zone_C_environment_meta", JSON.stringify({ updatedAt: 1 }));
    localStorage.setItem("fieldwork_zone_C_environment_submitted", "true");
    localStorage.setItem("fieldwork_completed", JSON.stringify({ C_environment: true }));
    localStorage.setItem("fieldwork_static_submissions", JSON.stringify([{ id: "old", studentId: "group-4-member-1", zone: "C", type: "environment", data: {}, submittedAt: "2026-08-24T01:00:00.000Z" }]));

    ensureCurrentFieldworkDate();

    expect(localStorage.getItem("fieldwork_session_date")).toBe("2026-08-25");
    expect(localStorage.getItem("fieldwork_student_group-4-member-1_zone_C_environment")).toBeNull();
    expect(localStorage.getItem("fieldwork_zone_C_environment_submitted")).toBeNull();
    expect(localStorage.getItem("fieldwork_completed")).toBeNull();
    expect(localStorage.getItem("fieldwork_static_submissions")).toBeNull();
    expect(loadLocal("C", "environment", { air: 0 })).toEqual({ air: 0 });
  });

  it("keeps form submissions local before the final Google Sheet send", async () => {
    const fetchSpy = vi.spyOn(window, "fetch");
    await studentLogin(2, 3);

    await submitData("A", "environment", { scores: { air: 7 }, average: 6.5 });

    expect(fetchSpy).not.toHaveBeenCalled();
    const { submissions } = await getTeacherSubmissions();
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({ studentId: "group-2-member-3", zone: "A", type: "environment" });
  });

  it("requires a Google Apps Script endpoint for the final send button", async () => {
    const fetchSpy = vi.spyOn(window, "fetch");
    await studentLogin(2, 3);
    await submitData("A", "environment", { scores: { air: 7 }, average: 6.5 });

    await expect(submitMySubmissionsToGoogleSheet()).rejects.toThrow("Google Sheet endpoint is not configured");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects Google Sheet edit links on the final send button", async () => {
    window.__SKYBASE_APP_CONFIG__ = { googleSheetWebAppUrl: "https://docs.google.com/spreadsheets/d/test/edit" };
    const fetchSpy = vi.spyOn(window, "fetch");
    await studentLogin(2, 3);
    await submitData("A", "environment", { scores: { air: 7 }, average: 6.5 });

    await expect(submitMySubmissionsToGoogleSheet()).rejects.toThrow("Invalid Google Sheet endpoint");

    expect(fetchSpy).not.toHaveBeenCalled();
    const { submissions } = await getTeacherSubmissions();
    expect(submissions).toHaveLength(1);
  });

  it("posts latest local submissions to Google Apps Script from the final send button", async () => {
    window.__SKYBASE_APP_CONFIG__ = { googleSheetWebAppUrl: "https://script.google.com/macros/s/test/exec" };
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    await studentLogin(1, 4);

    await submitData("B", "building", { average: 22.4 });
    await submitData("B", "environment", { scores: { air: 10 }, average: 10 });
    const result = await submitMySubmissionsToGoogleSheet();

    expect(result.count).toBe(2);
    expect(fetchSpy).toHaveBeenCalledWith("https://script.google.com/macros/s/test/exec", expect.objectContaining({
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    }));
    const sentTypes = fetchSpy.mock.calls.map(call => JSON.parse(String(call[1]?.body)).submission.type).sort();
    expect(sentTypes).toEqual(["building-scores", "environment"]);
    const { submissions } = await getTeacherSubmissions();
    expect(submissions).toHaveLength(2);
  });
});
