/**
 * Centralised, validated access to public environment variables.
 *
 * Only `EXPO_PUBLIC_`-prefixed variables are inlined into the JS bundle by the
 * Expo CLI, and they are visible in plain text in the shipped app. That is fine
 * for the Supabase URL and the *publishable* (anon) key — data access is guarded
 * by Row Level Security, not by key secrecy.
 *
 * NEVER put the Supabase service-role key (or any other secret) in an
 * `EXPO_PUBLIC_` variable or anywhere in this client app.
 *
 * Every variable must be referenced with static dot notation on `process.env`
 * for the CLI to inline it — do not access these dynamically.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing environment variable "${name}". Copy .env.example to .env.local and fill it in. ` +
        `See README.md > "Environment variables".`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
} as const;
