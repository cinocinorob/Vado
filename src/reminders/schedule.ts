/**
 * I promemoria: notifiche locali programmate sul telefono. Nessun server
 * manda notifiche: "qualcuno ti ha superato" si controlla con un compito in
 * secondo piano che Android esegue ogni qualche ora.
 */
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { FORGOT_AFTER_MS, overtakers, thirstyAt } from '../core/reminders';
import { dayKey } from '../core/scoring';
import { social } from '../social';
import { loadPauses } from '../storage/pause';
import { loadReminders, loadStandings, saveStandings } from '../storage/reminders';
import { loadTrips } from '../storage/trips';

const CHANNEL = 'promemoria';
const THIRSTY_ID = 'vado-sete';
const FORGOT_ID = 'vado-termina';
const BOARD_TASK = 'vado-classifica';

let ready: Promise<void> | null = null;

function setup(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Promemoria', importance: Notifications.AndroidImportance.DEFAULT });
      }
    })().catch(() => undefined);
  }
  return ready;
}

async function allowed(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    return current.granted;
  } catch {
    return false;
  }
}

/** Chiede il permesso delle notifiche, se non c'è già. */
export async function askReminderPermission(): Promise<boolean> {
  try {
    if (await allowed()) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

async function schedule(id: string, title: string, body: string, when: number, path: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, data: { path } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(when), channelId: CHANNEL },
  });
}

/** Riprogramma il promemoria della pianta e accende o spegne il controllo della classifica. */
export async function applyReminders(now: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await setup();
  const prefs = await loadReminders();

  await Notifications.cancelScheduledNotificationAsync(THIRSTY_ID).catch(() => undefined);
  if (prefs.thirsty && (await allowed())) {
    const [trips, pauses] = await Promise.all([loadTrips(), loadPauses()]);
    const when = thirstyAt(trips, now, pauses, dayKey(now));
    if (when) await schedule(THIRSTY_ID, 'La tua pianta ha sete', 'Due giorni senza tragitti senza auto: basta una camminata e si riprende.', when, '/bosco');
  }

  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BOARD_TASK);
    if (prefs.overtaken && !registered) await BackgroundTask.registerTaskAsync(BOARD_TASK, { minimumInterval: 180 });
    if (!prefs.overtaken && registered) await BackgroundTask.unregisterTaskAsync(BOARD_TASK);
  } catch {
    // Compiti in secondo piano non disponibili: niente controllo dei sorpassi.
  }
}

let lastNudge = 0;

/**
 * Durante un tragitto: a ogni movimento il promemoria "hai dimenticato
 * Termina?" si sposta di 15 minuti in avanti. Se ci si ferma, scatta.
 */
export function nudgeForgotReminder(now: number): void {
  if (Platform.OS === 'web' || now - lastNudge < 60_000) return;
  lastNudge = now;
  (async () => {
    await setup();
    if (!(await loadReminders()).forgot || !(await allowed())) return;
    await schedule(FORGOT_ID, 'Hai dimenticato Termina?', 'Il tragitto è ancora aperto ma sei fermo da un quarto d’ora.', now + FORGOT_AFTER_MS, '/in-corso');
  })().catch(() => undefined);
}

export function cancelForgotReminder(): void {
  lastNudge = 0;
  if (Platform.OS === 'web') return;
  Notifications.cancelScheduledNotificationAsync(FORGOT_ID).catch(() => undefined);
}

/** Controlla le classifiche delle proprie leghe e avvisa dei sorpassi. */
export async function checkOvertakes(now: number): Promise<void> {
  if (!(await loadReminders()).overtaken || !(await allowed())) return;
  if (!(await social.profile())) return;
  const previous = await loadStandings();
  const next: typeof previous = {};
  for (const league of await social.leagues(now)) {
    const board = await social.board(league.id, now);
    if (!board) continue;
    const standing = board.entries.map((e) => ({ id: e.id, name: e.name, points: e.points, me: e.me }));
    next[league.id] = standing;
    const names = previous[league.id] ? overtakers(previous[league.id], standing) : [];
    if (names.length > 0) {
      await setup();
      await Notifications.scheduleNotificationAsync({
        content: { title: `${names.join(' e ')} ti ${names.length === 1 ? 'ha' : 'hanno'} superato`, body: `Nella lega ${league.name}. Un tragitto e torni davanti.`, data: { path: '/classifica' } },
        trigger: { channelId: CHANNEL },
      });
    }
  }
  await saveStandings(next);
}

// Definito all'avvio del programma, come il compito delle posizioni.
TaskManager.defineTask(BOARD_TASK, async () => {
  try {
    await checkOvertakes(Date.now());
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
