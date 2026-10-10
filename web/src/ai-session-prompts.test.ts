import { describe, expect, test } from "vitest";

import { composeAISessionPrompt } from "./App";
import type { AISession, Project } from "./types";

const project: Project = {
  id: "project-1", name: "Build  LifeOS\n PC", description: null, type: "development", status: "in_progress",
  manual_progress: 45, next_step: "  Ship  core\n flow  ", is_pinned: true, version: 2,
  created_at: "2026-10-10T00:00:00Z", updated_at: "2026-10-10T00:00:00Z",
};
const session: AISession = {
  id: "session-1", goal: "  Complete\n AI  Session ", completed_work: "  API\n and  tests ",
  modified_files: "  app.py\n test.py  ", verification_result: "  5  passed  ",
  remaining_issues: "  UI\n polish  ", next_step: "  Add  form  ",
  recommended_next_prompt: "  Please\n continue  the UI  ", ai_tool: "  Codex  ", user_note: "  Keep  scope  tight ",
  started_at: "2026-10-10T00:00:00Z", ended_at: null, version: 1,
  created_at: "2026-10-10T00:00:00Z", updated_at: "2026-10-10T00:00:00Z",
};

const shared = [
  "Project: Build LifeOS PC", "Type: development", "Status: in_progress", "Progress: 45%",
  "Project next step: Ship core flow", "AI tool: Codex", "Session goal: Complete AI Session",
];

describe("saved AI Session prompts", () => {
  test("full records follow the exact three ordered templates", () => {
    expect(composeAISessionPrompt("start", project, session)).toBe([
      "Start collaboration", ...shared, "Completed work: API and tests", "Remaining issues: UI polish",
      "Next step: Add form", "User note: Keep scope tight",
      "Request: Help me work on this session goal using the context above.",
    ].join("\n"));
    expect(composeAISessionPrompt("end", project, session)).toBe([
      "End-of-session summary", ...shared, "Completed work: API and tests", "Modified files: app.py test.py",
      "Verification result: 5 passed", "Remaining issues: UI polish", "Next step: Add form",
      "User note: Keep scope tight", "Request: Summarize this session and propose the next prompt using the context above.",
    ].join("\n"));
    expect(composeAISessionPrompt("continue", project, session)).toBe([
      "Continue progress", ...shared, "Completed work: API and tests", "Modified files: app.py test.py",
      "Verification result: 5 passed", "Remaining issues: UI polish", "Next step: Add form",
      "User note: Keep scope tight", "Request: Please continue the UI",
    ].join("\n"));
  });

  test("sparse records omit blank fields and use each continuation fallback", () => {
    const sparse = { ...session, completed_work: null, modified_files: "  ", verification_result: null,
      remaining_issues: null, user_note: null, ai_tool: null, recommended_next_prompt: " \n " };
    const withoutProjectStep = { ...project, next_step: null };
    const withoutSessionStep = { ...sparse, next_step: null };
    const sparseShared = ["Project: Build LifeOS PC", "Type: development", "Status: in_progress", "Progress: 45%"];
    expect(composeAISessionPrompt("start", withoutProjectStep, withoutSessionStep)).toBe([
      "Start collaboration", ...sparseShared, "Session goal: Complete AI Session",
      "Request: Help me work on this session goal using the context above.",
    ].join("\n"));
    expect(composeAISessionPrompt("end", withoutProjectStep, withoutSessionStep)).toBe([
      "End-of-session summary", ...sparseShared, "Session goal: Complete AI Session",
      "Request: Summarize this session and propose the next prompt using the context above.",
    ].join("\n"));
    expect(composeAISessionPrompt("continue", project, sparse)).toContain("Request: Continue with: Add form");
    expect(composeAISessionPrompt("continue", project, withoutSessionStep)).toContain("Request: Continue with: Ship core flow");
    expect(composeAISessionPrompt("continue", withoutProjectStep, withoutSessionStep)).toBe([
      "Continue progress", ...sparseShared, "Session goal: Complete AI Session",
      "Request: Help me work toward: Complete AI Session",
    ].join("\n"));
  });
});
