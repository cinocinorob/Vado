/**
 * Percorsi virtuali: i km fatti senza auto fanno avanzare su un itinerario
 * vero, a tappe. Ogni tappa raggiunta sblocca una cartolina. Funzioni pure.
 *
 * Le distanze tra le tappe sono approssimate (lungo il tracciato storico o il
 * cammino di oggi, arrotondate): servono al gioco, non a orientarsi.
 */
import { candyMeters } from './halloween';
import type { Trip } from './scoring';

export type Stage = { name: string; km: number; card: string };
export type Journey = { id: string; name: string; subtitle: string; stages: readonly Stage[] };

export const JOURNEYS: readonly Journey[] = [
  {
    id: 'colli',
    name: 'I sette colli',
    subtitle: 'Un giro di Roma antica, da colle a colle',
    stages: [
      { name: 'Campidoglio', km: 0, card: 'Il cuore religioso di Roma antica, con il tempio di Giove Capitolino; oggi la piazza disegnata da Michelangelo.' },
      { name: 'Palatino', km: 1.5, card: 'Qui la leggenda mette la fondazione della città; qui gli imperatori costruirono i loro palazzi.' },
      { name: 'Aventino', km: 3, card: 'Dal Giardino degli Aranci si vede mezza Roma; poco più in là c’è il buco della serratura più famoso della città.' },
      { name: 'Celio', km: 5, card: 'Colle verde e tranquillo, tra la Villa Celimontana e le basiliche paleocristiane.' },
      { name: 'Esquilino', km: 7, card: 'Su questo colle sorge Santa Maria Maggiore.' },
      { name: 'Viminale', km: 8.5, card: 'Spesso indicato come il più piccolo dei sette; il nome viene dai vimini che vi crescevano.' },
      { name: 'Quirinale', km: 10, card: 'Il palazzo in cima è stato residenza dei papi, poi dei re; oggi è del Presidente della Repubblica.' },
    ],
  },
  {
    id: 'tevere',
    name: 'Il Tevere',
    subtitle: 'Dalla sorgente al mare, seguendo il fiume di Roma',
    stages: [
      { name: 'Monte Fumaiolo', km: 0, card: 'Il Tevere nasce qui, sull’Appennino tosco-romagnolo, a più di 1.200 metri.' },
      { name: 'Sansepolcro', km: 45, card: 'La città di Piero della Francesca, nell’alta valle del Tevere.' },
      { name: 'Città di Castello', km: 70, card: 'Prima città umbra lungo il fiume.' },
      { name: 'Perugia', km: 130, card: 'Il Tevere passa ai piedi della collina, a Ponte San Giovanni.' },
      { name: 'Todi', km: 190, card: 'Il borgo sul colle guarda la valle del Tevere dall’alto.' },
      { name: 'Orte', km: 260, card: 'Il fiume scorre ormai nel Lazio.' },
      { name: 'Roma', km: 370, card: 'L’Isola Tiberina è l’unica isola del Tevere a Roma.' },
      { name: 'La foce', km: 405, card: 'Il fiume arriva al mare tra Ostia e Fiumicino, dopo circa 400 km.' },
    ],
  },
  {
    id: 'appia',
    name: 'Via Appia',
    subtitle: 'La regina delle strade, da Roma a Brindisi',
    stages: [
      { name: 'Porta Capena', km: 0, card: 'Da qui partiva la Via Appia, aperta nel 312 a.C. dal censore Appio Claudio.' },
      { name: 'Ariccia', km: 26, card: 'La strada sale sui Colli Albani; oggi c’è il ponte ottocentesco.' },
      { name: 'Terracina', km: 100, card: 'In cima al monte il santuario di Giove Anxur guarda il mare.' },
      { name: 'Formia', km: 150, card: 'Qui la tradizione colloca la tomba di Cicerone.' },
      { name: 'Capua', km: 200, card: 'L’antica Capua aveva uno degli anfiteatri più grandi del mondo romano.' },
      { name: 'Benevento', km: 255, card: 'L’Arco di Traiano segna l’inizio della Via Traiana, la variante voluta dall’imperatore per arrivare a Brindisi.' },
      { name: 'Venosa', km: 370, card: 'Città natale del poeta Orazio.' },
      { name: 'Taranto', km: 450, card: 'La strada raggiunge il mar Ionio.' },
      { name: 'Brindisi', km: 540, card: 'Le colonne sul porto segnano la fine della Via Appia: da qui si partiva per l’Oriente.' },
    ],
  },
  {
    id: 'francigena',
    name: 'Via Francigena',
    subtitle: 'Il cammino dei pellegrini, dal Gran San Bernardo a San Pietro',
    stages: [
      { name: 'Gran San Bernardo', km: 0, card: 'Il valico alpino da cui la Francigena entra in Italia.' },
      { name: 'Aosta', km: 30, card: 'L’Augusta Praetoria dei Romani, con l’arco di Augusto.' },
      { name: 'Vercelli', km: 170, card: 'Tra le risaie, la basilica di Sant’Andrea.' },
      { name: 'Pavia', km: 240, card: 'Si attraversa il Ticino sul Ponte Coperto.' },
      { name: 'Piacenza', km: 300, card: 'Il cammino supera il Po.' },
      { name: 'Passo della Cisa', km: 420, card: 'Si valica l’Appennino tra Emilia e Toscana.' },
      { name: 'Lucca', km: 540, card: 'Le mura rinascimentali, intatte, circondano tutta la città.' },
      { name: 'San Gimignano', km: 620, card: 'Le torri medievali si vedono da lontano.' },
      { name: 'Siena', km: 660, card: 'Piazza del Campo, a forma di conchiglia.' },
      { name: 'Bolsena', km: 790, card: 'Il più grande lago vulcanico d’Europa.' },
      { name: 'Viterbo', km: 830, card: 'La città dei papi, con il Palazzo Papale.' },
      { name: 'San Pietro', km: 940, card: 'La meta dei pellegrini: la basilica di San Pietro.' },
    ],
  },
];

export function journeyById(id: string): Journey | null {
  return JOURNEYS.find((j) => j.id === id) ?? null;
}

export function journeyLength(j: Journey): number {
  return j.stages[j.stages.length - 1].km;
}

export type JourneyRun = {
  journey: Journey;
  km: number;
  /** Tappe raggiunte (la prima, la partenza, è sempre raggiunta). */
  reached: number;
  next: Stage | null;
  done: boolean;
  /** Quando è stato completato, se lo è. */
  doneAt: number | null;
};

/** Avanzamento su un percorso iniziato a `startedAt`: km senza auto dei tragitti successivi. */
export function journeyRun(journey: Journey, trips: readonly Trip[], startedAt: number): JourneyRun {
  const after = trips.filter((t) => t.endedAt >= startedAt).sort((a, b) => a.endedAt - b.endedAt);
  const total = journeyLength(journey);
  let meters = 0;
  let doneAt: number | null = null;
  for (const t of after) {
    meters += candyMeters(t);
    if (doneAt === null && meters / 1000 >= total) doneAt = t.endedAt;
  }
  const km = Math.min(total, meters / 1000);
  const reached = journey.stages.filter((s) => km >= s.km - 1e-9).length;
  return { journey, km, reached, next: journey.stages[reached] ?? null, done: doneAt !== null, doneAt };
}
