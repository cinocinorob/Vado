/** Schermata "Oggi": punti del giorno, obiettivo e tragitti fatti. */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatCo2, legCo2, tripCo2 } from '../core/co2';
import { appName } from '../core/health';
import { getMode } from '../core/modes';
import { DAILY_GOAL, dayKey, streak, summarizeDay, type Trip } from '../core/scoring';
import { connectHealth, forgetImportedBefore, refreshHealth, type HealthState } from '../health/sync';
import { openHealthSettings } from '../health/connect';
import { social } from '../social';
import { clearPauses } from '../storage/pause';
import { clearTrips, loadTrips } from '../storage/trips';
import { useActiveTrip } from '../tracking/store';
import { restoreTracking } from '../tracking/tracker';
import { currentLeg } from '../tracking/tripState';
import { dateLabel, integer } from '../ui/format';
import { BottomNav, NAV_SPACE } from '../ui/BottomNav';
import { Co2Card, Group, SectionTitle, ShapeBadge, TonalButton, WeekStrip } from '../ui/expressive';
import { PageTitle } from '../ui/Hero';
import { ChevronIcon, FlameIcon, HeartIcon, PlusIcon } from '../ui/Icons';
import { BonusRow, GhostButton, LegRow, ModeBadge, Panel, Screen, text } from '../ui/parts';
import { Sprout } from '../ui/Sprout';
import { C, F, R } from '../ui/theme';
import { usePlant } from '../ui/usePlant';
import { WavyRing } from '../ui/Wavy';

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
      // I punti dei tragitti nuovi vanno al server della classifica, se c'è un
      // profilo: così gli altri li vedono senza che si debba aprire la classifica.
      social.sync(Date.now()).catch(() => undefined);
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
  const todayCo2 = today.trips.reduce((sum, t) => sum + tripCo2(t), 0);
  const plant = usePlant(trips, now);
  const activeDays = useMemo(() => new Set(trips.filter((t) => t.total > 0).map((t) => t.day)), [trips]);

  async function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    await clearTrips();
    await clearPauses();
    // Le attività già importate non devono rientrare alla prossima lettura.
    await forgetImportedBefore(Date.now());
    // Anche il profilo della classifica, qui e sul server.
    await social.reset();
    setTrips([]);
    setHealthNote(null);
    setConfirmReset(false);
  }

  return (
    <Screen bleed>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <PageTitle
          caption={dateLabel(now)}
          title="Oggi"
          right={
            <Pressable onPress={() => router.push('/bosco')} accessibilityRole="button" accessibilityLabel="Il tuo germoglio e il bosco" hitSlop={6}>
              <ShapeBadge shape="cookie12" color={C.mint} size={60}>
                <Sprout size={52} stage={plant.stage} health={plant.health} />
              </ShapeBadge>
            </Pressable>
          }
        />

        <View style={styles.body}>
          <View style={styles.hero}>
            <View
              style={styles.ring}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Obiettivo di oggi: ${today.points} di ${DAILY_GOAL} punti`}
            >
              <WavyRing size={196} ratio={today.points / DAILY_GOAL} />
              <View style={styles.ringText}>
                <Text style={styles.heroPoints} adjustsFontSizeToFit numberOfLines={1}>
                  {today.points}
                </Text>
                <Text style={styles.heroLabel}>di {DAILY_GOAL} punti</Text>
              </View>
            </View>
            <View style={styles.heroSide}>
              <View style={styles.streak} accessible accessibilityLabel={days > 0 ? `Serie di ${days} giorni` : 'Nessuna serie in corso'}>
                <FlameIcon size={20} />
                <View>
                  <Text style={styles.streakValue}>{days}</Text>
                  <Text style={styles.streakLabel}>{days === 1 ? 'giorno di fila' : 'giorni di fila'}</Text>
                </View>
              </View>
              <View style={styles.steps}>
                <Text style={styles.stepsLabel}>{healthSteps != null ? 'passi oggi' : 'passi nei tragitti'}</Text>
                <Text style={styles.stepsValue} adjustsFontSizeToFit numberOfLines={1}>
                  {integer(healthSteps ?? today.steps)}
                </Text>
              </View>
            </View>
          </View>

          {active ? (
            <Pressable onPress={() => router.push('/in-corso')} accessibilityRole="button" style={({ pressed }) => [styles.activeBanner, pressed && { opacity: 0.9 }]}>
              <ModeBadge mode={currentLeg(active).mode} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>Tragitto in corso</Text>
                <Text style={styles.activeDetail}>{getMode(currentLeg(active).mode).label}: tocca per riaprirlo</Text>
              </View>
            </Pressable>
          ) : null}

          <Co2Card grams={todayCo2} meters={today.carFreeMeters} title="CO₂ evitata oggi" plant={plant} onPress={() => router.push('/bosco')} />

          <WeekStrip activeDays={activeDays} now={now} />

          <SectionTitle
            title="Tragitti di oggi"
            right={
              !active ? (
                <TonalButton label="Ho preso la metro" onPress={() => router.push('/metro')} icon={<PlusIcon size={16} color={C.ink} />} />
              ) : undefined
            }
          />
          {rows.length === 0 ? (
            <View style={styles.empty}>
              <Sprout size={88} stage="seme" />
              <Text style={[text.body, { textAlign: 'center' }]}>
                Ancora nessun tragitto. Tocca Parti in basso, scegli come ti muovi e premi Avvia: punti e CO₂ arrivano a fine percorso.
              </Text>
            </View>
          ) : (
            <Group>
              {rows.map((row) =>
                row.leg ? (
                  <LegRow key={row.key} leg={row.leg} caption={row.caption} co2={legCo2(row.leg) > 0 ? `${formatCo2(legCo2(row.leg))} di CO₂ evitata` : undefined} />
                ) : (
                  <BonusRow key={row.key} points={row.bonus} />
                ),
              )}
            </Group>
          )}

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

          <Pressable onPress={() => router.push('/backup')} accessibilityRole="button" style={styles.backup}>
            <Text style={styles.backupText}>Backup e cambio telefono</Text>
            <ChevronIcon size={14} color={C.ink} />
          </Pressable>

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
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  hero: { backgroundColor: C.lime, borderRadius: R.hero, padding: 12, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  ring: { width: 196, height: 196, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', left: 30, right: 30, alignItems: 'center' },
  heroPoints: { fontFamily: F.displayBold, fontSize: 68, lineHeight: 74, letterSpacing: -2, color: C.ink },
  heroLabel: { fontFamily: F.semi, fontSize: 14, color: C.ink, marginTop: -2 },
  heroSide: { flex: 1, gap: 10 },
  streak: {
    backgroundColor: C.ink,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomLeftRadius: 8,
    padding: 14,
    gap: 10,
  },
  streakValue: { fontFamily: F.displayBold, fontSize: 30, lineHeight: 34, color: C.lime },
  streakLabel: { fontFamily: F.medium, fontSize: 12, color: '#E9F8C7' },
  steps: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomLeftRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  stepsLabel: { fontFamily: F.semi, fontSize: 12, color: C.onLime },
  stepsValue: { fontFamily: F.displayBold, fontSize: 24, lineHeight: 28, color: C.ink },
  activeBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.card, backgroundColor: C.coral },
  activeTitle: { fontFamily: F.bold, fontSize: 17, color: C.onCoral },
  activeDetail: { fontFamily: F.medium, fontSize: 13, color: C.onCoral },
  health: { gap: 12, marginTop: 8 },
  healthHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  healthIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: C.tonal, alignItems: 'center', justifyContent: 'center' },
  healthTitle: { fontFamily: F.bold, fontSize: 17, color: C.text },
  healthNote: { fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.teal },
  healthLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 8 },
  healthLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  healthLinkText: { fontFamily: F.semi, fontSize: 13, color: C.text, textDecorationLine: 'underline' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 18, paddingHorizontal: 16, backgroundColor: C.card, borderRadius: R.card },
  reset: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  backup: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 16, marginTop: 4 },
  backupText: { fontFamily: F.semi, fontSize: 14, color: C.text, textDecorationLine: 'underline' },
});
