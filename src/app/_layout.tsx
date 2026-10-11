/** Radice dell'app: caratteri, navigazione e registrazione del rilevamento. */
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

// Importato qui perché il compito che riceve le posizioni va definito
// all'avvio del programma, prima che venga mostrata qualsiasi schermata.
import '../tracking/tracker';
import { C } from '../ui/theme';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  // Se i caratteri non si caricano l'app parte comunque con quelli di sistema.
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="classifica" options={{ animation: 'none' }} />
        <Stack.Screen name="medaglie" options={{ animation: 'none' }} />
        <Stack.Screen name="lega-nuova" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="sfida-nuova" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="nuovo" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="metro" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="in-corso" options={{ gestureEnabled: false }} />
        <Stack.Screen name="riepilogo" />
        <Stack.Screen name="riservatezza" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}
