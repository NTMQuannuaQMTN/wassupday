import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  loading?: boolean;
  variant?: 'solid' | 'ghost';
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, loading, variant = 'solid', disabled, style, ...rest }: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const solid = variant === 'solid';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: solid ? theme.accent : 'transparent',
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={solid ? '#fff' : theme.accent} />
      ) : (
        <ThemedText type="smallBold" style={{ color: solid ? '#fff' : theme.accent }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
});
