/**
 * Colori, caratteri e forme della grafica "Adesivi": fondo chiaro, inchiostro
 * scuro, schede bianche con bordo spesso e ombra piena (senza sfumatura), come
 * le figurine di un album.
 *
 * Regola per i colori dei testi: sul chiaro si scrive in inchiostro; lime e
 * corallo sono riempimenti, mai colori di testo su bianco (non si leggono).
 * Il lime come testo va solo su fondo inchiostro.
 */
export const C = {
  /** Fondo delle schermate. */
  bg: '#F4F7EC',
  /** Fondo delle schede. */
  card: '#FFFFFF',
  /** Inchiostro: testi, bordi, ombre. */
  ink: '#0B1F2A',
  lime: '#C8F560',
  /** Lime chiaro per le righe selezionate. */
  limeSoft: '#E9FAC0',
  coral: '#FF8A65',
  coralSoft: '#FFE3D8',
  teal: '#1F5266',
  /** Testo principale (sul chiaro). */
  text: '#0B1F2A',
  /** Testo secondario: inchiostro al 74%, contrasto oltre 7:1 su bianco. */
  dim: 'rgba(11, 31, 42, 0.74)',
  /** Riempimenti neutri: binari delle barre, sagome bloccate. */
  faint: 'rgba(11, 31, 42, 0.12)',
  /** Linee di separazione. */
  line: 'rgba(11, 31, 42, 0.10)',
  /** Testo su fondo inchiostro. */
  onInk: '#FFFFFF',
  onInkDim: 'rgba(255, 255, 255, 0.85)',
  /** Corallo scuro per avvisi scritti su fondo chiaro (contrasto 4,6:1 su bianco). */
  alert: '#B83A17',
} as const;

export const F = {
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  displayMedium: 'Fredoka_500Medium',
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const;

/** Spessore del bordo delle schede e dei pulsanti. */
export const BORDER = 3;

/** Ombra piena sotto una scheda: stessa forma, spostata in basso, senza sfumatura. */
export const shadow = (depth = 5, color: string = C.ink) => ({ boxShadow: `0px ${depth}px 0px 0px ${color}` });

/** Il bordo e il fondo di una scheda. */
export const card = {
  backgroundColor: C.card,
  borderColor: C.ink,
  borderWidth: BORDER,
} as const;
