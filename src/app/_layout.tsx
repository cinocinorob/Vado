/** Radice dell'app: caratteri, navigazione e registrazione del rilevamento. */
import { Roboto_400Regular, Roboto_500Medium, Roboto_600SemiBold, Roboto_700Bold, Roboto_800ExtraBold, Roboto_900Black } from '@expo-google-fonts/roboto';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

// Importato qui perché il compito che riceve le posizioni va definito
// all'avvio del programma, prima che venga mostrata qualsiasi schermata.
import '../tracking/tracker';
import '../reminders/schedule';
import { C, DARK_UI } from '../ui/theme';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_600SemiBold,
    Roboto_700Bold,
    Roboto_800ExtraBold,
    Roboto_900Black,
  });

  // Se i caratteri non si caricano l'app parte comunque con quelli di sistema.
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <>
      <StatusBar style={DARK_UI ? 'light' : 'dark'} />
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
        <Stack.Screen name="backup" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="bosco" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="impostazioni" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="storico" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="benvenuto" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="bus" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}
