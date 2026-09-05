/**
 * RLS / data-isolation tests for the wassupday schema.
 *
 * These prove the security claims in 20260904000100_init_schema.sql:
 *  - a user only ever sees / mutates their own rows
 *  - a forged user_id cannot smuggle a row past the INSERT policy
 *  - the anon role has no access at all
 *  - CHECK constraints reject out-of-range / unknown values
 *
 * Run: npm run test:db
 */

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { asUser, createTestDb, createUser, rejects, type TestDb } from './db.ts';

describe('schema + RLS', () => {
  let db: TestDb;
  let alice: string;
  let bob: string;

  before(async () => {
    db = await createTestDb();
    alice = await createUser(db, { email: 'alice@wassup.day', displayName: '  Alice  ' });
    bob = await createUser(db, { email: 'bob@wassup.day' });
  });

  after(async () => {
    await db.close();
  });

  test('handle_new_user creates a profile, trimming the display name', async () => {
    const res = await db.query<{ id: string; display_name: string; timezone: string }>(
      'select id, display_name, timezone from public.profiles order by created_at',
    );
    assert.equal(res.rows.length, 2);
    const aliceProfile = res.rows.find((r) => r.id === alice);
    assert.equal(aliceProfile?.display_name, 'Alice');
    assert.equal(aliceProfile?.timezone, 'UTC');
  });

  test('a user sees only their own events', async () => {
    await asUser(db, alice, async () => {
      await db.query(
        `insert into public.events (title, start_time, end_time)
         values ('Alice lecture', now(), now() + interval '1 hour')`,
      );
    });
    await asUser(db, bob, async () => {
      await db.query(
        `insert into public.events (title, start_time, end_time)
         values ('Bob meeting', now(), now() + interval '1 hour')`,
      );
    });

    const aliceRows = await asUser(db, alice, () =>
      db.query<{ title: string }>('select title from public.events'),
    );
    assert.deepEqual(
      aliceRows.rows.map((r) => r.title),
      ['Alice lecture'],
    );
  });

  test('a user cannot insert a row owned by someone else (forged user_id)', async () => {
    const blocked = await rejects(() =>
      asUser(db, alice, () =>
        db.query(
          `insert into public.events (user_id, title, start_time, end_time)
           values ($1, 'sneaky', now(), now() + interval '1 hour')`,
          [bob],
        ),
      ),
    );
    assert.equal(blocked, true);
  });

  test('a user cannot update another user\'s task', async () => {
    const bobTaskId = await asUser(db, bob, async () => {
      const r = await db.query<{ id: string }>(
        `insert into public.tasks (title) values ('Bob task') returning id`,
      );
      return r.rows[0].id;
    });

    const updated = await asUser(db, alice, () =>
      db.query(`update public.tasks set title = 'hijacked' where id = $1`, [bobTaskId]),
    );
    assert.equal(updated.affectedRows, 0);

    const check = await asUser(db, bob, () =>
      db.query<{ title: string }>(`select title from public.tasks where id = $1`, [bobTaskId]),
    );
    assert.equal(check.rows[0].title, 'Bob task');
  });

  test('a user cannot delete another user\'s event', async () => {
    const bobEventId = await asUser(db, bob, async () => {
      const r = await db.query<{ id: string }>(`select id from public.events where title = 'Bob meeting'`);
      return r.rows[0].id;
    });
    const del = await asUser(db, alice, () =>
      db.query(`delete from public.events where id = $1`, [bobEventId]),
    );
    assert.equal(del.affectedRows, 0);
  });

  test('a user sees only their own profile', async () => {
    const rows = await asUser(db, alice, () =>
      db.query<{ id: string }>('select id from public.profiles'),
    );
    assert.deepEqual(
      rows.rows.map((r) => r.id),
      [alice],
    );
  });

  test('a user cannot insert into profiles (no INSERT policy)', async () => {
    const blocked = await rejects(() =>
      asUser(db, alice, () =>
        db.query(`insert into public.profiles (id) values ($1)`, [alice]),
      ),
    );
    assert.equal(blocked, true);
  });

  test('the anon role has no access to any table', async () => {
    for (const table of ['public.profiles', 'public.events', 'public.tasks']) {
      const blocked = await rejects(() =>
        asUser(db, null, () => db.query(`select * from ${table}`)),
      );
      assert.equal(blocked, true, `anon could read ${table}`);
    }
  });

  test('CHECK constraints reject bad enum values and inverted time ranges', async () => {
    await asUser(db, alice, async () => {
      assert.equal(
        await rejects(() =>
          db.query(
            `insert into public.events (title, start_time, end_time)
             values ('bad', now(), now() - interval '1 hour')`,
          ),
        ),
        true,
        'end_time before start_time was allowed',
      );
      assert.equal(
        await rejects(() =>
          db.query(
            `insert into public.events (title, start_time, end_time, category)
             values ('bad', now(), now(), 'garbage')`,
          ),
        ),
        true,
        'unknown category was allowed',
      );
      assert.equal(
        await rejects(() =>
          db.query(`insert into public.tasks (title, priority) values ('bad', 'urgent')`),
        ),
        true,
        'unknown priority was allowed',
      );
      assert.equal(
        await rejects(() =>
          db.query(`insert into public.tasks (title, estimated_duration) values ('bad', 0)`),
        ),
        true,
        'zero duration was allowed',
      );
    });
  });
});
