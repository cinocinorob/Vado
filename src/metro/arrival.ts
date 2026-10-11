/**
 * Dove si trova adesso il telefono, per "Ho preso la metro".
 *
 * È l'unico momento, fuori da un tragitto, in cui l'app legge la posizione:
 * una lettura sola, chiesta da un tocco dell'utente, usata per riconoscere la
 * stazione di uscita e poi buttata. Non viene salvata.
 */
import * as Location from 'expo-location';

import { ARRIVAL_MAX_ACCURACY_M, ARRIVAL_RADIUS_M, nearestStation, type Station } from '../core/metro';
import { ROMA } from '../data/metro';

export type Arrival =
  | { kind: 'ok'; station: Station; meters: number }
  /** Permesso di posizione negato. */
  | { kind: 'permesso' }
  /** Nessuna posizione entro il tempo di attesa. */
  | { kind: 'assente' }
  /** Posizione troppo incerta per dire a quale stazione si è. */
  | { kind: 'incerta'; accuracy: number }
  /** Posizione generata da un'app di simulazione. */
  | { kind: 'simulata' }
  /** Nessuna stazione entro il raggio. */
  | { kind: 'lontano' };

const WAIT_MS = 15_000;

function timeout<T>(ms: number): Promise<T | null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

export async function locateArrival(): Promise<Arrival> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { kind: 'permesso' };
  } catch {
    return { kind: 'permesso' };
  }

  let location: Location.LocationObject | null = null;
  try {
    location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeout<Location.LocationObject>(WAIT_MS),
    ]);
  } catch {
    location = null;
  }
  // Appena usciti dalla stazione la lettura nuova può tardare: va bene anche
  // l'ultima nota, se è di meno di un minuto fa.
  if (!location) {
    location = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: ARRIVAL_MAX_ACCURACY_M }).catch(() => null);
  }
  if (!location) return { kind: 'assente' };
  if (location.mocked === true) return { kind: 'simulata' };

  const accuracy = location.coords.accuracy ?? Infinity;
  if (accuracy > ARRIVAL_MAX_ACCURACY_M) return { kind: 'incerta', accuracy };

  const found = nearestStation(ROMA, { lat: location.coords.latitude, lon: location.coords.longitude }, ARRIVAL_RADIUS_M);
  return found ? { kind: 'ok', station: found.station, meters: found.meters } : { kind: 'lontano' };
}
