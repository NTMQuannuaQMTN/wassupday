import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { validateEmail } from '@/lib/validation';
import { requestPasswordReset } from '@/services/auth';

/**
 * Requests a reset-link email. Always ends in the same "check your email"
 * state on success — never reveals whether the address has an account (see
 * `requestPasswordReset`).
 */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    setError(null);
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      setError(emailCheck.message!);
      return;
    }
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Screen>
        <View style={styles.header}>
          <ThemedText type="title">Check your email</ThemedText>
          <ThemedText themeColor="textSecondary">
            If an account exists for {email.trim()}, we&rsquo;ve sent a link to reset your password.
            It expires shortly, so use it soon.
          </ThemedText>
        </View>
        <PrimaryButton label="Back to sign in" variant="ghost" onPress={() => router.replace('/(auth)/sign-in')} />
        {__DEV__ ? (
          // Dev-only: the live project's Supabase auth redirect allow-list
          // hasn't been pushed yet, so a real emailed link can't reach
          // reset-password.tsx here. This jumps straight to that screen the
          // way clicking the email link would, skipping only the email round
          // trip — stripped out of release builds (`__DEV__` is `false`
          // there), never reachable in production.
          <PrimaryButton
            label="Dev: simulate clicking the email link"
            variant="ghost"
            onPress={() => router.push('/reset-password?dev=1')}
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">Reset your password</ThemedText>
        <ThemedText themeColor="textSecondary">
          Enter your email and we&rsquo;ll send you a link to set a new password.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          inputMode="email"
          returnKeyType="go"
          autoFocus
          onSubmitEditing={onSubmit}
        />
        {error ? (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        ) : null}
        <PrimaryButton label="Send reset link" loading={busy} onPress={onSubmit} />
      </View>

      <View style={styles.footer}>
        <Link href="/(auth)/sign-in" replace>
          <ThemedText type="smallBold" themeColor="accent">
            Back to sign in
          </ThemedText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  form: { gap: Spacing.three },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
