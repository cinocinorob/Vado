/**
 * Punto di ingresso: quello di expo-router, più il gestore del widget per la
 * schermata Home di Android (che gira anche ad app chiusa).
 */
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { widgetTaskHandler } = require('./src/widget/handler') as typeof import('./src/widget/handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
