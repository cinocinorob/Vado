/**
 * Colori, caratteri e forme della grafica "Expressive", ispirata a Material 3
 * Expressive (Android 16 e successivi): superfici chiare a toni, schede senza
 * bordo con angoli molto tondi e a volte asimmetrici, forme a lobi, numeri
 * grandi e pesanti.
 *
 * Tre tavolozze con gli stessi nomi: chiara, scura e Halloween.
 * Regole: `text`/`dim` sui fondi e sulle schede; `ink` sopra i riempimenti
 * vivaci (lime, corallo, menta, pastelli), scuro in ogni tema; `strong` per i
 * riempimenti forti con sopra `onStrong`.
 */
import { Appearance } from 'react-native';

import { resolveLook, type Look } from '../core/look';
import { readLookChoice } from '../storage/lookFile';

const LIGHT = {
  /** Fondo delle schermate. */
  bg: '#F7F9EE',
  /** Fondo delle schede. */
  card: '#FFFFFF',
  /** Superficie a toni: pulsanti secondari, binari, schede neutre. */
  tonal: '#E3E8D3',
  /** Barra di navigazione in basso. */
  navBg: '#ECF0E0',
  /** Scuro per i contenuti sopra i riempimenti vivaci (lime, corallo, menta, pastelli). Scuro in tutti i temi. */
  ink: '#1A1D14',
  /** Superficie scura in ogni tema (cronometro del tragitto, serie di giorni), con sopra lime e bianco. */
  deep: '#1A1D14',
  /** Riempimento forte (etichette, pulsante principale, interruttore acceso), con sopra onStrong. */
  strong: '#1A1D14',
  onStrong: '#C8F560',
  /** Il blocco principale in cima a Oggi e al riepilogo. */
  hero: '#C8F560',
  /** Secondo giro dell'anello, oltre l'obiettivo. */
  over: '#FF8A65',
  lime: '#C8F560',
  /** Lime chiaro per le righe selezionate. */
  limeSoft: '#E9FAC0',
  /** Testo scuro su lime. */
  onLime: '#2E3B10',
  coral: '#FF8A65',
  coralSoft: '#FFDBCF',
  /** Testo scuro su corallo. */
  onCoral: '#3A1306',
  onCoralDim: '#6E2A14',
  /** Verde acqua: CO₂ e pianta. */
  mint: '#CDEFE6',
  onMint: '#04241D',
  onMintDim: '#0D4A3E',
  /** Verde per testi su schede (CO₂, verificato). */
  teal: '#1F6B5A',
  /** Testo principale, su fondo e schede. */
  text: '#1A1D14',
  /** Testo secondario. */
  dim: '#4F5545',
  /** Contorni e binari sulle schede. */
  outline: '#74796D',
  /** Riempimenti neutri: binari delle barre, sagome bloccate. */
  faint: 'rgba(26, 29, 20, 0.12)',
  /** Linee di separazione. */
  line: 'rgba(26, 29, 20, 0.10)',
  /** Testo su fondo scuro fisso. */
  onInk: '#FFFFFF',
  onInkDim: 'rgba(255, 255, 255, 0.82)',
  /** Avvisi scritti su fondo e schede. */
  alert: '#B83A17',
};

export type Palette = typeof LIGHT;

const DARK: Palette = {
  ...LIGHT,
  bg: '#12140F',
  card: '#1E2119',
  tonal: '#2E3327',
  navBg: '#191C15',
  deep: '#0A0B08',
  strong: '#C8F560',
  onStrong: '#1A1D14',
  limeSoft: '#D5F29A',
  coralSoft: '#FFC9B6',
  mint: '#A9DCCF',
  teal: '#8ED9C6',
  text: '#EEF1E6',
  dim: '#B4BAA8',
  outline: '#8D9383',
  faint: 'rgba(238, 241, 230, 0.16)',
  line: 'rgba(238, 241, 230, 0.12)',
  alert: '#FF9C85',
};

/** La notte di Halloween: viola notte, zucca e lime "slime". */
const HALLOWEEN: Palette = {
  ...DARK,
  bg: '#15101C',
  card: '#221A2C',
  tonal: '#352A44',
  navBg: '#1B1424',
  ink: '#170F1E',
  deep: '#0C0711',
  strong: '#B8F23A',
  onStrong: '#170F1E',
  hero: '#FF8A2A',
  over: '#B98CFF',
  lime: '#B8F23A',
  limeSoft: '#D6F59A',
  onLime: '#24310A',
  coral: '#FF8A2A',
  coralSoft: '#FFC48A',
  onCoral: '#2A1205',
  onCoralDim: '#5A2A08',
  mint: '#BFB0E8',
  onMint: '#1C1233',
  onMintDim: '#3A2A63',
  teal: '#C7B6FF',
  text: '#F3EEF8',
  dim: '#B8AECB',
  outline: '#8E82A3',
  faint: 'rgba(243, 238, 248, 0.16)',
  line: 'rgba(243, 238, 248, 0.12)',
  alert: '#FF9C85',
};

/** Natale: verde abete, rosso, oro e neve. */
const NATALE: Palette = {
  ...DARK,
  bg: '#0E1814',
  card: '#182620',
  tonal: '#26382F',
  navBg: '#121F1A',
  ink: '#1C0E0C',
  deep: '#07100C',
  strong: '#F5D36E',
  onStrong: '#1C0E0C',
  hero: '#FF7468',
  over: '#F5D36E',
  lime: '#A8E68E',
  limeSoft: '#CDF2BE',
  onLime: '#163112',
  coral: '#FF7468',
  coralSoft: '#FFB8AF',
  onCoral: '#2A0B07',
  onCoralDim: '#5E1C14',
  mint: '#BFE6D6',
  onMint: '#0D2A20',
  onMintDim: '#2C5545',
  teal: '#9FE3C9',
  text: '#F1F6F2',
  dim: '#AFC4B9',
  outline: '#86A094',
  faint: 'rgba(241, 246, 242, 0.16)',
  line: 'rgba(241, 246, 242, 0.12)',
  alert: '#FF9C85',
};

/** L'aspetto scelto all'avvio. Cambiarlo richiede di riaprire l'app. */
export const LOOK: Look = resolveLook(readLookChoice(), Date.now(), Appearance.getColorScheme() === 'dark');
export const HALLOWEEN_ON = LOOK === 'halloween';
export const NATALE_ON = LOOK === 'natale';
export const DARK_UI = LOOK !== 'chiaro';

export const C: Palette = LOOK === 'halloween' ? HALLOWEEN : LOOK === 'natale' ? NATALE : LOOK === 'scuro' ? DARK : LIGHT;

/** Roboto, il carattere di Android, nei pesi pieni che usa Material 3 Expressive. */
export const F = {
  display: 'Roboto_800ExtraBold',
  displayBold: 'Roboto_900Black',
  displayMedium: 'Roboto_700Bold',
  body: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  semi: 'Roboto_600SemiBold',
  bold: 'Roboto_700Bold',
} as const;

/** Spessore del contorno dei campi di testo. Le schede non hanno bordo. */
export const BORDER = 2;

/** Le superfici sono piatte: nessuna ombra. Resta per compatibilità con le schermate. */
export const shadow = (_depth = 5, _color: string = C.ink) => ({});

/** Il fondo di una scheda. */
export const card = {
  backgroundColor: C.card,
} as const;

/** Angoli: grandi per le schede, molto grandi per i blocchi principali. */
export const R = { card: 28, hero: 40, row: 24, inner: 6 } as const;
