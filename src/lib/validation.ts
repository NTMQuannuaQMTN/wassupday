/**
 * Pure input validation / normalisation for auth (and later, forms).
 *
 * These are allow-list checks: input is accepted only if it matches a strict
 * shape, otherwise rejected. They are the first line of defence, not the only
 * one — every value still crosses parameterised PostgREST queries and RLS /
 * CHECK constraints server-side. Nothing here builds SQL or trusts input to be
 * safe just because it passed.
 *
 * No React, no I/O — unit tested in validation.test.ts.
 */

export interface FieldResult {
  ok: boolean;
  /** User-facing reason when `ok` is false. */
  message?: string;
}

const OK: FieldResult = { ok: true };

// ASCII/Unicode C0 + C1 control characters and DEL.
const CONTROL_CHARS = /[\x00-\x1f\x7f-\x9f]/;
const CONTROL_CHARS_GLOBAL = /[\x00-\x1f\x7f-\x9f]/g;

// Deliberately conservative: single @, no whitespace, capped local/domain
// lengths. Not a full RFC 5322 parser — just enough to catch fat-finger input
// before it reaches Supabase.
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/;

/** Trim + lowercase. Use everywhere an email is sent to Supabase. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEmail(raw: string): FieldResult {
  const email = normalizeEmail(raw);
  if (email.length === 0) return { ok: false, message: 'Enter your email.' };
  if (email.length > 254) return { ok: false, message: 'That email is too long.' };
  if (CONTROL_CHARS.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  if (!EMAIL_RE.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  return OK;
}

// bcrypt (Supabase's hasher) silently truncates at 72 bytes; reject longer so a
// user never has a password whose tail is ignored.
const PASSWORD_MIN = 10;
const PASSWORD_MAX_BYTES = 72;

export function validatePassword(password: string): FieldResult {
  if (password.length < PASSWORD_MIN) {
    return { ok: false, message: `Use at least ${PASSWORD_MIN} characters.` };
  }
  if (byteLength(password) > PASSWORD_MAX_BYTES) {
    return { ok: false, message: 'That password is too long.' };
  }
  if (CONTROL_CHARS.test(password)) {
    return { ok: false, message: 'Remove control characters from your password.' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, message: 'Include at least one letter and one number.' };
  }
  return OK;
}

/**
 * Display name: strip control chars, collapse internal whitespace, trim, cap at
 * 60 (matches the profiles.display_name CHECK). Returns '' when nothing usable
 * is left — callers treat that as "no display name".
 */
export function sanitizeDisplayName(raw: string): string {
  return raw
    .replace(CONTROL_CHARS_GLOBAL, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export function validateDisplayName(raw: string): FieldResult {
  if (sanitizeDisplayName(raw).length === 0) return { ok: false, message: 'Enter a name.' };
  return OK;
}

function byteLength(s: string): number {
  // Avoids a hard dependency on Buffer / TextEncoder availability.
  return unescape(encodeURIComponent(s)).length;
}
