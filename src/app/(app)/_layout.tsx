import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="event/new"
        options={{ presentation: 'modal', title: 'New event' }}
      />
      <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
      <Stack.Screen
        name="event/[id]/edit"
        options={{ presentation: 'modal', title: 'Edit event' }}
      />
      <Stack.Screen
        name="task/new"
        options={{ presentation: 'modal', title: 'New task' }}
      />
      <Stack.Screen
        name="task/[id]/edit"
        options={{ presentation: 'modal', title: 'Edit task' }}
      />
    </Stack>
  );
}
