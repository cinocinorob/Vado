/** Schermata "Tragitto in corso": percorso, punti che maturano, pausa e fine. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Polyline } from 'react-native-svg';

import { getMode, type ModeId } from '../core/modes';
import { COMMUTE_BONUS, COMMUTE_MIN_M, TRIP_CAP, capUsedBefore, dayKey, scoreTrip, summarizeDay, type Trip } from '../core/scoring';
import { loadTrips } from '../storage/trips';
import { useActiveTrip } from '../tracking/store';
import { changeMode, confirmTransit, finishTracking, pauseTracking, rejectTransit, resumeTracking } from '../tracking/tracker';
import { STILL_ON_BOARD_MS, currentLeg, legElapsedMs, pendingTransit, toLegInputs, type PathPoint } from '../tracking/tripState';
import { clock, distance, integer, speed } from '../ui/format';
import { PauseIcon, PlayIcon, StarIcon, StopIcon, SwapIcon } from '../ui/Icons';
import { Mascot, MascotShapes } from '../ui/Mascot';
import { GhostButton, ModeBadge, ModeGrid, Panel, ProgressBar, Screen, StatusChip, text } from '../ui/parts';
import { C, F, R } from '../ui/theme';

export default function InCorso() {
  const trip = useActiveTrip();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());
  const [picker, setPicker] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [history, setHistory] = useState<Trip[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Lo storico serve per sapere se il bonus di oggi è già stato preso e
  // quanta parte del tetto è già stata usata dal tragitto appena precedente.
  useEffect(() => {
    loadTrips().then(setHistory);
  }, []);

  // Senza un tragitto aperto questa schermata non ha senso: si torna a Oggi.
  useEffect(() => {
    if (!trip && !finishing) router.dismissTo('/');
  }, [trip, finishing]);

  if (!trip) return <Screen>{null}</Screen>;

  const leg = currentLeg(trip);
  const mode = getMode(leg.mode);
  const bonusAlready = summarizeDay(history, dayKey(now)).bonusAwarded;
  const capUsed = capUsedBefore(history, trip.startedAt);
  const score = scoreTrip(toLegInputs(trip, now), { commute: trip.commute, bonusAlreadyToday: bonusAlready, capUsed });
  const capNow = capUsed + score.legPoints;
  const liveLeg = score.legs[score.legs.length - 1];
  const totalSeconds = trip.legs.reduce((sum, l) => sum + legElapsedMs(l, now), 0) / 1000;
  const bonusPending = trip.commute && !bonusAlready && score.bonus === 0 && score.meters < COMMUTE_MIN_M;

  const transit = pendingTransit(trip);
  const onBoard = !!transit && transit.leg === leg && now - transit.fast.endT < STILL_ON_BOARD_MS;

  /** Prima di chiudere: un pezzo troppo veloce per il mezzo dichiarato era su un mezzo pubblico? */
  function finish() {
    if (!transit) {
      close(false);
      return;
    }
    const km = (transit.fast.rejectedM / 1000).toFixed(1).replace('.', ',');
    Alert.alert(
      'Eri su un mezzo pubblico?',
      `Circa ${km} km sono troppo veloci per "${getMode(transit.leg.mode).label}". Se eri su bus, tram o metro, li conto come mezzi pubblici; altrimenti quel tratto non vale punti.`,
      [
        { text: 'No', style: 'cancel', onPress: () => close(false) },
        { text: 'Sì, mezzi pubblici', onPress: () => close(true) },
      ],
    );
  }

  async function close(transitConfirmed: boolean) {
    setFinishing(true);
    setProblem(null);
    try {
      const done = await finishTracking({ transit: transitConfirmed });
      if (done) router.replace({ pathname: '/riepilogo', params: { id: done.id } });
      else router.dismissTo('/');
    } catch {
      // Il tragitto resta aperto: si può riprovare senza perdere nulla.
      setFinishing(false);
      setProblem('Non sono riuscito a salvare il tragitto. Riprova.');
    }
  }

  function pick(next: ModeId) {
    setPicker(false);
    changeMode(next).catch(() => undefined);
  }

  return (
    <Screen style={{ paddingBottom: insets.bottom + 12 }}>
      <View style={styles.top}>
        <View style={styles.modeChip}>
          <ModeBadge mode={leg.mode} size={36} />
          <View>
            <Text style={styles.modeLabel}>{mode.label}</Text>
            <StatusChip status={liveLeg.status} />
          </View>
        </View>
        <Pressable
          onPress={() => setPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="Cambia mezzo"
          style={({ pressed }) => [styles.swap, pressed && { opacity: 0.8 }]}
        >
          <SwapIcon size={18} />
          <Text style={styles.swapLabel}>Cambia</Text>
        </Pressable>
      </View>

      <View style={styles.map}>
        <TrackView path={trip.path} gpsUsable={trip.gpsUsable} paused={trip.paused} />
      </View>

      {trip.gpsUsable && !trip.background ? (
        <Text style={styles.notice}>
          {"Tieni l'app aperta: su questo telefono la distanza non viene misurata a schermo spento, quindi lo schermo resta acceso."}
        </Text>
      ) : null}

      {problem ? (
        <Text style={styles.notice} accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}

      {transit ? (
        <View style={styles.transit} accessibilityRole="alert">
          <Text style={styles.transitTitle}>{onBoard ? 'Sei su un mezzo pubblico?' : 'Eri su un mezzo pubblico?'}</Text>
          <Text style={styles.transitBody}>
            Stai andando troppo veloce per &quot;{getMode(transit.leg.mode).label}&quot;. Se sei su bus, tram o metro, conto quel pezzo come mezzi pubblici.
          </Text>
          <View style={styles.transitRow}>
            <Pressable onPress={rejectTransit} accessibilityRole="button" style={({ pressed }) => [styles.transitNo, pressed && { opacity: 0.8 }]}>
              <Text style={styles.transitNoText}>No</Text>
            </Pressable>
            <Pressable onPress={confirmTransit} accessibilityRole="button" style={({ pressed }) => [styles.transitYes, pressed && { opacity: 0.85 }]}>
              <Text style={styles.transitYesText}>Sì, mezzi pubblici</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Panel style={styles.sheet}>
        <View style={styles.pointsRow}>
          <View style={styles.pointsLine}>
            <Text style={styles.points}>+{score.legPoints}</Text>
            <Text style={styles.pointsLabel}>punti</Text>
          </View>
          {score.bonus > 0 || bonusPending ? (
            <View style={styles.bonus}>
              <StarIcon size={14} color={C.lime} filled />
              <Text style={styles.bonusText}>
                {score.bonus > 0 ? `+${COMMUTE_BONUS} all'arrivo` : `+${COMMUTE_BONUS} oltre i ${COMMUTE_MIN_M} m`}
              </Text>
            </View>
          ) : null}
        </View>

        <ProgressBar
          value={capNow}
          max={TRIP_CAP}
          label={capUsed > 0 ? 'Tetto, con il tragitto precedente' : 'Tetto del tragitto'}
          detail={`${capNow} di ${TRIP_CAP}`}
          color={C.lime}
          track="rgba(200, 245, 96, 0.22)"
        />

        <View style={styles.stats}>
          <Stat value={distance(score.meters)} label="Distanza" />
          <Stat value={clock(totalSeconds)} label={trip.paused ? 'In pausa' : 'Tempo'} />
          {leg.mode === 'piedi' ? (
            <Stat value={liveLeg.steps != null ? integer(liveLeg.steps) : '–'} label="Passi" />
          ) : (
            <Stat value={speed(liveLeg.meters, liveLeg.seconds)} label="Velocità media" />
          )}
        </View>

        <View style={styles.buttons}>
          <GhostButton
            style={styles.pause}
            label={trip.paused ? 'Riprendi' : 'Pausa'}
            icon={trip.paused ? <PlayIcon size={18} color={C.text} /> : <PauseIcon />}
            onPress={trip.paused ? resumeTracking : pauseTracking}
          />
          <Pressable
            onPress={finish}
            disabled={finishing}
            accessibilityRole="button"
            style={({ pressed }) => [styles.finish, { opacity: finishing ? 0.55 : 1 }, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <StopIcon color={C.onCoral} />
            <Text style={styles.finishLabel}>{finishing ? 'Chiudo…' : 'Termina'}</Text>
          </Pressable>
        </View>
      </Panel>

      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
        <View style={styles.overlay}>
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={[text.h2, { fontSize: 22 }]} accessibilityRole="header">
              Cambia mezzo
            </Text>
            <Text style={text.small}>Il tratto fatto finora viene chiuso e ne inizia uno nuovo.</Text>
            <ModeGrid selected={leg.mode} onSelect={pick} />
            <GhostButton label="Annulla" onPress={() => setPicker(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * Disegno del percorso senza mappa: i punti vengono riscalati per riempire lo
 * spazio. Niente cartografia, quindi nessun servizio esterno riceve la posizione.
 */
function TrackView({ path, gpsUsable, paused }: { path: PathPoint[]; gpsUsable: boolean; paused: boolean }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  if (path.length < 2) {
    return (
      <View style={styles.waiting} onLayout={onLayout}>
        <Mascot size={110} />
        <Text style={[text.body, { textAlign: 'center' }]}>
          {!gpsUsable
            ? 'Posizione non concessa: conto solo i passi.'
            : paused
              ? 'In pausa.'
              : path.length === 0
                ? 'Cerco il segnale GPS…'
                : 'Segnale trovato. Il percorso compare appena ti muovi.'}
        </Text>
      </View>
    );
  }

  const pad = 36;
  const lat0 = path[0].lat;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = path.map((p) => p.lon * kx);
  const ys = path.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((size.w - 2 * pad) / spanX, (size.h - 2 * pad) / spanY);
  const offX = (size.w - spanX * scale) / 2;
  const offY = (size.h - spanY * scale) / 2;
  const pts = path.map((_, i) => ({ x: offX + (xs[i] - minX) * scale, y: size.h - offY - (ys[i] - minY) * scale }));
  const last = pts[pts.length - 1];
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} accessibilityLabel="Disegno del percorso fatto finora">
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h}>
          {/* Il percorso è una strada: bordo a inchiostro, corsia lime. */}
          <Polyline points={line} fill="none" stroke={C.deep} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline points={line} fill="none" stroke={C.lime} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={pts[0].x} cy={pts[0].y} r={8} fill={C.card} stroke={C.text} strokeWidth={3} />
          <G transform={`translate(${(last.x - 28).toFixed(1)} ${(last.y - 28).toFixed(1)}) scale(0.583)`}>
            <MascotShapes disc={C.coral} />
          </G>
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  transit: { backgroundColor: C.coral, borderRadius: R.card, padding: 16, gap: 6, marginBottom: 10 },
  transitTitle: { fontFamily: F.displayBold, fontSize: 20, color: C.onCoral },
  transitBody: { fontFamily: F.medium, fontSize: 14, lineHeight: 19, color: C.onCoralDim },
  transitRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  transitNo: { height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: 'rgba(58, 19, 6, 0.12)', justifyContent: 'center' },
  transitNoText: { fontFamily: F.bold, fontSize: 15, color: C.onCoral },
  transitYes: { flex: 1, height: 44, borderRadius: 22, backgroundColor: C.strong, alignItems: 'center', justifyContent: 'center' },
  transitYesText: { fontFamily: F.bold, fontSize: 15, color: C.onStrong },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  modeChip: { backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingLeft: 8, paddingRight: 16, borderRadius: 28 },
  modeLabel: { fontFamily: F.bold, fontSize: 15, color: C.text },
  swap: { backgroundColor: C.tonal, height: 48, paddingLeft: 14, paddingRight: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 7 },
  swapLabel: { fontFamily: F.semi, fontSize: 14, color: C.text },
  map: { flex: 1, minHeight: 140, marginVertical: 12, backgroundColor: C.card, borderRadius: R.card, overflow: 'hidden' },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  notice: { fontFamily: F.bold, fontSize: 12.5, lineHeight: 17, color: C.alert, marginBottom: 10 },
  sheet: { borderRadius: R.hero, padding: 20, gap: 16, marginBottom: 6, backgroundColor: C.deep },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pointsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  points: { fontFamily: F.displayBold, fontSize: 76, lineHeight: 82, letterSpacing: -2, color: C.lime },
  pointsLabel: { fontFamily: F.semi, fontSize: 18, color: C.onInk },
  bonus: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.lime, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bonusText: { fontFamily: F.bold, fontSize: 12.5, color: C.ink },
  stats: { flexDirection: 'row', gap: 8 },
  statValue: { fontFamily: F.displayBold, fontSize: 22, color: C.onInk },
  statLabel: { fontFamily: F.medium, fontSize: 12.5, lineHeight: 17, color: C.onInkDim },
  buttons: { flexDirection: 'row', gap: 4 },
  finish: {
    flex: 1.5,
    height: 64,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
    backgroundColor: C.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishLabel: { fontFamily: F.bold, fontSize: 18, color: C.onCoral },
  pause: { flex: 1, height: 64, borderTopLeftRadius: 32, borderBottomLeftRadius: 32, borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(26, 29, 20, 0.6)' },
  pickerSheet: { backgroundColor: C.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, gap: 14 },
});
