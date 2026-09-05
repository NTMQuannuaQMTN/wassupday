import { Redirect } from 'expo-router';

// The "Add" tab never renders — its press is intercepted in (tabs)/_layout.tsx
// to open the new-event modal. This redirect is just a safety net.
export default function AddTab() {
  return <Redirect href="/(app)/(tabs)" />;
}
