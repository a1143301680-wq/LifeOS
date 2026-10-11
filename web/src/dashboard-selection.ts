import type { Project } from "./types";

const unpinnedOrder: Project["status"][] = ["in_progress", "planning", "paused"];

export function selectFocusedProjects(projects: Project[]): Project[] {
  const compare = (left: Project, right: Project) =>
    Date.parse(right.updated_at) - Date.parse(left.updated_at) || left.id.localeCompare(right.id);
  const selected: Project[] = [];
  const seen = new Set<string>();
  const add = (rows: Project[]) => {
    for (const project of rows.sort(compare)) {
      if (selected.length === 3) break;
      if (!seen.has(project.id)) {
        selected.push(project);
        seen.add(project.id);
      }
    }
  };
  add(projects.filter((project) => project.is_pinned));
  for (const status of unpinnedOrder) {
    add(projects.filter((project) => !project.is_pinned && project.status === status));
  }
  return selected;
}
