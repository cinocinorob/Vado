/**
 * Backup su file: lo crea e lo passa al foglio di condivisione di Android
 * (Drive, WhatsApp, email, File…), oppure lo legge da un file scelto
 * dall'utente. Le regole stanno in core/backup.ts; qui solo file e schermi
 * di sistema.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { backupName, buildBackup, mergeProgress, newTrips, parseBackup, type Progress } from '../core/backup';
import { social } from '../social';
import { loadJourneys, saveJourneys } from '../storage/journey';
import { loadPauses, savePauses } from '../storage/pause';
import { loadChosen, saveChosen } from '../storage/showcase';
import { loadWins, saveWins } from '../storage/wins';
import { loadTree, saveTree } from '../storage/tree';
import { loadTrips, saveTrips } from '../storage/trips';

export type Outcome = { ok: true; message: string } | { ok: false; problem: string } | { ok: 'annullato' };

async function loadProgress(): Promise<Progress> {
  const [journeys, wins, showcase] = await Promise.all([loadJourneys(), loadWins(), loadChosen()]);
  return { journeys, wins, showcase };
}

export async function exportBackup(now: number): Promise<Outcome> {
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, problem: 'Su questo telefono non riesco ad aprire la condivisione dei file.' };
    const trips = await loadTrips();
    const recovery = await social.recoveryCode();
    const file = new File(Paths.cache, backupName(now));
    if (file.exists) file.delete();
    file.create();
    const [tree, pauses, progress] = await Promise.all([loadTree(), loadPauses(), loadProgress()]);
    file.write(JSON.stringify(buildBackup(trips, recovery, now, { species: tree.species, history: tree.history, pauses }, progress)));
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Salva il backup di Vado' });
    const count = trips.length === 1 ? '1 tragitto' : `${trips.length} tragitti`;
    return { ok: true, message: `Backup creato con ${count}${recovery ? ' e il codice di recupero della classifica' : ''}. Controlla di averlo salvato dove l'hai mandato.` };
  } catch {
    return { ok: false, problem: 'Non sono riuscito a creare il file di backup. Riprova.' };
  }
}

export async function importBackup(): Promise<Outcome> {
  let text: string;
  try {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.length) return { ok: 'annullato' };
    text = await new File(picked.assets[0].uri).text();
  } catch {
    return { ok: false, problem: 'Non riesco a leggere il file scelto.' };
  }

  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;

  const added = newTrips(await loadTrips(), parsed.trips);
  await saveTrips(added);
  const parts = [
    added.length === 0 ? 'Nessun tragitto nuovo: erano già tutti sul telefono.' : `${added.length === 1 ? 'Aggiunto 1 tragitto' : `Aggiunti ${added.length} tragitti`}.`,
  ];
  if (parsed.plant) {
    // Albero e bosco: si prendono dal file solo se qui non ce ne sono già.
    const tree = await loadTree();
    if (!tree.species && parsed.plant.species) {
      await saveTree({ species: parsed.plant.species, history: tree.history.length >= parsed.plant.history.length ? tree.history : parsed.plant.history });
      parts.push('Albero e bosco ritrovati.');
    }
    const pauses = await loadPauses();
    if (pauses.length === 0 && parsed.plant.pauses.length > 0) await savePauses(parsed.plant.pauses);
  }
  if (parsed.progress) {
    const merged = mergeProgress(await loadProgress(), parsed.progress);
    await Promise.all([saveJourneys(merged.journeys), saveWins(merged.wins), saveChosen(merged.showcase)]);
  }
  if (parsed.ignored > 0) parts.push(`${parsed.ignored} righe del file erano rovinate e sono state saltate.`);

  if (parsed.recovery) {
    const current = await social.profile();
    if (!current) {
      const restored = await social.recover(parsed.recovery);
      parts.push(restored.ok ? `Profilo della classifica "${restored.value.nickname}" ritrovato.` : `Profilo della classifica non ritrovato: ${restored.problem}`);
    } else {
      parts.push(`Il profilo della classifica di questo telefono ("${current.nickname}") è rimasto quello: per usare l'altro, inserisci il suo codice qui sotto.`);
    }
  }
  return { ok: true, message: parts.join(' ') };
}
