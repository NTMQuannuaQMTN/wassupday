import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/datetime-field';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { validateTaskInput, type TaskInput } from '@/services/task-source';
import type { TaskPriority, TaskStatus } from '@/types/models';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function defaultDueDate(initial?: { dueDate?: string | null }): Date {
  if (initial?.dueDate) return new Date(initial.dueDate);
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d;
}

export interface TaskFormProps {
  initial?: {
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    priority?: TaskPriority;
    estimatedDuration?: number | null;
  };
  /** Present only when editing — shows the "mark complete / not done" toggle. */
  currentStatus?: TaskStatus;
  submitLabel: string;
  onSubmit: (input: TaskInput) => Promise<string | null>;
  onDelete?: () => Promise<string | null>;
  onToggleStatus?: () => Promise<string | null>;
}

export function TaskForm({
  initial,
  currentStatus,
  submitLabel,
  onSubmit,
  onDelete,
  onToggleStatus,
}: TaskFormProps) {
  const theme = useTheme();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [hasDueDate, setHasDueDate] = useState(initial?.dueDate != null);
  // Lazy initializer: only needs to run once, to seed from `initial` at mount.
  const [dueDate, setDueDate] = useState<Date>(() => defaultDueDate(initial));
  const [estimatedDuration, setEstimatedDuration] = useState(
    initial?.estimatedDuration != null ? String(initial.estimatedDuration) : '',
  );
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'delete' | 'toggle'>(null);

  async function handleSubmit() {
    setError(null);
    const duration = estimatedDuration.trim() ? Number(estimatedDuration.trim()) : null;
    const input: TaskInput = {
      title,
      priority,
      dueDate: hasDueDate ? dueDate.toISOString() : null,
      estimatedDuration: duration != null && Number.isFinite(duration) ? duration : null,
      description: description.trim() || null,
    };
    const localError = validateTaskInput(input);
    if (localError) {
      setError(localError);
      return;
    }
    setBusy('save');
    const submitError = await onSubmit(input);
    setBusy(null);
    if (submitError) setError(submitError);
  }

  async function handleDelete() {
    if (!onDelete) return;
    setError(null);
    setBusy('delete');
    const deleteError = await onDelete();
    setBusy(null);
    if (deleteError) setError(deleteError);
  }

  async function handleToggleStatus() {
    if (!onToggleStatus) return;
    setError(null);
    setBusy('toggle');
    const toggleError = await onToggleStatus();
    setBusy(null);
    if (toggleError) setError(toggleError);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive">
      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Finish assignment"
        autoFocus={!initial}
        maxLength={200}
      />

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Priority
        </ThemedText>
        <View style={styles.chips}>
          {PRIORITIES.map((p) => {
            const active = p.value === priority;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPriority(p.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.accent : theme.backgroundElement,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}>
                <ThemedText type="small" style={{ color: active ? '#fff' : theme.text }}>
                  {p.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <View style={styles.dueDateHeader}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Due date
          </ThemedText>
          <Pressable
            onPress={() => setHasDueDate((v) => !v)}
            style={[
              styles.toggle,
              { backgroundColor: hasDueDate ? theme.accent : theme.backgroundElement, borderColor: theme.border },
            ]}>
            <ThemedText type="small" style={{ color: hasDueDate ? '#fff' : theme.textSecondary }}>
              {hasDueDate ? 'On' : 'None'}
            </ThemedText>
          </Pressable>
        </View>
        {hasDueDate ? <DateTimeField label="Date & time" value={dueDate} onChange={setDueDate} /> : null}
      </View>

      <TextField
        label="Estimated duration (minutes)"
        value={estimatedDuration}
        onChangeText={(t) => setEstimatedDuration(t.replace(/[^\d]/g, ''))}
        placeholder="Optional"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={4}
      />
      <TextField
        label="Notes"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional"
        multiline
        numberOfLines={3}
        maxLength={2000}
        style={styles.multiline}
      />

      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}

      <PrimaryButton label={submitLabel} loading={busy === 'save'} onPress={handleSubmit} />
      {onToggleStatus ? (
        <PrimaryButton
          label={currentStatus === 'completed' ? 'Mark as not done' : 'Mark complete'}
          variant="ghost"
          loading={busy === 'toggle'}
          disabled={busy != null && busy !== 'toggle'}
          onPress={handleToggleStatus}
        />
      ) : null}
      {onDelete ? (
        <Pressable onPress={handleDelete} disabled={busy != null} style={styles.delete}>
          <ThemedText type="smallBold" themeColor="danger">
            {busy === 'delete' ? 'Deleting…' : 'Delete task'}
          </ThemedText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  field: { gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  dueDateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  delete: { alignItems: 'center', padding: Spacing.two },
});
