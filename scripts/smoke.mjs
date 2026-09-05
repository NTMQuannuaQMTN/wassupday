/**
 * End-to-end smoke test against the real Supabase project.
 *
 *   node scripts/smoke.mjs you+wsd1@example.com 'a-strong-password-1'
 *
 * Walks the full stack: sign up (session comes back immediately — no email
 * confirmation) -> create an event -> list it back -> confirm RLS hides it
 * from anon -> delete. Reads EXPO_PUBLIC_SUPABASE_* from .env.local. Safe to
 * run repeatedly with a fresh email alias.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const [email, password] = process.argv.slice(2);

if (!URL_ || !KEY) throw new Error('Missing EXPO_PUBLIC_SUPABASE_* in .env.local');
if (!email || !password) throw new Error('Usage: node scripts/smoke.mjs <email> <password>');

const ok = (m) => console.log(`  ✓ ${m}`);
const die = (m, e) => {
  console.error(`  ✗ ${m}${e ? `: ${e.message ?? e}` : ''}`);
  process.exit(1);
};

const supabase = createClient(URL_, KEY, { auth: { persistSession: false } });

console.log(`\nProject: ${URL_}\n`);

// 1. sign up — no email confirmation, session comes back immediately
{
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: 'Smoke Test' } },
  });
  if (error) die('signUp', error);
  if (!data.session) die('signUp did not return a session — is "Confirm email" back on?');
  ok(`signed up + signed in as ${data.user?.id}`);
}

// 2. profile row was created by the trigger
{
  const { data, error } = await supabase.from('profiles').select('id,display_name').single();
  if (error) die('read own profile', error);
  if (data.display_name !== 'Smoke Test') die(`profile display_name = ${data.display_name}`);
  ok('handle_new_user created the profile with the right display name');
}

// 3. create an event
let eventId;
{
  const start = new Date(Date.now() + 3_600_000).toISOString();
  const end = new Date(Date.now() + 7_200_000).toISOString();
  const { data, error } = await supabase
    .from('events')
    .insert({ title: 'Smoke test event', start_time: start, end_time: end })
    .select('id,user_id,title')
    .single();
  if (error) die('createEvent', error);
  eventId = data.id;
  ok(`created event ${eventId} (user_id set by DB: ${data.user_id})`);
}

// 4. list it back
{
  const { data, error } = await supabase.from('events').select('id').eq('id', eventId);
  if (error) die('listEvents', error);
  if (data.length !== 1) die(`expected 1 event, got ${data.length}`);
  ok('listed the event back');
}

// 5. anon cannot see it
{
  const anon = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.from('events').select('id').eq('id', eventId);
  if (!error && data?.length) die('RLS FAIL: anon can read the event');
  ok('RLS: anon cannot read the event');
}

// 6. delete + sign out
{
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) die('deleteEvent', error);
  await supabase.auth.signOut();
  ok('deleted the event and signed out');
}

console.log('\n✓ smoke test passed\n');
