import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { validateDisplayName, validateEmail, validatePassword } from '@/lib/validation';
import { signUp } from '@/services/auth';

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const nextErrors = {
      name: validateDisplayName(displayName).message,
      email: validateEmail(email).message,
      password: validatePassword(password).message,
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.email || nextErrors.password) return;

    setBusy(true);
    const result = await signUp({ displayName, email, password });
    setBusy(false);

    if (result.ok) return; // AuthProvider swaps the navigator.
    setFormError(result.message);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">Create account</ThemedText>
        <ThemedText themeColor="textSecondary">A calm daily planner. Takes a few seconds.</ThemedText>
      </View>

      <View style={styles.form}>
        <TextField
          label="Name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          error={errors.name}
          maxLength={60}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          textContentType="username"
          error={errors.email}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
          onSubmitEditing={onSubmit}
        />
        {formError ? (
          <ThemedText type="small" themeColor="danger">
            {formError}
          </ThemedText>
        ) : null}
        <PrimaryButton label="Create account" loading={busy} onPress={onSubmit} />
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          Already have an account?{' '}
        </ThemedText>
        <Link href="/(auth)/sign-in" replace>
          <ThemedText type="smallBold" themeColor="accent">
            Sign in
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
