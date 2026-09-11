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
 *
 * Password reset: `requestPasswordReset` always reports success (Supabase
 * itself never reveals whether the email is registered) and emails a link back
 * into the app (`wassupday://reset-password?code=...`, PKCE — see
 * `lib/supabase.ts`). `reset-password.tsx` calls `exchangeRecoveryCode` with
 * that code, then `updatePassword` once the user picks a new one.
 */

import type { AuthError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';
import { normalizeEmail, sanitizeDisplayName, validateEmail, validatePassword } from '@/lib/validation';

export type AuthOutcome = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function mapError(error: AuthError, context: string): string {
  // Logged only in dev — the mapped message below is deliberately generic for
  // anything not on the safe list, so this is the only way to see what
  // Supabase actually said (e.g. while debugging a new error case).
  if (__DEV__) console.warn(`[auth] ${context}:`, error.status, error.code, error.message);

  // Pass through the messages that are safe and actionable; wrap the rest.
  const safe = [
    'Invalid login credentials',
    'User already registered',
    'New password should be different from the old password',
  ];
  if (safe.some((s) => error.message.includes(s))) return error.message;
  if (error.message.startsWith('For security purposes')) return error.message; // rate limit
  if (/rate limit|too many requests/i.test(error.message)) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  // `secure_password_change` (supabase/config.toml) requires a *fresh* sign-in
  // to change the password — an older session gets rejected here. Surface it
  // distinctly rather than the generic message, since "sign in again" is
  // exactly what fixes it (see updatePassword's doc comment).
  if (error.code === 'session_expired' || /reauthenticat/i.test(error.message)) {
    return 'For security, sign out and back in, then try changing your password again.';
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
  if (error) return { ok: false, message: mapError(error, 'signUp') };
  if (!data.session) return { ok: false, message: GENERIC_ERROR };
  return { ok: true };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthOutcome> {
  const email = normalizeEmail(input.email);
  if (!validateEmail(email).ok || input.password.length === 0) {
    return { ok: false, message: 'Enter your email and password.' };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error) return { ok: false, message: mapError(error, 'signIn') };
  return { ok: true };
}

export async function signOut(): Promise<AuthOutcome> {
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, message: mapError(error, 'signOut') };
  return { ok: true };
}

/**
 * Emails a password-reset link. Always returns `{ ok: true }` for a
 * syntactically valid address — whether or not that email has an account is
 * never revealed (Supabase's own behavior; matches the no-enumeration rule).
 */
export async function requestPasswordReset(rawEmail: string): Promise<AuthOutcome> {
  const email = normalizeEmail(rawEmail);
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return { ok: false, message: emailCheck.message! };

  const redirectTo = Linking.createURL('reset-password');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  // Supabase's own rate-limit error is the one exception worth surfacing —
  // everything else (including "no such user", which it doesn't actually
  // send) collapses into the same generic success.
  if (error) {
    if (__DEV__) console.warn('[auth] requestPasswordReset:', error.status, error.code, error.message);
    if (/rate limit|too many requests/i.test(error.message)) {
      return { ok: false, message: 'Too many attempts. Wait a minute and try again.' };
    }
  }
  return { ok: true };
}

/** Exchanges the `code` from a password-reset deep link for a session. */
export async function exchangeRecoveryCode(code: string): Promise<AuthOutcome> {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    if (__DEV__) console.warn('[auth] exchangeRecoveryCode:', error.status, error.code, error.message);
    return { ok: false, message: 'This link is invalid or has expired. Request a new one.' };
  }
  return { ok: true };
}

/**
 * Sets a new password for the current session (a recovery session works too).
 *
 * `secure_password_change` (supabase/config.toml) means this only succeeds
 * against a *fresh* session — one just created by signing in or by
 * `exchangeRecoveryCode`. A session that's been sitting around a while (e.g.
 * signed in, then navigated around the app for a bit before changing the
 * password from Profile) gets rejected; `mapError` turns that into an
 * actionable "sign out and back in" message rather than the generic one. This
 * is the real production flow's normal case (the recovery session is always
 * freshly minted right before this call) — it mainly bites the `__DEV__` test
 * shortcut in `profile.tsx`, which reuses whatever session was already open.
 */
export async function updatePassword(newPassword: string): Promise<AuthOutcome> {
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.ok) return { ok: false, message: passwordCheck.message! };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, message: mapError(error, 'updatePassword') };
  return { ok: true };
}
