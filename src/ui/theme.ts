/**
 * Colori, caratteri e forme della grafica "Expressive", ispirata a Material 3
 * Expressive (Android 16 e successivi): superfici chiare a toni, schede senza
 * bordo con angoli molto tondi e a volte asimmetrici, forme a lobi, numeri
 * grandi e pesanti.
 *
 * Regola per i colori dei testi: sul chiaro si scrive in inchiostro; lime e
 * corallo sono riempimenti, mai colori di testo su bianco (non si leggono).
 * Il lime come testo va solo su fondo inchiostro.
 */
export const C = {
  /** Fondo delle schermate. */
  bg: '#F7F9EE',
  /** Fondo delle schede. */
  card: '#FFFFFF',
  /** Superficie a toni: pulsanti secondari, binari, schede neutre. */
  tonal: '#E3E8D3',
  /** Barra di navigazione in basso. */
  navBg: '#ECF0E0',
  /** Inchiostro: testi e riempimenti scuri. */
  ink: '#1A1D14',
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
  teal: '#1F6B5A',
  /** Testo principale (sul chiaro). */
  text: '#1A1D14',
  /** Testo secondario: contrasto oltre 6:1 su bianco. */
  dim: '#4F5545',
  /** Riempimenti neutri: binari delle barre, sagome bloccate. */
  faint: 'rgba(26, 29, 20, 0.12)',
  /** Linee di separazione. */
  line: 'rgba(26, 29, 20, 0.10)',
  /** Testo su fondo inchiostro. */
  onInk: '#FFFFFF',
  onInkDim: 'rgba(255, 255, 255, 0.82)',
  /** Corallo scuro per avvisi scritti su fondo chiaro (contrasto 4,6:1 su bianco). */
  alert: '#B83A17',
} as const;

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
