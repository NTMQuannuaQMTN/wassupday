/**
 * Database row types.
 *
 * Hand-written to match `supabase/migrations/`. Regenerate from the live schema
 * after any migration:
 *
 *   npx supabase gen types typescript --local > src/types/database.ts
 *   # or --project-id <ref>
 *
 * `Insert` types leave `user_id` / `id` / timestamps optional because the
 * database fills them (`default auth.uid()`, `default gen_random_uuid()`,
 * `default now()`). The RLS `WITH CHECK` still enforces ownership.
 */

import type { EventCategory, TaskPriority, TaskStatus } from '@/types/models';

/** The values the `source` CHECK constraint actually allows in the database. */
type DbRecordSource = 'manual' | 'import' | 'ai';

export type ProfileRow = {
  id: string;
  display_name: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export type EventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  category: EventCategory;
  source: DbRecordSource;
  created_at: string;
  updated_at: string;
}

export type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  estimated_duration: number | null;
  status: TaskStatus;
  source: DbRecordSource;
  created_at: string;
  updated_at: string;
}

/** Columns the DB fills in on its own. */
type DbDefaulted = 'id' | 'user_id' | 'created_at' | 'updated_at' | 'source' | 'status';

type InsertOf<Row> = Omit<Row, DbDefaulted> & Partial<Pick<Row, DbDefaulted & keyof Row>>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, 'id'>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: InsertOf<EventRow>;
        Update: Partial<Omit<EventRow, 'id' | 'user_id'>>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: InsertOf<TaskRow>;
        Update: Partial<Omit<TaskRow, 'id' | 'user_id'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
