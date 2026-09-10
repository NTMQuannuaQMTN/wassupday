import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ErrorState, LoadingState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { EventForm } from '@/features/events/event-form';
import { notifyEventsChanged, useEvent } from '@/features/events/use-events';
import { deleteEvent, updateEvent } from '@/services/event-source';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, loading, error, refetch } = useEvent(id);

  if (loading) return <LoadingState />;
  if (error || !event) {
    return <ErrorState message={error ?? 'Event not found.'} onRetry={refetch} />;
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <EventForm
        submitLabel="Save changes"
        excludeEventId={event.id}
        initial={{
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          category: event.category,
        }}
        onSubmit={async (input) => {
          const res = await updateEvent(event.id, input);
          if (res.error) return res.error;
          notifyEventsChanged();
          router.back();
          return null;
        }}
        onDelete={() =>
          new Promise<string | null>((resolve) => {
            Alert.alert('Delete event?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  const res = await deleteEvent(event.id);
                  if (res.error) {
                    resolve(res.error);
                    return;
                  }
                  notifyEventsChanged();
                  resolve(null);
                  // Pop the edit modal and the detail screen underneath it.
                  if (router.canDismiss()) router.dismissAll();
                  else router.replace('/(app)/(tabs)');
                },
              },
            ]);
          })
        }
      />
    </ThemedView>
  );
}
