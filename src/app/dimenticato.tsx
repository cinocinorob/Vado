/**
 * "Aggiungi un viaggio dimenticato": metro, bus o tram fatti senza avviare il
 * tragitto, aggiunti più tardi senza bisogno di essere alla stazione.
 * Partenza, arrivo e orario li dichiara l'utente; i km vengono dalla rete o
 * dal percorso della linea. Stesso limite al giorno di "Ho preso la metro".
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BUS_MS, busLabel, busRide } from '../core/bus';
import { canAddForgotten, declaredBusTrip, declaredTrip } from '../core/declared';
import { DECLARED_PER_DAY, rideSeconds, routeBetween, routeLabel, routeLines } from '../core/metro';
import { COMMUTE_BONUS, type Trip } from '../core/scoring';
import { BUS_ROMA } from '../data/bus';
import { ROMA } from '../data/metro';
import { diag } from '../diagnostics/log';
import { loadTrips, saveTrip } from '../storage/trips';
import { km } from '../ui/format';
import { CheckIcon, CloseIcon, ShieldIcon } from '../ui/Icons';
import { Header, LineBadge, Panel, PointsChip, PrimaryButton, RoundButton, Screen, Toggle, input, text, PLACEHOLDER } from '../ui/parts';
import { Segmented } from '../ui/social';
import { C, F, R } from '../ui/theme';

const clock = () => Date.now();

type Kind = 'metro' | 'bus';

/** Quando è finito il viaggio: minuti fa. */
const WHEN = [
  { label: 'Poco fa', minutes: 5 },
  { label: '30 min fa', minutes: 30 },
  { label: '1 ora fa', minutes: 60 },
  { label: '2 ore fa', minutes: 120 },
  { label: '4 ore fa', minutes: 240 },
  { label: '8 ore fa', minutes: 480 },
];

