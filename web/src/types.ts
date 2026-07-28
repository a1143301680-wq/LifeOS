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

export type DataEnvelope<T> = {
  data: T;
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
