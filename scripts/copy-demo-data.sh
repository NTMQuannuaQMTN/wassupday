#!/usr/bin/env bash
#
# Copies `events` + `tasks` row data (not `profiles`, not `auth.users`) from
# one Supabase project into another, reassigning every copied row to a single
# existing user in the TARGET project. Built for moving test/demo rows into a
# project that already has its own real users and data — it does NOT touch
# `auth.users` or `profiles`, and it never deletes anything in the target.
#
# Why `profiles`/`auth.users` are excluded: `profiles.id` and
# `events`/`tasks`.user_id are all `references auth.users(id)`, and Supabase
# generates a fresh, project-specific uuid for every signup — there is no way
# to "copy" a user across projects, only to point data at one that already
# exists on the other side. This script does the latter.
#
# Requires only the Supabase CLI (`npx supabase`, already used elsewhere in
# this repo) — no local `psql`/`pg_dump` install needed.
#
# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
# 1. Get a *direct* Postgres connection string for each project (NOT the
#    pgbouncer/pooler one): Supabase Dashboard -> Project Settings -> Database
#    -> Connection string -> URI ("Direct connection", port 5432). It embeds
#    the database password — treat it like any other production secret: don't
#    commit it, don't paste it into a chat/issue/PR, don't leave it in your
#    shell's saved history any longer than you have to.
#
# 2. Get the target user's id: Supabase Dashboard (target project) ->
#    Authentication -> Users -> copy the UUID of whichever account should own
#    the copied rows.
#
# 3. Run:
#      export SOURCE_DB_URL="postgresql://postgres:...@db.<source-ref>.supabase.co:5432/postgres"
#      export TARGET_DB_URL="postgresql://postgres:...@db.<target-ref>.supabase.co:5432/postgres"
#      export TARGET_USER_ID="<uuid from step 2>"
#      ./scripts/copy-demo-data.sh
#
#    A leading space before `export` keeps it out of your shell history on
#    most shells with HISTCONTROL=ignorespace/ignoreboth set.
#
# If the target project doesn't already have this schema deployed, apply
# migrations first (review before running against a project with real data):
#      npx supabase db push --db-url "$TARGET_DB_URL" --include-all
#
# The script pauses for confirmation after showing you the exact SQL it's
# about to run against the target, before touching anything there.

set -euo pipefail

: "${SOURCE_DB_URL:?Set SOURCE_DB_URL (see the header comment in this script)}"
: "${TARGET_DB_URL:?Set TARGET_DB_URL (see the header comment in this script)}"
: "${TARGET_USER_ID:?Set TARGET_USER_ID (see the header comment in this script)}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
DUMP_FILE="$WORKDIR/data.sql"

echo "==> Source user_id values currently on events/tasks rows:"
npx supabase db query --db-url "$SOURCE_DB_URL" \
  "select distinct user_id from public.events union select distinct user_id from public.tasks;"
echo
read -r -p "Comma-separated list of the user_id(s) above to remap to TARGET_USER_ID (blank = none found, abort): " SOURCE_USER_IDS
if [ -z "$SOURCE_USER_IDS" ]; then
  echo "Nothing to remap — aborting without touching either project."
  exit 1
fi

echo "==> Dumping events + tasks data from source (profiles excluded)..."
npx supabase db dump --db-url "$SOURCE_DB_URL" \
  --data-only --schema public \
  --exclude public.profiles \
  -f "$DUMP_FILE"

echo "==> Remapping user_id -> $TARGET_USER_ID..."
IFS=',' read -ra ids <<< "$SOURCE_USER_IDS"
for old_id in "${ids[@]}"; do
  old_id="$(echo "$old_id" | xargs)" # trim whitespace
  [ -z "$old_id" ] && continue
  # BSD sed (macOS default) -- the empty '' after -i is the (no) backup suffix.
  sed -i '' "s/$old_id/$TARGET_USER_ID/g" "$DUMP_FILE"
done

echo "==> Making inserts merge-safe (skip rows whose id already exists in the target)..."
# Only touches pg_dump's single-line "INSERT INTO ...;" rows -- leaves the
# surrounding SET/RESET statements untouched.
sed -i '' -E '/^INSERT INTO/ s/;$/ ON CONFLICT (id) DO NOTHING;/' "$DUMP_FILE"

echo
echo "==> Dump ready at: $DUMP_FILE"
echo "    Review it before applying, e.g.: less \"$DUMP_FILE\""
echo
read -r -p "Apply this to the TARGET project now? [y/N] " confirm
if [[ "$confirm" != [yY] ]]; then
  echo "Aborted without applying. The dump file is deleted when this script exits (trap) —"
  echo "copy it elsewhere first if you want to keep or hand-edit it: cp \"$DUMP_FILE\" ./reviewed-dump.sql"
  read -r -p "Press enter once you've copied it (or just to confirm abort)..." _
  exit 1
fi

echo "==> Applying to target..."
npx supabase db query --db-url "$TARGET_DB_URL" -f "$DUMP_FILE"

echo "==> Done. Spot-check counts in the target, e.g.:"
echo '    npx supabase db query --db-url "$TARGET_DB_URL" "select count(*) from public.events; select count(*) from public.tasks;"'
