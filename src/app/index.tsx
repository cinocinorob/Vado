/** Schermata "Oggi": punti del giorno, obiettivo e tragitti fatti. */
import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { appName } from '../core/health';
import { getMode } from '../core/modes';
import { DAILY_GOAL, dayKey, streak, summarizeDay, type Trip } from '../core/scoring';
import { connectHealth, forgetImportedBefore, refreshHealth, type HealthState } from '../health/sync';
import { openHealthSettings } from '../health/connect';
import { clearTrips, loadTrips } from '../storage/trips';
import { useActiveTrip } from '../tracking/store';
import { restoreTracking } from '../tracking/tracker';
import { currentLeg } from '../tracking/tripState';
import { dateLabel, integer, km } from '../ui/format';
import { BottomNav, NAV_SPACE } from '../ui/BottomNav';
import { ChevronIcon, FlameIcon, HeartIcon, ModeIcon } from '../ui/Icons';
import { Mascot } from '../ui/Mascot';
import { BonusRow, Divider, GhostButton, Header, LegRow, Panel, ProgressBar, Screen, text } from '../ui/parts';
import { C, F } from '../ui/theme';

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
      caption: trip.source === 'salute' ? `Registrato da ${appName(trip.sourceApp)}` : undefined,
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
    setTrips([]);
    setHealthNote(null);
    setConfirmReset(false);
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header
          caption={dateLabel(now)}
          title="Oggi"
          right={
            days > 0 ? (
              <View style={styles.streak} accessibilityLabel={`Serie di ${days} giorni`}>
                <FlameIcon />
                <Text style={styles.streakText}>{days === 1 ? '1 giorno' : `${days} giorni di fila`}</Text>
              </View>
            ) : null
          }
        />

        <View style={styles.hero}>
          <RouteDecoration />
          <View style={styles.heroLine}>
            <Text style={styles.heroPoints}>{today.points}</Text>
            <Text style={styles.heroLabel}>punti oggi</Text>
          </View>
          <View style={styles.goal}>
            <ProgressBar value={today.points} max={DAILY_GOAL} label="Obiettivo giornaliero" detail={`${today.points} di ${DAILY_GOAL}`} />
          </View>
        </View>

        <View style={styles.stats}>
          <Panel style={styles.stat}>
            <Text style={text.value}>{km(today.carFreeMeters)}</Text>
            <Text style={text.small}>senza auto privata</Text>
          </Panel>
          <Panel style={styles.stat}>
            <Text style={text.value}>{integer(healthSteps ?? today.steps)}</Text>
            <Text style={text.small}>{healthSteps != null ? 'passi oggi' : 'passi nei tragitti'}</Text>
          </Panel>
        </View>

        {active ? (
          <Pressable onPress={() => router.push('/in-corso')} accessibilityRole="button" style={styles.activeBanner}>
            <ModeIcon mode={currentLeg(active).mode} size={22} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>Tragitto in corso</Text>
              <Text style={styles.activeDetail}>{getMode(currentLeg(active).mode).label} · tocca per riaprirlo</Text>
            </View>
          </Pressable>
        ) : null}

        <Panel>
          <Text style={[text.h2, { marginBottom: 6 }]} accessibilityRole="header">
            Tragitti di oggi
          </Text>
          {rows.length === 0 ? (
            <View style={styles.empty}>
              <Mascot size={84} />
              <Text style={[text.body, { textAlign: 'center' }]}>
                Ancora nessun tragitto. Tocca il pulsante verde, scegli come ti muovi e premi Avvia: i punti arrivano a fine percorso.
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
              <View style={[styles.healthIcon, health.connected && { backgroundColor: C.limeSoft }]}>
                <HeartIcon size={20} color={health.connected ? C.lime : C.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.healthTitle} accessibilityRole="header">
                  Connessione Salute
                </Text>
                <Text style={text.small}>
                  {health.status === 'da-aggiornare'
                    ? 'Da aggiornare dal Play Store prima di poterla collegare.'
                    : health.connected
                      ? 'Collegata: passi e attività vengono letti quando apri l\'app.'
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
              <Text style={[styles.healthNote, { color: C.coral }]} accessibilityRole="alert">
                {healthProblem}
              </Text>
            ) : null}

            <View style={styles.healthLinks}>
              {health.connected ? (
                <Pressable onPress={openHealthSettings} accessibilityRole="button" style={styles.healthLink} hitSlop={6}>
                  <Text style={styles.healthLinkText}>Gestisci i permessi</Text>
                  <ChevronIcon size={14} color={C.dim} />
                </Pressable>
              ) : null}
              <Pressable onPress={() => router.push('/riservatezza')} accessibilityRole="button" style={styles.healthLink} hitSlop={6}>
                <Text style={styles.healthLinkText}>Come usiamo questi dati</Text>
                <ChevronIcon size={14} color={C.dim} />
              </Pressable>
            </View>
          </Panel>
        ) : null}

        {trips.length > 0 ? (
          <Pressable onPress={reset} accessibilityRole="button" style={styles.reset}>
            <Text style={[text.small, confirmReset && { color: C.coral }]}>
              {confirmReset ? 'Tocca di nuovo per cancellare tutti i tragitti' : 'Azzera i dati di prova'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <BottomNav current="oggi" tripActive={!!active} />
    </Screen>
  );
}

/** Il percorso lime del mockup, puramente decorativo. */
function RouteDecoration() {
  return (
    <View style={styles.decoration} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={82} height={170} viewBox="250 120 130 270">
        <Path d="M352 384C352 340 292 336 292 290S350 250 330 206S276 176 318 140" fill="none" stroke={C.lime} strokeWidth={9} strokeLinecap="round" />
        <Circle cx={292} cy={290} r={7} fill={C.bg} stroke="#FFFFFF" strokeWidth={3} />
        <Circle cx={318} cy={140} r={11} fill={C.lime} stroke="#FFFFFF" strokeWidth={4} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: NAV_SPACE },
  decoration: { position: 'absolute', right: 6, top: 0 },
  streak: {
    height: 36,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 18,
    backgroundColor: C.panel,
    borderColor: C.panelBorder,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakText: { fontFamily: F.semi, fontSize: 13, color: C.text },
  hero: { height: 170, justifyContent: 'center', gap: 18 },
  heroLine: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  heroPoints: { fontFamily: F.displayBold, fontSize: 104, lineHeight: 104, color: C.lime },
  heroLabel: { fontFamily: F.semi, fontSize: 17, color: C.text },
  goal: { width: 210 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: 20, paddingVertical: 13 },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: C.lime,
  },
  activeTitle: { fontFamily: F.display, fontSize: 17, color: C.ink },
  activeDetail: { fontFamily: F.medium, fontSize: 13, color: C.ink },
  health: { gap: 12 },
  healthHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  healthIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center', justifyContent: 'center' },
  healthTitle: { fontFamily: F.display, fontSize: 17, color: C.text },
  healthNote: { fontFamily: F.semi, fontSize: 14, lineHeight: 20, color: C.lime },
  healthLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 8 },
  healthLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  healthLinkText: { fontFamily: F.medium, fontSize: 13, color: C.dim },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 18, paddingHorizontal: 8 },
  reset: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 16 },
});
