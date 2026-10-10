/**
 * La sorgente dei dati di classifica, leghe e sfide usata dalle schermate.
 * Per collegare un server basta sostituire questa riga con una sorgente che
 * rispetti lo stesso contratto (types.ts).
 */
import { demoSource } from './demo';
import type { SocialSource } from './types';

export const social: SocialSource = demoSource;

export { resetDemo } from './demo';
export type * from './types';
