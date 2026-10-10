/** Schermata "Tragitto in corso": percorso, punti che maturano, pausa e fine. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Polyline } from 'react-native-svg';

import { getMode, type ModeId } from '../core/modes';
import { COMMUTE_BONUS, COMMUTE_MIN_M, TRIP_CAP, capUsedBefore, dayKey, scoreTrip, summarizeDay, type Trip } from '../core/scoring';
import { loadTrips } from '../storage/trips';
import { useActiveTrip } from '../tracking/store';
import { changeMode, finishTracking, pauseTracking, resumeTracking } from '../tracking/tracker';
import { currentLeg, legElapsedMs, toLegInputs, type PathPoint } from '../tracking/tripState';
import { clock, distance, integer, speed } from '../ui/format';
import { ModeIcon, PauseIcon, PlayIcon, StarIcon, StopIcon, SwapIcon } from '../ui/Icons';
import { Mascot, MascotShapes } from '../ui/Mascot';
import { GhostButton, ModeGrid, Panel, ProgressBar, Screen, StatusChip, text } from '../ui/parts';
import { C, F } from '../ui/theme';

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

  async function finish() {
    setFinishing(true);
    setProblem(null);
    try {
      const done = await finishTracking();
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
          <ModeIcon mode={leg.mode} size={20} color={C.lime} />
          <View>
            <Text style={styles.modeLabel}>{mode.label}</Text>
            <StatusChip status={liveLeg.status} />
          </View>
        </View>
        <Pressable onPress={() => setPicker(true)} accessibilityRole="button" accessibilityLabel="Cambia mezzo" style={styles.swap}>
          <SwapIcon size={18} />
          <Text style={styles.swapLabel}>Cambia</Text>
        </Pressable>
      </View>

      <View style={styles.map}>
        <TrackView path={trip.path} gpsUsable={trip.gpsUsable} paused={trip.paused} />
      </View>

      {trip.gpsUsable && !trip.background ? (
        <Text style={styles.notice}>
          Versione di prova: tieni l'app aperta, lo schermo resta acceso. A schermo spento la distanza non viene misurata.
        </Text>
      ) : null}

      {problem ? (
        <Text style={styles.notice} accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}

      <Panel style={styles.sheet}>
        <View style={styles.pointsRow}>
          <View style={styles.pointsLine}>
            <Text style={styles.points}>+{score.legPoints}</Text>
            <Text style={styles.pointsLabel}>punti</Text>
          </View>
          {score.bonus > 0 || bonusPending ? (
            <View style={styles.bonus}>
              <StarIcon size={14} filled />
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
            style={{ flex: 1 }}
            label={trip.paused ? 'Riprendi' : 'Pausa'}
            icon={trip.paused ? <PlayIcon size={18} color={C.text} /> : <PauseIcon />}
            onPress={trip.paused ? resumeTracking : pauseTracking}
          />
          <Pressable
            onPress={finish}
            disabled={finishing}
            accessibilityRole="button"
            style={({ pressed }) => [styles.finish, { opacity: finishing ? 0.5 : pressed ? 0.85 : 1 }]}
          >
            <StopIcon />
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
      <Text style={text.small}>{label}</Text>
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
        <Mascot size={96} />
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

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} accessibilityLabel="Disegno del percorso fatto finora">
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Polyline
            points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={C.lime}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={pts[0].x} cy={pts[0].y} r={7} fill={C.bg} stroke="#FFFFFF" strokeWidth={3} />
          <Circle cx={last.x} cy={last.y} r={34} fill={C.lime} fillOpacity={0.18} />
          <G transform={`translate(${(last.x - 24).toFixed(1)} ${(last.y - 24).toFixed(1)}) scale(0.5)`}>
            <MascotShapes />
          </G>
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 24,
    backgroundColor: C.panel,
    borderColor: C.panelBorder,
    borderWidth: 1,
  },
  modeLabel: { fontFamily: F.semi, fontSize: 15, color: C.text },
  swap: {
    height: 44,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 22,
    backgroundColor: C.panel,
    borderColor: C.panelBorder,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  swapLabel: { fontFamily: F.semi, fontSize: 14, color: C.text },
  map: { flex: 1, minHeight: 140, marginVertical: 12 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  notice: { fontFamily: F.medium, fontSize: 12.5, lineHeight: 17, color: C.coral, marginBottom: 10 },
  sheet: { borderRadius: 32, padding: 20, gap: 16 },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pointsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  points: { fontFamily: F.displayBold, fontSize: 80, lineHeight: 82, color: C.lime },
  pointsLabel: { fontFamily: F.semi, fontSize: 17, color: C.text },
  bonus: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: C.limeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bonusText: { fontFamily: F.semi, fontSize: 12.5, color: C.lime },
  stats: { flexDirection: 'row', gap: 8 },
  statValue: { fontFamily: F.display, fontSize: 21, color: C.text },
  buttons: { flexDirection: 'row', gap: 10 },
  finish: {
    flex: 1.4,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishLabel: { fontFamily: F.display, fontSize: 18, color: C.ink },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  pickerSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderColor: C.panelBorder,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
});
