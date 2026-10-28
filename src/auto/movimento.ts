/**
 * Avvio automatico: il telefono riconosce quando si comincia a camminare, a
 * pedalare o si sale su un mezzo (Activity Recognition di Google Play
 * services) e Vado propone con una notifica di avviare il tragitto.
 *
 * Il riconoscimento e la notifica vivono nel modulo nativo
 * modules/vado-movimento: funzionano anche ad app chiusa. Toccando la
 * notifica si apre Nuovo tragitto e la misura parte subito.
 */
import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

type Status = { available: boolean; permission: boolean; enabled: boolean; lastEvent: string; lastEventAt: number; lastNotified: number; history?: string };

type Native = {
  status(): Status;
  enable(): Promise<boolean>;
  disable(): Promise<boolean>;
  setTripActive(active: boolean): void;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('VadoMovimento') : null;

export const AUTO_SUPPORTED = !!native;

export function autoStatus(): Status | null {
  try {
    return native ? native.status() : null;
  } catch {
    return null;
  }
}

export type AutoResult = { ok: true } | { ok: false; problem: string };

/** Accende l'avvio automatico: chiede il permesso "Attività fisica" e registra il riconoscimento. */
export async function enableAuto(): Promise<AutoResult> {
  if (!native) return { ok: false, problem: 'Su questo telefono il riconoscimento del movimento non è disponibile.' };
  const status = autoStatus();
  if (status && !status.available) return { ok: false, problem: 'Servono i servizi Google Play aggiornati.' };
  if (Number(Platform.Version) >= 29) {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION).catch(() => 'denied');
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      return { ok: false, problem: 'Serve il permesso "Attività fisica": Impostazioni del telefono, App, Vado, Autorizzazioni.' };
    }
  }
  try {
    await native.enable();
    return { ok: true };
  } catch (error) {
    return { ok: false, problem: `Non sono riuscito ad accenderlo (${error instanceof Error ? error.message : 'errore'}).` };
  }
}

export async function disableAuto(): Promise<void> {
  await native?.disable().catch(() => undefined);
}

/** All'apertura dell'app: se era acceso lo si registra di nuovo (dopo un aggiornamento la registrazione si perde). */
export function refreshAuto(): void {
  const status = autoStatus();
  if (native && status?.enabled && status.permission) native.enable().catch(() => undefined);
}

/** Durante un tragitto non si propone di avviarne un altro. */
export function setTripActive(active: boolean): void {
  try {
    native?.setTripActive(active);
  } catch {
    // Modulo assente: niente da fare.
  }
}

/** Gli ultimi eventi del riconoscimento, leggibili: "28/10 08:12  piedi: avviso mandato". */
export function autoHistory(stamp: (t: number) => string): string[] {
  const raw = autoStatus()?.history ?? '';
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [t, ...rest] = line.split(' ');
      const at = Number(t);
      return Number.isFinite(at) ? `${stamp(at)}  ${rest.join(' ')}` : line;
    });
}
