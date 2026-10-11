import { expect, test } from "vitest";

import { selectFocusedProjects } from "./dashboard-selection";
import type { Project } from "./types";

function project(id: string, status: Project["status"], pinned: boolean, updated: string): Project {
  return {
    id, name: id, description: null, type: "development", status,
    manual_progress: 0, next_step: null, is_pinned: pinned, version: 1,
    created_at: updated, updated_at: updated,
  };
}

test("pinned projects win, with updated-at descending and ID ascending ties", () => {
  const rows = [
    project("z", "completed", true, "2026-10-10T00:00:00Z"),
    project("c", "paused", true, "2026-10-11T00:00:00Z"),
    project("b", "abandoned", true, "2026-10-11T00:00:00Z"),
    project("a", "in_progress", false, "2026-10-12T00:00:00Z"),
  ];
  expect(selectFocusedProjects(rows).map((item) => item.id)).toEqual(["b", "c", "z"]);
});

test("fills with active, planning, then paused; excludes unpinned terminal projects", () => {
  const rows = [
    project("pinned", "completed", true, "2026-10-01T00:00:00Z"),
    project("paused", "paused", false, "2026-10-12T00:00:00Z"),
    project("planning", "planning", false, "2026-10-11T00:00:00Z"),
    project("active-b", "in_progress", false, "2026-10-10T00:00:00Z"),
    project("active-a", "in_progress", false, "2026-10-10T00:00:00Z"),
    project("completed", "completed", false, "2026-10-13T00:00:00Z"),
    project("abandoned", "abandoned", false, "2026-10-13T00:00:00Z"),
  ];
  expect(selectFocusedProjects(rows).map((item) => item.id)).toEqual(["pinned", "active-a", "active-b"]);
  expect(selectFocusedProjects(rows.slice(1, 3)).map((item) => item.id)).toEqual(["planning", "paused"]);
  expect(selectFocusedProjects(rows.slice(5))).toEqual([]);
});

test("never repeats an ID", () => {
  const same = project("same", "in_progress", false, "2026-10-10T00:00:00Z");
  expect(selectFocusedProjects([same, same]).map((item) => item.id)).toEqual(["same"]);
});
