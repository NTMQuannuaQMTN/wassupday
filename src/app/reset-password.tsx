import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { validatePassword } from '@/lib/validation';
import { exchangeRecoveryCode, updatePassword } from '@/services/auth';

/**
 * Landing screen for the password-reset email link
 * (`wassupday://reset-password?code=...`). Deliberately NOT inside `(app)` or
 * `(auth)` — those groups are gated on session presence, and exchanging the
 * recovery code creates a session, which would otherwise silently drop the
 * user straight into the app before they've picked a new password. This
 * screen stays the active route regardless of session state until it
 * explicitly hands off.
 */
export default function ResetPasswordScreen() {
  const { code, dev } = useLocalSearchParams<{ code?: string; dev?: string }>();
  // Dev-only shortcut so the "set a new password" screen can be exercised
  // without a live redirect-URL round trip (see forgot-password.tsx's "Skip
  // to reset" button) — the live project's Supabase auth redirect allow-list
  // hasn't been pushed yet, so a real emailed link can't reach here.
  // `__DEV__` is compiled to `false` in release builds, so this branch is
  // dead code (and `dev=1` in a URL does nothing) in production.
  const isDevBypass = __DEV__ && dev === '1';
  const [stage, setStage] = useState<'exchanging' | 'ready' | 'error'>(
    isDevBypass ? 'ready' : 'exchanging',
  );
  const [linkError, setLinkError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attemptedRef = useRef(false);
  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    if (isDevBypass) return; // already started on 'ready' — nothing to exchange
    // Reacting to the route param this screen was deep-linked with (an
    // external system — the email link — not derived React state), and
    // `attemptedRef` already guards against re-firing.
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkError('This link is missing its code. Request a new one from the sign-in screen.');
      setStage('error');
      return;
    }
    exchangeRecoveryCode(code).then((result) => {
      if (result.ok) {
        setStage('ready');
      } else {
        setLinkError(result.message);
        setStage('error');
      }
    });
  }, [code, isDevBypass]);

  async function onSubmit() {
    setFormError(null);
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      setFormError(passwordCheck.message!);
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    router.replace('/(app)/(tabs)');
  }

  if (stage === 'exchanging') {
    return (
      <Screen>
        <View style={styles.header}>
          <ThemedText type="title">Verifying your link…</ThemedText>
        </View>
      </Screen>
    );
  }

  if (stage === 'error') {
    return (
      <Screen>
        <View style={styles.header}>
          <ThemedText type="title">Link expired</ThemedText>
          <ThemedText themeColor="textSecondary">{linkError}</ThemedText>
        </View>
        <PrimaryButton
          label="Back to sign in"
          variant="ghost"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">Set a new password</ThemedText>
        <ThemedText themeColor="textSecondary">Choose something you haven&rsquo;t used before.</ThemedText>
        {isDevBypass ? (
          <ThemedText type="small" themeColor="warning">
            DEV TEST MODE — no real email link was clicked.
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.form}>
        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          autoFocus
        />
        <TextField
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
        />
        {formError ? (
          <ThemedText type="small" themeColor="danger">
            {formError}
          </ThemedText>
        ) : null}
        <PrimaryButton label="Save new password" loading={busy} onPress={onSubmit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  form: { gap: Spacing.three },
});
