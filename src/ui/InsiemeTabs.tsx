/**
 * Le tre parti della scheda "Insieme": leghe, sfide e percorsi. Leghe e sfide
 * stanno nella stessa schermata, i percorsi in un'altra: questa fila di
 * pulsanti le tiene unite, così sembrano (e si usano come) una sezione sola.
 */
import { router } from 'expo-router';

import { Segmented } from './social';

export type InsiemePart = 'leghe' | 'sfide' | 'percorsi';

export function InsiemeTabs({ value, onLocal }: { value: InsiemePart; onLocal?: (part: 'leghe' | 'sfide') => void }) {
  function pick(part: InsiemePart) {
    if (part === value) return;
    if (part === 'percorsi') router.replace('/percorsi');
    else if (onLocal) onLocal(part);
    else router.replace({ pathname: '/classifica', params: { sezione: part } });
  }
  return (
    <Segmented
      label="Sezione"
      value={value}
      onChange={pick}
      options={[
        { id: 'leghe', label: 'Leghe' },
        { id: 'sfide', label: 'Sfide' },
        { id: 'percorsi', label: 'Percorsi' },
      ]}
    />
  );
}
