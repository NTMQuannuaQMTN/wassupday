import { router } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { EventForm } from '@/features/events/event-form';
import { notifyEventsChanged } from '@/features/events/use-events';
import { createEvent } from '@/services/events';

export default function NewEventScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <EventForm
        submitLabel="Add event"
        onSubmit={async (input) => {
          const res = await createEvent(input);
          if (res.error) return res.error;
          notifyEventsChanged();
          router.back();
          return null;
        }}
      />
    </ThemedView>
  );
}
