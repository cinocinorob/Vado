/**
 * Passaggio di consegne tra "Nuova lega" e "Classifica": la lega appena creata
 * (o in cui si è appena entrati) è quella da mostrare al ritorno.
 */
let pending: string | null = null;

export const leagueToOpen = {
  set(id: string): void {
    pending = id;
  },
  /** Restituisce la lega da aprire, una volta sola. */
  take(): string | null {
    const id = pending;
    pending = null;
    return id;
  },
};
