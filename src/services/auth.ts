/**
 * Auth service — the only module that calls `supabase.auth.*`.
 *
 * Flow: email + password, no email-confirmation step. `signUp` returns a
 * session immediately ("Confirm email" is off for this project — see
 * PROGRESS.md for the trade-off this accepts).
 *
 * Every entry point re-validates its input (screens validate too — this is the
 * belt-and-braces layer) and returns a plain discriminated result. Callers never
 * see a Supabase `AuthError`. Errors are not detailed enough to enable account
 * enumeration, except that "already registered" is unavoidable without
 * email confirmation — Supabase reports it directly on sign-up.
 */

import type { AuthError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { normalizeEmail, sanitizeDisplayName, validateEmail, validatePassword } from '@/lib/validation';

export type AuthOutcome = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function mapError(error: AuthError): string {
  // Pass through the messages that are safe and actionable; wrap the rest.
  const safe = ['Invalid login credentials', 'User already registered'];
  if (safe.some((s) => error.message.includes(s))) return error.message;
  if (error.message.startsWith('For security purposes')) return error.message; // rate limit
  if (/rate limit|too many requests/i.test(error.message)) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  return GENERIC_ERROR;
}

export async function signUp(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthOutcome> {
  const email = normalizeEmail(input.email);
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return { ok: false, message: emailCheck.message! };
  const passwordCheck = validatePassword(input.password);
  if (!passwordCheck.ok) return { ok: false, message: passwordCheck.message! };
  const displayName = sanitizeDisplayName(input.displayName);
  if (displayName.length === 0) return { ok: false, message: 'Enter a name.' };

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { display_name: displayName } },
  });
  if (error) return { ok: false, message: mapError(error) };
  if (!data.session) return { ok: false, message: GENERIC_ERROR };
  return { ok: true };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthOutcome> {
  const email = normalizeEmail(input.email);
  if (!validateEmail(email).ok || input.password.length === 0) {
    return { ok: false, message: 'Enter your email and password.' };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error) return { ok: false, message: mapError(error) };
  return { ok: true };
}

export async function signOut(): Promise<AuthOutcome> {
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, message: mapError(error) };
  return { ok: true };
}
