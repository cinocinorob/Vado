/**
 * La sorgente dei dati di classifica, leghe e sfide usata dalle schermate:
 * quella vera, collegata al server indicato in config.ts.
 *
 * Qui stanno solo i collegamenti con il telefono (memoria, tragitti, numeri
 * casuali); tutto il resto è in remote.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { loadTrips } from '../storage/trips';
import { SERVER } from './config';
import { remoteSource } from './remote';
import type { SocialSource } from './types';

/** Trentadue byte casuali, scritti in esadecimale: la chiave segreta del telefono. */
async function newSecret(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const social: SocialSource = remoteSource({
  rest: SERVER.rest,
  key: SERVER.key,
  storage: {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
    remove: (key) => AsyncStorage.removeItem(key),
  },
  loadTrips,
  newSecret,
});

export type * from './types';
