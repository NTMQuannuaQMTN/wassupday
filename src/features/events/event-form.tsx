import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/datetime-field';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { detectConflicts } from '@/lib/conflicts';
import { endOfLocalDay, startOfLocalDay } from '@/lib/time';
import { listEventsInRange, validateEventInput, type EventInput } from '@/services/events';
import type { CalendarEvent, EventCategory } from '@/types/models';

/** Placeholder id for the in-progress draft when checking it against saved events. */
const DRAFT_ID = '__draft__';
/** Debounce the conflict check so rapid date/time-picker changes don't spam the network. */
const CONFLICT_CHECK_DEBOUNCE_MS = 400;

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'personal', label: 'Personal' },
  { value: 'health', label: 'Health' },
  { value: 'social', label: 'Social' },
  { value: 'other', label: 'Other' },
];

function nextHour(from = new Date()): Date {
  const d = new Date(from);
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

function defaultStart(initial?: { startTime?: string }): Date {
  return initial?.startTime ? new Date(initial.startTime) : nextHour();
}

function defaultEnd(initial?: { startTime?: string; endTime?: string }): Date {
  if (initial?.endTime) return new Date(initial.endTime);
  return new Date(defaultStart(initial).getTime() + 3_600_000);
}

export interface EventFormProps {
  initial?: {
    title?: string;
    description?: string | null;
    startTime?: string;
    endTime?: string;
    location?: string | null;
    category?: EventCategory;
  };
  /** The event being edited, if any — excluded from its own conflict check. */
  excludeEventId?: string;
  submitLabel: string;
  onSubmit: (input: EventInput) => Promise<string | null>;
  onDelete?: () => Promise<string | null>;
}

export function EventForm({
  initial,
  excludeEventId,
  submitLabel,
  onSubmit,
  onDelete,
}: EventFormProps) {
  const theme = useTheme();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<EventCategory>(initial?.category ?? 'other');
  // Lazy initializers: this only needs to run once, to seed local state from
  // `initial` (or sensible defaults) at mount — not memoized per render.
  const [start, setStart] = useState<Date>(() => defaultStart(initial));
  const [end, setEnd] = useState<Date>(() => defaultEnd(initial));
  const [location, setLocation] = useState(initial?.location ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'delete'>(null);
  const [conflictHint, setConflictHint] = useState<string | null>(null);

  function setStartKeepingDuration(next: Date) {
    const durationMs = end.getTime() - start.getTime();
    setStart(next);
    if (durationMs > 0) setEnd(new Date(next.getTime() + durationMs));
  }

  // Unobtrusive, non-blocking hint: re-check for a conflict whenever the
  // draft's time window changes. Never blocks handleSubmit — this is the
  // "wired into the event save flow" active half; the passive half is that
  // `notifyEventsChanged()` + the Today dashboard's focus-refetch already
  // recompute conflicts for real once the event is actually saved.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (end.getTime() <= start.getTime()) {
        setConflictHint(null); // validation will surface this; don't also flag it as a conflict
        return;
      }
      listEventsInRange(startOfLocalDay(start).toISOString(), endOfLocalDay(end).toISOString()).then(
        (res) => {
          if (!active || !res.data) return;
          const draft: CalendarEvent = {
            id: DRAFT_ID,
            userId: '',
            title: title.trim() || 'This event',
            description: null,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            location: null,
            category,
            source: 'manual',
            createdAt: '',
            updatedAt: '',
          };
          const others = res.data.filter((e) => e.id !== excludeEventId);
          const hit = detectConflicts([...others, draft]).find(
            (c) => c.a.id === DRAFT_ID || c.b.id === DRAFT_ID,
          );
          if (!hit) {
            setConflictHint(null);
            return;
          }
          const other = hit.a.id === DRAFT_ID ? hit.b : hit.a;
          setConflictHint(`Overlaps with ${other.title}`);
        },
      );
    }, CONFLICT_CHECK_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // `title`/`category` are read here only to label the in-memory draft —
    // they don't affect whether a conflict exists or which other event is
    // found, so they're deliberately excluded to avoid re-checking on every
    // keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, excludeEventId]);

  async function handleSubmit() {
    setError(null);
    const input: EventInput = {
      title,
      category,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      location: location.trim() || null,
      description: description.trim() || null,
    };
    const localError = validateEventInput(input);
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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive">
      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="CS1231S Lecture"
        autoFocus={!initial}
        maxLength={200}
      />

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Category
        </ThemedText>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => {
            const active = c.value === category;
            return (
              <Pressable
                key={c.value}
                onPress={() => setCategory(c.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.accent : theme.backgroundElement,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}>
                <ThemedText type="small" style={{ color: active ? '#fff' : theme.text }}>
                  {c.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <DateTimeField label="Starts" value={start} onChange={setStartKeepingDuration} />
      <DateTimeField label="Ends" value={end} onChange={setEnd} minimumDate={start} />
      {conflictHint ? (
        <ThemedText type="small" themeColor="danger">
          ⚠ {conflictHint}
        </ThemedText>
      ) : null}

      <TextField
        label="Location"
        value={location}
        onChangeText={setLocation}
        placeholder="Optional"
        maxLength={200}
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
      {onDelete ? (
        <Pressable onPress={handleDelete} disabled={busy != null} style={styles.delete}>
          <ThemedText type="smallBold" themeColor="danger">
            {busy === 'delete' ? 'Deleting…' : 'Delete event'}
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
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  delete: { alignItems: 'center', padding: Spacing.two },
});
