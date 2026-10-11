/** Schermata "Oggi": punti del giorno, obiettivo e tragitti fatti. */
import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appName } from '../core/health';
import { getMode } from '../core/modes';
import { DAILY_GOAL, dayKey, streak, summarizeDay, type Trip } from '../core/scoring';
import { connectHealth, forgetImportedBefore, refreshHealth, type HealthState } from '../health/sync';
import { openHealthSettings } from '../health/connect';
import { resetDemo } from '../social';
import { clearTrips, loadTrips } from '../storage/trips';
import { useActiveTrip } from '../tracking/store';
import { restoreTracking } from '../tracking/tracker';
import { currentLeg } from '../tracking/tripState';
import { dateLabel, integer, km } from '../ui/format';
import { BottomNav, NAV_SPACE } from '../ui/BottomNav';
import { HeroBlock, StickerChip, chipText } from '../ui/Hero';
import { ChevronIcon, FlameIcon, HeartIcon } from '../ui/Icons';
import { Mascot, StickerMascot } from '../ui/Mascot';
import { BonusRow, Divider, GUTTER, GhostButton, LegRow, ModeBadge, Panel, ProgressBar, Screen, text } from '../ui/parts';
import { BORDER, C, F, shadow } from '../ui/theme';

export default function Oggi() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [healthNote, setHealthNote] = useState<string | null>(null);
  const [healthProblem, setHealthProblem] = useState<string | null>(null);
  const active = useActiveTrip();
  // L'ora si aggiorna a ogni ritorno sulla schermata, non a ogni ridisegno.
  const [now, setNow] = useState(() => Date.now());

  const applyHealth = useCallback((state: HealthState) => {
    setHealth(state);
    if (state.imported.length > 0) {
      const points = state.imported.reduce((sum, t) => sum + t.total, 0);
      const count = state.imported.length;
      setHealthNote(`${count === 1 ? 'Importata 1 attività' : `Importate ${count} attività`}: +${points} punti`);
      loadTrips().then(setTrips);
    }
  }, []);

  async function connect() {
    setConnecting(true);
    setHealthNote(null);
    setHealthProblem(null);
    try {
      const state = await connectHealth(Date.now());
      applyHealth(state);
      if (!state.connected) setHealthProblem('Collegamento non attivato: non è stato concesso nessun permesso.');
    } finally {
      setConnecting(false);
    }
  }

  // Ricarica lo storico ogni volta che si torna su questa schermata.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setNow(Date.now());
      loadTrips().then((loaded) => {
        if (alive) setTrips(loaded);
      });
      // Se Connessione Salute è collegata, si leggono i passi di oggi e le
      // attività nuove. Succede solo qui, ad app aperta.
      refreshHealth(Date.now())
        .then((state) => {
          if (alive) applyHealth(state);
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [applyHealth]),
  );

  // Se l'app era stata chiusa a tragitto aperto, lo si recupera.
  useEffect(() => {
    restoreTracking().catch(() => undefined);
  }, []);

  const today = summarizeDay(trips, dayKey(now));
  const days = streak(trips, now);
  const rows = today.trips.flatMap((trip) => [
    ...trip.legs.map((leg, i) => ({
      key: `${trip.id}-${i}`,
      leg,
      bonus: 0,
      caption:
        trip.source === 'salute' ? `Registrato da ${appName(trip.sourceApp)}` : trip.source === 'metro' ? 'Registrato a posteriori' : undefined,
    })),
    ...(trip.bonus > 0 ? [{ key: `${trip.id}-bonus`, leg: null, bonus: trip.bonus, caption: undefined }] : []),
  ]);
  const healthSteps = health?.connected ? health.todaySteps : null;

  async function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    await clearTrips();
    // Le attività già importate non devono rientrare alla prossima lettura.
    await forgetImportedBefore(Date.now());
    // Anche soprannome, leghe e sfide dell'anteprima.
    await resetDemo();
    setTrips([]);
    setHealthNote(null);
    setConfirmReset(false);
  }

  return (
    <Screen bleed>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <HeroBlock
          caption={dateLabel(now)}
          title="Oggi"
          right={
            days > 0 ? (
              <StickerChip label={`Serie di ${days} giorni`}>
                <FlameIcon />
                <Text style={chipText}>{days === 1 ? '1 giorno' : `${days} giorni di fila`}</Text>
              </StickerChip>
            ) : null
          }
        >
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroPoints}>{today.points}</Text>
              <Text style={styles.heroLabel}>punti oggi</Text>
            </View>
            <View style={styles.heroMascot}>
              <StickerMascot size={132} disc={C.coral} />
            </View>
          </View>
          <ProgressBar value={today.points} max={DAILY_GOAL} label="Obiettivo di oggi" detail={`${today.points} di ${DAILY_GOAL}`} />
        </HeroBlock>

        <View style={styles.body}>
          <View style={styles.stats}>
            <View style={[styles.stat, styles.statLight]}>
              <Text style={text.value}>{km(today.carFreeMeters)}</Text>
              <Text style={styles.statLabel}>senza auto privata</Text>
            </View>
            <View style={[styles.stat, styles.statDark]}>
              <Text style={[text.value, { color: C.lime }]}>{integer(healthSteps ?? today.steps)}</Text>
              <Text style={[styles.statLabel, { color: C.onInkDim }]}>{healthSteps != null ? 'passi oggi' : 'passi nei tragitti'}</Text>
            </View>
          </View>

          {active ? (
            <Pressable
              onPress={() => router.push('/in-corso')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.activeBanner, pressed ? [shadow(1), { transform: [{ translateY: 4 }] }] : shadow(5)]}
            >
              <ModeBadge mode={currentLeg(active).mode} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>Tragitto in corso</Text>
                <Text style={styles.activeDetail}>{getMode(currentLeg(active).mode).label}: tocca per riaprirlo</Text>
              </View>
            </Pressable>
          ) : null}

          {!active ? (
            <Pressable
              onPress={() => router.push('/metro')}
              accessibilityRole="button"
              accessibilityLabel="Ho preso la metro"
              style={({ pressed }) => [styles.metro, pressed ? [shadow(1), { transform: [{ translateY: 3 }] }] : shadow(4)]}
            >
              <ModeBadge mode="tpl" />
              <View style={{ flex: 1 }}>
                <Text style={styles.metroTitle}>Ho preso la metro</Text>
                <Text style={text.small}>Dimenticato di avviare? Registrala all&apos;uscita.</Text>
              </View>
              <ChevronIcon size={18} color={C.ink} />
            </Pressable>
          ) : null}

          <Panel>
            <Text style={[text.h2, { marginBottom: 6 }]} accessibilityRole="header">
              Tragitti di oggi
            </Text>
            {rows.length === 0 ? (
              <View style={styles.empty}>
                <Mascot size={84} tilt={-6} />
                <Text style={[text.body, { textAlign: 'center' }]}>
                  Ancora nessun tragitto. Tocca il pulsante tondo in basso, scegli come ti muovi e premi Avvia: i punti arrivano a fine
                  percorso.
                </Text>
              </View>
            ) : (
              rows.map((row, i) => (
                <Fragment key={row.key}>
                  {i > 0 ? <Divider /> : null}
                  {row.leg ? <LegRow leg={row.leg} caption={row.caption} /> : <BonusRow points={row.bonus} />}
                </Fragment>
              ))
            )}
          </Panel>

          {health && health.status !== 'non-disponibile' ? (
            <Panel style={styles.health}>
              <View style={styles.healthHead}>
                <View style={[styles.healthIcon, health.connected && { backgroundColor: C.lime }]}>
                  <HeartIcon size={20} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.healthTitle} accessibilityRole="header">
                    Connessione Salute
                  </Text>
                  <Text style={text.small}>
                    {health.status === 'da-aggiornare'
                      ? 'Da aggiornare dal Play Store prima di poterla collegare.'
                      : health.connected
                        ? "Collegata: passi e attività vengono letti quando apri l'app."
                        : 'Non collegata'}
                  </Text>
                </View>
              </View>

              {health.status === 'disponibile' && !health.connected ? (
                <>
                  <Text style={text.body}>
                    Collegala per confermare i tratti a piedi anche a schermo spento e per ricevere punti da camminate, corse e giri
                    in bici registrati da altre app o dall&apos;orologio.
                  </Text>
                  <GhostButton label={connecting ? 'Collego…' : 'Collega'} onPress={connect} />
                </>
              ) : null}

              {healthNote ? (
                <Text style={styles.healthNote} accessibilityRole="alert">
                  {healthNote}
                </Text>
              ) : null}
              {healthProblem ? (
                <Text style={[styles.healthNote, { color: C.alert }]} accessibilityRole="alert">
                  {healthProblem}
                </Text>
              ) : null}

              <View style={styles.healthLinks}>
                {health.connected ? (
                  <Pressable onPress={openHealthSettings} accessibilityRole="button" style={styles.healthLink} hitSlop={6}>
                    <Text style={styles.healthLinkText}>Gestisci i permessi</Text>
                    <ChevronIcon size={14} color={C.ink} />
                  </Pressable>
                ) : null}
                <Pressable onPress={() => router.push('/riservatezza')} accessibilityRole="button" style={styles.healthLink} hitSlop={6}>
                  <Text style={styles.healthLinkText}>Come usiamo questi dati</Text>
                  <ChevronIcon size={14} color={C.ink} />
                </Pressable>
              </View>
            </Panel>
          ) : null}

          {trips.length > 0 ? (
            <Pressable onPress={reset} accessibilityRole="button" style={styles.reset}>
              <Text style={[text.small, confirmReset && { color: C.alert, fontFamily: F.bold }]}>
                {confirmReset ? 'Tocca di nuovo per cancellare tutti i tragitti' : 'Azzera i dati di prova'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <BottomNav current="oggi" tripActive={!!active} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: NAV_SPACE },
  body: { paddingHorizontal: GUTTER, paddingTop: 18, gap: 18 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, marginBottom: 14 },
  heroPoints: { fontFamily: F.displayBold, fontSize: 128, lineHeight: 122, letterSpacing: -3, color: C.ink },
  heroLabel: { fontFamily: F.display, fontSize: 20, color: C.ink, marginTop: 2 },
  heroMascot: { marginRight: -4, marginBottom: 2 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, minHeight: 76, borderRadius: 22, borderWidth: BORDER, borderColor: C.ink, paddingVertical: 11, paddingHorizontal: 16, justifyContent: 'center' },
  // Le due tessere sono appoggiate un po' storte, una per parte.
  statLight: { backgroundColor: C.card, transform: [{ rotate: '-1.5deg' }], ...shadow(5) },
  statDark: { backgroundColor: C.ink, transform: [{ rotate: '1.5deg' }], ...shadow(5, C.coral) },
  statLabel: { fontFamily: F.semi, fontSize: 12.5, color: C.dim },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: C.coral,
    borderColor: C.ink,
    borderWidth: BORDER,
  },
  metro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: C.card,
    borderColor: C.ink,
    borderWidth: BORDER,
  },
  metroTitle: { fontFamily: F.displayBold, fontSize: 17, color: C.text },
  activeTitle: { fontFamily: F.displayBold, fontSize: 17, color: C.ink },
  activeDetail: { fontFamily: F.semi, fontSize: 13, color: C.ink },
  health: { gap: 12 },
  healthHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  healthIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderColor: C.ink, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  healthTitle: { fontFamily: F.displayBold, fontSize: 17, color: C.text },
  healthNote: { fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.teal },
  healthLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 8 },
  healthLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  healthLinkText: { fontFamily: F.bold, fontSize: 13, color: C.text, textDecorationLine: 'underline' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 18, paddingHorizontal: 8 },
  reset: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 },
});
