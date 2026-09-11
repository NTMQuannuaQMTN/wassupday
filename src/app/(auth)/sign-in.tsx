import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { TextField } from '@/components/text-field';
import { signIn } from '@/services/auth';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    const result = await signIn({ email, password });
    setBusy(false);
    if (result.ok) return; // AuthProvider swaps the navigator.
    setError(result.message);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">wassupday</ThemedText>
        <ThemedText themeColor="textSecondary">Sign in to see your day.</ThemedText>
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
          returnKeyType="next"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
        />
        <Link href="/(auth)/forgot-password" style={styles.forgot}>
          <ThemedText type="small" themeColor="accent">
            Forgot password?
          </ThemedText>
        </Link>
        {error ? (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        ) : null}
        <PrimaryButton label="Sign in" loading={busy} onPress={onSubmit} />
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          New here?{' '}
        </ThemedText>
        <Link href="/(auth)/sign-up" replace>
          <ThemedText type="smallBold" themeColor="accent">
            Create an account
          </ThemedText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  form: { gap: Spacing.three },
  forgot: { alignSelf: 'flex-end', marginTop: -Spacing.one },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
