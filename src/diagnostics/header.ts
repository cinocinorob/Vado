/** Intestazione del registro di diagnostica: versione, telefono, stato dell'avvio automatico. */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { autoHistory, autoStatus } from '../auto/movimento';
import { BUILD } from '../update/check';
import { stamp } from './log';

export function diagHeader(): string {
  const version = Constants.expoConfig?.version ?? '?';
  const auto = autoStatus();
  const autoText = auto
    ? `avvio automatico ${auto.enabled ? 'acceso' : 'spento'}${auto.lastEvent ? `, ultimo movimento ${auto.lastEvent} ${stamp(auto.lastEventAt)}` : ''}${auto.lastNotified ? `, ultimo avviso ${stamp(auto.lastNotified)}` : ''}`
    : 'avvio automatico non disponibile';
  const history = autoHistory(stamp);
  return `Vado ${version} (n. ${BUILD}) · ${Platform.OS} ${String(Platform.Version)} · ${new Date().toISOString()} · ${autoText}${
    history.length ? `\nAvvio automatico, ultimi eventi:\n${history.join('\n')}` : ''
  }`;
}

