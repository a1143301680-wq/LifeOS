export type UserIdentity = {
  id: string;
  alias: string;
  display_name: string;
  timezone: string;
};

export type TodoCategorySummary = {
  id: string;
  name: string;
  is_deleted: boolean;
};

export type TodoCategory = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_inbox: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Todo = {
  id: string;
  category_id: string | null;
  category: TodoCategorySummary | null;
  title: string;
  note: string | null;
  status: "pending" | "completed" | "canceled";
  priority: "high" | "medium" | "low";
  planned_date: string | null;
  due_at: string | null;
  completed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type TodoCreatePayload = {
  title: string;
  category_id?: string;
  priority: Todo["priority"];
  planned_date?: string;
};

export type TodoUpdatePayload = {
  title: string;
  category_id: string;
  priority: Todo["priority"];
  planned_date: string | null;
};

export type DataEnvelope<T> = {
  data: T;
  server_time: string;
};

export type WriteEnvelope<T> = DataEnvelope<T> & {
  sync: {
    cursor: number;
  };
};

type SyncChangeBase = {
  cursor: number;
  entity_type: "todo" | "todo_category";
  entity_id: string;
  entity_version: number | null;
};

export type SyncSnapshotChange = SyncChangeBase & {
  change_type:
    | "todo.created"
    | "todo.updated"
    | "todo.completed"
    | "todo.reopened"
    | "category.created"
    | "category.updated";
  snapshot: Record<string, unknown>;
};

export type SyncTombstoneChange = SyncChangeBase & {
  change_type: "todo.deleted" | "category.deleted";
  deleted: true;
  deleted_at: string;
};

export type SyncChangesEnvelope = {
  items: Array<SyncSnapshotChange | SyncTombstoneChange>;
  next_cursor: number;
  has_more: boolean;
  server_time: string;
};

export type ListEnvelope<T> = {
  items: T[];
  next_cursor: string | null;
  server_time: string;
};

export type TodaySectionName = "overdue" | "due" | "planned" | "inbox_recent";

export type TodaySections = Record<TodaySectionName, Todo[]>;

export type TodaySummary = {
  pending_count: number;
  completed_count: number;
  overdue_count: number;
};

export type TodayData = {
  date: string;
  timezone: string;
  sections: TodaySections;
  summary: TodaySummary;
};
