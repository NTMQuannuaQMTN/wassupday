# services

Data-access layer. Each module wraps Supabase queries for one domain and maps
between DB row shapes (`src/types/database.ts`) and domain models
(`src/types/models.ts`). Pure business logic (conflict detection, Today snapshot)
lives in `src/lib/`, not here.
