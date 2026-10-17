/** Aggiorna il widget quando cambiano i tragitti. Solo su Android. */
import { Platform } from 'react-native';

import { widgetData } from './data';
import { OggiWidget } from './OggiWidget';

export async function updateWidget(now: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    // Caricato solo su Android: nel browser il modulo non esiste.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    const data = await widgetData(now);
    await requestWidgetUpdate({ widgetName: 'Oggi', renderWidget: () => <OggiWidget {...data} /> });
  } catch {
    // Nessun widget sulla schermata Home, o modulo non disponibile.
  }
}
