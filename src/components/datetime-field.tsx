import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, toLocalDateKey } from '@/lib/time';

type Props = {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  error?: string;
  minimumDate?: Date;
};

/** A labelled control that edits one instant via the native date + time pickers. */
export function DateTimeField({ label, value, onChange, error, minimumDate }: Props) {
  const [picking, setPicking] = useState<null | 'date' | 'time'>(null);

  function apply(mode: 'date' | 'time') {
    return (_e: DateTimePickerEvent, next?: Date) => {
      // Android fires with type 'dismissed' and no date; iOS keeps the sheet open.
      if (Platform.OS === 'android') setPicking(null);
      if (!next) return;
      const merged = new Date(value);
      if (mode === 'date') {
        merged.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
      } else {
        merged.setHours(next.getHours(), next.getMinutes(), 0, 0);
      }
      onChange(merged);
    };
  }

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.row}>
        <Chip
          text={formatDateLabel(value)}
          active={picking === 'date'}
          onPress={() => setPicking(picking === 'date' ? null : 'date')}
        />
        <Chip
          text={formatClock(value)}
          active={picking === 'time'}
          onPress={() => setPicking(picking === 'time' ? null : 'time')}
        />
      </View>

      {picking && (
        <DateTimePicker
          value={value}
          mode={picking}
          minimumDate={minimumDate}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={apply(picking)}
        />
      )}
      {picking && Platform.OS === 'ios' && (
        <Pressable onPress={() => setPicking(null)} style={styles.done}>
          <ThemedText type="smallBold" themeColor="accent">
            Done
          </ThemedText>
        </Pressable>
      )}

      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Chip({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: active ? theme.accent : theme.border,
        },
      ]}>
      <ThemedText type="small">{text}</ThemedText>
    </Pressable>
  );
}

function formatDateLabel(d: Date): string {
  const today = toLocalDateKey(new Date());
  const key = toLocalDateKey(d);
  if (key === today) return 'Today';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  done: { alignSelf: 'flex-end', padding: Spacing.two },
});
