/**
 * Database row types.
 *
 * These will be replaced by types generated from the live schema once Phase 2
 * migrations are applied:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * Until then this hand-written `Database` type keeps the Supabase client typed.
 * Keep it in sync with `supabase/migrations/`.
 */

import type { EventCategory, RecordSource, TaskPriority, TaskStatus } from '@/types/models';

export interface ProfileRow {
  id: string;
  display_name: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  category: EventCategory;
  source: RecordSource;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  estimated_duration: number | null;
  status: TaskStatus;
  source: RecordSource;
  created_at: string;
  updated_at: string;
}

type Timestamped = { id: string; created_at: string; updated_at: string };

type InsertOf<T extends Timestamped> = Omit<T, keyof Timestamped> & Partial<Timestamped>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: InsertOf<ProfileRow>;
        Update: Partial<ProfileRow>;
      };
      events: {
        Row: EventRow;
        Insert: InsertOf<EventRow>;
        Update: Partial<EventRow>;
      };
      tasks: {
        Row: TaskRow;
        Insert: InsertOf<TaskRow>;
        Update: Partial<TaskRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
