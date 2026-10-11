/**
 * Dove sta il server di classifica, leghe e sfide.
 *
 * I due valori sono pubblici per costruzione: la chiave "publishable" di
 * Supabase è fatta per stare dentro un'app. Con lei si possono solo chiamare
 * le funzioni elencate in supabase/schema.sql; le tabelle non sono
 * raggiungibili. La chiave segreta del progetto non va mai messa qui.
 */
export const SERVER = {
  rest: 'https://fqynpsucjgffjmwcclmw.supabase.co/rest/v1',
  key: 'sb_publishable_veqzw4lUYrx-mZix7kQ3hw_ZUnlcP_y',
} as const;
