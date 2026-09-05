/**
 * Supabase client for the mobile app.
 *
 * Session persistence
 * ===================
 * `LargeSecureStore` keeps the session encrypted at rest: a random AES-256 key
 * lives in the OS keychain / keystore (expo-secure-store), the ciphertext lives
 * in AsyncStorage. This sidesteps SecureStore's ~2 KB item limit while still
 * meaning a device compromise does not hand over a plaintext refresh token.
 *
 * Lifetime the product wants:
 *   - survives the app being closed / the process being killed  -> persistSession
 *   - survives OS reboots                                       -> persisted storage
 *   - is gone after the app is deleted and reinstalled          -> see below
 *
 * On uninstall, AsyncStorage (the app container) is wiped, so the ciphertext is
 * gone even though the iOS keychain item can linger. To make "reinstall = logged
 * out" deterministic we also:
 *   - store the keychain item as WHEN_UNLOCKED_THIS_DEVICE_ONLY (no iCloud
 *     keychain sync, no restore onto a new device), and
 *   - on first launch after a fresh install, proactively delete any stale
 *     keychain item before the client reads it (`ensureFreshInstallPurge`).
 */

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import 'react-native-get-random-values';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

const PROJECT_REF = new URL(env.supabaseUrl).hostname.split('.')[0];
/** Deterministic key Supabase uses for the persisted session. */
const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const INSTALL_MARKER_KEY = 'wassupday.install-marker.v1';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(
      key,
      aesjs.utils.hex.fromBytes(encryptionKey),
      SECURE_STORE_OPTIONS,
    );

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    if (!encryptionKeyHex) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return null;
    }
    try {
      return await this._decrypt(key, encrypted);
    } catch {
      // Corrupt / key missing -> treat as no session rather than crashing.
      await this.removeItem(key);
      return null;
    }
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: new LargeSecureStore(),
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

/**
 * Call once, before reading the session, on every app start. If AsyncStorage has
 * no install marker the app was just (re)installed — clear any keychain material
 * that outlived a previous install so a stale key can never resurrect a session.
 */
export async function ensureFreshInstallPurge(): Promise<void> {
  try {
    const marker = await AsyncStorage.getItem(INSTALL_MARKER_KEY);
    if (marker) return;
    await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY, SECURE_STORE_OPTIONS);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    await AsyncStorage.setItem(INSTALL_MARKER_KEY, new Date().toISOString());
  } catch {
    // Non-fatal: worst case the client just finds no decryptable session.
  }
}

/**
 * Supabase only auto-refreshes the session while the JS runtime is awake. Tie
 * refresh to app foreground/background so a session does not go stale while the
 * app is backgrounded. Call once from the root layout.
 */
let appStateSubscription: { remove: () => void } | null = null;

export function registerAuthAutoRefresh() {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
