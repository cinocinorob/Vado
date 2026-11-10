/** Pezzi del gioco: livello, missioni del giorno, salvaserie, coriandoli. */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ALL_MISSIONS_XP, MISSION_XP, missionProgress, missionXp, type Level, type Mission } from '../core/game';
import { CheckIcon } from './Icons';
import { useEased } from './motion';
import { SHAPES } from './shapes';
import { C, F, R } from './theme';

/** Stemma del livello: una forma a biscotto con il numero. */
export function LevelBadge({ level, size = 46 }: { level: number; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 96 96" style={StyleSheet.absoluteFill}>
        <Path d={SHAPES.cookie9} fill={C.strong} />
      </Svg>
      <Text style={[styles.badgeText, { fontSize: size * (level > 9 ? 0.36 : 0.42) }]}>{level}</Text>
    </View>
  );
}

/** Striscia del livello: stemma, titolo e barra dell'esperienza. */
export function LevelStrip({ level, onPress }: { level: Level; onPress?: () => void }) {
  const shown = useEased(level.ratio, 900);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Livello ${level.level}, ${level.title}. ${level.into} di ${level.need} punti esperienza per il prossimo livello`}
      style={({ pressed }) => [styles.level, pressed && { opacity: 0.9 }]}
    >
      <LevelBadge level={level.level} />
      <View style={{ flex: 1, gap: 5 }}>
        <View style={styles.levelHead}>
          <Text style={styles.levelTitle} numberOfLines={1}>
            Livello {level.level} · {level.title}
          </Text>
          <Text style={styles.levelXp}>
            {level.into} / {level.need} XP
          </Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${Math.max(3, shown * 100)}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

/** Scudo del salvaserie, pieno o vuoto. */
export function FreezeShield({ on, size = 16 }: { on: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.5l8 3v6.2c0 4.6-3.2 8.3-8 9.8-4.8-1.5-8-5.2-8-9.8V5.5z"
        fill={on ? '#7FD4FF' : 'transparent'}
        stroke={on ? '#7FD4FF' : 'rgba(255, 255, 255, 0.45)'}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Le tre missioni di oggi. */
export function MissionsCard({ missions }: { missions: Mission[] }) {
  const done = missions.filter((m) => m.done).length;
  const all = done === missions.length;
  return (
    <View style={[styles.missions, all && { backgroundColor: C.limeSoft }]}>
      <View style={styles.missionsHead}>
        <Text style={[styles.missionsTitle, all && { color: C.ink }]} accessibilityRole="header">
          Missioni di oggi
        </Text>
        <View style={[styles.xpChip, all && { backgroundColor: C.ink }]}>
          <Text style={[styles.xpChipText, all && { color: '#FFFFFF' }]}>{all ? `+${missionXp(missions)} XP presi` : `${done} di ${missions.length}`}</Text>
        </View>
      </View>
      {missions.map((m) => (
        <View key={m.id} style={styles.mission} accessible accessibilityLabel={`${m.title}: ${m.done ? 'completata' : missionProgress(m)}`}>
          <View style={[styles.check, m.done && styles.checkOn]}>{m.done ? <CheckIcon size={14} color={C.ink} /> : null}</View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.missionTitle, all && { color: C.ink }, m.done && !all && { color: C.dim }]}>{m.title}</Text>
            {!m.done ? (
              <View style={styles.missionTrack}>
                <View style={[styles.missionFill, { width: `${m.ratio * 100}%` }]} />
              </View>
            ) : null}
          </View>
          <Text style={[styles.missionXp, all && { color: C.ink }]}>{m.done ? `+${MISSION_XP} XP` : missionProgress(m)}</Text>
        </View>
      ))}
      {!all ? <Text style={styles.missionsFoot}>Tutte e tre: altri +{ALL_MISSIONS_XP} XP. Cambiano ogni giorno.</Text> : null}
    </View>
  );
}

const CONFETTI = ['#B8F03A', '#FF8C82', '#7FD4FF', '#FFD23F', '#C9A7FF', '#3FBF8F'];

/**
 * Coriandoli che cadono una volta, per i momenti di festa (medaglia, livello,
 * missioni complete). Non si vedono se il telefono chiede meno animazioni.
 */
export function Confetti({ run }: { run: boolean }) {
  const { width, height } = useWindowDimensions();
  const [fall] = useState(() => new Animated.Value(0));
  const [show, setShow] = useState(false);
  const [pieces] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({
      x: Math.random(),
      delay: Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 120,
      spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
      size: 7 + Math.random() * 7,
      color: CONFETTI[i % CONFETTI.length],
      round: i % 3 === 0,
    })),
  );

  useEffect(() => {
    if (!run) return;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive || reduce) return;
        setShow(true);
        fall.setValue(0);
        Animated.timing(fall, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
          if (alive) setShow(false);
        });
      });
    return () => {
      alive = false;
    };
  }, [run, fall]);

  if (!show) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => {
        const t = fall.interpolate({ inputRange: [p.delay, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x * width,
              top: -20,
              width: p.size,
              height: p.round ? p.size : p.size * 0.5,
              borderRadius: p.round ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: fall.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.85] }) },
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badgeText: { fontFamily: F.displayBold, color: C.onStrong },
  level: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: R.card, paddingVertical: 12, paddingHorizontal: 14 },
  levelHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  levelTitle: { flex: 1, fontFamily: F.bold, fontSize: 15.5, color: C.text },
  levelXp: { fontFamily: F.semi, fontSize: 12.5, color: C.dim },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: C.faint, overflow: 'hidden' },
  xpFill: { height: 8, borderRadius: 4, backgroundColor: C.lime },
  missions: { backgroundColor: C.card, borderRadius: R.card, padding: 16, gap: 12 },
  missionsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  missionsTitle: { fontFamily: F.bold, fontSize: 17, color: C.text },
  xpChip: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: C.tonal, justifyContent: 'center' },
  xpChipText: { fontFamily: F.bold, fontSize: 12.5, color: C.text },
  mission: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, borderColor: C.outline, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.lime, borderColor: C.lime },
  missionTitle: { fontFamily: F.semi, fontSize: 15, color: C.text },
  missionTrack: { height: 5, borderRadius: 3, backgroundColor: C.faint, overflow: 'hidden' },
  missionFill: { height: 5, borderRadius: 3, backgroundColor: C.teal },
  missionXp: { fontFamily: F.bold, fontSize: 12.5, color: C.dim },
  missionsFoot: { fontFamily: F.medium, fontSize: 12.5, color: C.dim },
});
