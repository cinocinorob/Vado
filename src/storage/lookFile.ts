/**
 * La scelta dell'aspetto, letta in modo sincrono all'avvio: i colori servono
 * prima che venga disegnata qualsiasi schermata. Per questo sta in un file e
 * non nella memoria asincrona dell'app.
 */
import { File, Paths } from 'expo-file-system';

import { isLookChoice, type LookChoice } from '../core/look';

const NAME = 'vado-aspetto.json';

export function readLookChoice(): LookChoice {
  try {
    const file = new File(Paths.document, NAME);
    if (!file.exists) return 'auto';
    const parsed = JSON.parse(file.textSync()) as { look?: unknown };
    if (!isLookChoice(parsed.look)) return 'auto';
    // I temi di stagione non si scelgono più a mano: chi li aveva torna ad automatico.
    return parsed.look === 'halloween' || parsed.look === 'natale' ? 'auto' : parsed.look;
  } catch {
    return 'auto';
  }
}

export function writeLookChoice(look: LookChoice): boolean {
  try {
    const file = new File(Paths.document, NAME);
    if (!file.exists) file.create();
    file.write(JSON.stringify({ look }));
    return true;
  } catch {
    return false;
  }
}