function timeText(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Dimenticato() {
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ tipo?: string }>();
  const [kind, setKind] = useState<Kind>(params.tipo === 'bus' ? 'bus' : 'metro');
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [minutes, setMinutes] = useState(5);
  const [commute, setCommute] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Metro
  const [lineId, setLineId] = useState(ROMA.data.lines[0].id);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);

  // Bus
  const [query, setQuery] = useState('');
  const [patternIdx, setPatternIdx] = useState<number | null>(null);
  const [fromPos, setFromPos] = useState<number | null>(null);
  const [toPos, setToPos] = useState<number | null>(null);

  useEffect(() => {
    loadTrips().then((t) => {
      setTrips(t);
      setNow(clock());
    });
  }, []);

  const endAt = now - minutes * 60_000;
  const line = ROMA.data.lines.find((l) => l.id === lineId) ?? ROMA.data.lines[0];
  const route = kind === 'metro' && fromId && toId && fromId !== toId ? routeBetween(ROMA, fromId, toId) : null;

  const patterns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const out: number[] = [];
    BUS_ROMA.patterns.forEach((p, i) => {
      const key = `${p.line}→${p.headsign}`;
      if (p.line.toLowerCase() !== q || seen.has(key)) return;
      seen.add(key);
      out.push(i);
    });
    return out;
  }, [query]);
  const pattern = patternIdx != null ? BUS_ROMA.patterns[patternIdx] : null;
  const ride =
    kind === 'bus' && pattern && patternIdx != null && fromPos != null && toPos != null && toPos > fromPos
      ? busRide(BUS_ROMA, { pattern: patternIdx, pos: toPos, stop: BUS_ROMA.stops[pattern.stops[toPos]] }, fromPos)
      : null;

  const seconds = route ? rideSeconds(route) : ride ? Math.round(ride.meters / BUS_MS) : 0;
  const startAt = endAt - seconds * 1000;
  const check = trips && (route || ride) ? canAddForgotten(trips, startAt, endAt, now, kind) : null;
  const preview =
    trips && check?.ok
      ? route
        ? declaredTrip(route, { now: endAt, commute, trips, manual: true })
        : ride
          ? declaredBusTrip(ride, { now: endAt, commute, trips, manual: true })
          : null
      : null;
  const whenChoices = WHEN.filter((w) => new Date(now - w.minutes * 60_000).getDate() === new Date(now).getDate());

  function scrollDown() {
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
  }

  function tapStation(id: string) {
    if (!fromId || (fromId && toId)) {
      setFromId(id);
      setToId(null);
    } else if (id === fromId) {
      setFromId(null);
    } else {
      setToId(id);
      scrollDown();
    }
  }

  function tapStop(pos: number) {
    if (fromPos == null || toPos != null) {
      setFromPos(pos);
      setToPos(null);
    } else if (pos <= fromPos) {
      setFromPos(pos);
    } else {
      setToPos(pos);
      scrollDown();
    }
  }

  async function save() {
    if (!route && !ride) return;
    setSaving(true);
    setProblem(null);
    const at = clock();
    const fresh = await loadTrips();
    const end = at - minutes * 60_000;
    const allowed = canAddForgotten(fresh, end - seconds * 1000, end, at, kind);
    if (!allowed.ok) {
      setProblem(allowed.reason);
      setSaving(false);
      return;
    }
    try {
      const trip = route ? declaredTrip(route, { now: end, commute, trips: fresh, manual: true }) : declaredBusTrip(ride!, { now: end, commute, trips: fresh, manual: true });
      await saveTrip(trip);
      diag(`Aggiunto a mano: ${trip.legs[0].route ?? kind}, ${Math.round(trip.meters)} m, ${trip.total} punti`);
      router.replace({ pathname: '/riepilogo', params: { id: trip.id } });
    } catch {
      setProblem('Non sono riuscito a salvare il viaggio. Riprova.');
      setSaving(false);
    }
  }

  const ready = !!(route || ride);

  return (
    <Screen>
      <ScrollView ref={scroller} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Header
          caption="Hai dimenticato di avviare?"
          title="Aggiungi un viaggio"
          left={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} />
            </RoundButton>
          }
        />

        <Segmented
          label="Mezzo"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setProblem(null);
          }}
          options={[
            { id: 'metro', label: 'Metro' },
            { id: 'bus', label: 'Bus e tram' },
          ]}
        />

        <Panel style={styles.section}>
          <Text style={text.caption}>Quando sei arrivato</Text>
          <View style={styles.chips}>
            {whenChoices.map((w) => {
              const on = w.minutes === minutes;
              return (
                <Pressable key={w.minutes} onPress={() => setMinutes(w.minutes)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && { color: C.ink }]}>{w.label}</Text>
                  <Text style={[styles.chipTime, on && { color: C.ink }]}>{timeText(now - w.minutes * 60_000)}</Text>
                </Pressable>
              );
            })}
          </View>
        </Panel>

        {kind === 'metro' ? (
          <Panel style={styles.section}>
            <Text style={text.caption}>{!fromId ? 'Tocca la stazione dove sei salito' : !toId ? 'Ora tocca quella dove sei sceso (anche su un\'altra linea)' : 'Partenza e arrivo scelti'}</Text>
            <View style={styles.lines} accessibilityRole="tablist" accessibilityLabel="Linea">
              {ROMA.data.lines.map((l) => {
                const selected = l.id === line.id;
                return (
                  <Pressable key={l.id} onPress={() => setLineId(l.id)} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={l.name} style={[styles.lineTab, selected && styles.lineTabOn]}>
                    <LineBadge line={l.id} size={28} />
                  </Pressable>
                );
              })}
            </View>
            <View>
              {line.stations.map((id) => {
                const station = ROMA.stations.get(id);
                if (!station) return null;
                const role = id === fromId ? 'Da' : id === toId ? 'A' : null;
                return (
                  <Pressable
                    key={id}
                    onPress={() => tapStation(id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${station.name}${role === 'Da' ? ', partenza' : role === 'A' ? ', arrivo' : ''}`}
                    style={[styles.stop, role && styles.stopOn]}
                  >
                    <View style={[styles.dot, role && styles.dotOn]} />
                    <Text style={[styles.stopName, role && { fontFamily: F.bold, color: C.ink }]}>{station.name}</Text>
                    {role ? (
                      <View style={styles.role}>
                        <Text style={styles.roleText}>{role}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Panel>
        ) : (
          <Panel style={styles.section}>
            <Text style={text.caption}>Numero della linea</Text>
            <TextInput
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setPatternIdx(null);
                setFromPos(null);
                setToPos(null);
              }}
              placeholder="Per esempio 64, 8, 170"
              placeholderTextColor={PLACEHOLDER}
              autoCapitalize="characters"
              autoCorrect={false}
              style={input}
              accessibilityLabel="Numero della linea"
            />
            {query.trim() && patterns.length === 0 ? <Text style={text.small}>Nessuna linea con questo numero.</Text> : null}
            {patterns.map((pi) => {
              const p = BUS_ROMA.patterns[pi];
              const on = pi === patternIdx;
              return (
                <Pressable
                  key={pi}
                  onPress={() => {
                    setPatternIdx(pi);
                    setFromPos(null);
                    setToPos(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.stop, on && styles.stopOn]}
                >
                  <Text style={[styles.stopName, on && { fontFamily: F.bold, color: C.ink }]}>
                    {busLabel({ line: p.line, tram: p.tram })} verso {p.headsign}
                  </Text>
                  {on ? <CheckIcon size={16} color={C.ink} /> : null}
                </Pressable>
              );
            })}
            {pattern ? (
              <>
                <Text style={[text.caption, { marginTop: 8 }]}>{fromPos == null ? 'Tocca la fermata dove sei salito' : toPos == null ? 'Ora quella dove sei sceso' : 'Fermate scelte'}</Text>
                <View>
                  {pattern.stops.map((s, pos) => {
                    const role = pos === fromPos ? 'Da' : pos === toPos ? 'A' : null;
                    const inside = fromPos != null && toPos != null && pos > fromPos && pos < toPos;
                    return (
                      <Pressable key={`${s}-${pos}`} onPress={() => tapStop(pos)} accessibilityRole="button" style={[styles.stop, role && styles.stopOn]}>
                        <View style={[styles.dot, (role || inside) && styles.dotOn]} />
                        <Text style={[styles.stopName, role && { fontFamily: F.bold, color: C.ink }, inside && { color: C.text }]}>{BUS_ROMA.stops[s].name}</Text>
                        {role ? (
                          <View style={styles.role}>
                            <Text style={styles.roleText}>{role}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </Panel>
        )}

        {ready ? (
          <Panel style={styles.result}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.resultTitle}>{route ? routeLabel(route) : ride ? `${busLabel(ride)}, ${ride.from} → ${ride.to}` : ''}</Text>
              {route ? <Text style={styles.resultDetail}>{routeLines(route)}</Text> : null}
              <Text style={styles.resultDetail}>
                {km(route ? route.meters : (ride?.meters ?? 0))} · dalle {timeText(startAt)} alle {timeText(endAt)}
              </Text>
            </View>
            {preview ? <PointsChip points={preview.total} /> : null}
          </Panel>
        ) : null}

        {check && !check.ok ? (
          <Text style={styles.problem} accessibilityRole="alert">
            {check.reason}
          </Text>
        ) : null}

        {ready ? (
          <Panel style={styles.commute}>
            <View style={{ flex: 1 }}>
              <Text style={styles.commuteTitle}>Tragitto casa-lavoro</Text>
              <Text style={text.small}>Bonus +{COMMUTE_BONUS}, una volta al giorno</Text>
            </View>
            <Toggle value={commute} onChange={setCommute} label="Tragitto casa-lavoro" />
          </Panel>
        ) : null}

        <Panel style={styles.info}>
          <ShieldIcon size={22} color={C.teal} />
          <Text style={[text.small, { flex: 1, lineHeight: 18 }]}>
            Partenza, arrivo e orario li dichiari tu: il viaggio risulta &quot;dichiarato&quot; e se ne possono aggiungere {DECLARED_PER_DAY} al giorno
            per la metro e {DECLARED_PER_DAY} per bus e tram, solo di oggi. Se sei ancora alla stazione di arrivo, &quot;+ Metro&quot; e &quot;+ Bus&quot; in Oggi
            verificano l&apos;arrivo dalla posizione.
          </Text>
        </Panel>

        {problem ? (
          <Text style={styles.problem} accessibilityRole="alert">
            {problem}
          </Text>
        ) : null}
      </ScrollView>

      {ready && check?.ok ? (
        <View style={[styles.cta, { bottom: insets.bottom + 16 }]}>
          <PrimaryButton label={saving ? 'Aggiungo…' : 'Aggiungi il viaggio'} onPress={save} disabled={saving} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, paddingBottom: 116 },
  section: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: C.tonal, alignItems: 'center' },
  chipOn: { backgroundColor: C.lime },
  chipText: { fontFamily: F.bold, fontSize: 14, color: C.text },
  chipTime: { fontFamily: F.medium, fontSize: 11.5, color: C.dim },
  lines: { flexDirection: 'row', gap: 8 },
  lineTab: { flex: 1, height: 44, borderRadius: 22, backgroundColor: C.tonal, alignItems: 'center', justifyContent: 'center' },
  lineTabOn: { backgroundColor: C.lime },
  stop: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 14 },
  stopOn: { backgroundColor: C.limeSoft },
  stopName: { flex: 1, fontFamily: F.semi, fontSize: 15, color: C.dim },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: C.outline },
  dotOn: { backgroundColor: C.teal, borderColor: C.teal },
  role: { minWidth: 30, height: 26, paddingHorizontal: 8, borderRadius: 13, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  roleText: { fontFamily: F.bold, fontSize: 12.5, color: '#FFFFFF' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.lime, borderRadius: R.card },
  resultTitle: { fontFamily: F.displayBold, fontSize: 18, lineHeight: 23, color: C.ink },
  resultDetail: { fontFamily: F.semi, fontSize: 13, lineHeight: 18, color: C.ink },
  commute: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, paddingVertical: 12 },
  commuteTitle: { fontFamily: F.bold, fontSize: 15, color: C.text },
  info: { flexDirection: 'row', gap: 12, borderRadius: 20, paddingVertical: 12 },
  problem: { fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.alert },
  cta: { position: 'absolute', left: 20, right: 20 },
});
