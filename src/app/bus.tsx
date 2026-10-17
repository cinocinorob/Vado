/**
 * "Ho preso il bus": registra a posteriori un viaggio in bus o tram.
 * La fermata di arrivo viene dalla posizione; linea e fermata di partenza si
 * scelgono dall'elenco; i metri sono quelli lungo il percorso della linea.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { arrivalsNear, busLabel, busRide, departures, stopsNear, type Arrival } from '../core/bus';
import { canDeclare, declaredBusTrip, type DeclareCheck } from '../core/declared';
import { ARRIVAL_RADIUS_M, DECLARED_PER_DAY } from '../core/metro';
import { COMMUTE_BONUS, type Trip } from '../core/scoring';
import { BUS_ROMA } from '../data/bus';
import { locateHere, type Here } from '../metro/arrival';
import { loadTrips, saveTrip } from '../storage/trips';
import { useActiveTrip } from '../tracking/store';
import { km } from '../ui/format';
import { CheckIcon, CloseIcon, ShieldIcon } from '../ui/Icons';
import { GhostButton, Header, Panel, PointsChip, PrimaryButton, RoundButton, Screen, Toggle, text } from '../ui/parts';
import { C, F } from '../ui/theme';

const clock = () => Date.now();

const PROBLEMS: Record<Exclude<Here['kind'], 'ok'>, string> = {
  permesso: 'Serve la posizione per riconoscere la fermata dove sei sceso. Concedi il permesso "Mentre usi l\'app" e riprova.',
  assente: 'Non arriva nessuna posizione. Controlla che il GPS sia acceso e riprova.',
  incerta: 'La posizione è ancora troppo incerta. Aspetta qualche secondo all\'aperto e riprova.',
  simulata: 'La posizione arriva da un\'app di simulazione: così il viaggio non si può registrare.',
};

export default function HoPresoIlBus() {
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const active = useActiveTrip();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [check, setCheck] = useState<DeclareCheck | null>(null);
  const [here, setHere] = useState<Here | null>(null);
  const [arrivalKey, setArrivalKey] = useState<number | null>(null);
  const [fromPos, setFromPos] = useState<number | null>(null);
  const [commute, setCommute] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const locate = useCallback(async () => {
    setHere(null);
    setArrivalKey(null);
    setFromPos(null);
    setHere(await locateHere());
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadTrips().then((loaded) => {
        if (!alive) return;
        const opened = clock();
        setNow(opened);
        setTrips(loaded);
        const allowed = canDeclare(loaded, opened, 'bus');
        setCheck(allowed);
        if (allowed.ok) locate();
      });
      return () => {
        alive = false;
      };
    }, [locate]),
  );

  const arrivals: Arrival[] = useMemo(
    () => (here?.kind === 'ok' ? arrivalsNear(BUS_ROMA, stopsNear(BUS_ROMA, here.lat, here.lon, ARRIVAL_RADIUS_M)) : []),
    [here],
  );
  const arrival = arrivalKey != null ? arrivals[arrivalKey] : null;
  const ride = arrival && fromPos != null ? busRide(BUS_ROMA, arrival, fromPos) : null;
  const preview = ride && trips ? declaredBusTrip(ride, { now, commute, trips }) : null;

  function pickLine(i: number) {
    setArrivalKey(i);
    setFromPos(null);
  }

  function pickFrom(pos: number) {
    setFromPos(pos);
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
  }

  async function save() {
    if (!ride) return;
    setSaving(true);
    setProblem(null);
    const at = clock();
    const fresh = await loadTrips();
    const allowed = canDeclare(fresh, at, 'bus');
    if (!allowed.ok) {
      setCheck(allowed);
      setSaving(false);
      return;
    }
    try {
      const trip = declaredBusTrip(ride, { now: at, commute, trips: fresh });
      await saveTrip(trip);
      router.replace({ pathname: '/riepilogo', params: { id: trip.id } });
    } catch {
      setProblem('Non sono riuscito a salvare il viaggio. Riprova.');
      setSaving(false);
    }
  }

  const blocked = active
    ? 'Hai un tragitto in corso: se sei sul bus, viene riconosciuto lì. Terminalo prima di registrarne un altro.'
    : check && !check.ok
      ? check.reason
      : null;

  return (
    <Screen>
      <ScrollView ref={scroller} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header
          caption="Hai dimenticato di avviare?"
          title="Ho preso il bus"
          left={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} />
            </RoundButton>
          }
        />

        {blocked ? (
          <Panel style={styles.blocked}>
            <Text style={styles.blockedText} accessibilityRole="alert">
              {blocked}
            </Text>
          </Panel>
        ) : (
          <>
            <Panel style={styles.section}>
              <Text style={text.caption}>Con che linea sei arrivato qui?</Text>
              {here === null ? (
                <View style={styles.searching}>
                  <ActivityIndicator color={C.text} />
                  <Text style={text.body}>Cerco le fermate vicine…</Text>
                </View>
              ) : here.kind !== 'ok' ? (
                <>
                  <Text style={styles.problem} accessibilityRole="alert">
                    {PROBLEMS[here.kind]}
                  </Text>
                  <GhostButton label="Riprova" onPress={locate} />
                </>
              ) : arrivals.length === 0 ? (
                <>
                  <Text style={styles.problem}>Nessuna fermata di bus o tram entro {ARRIVAL_RADIUS_M} metri. Il viaggio si registra appena sceso.</Text>
                  <GhostButton label="Riprova" onPress={locate} />
                </>
              ) : (
                <View style={styles.chips}>
                  {arrivals.map((a, i) => {
                    const p = BUS_ROMA.patterns[a.pattern];
                    const on = i === arrivalKey;
                    return (
                      <Pressable
                        key={`${p.line}-${p.headsign}`}
                        onPress={() => pickLine(i)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${busLabel(p)} verso ${p.headsign}`}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipLine, on && { color: C.ink }]}>{busLabel(p)}</Text>
                        <Text style={[styles.chipHead, on && { color: C.ink }]} numberOfLines={1}>
                          verso {p.headsign}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Panel>

            {arrival ? (
              <Panel style={styles.section}>
                <Text style={text.caption}>
                  Sei sceso a {arrival.stop.name}. Dove sei salito?
                </Text>
                {departures(BUS_ROMA, arrival).map((d) => {
                  const on = d.pos === fromPos;
                  return (
                    <Pressable
                      key={d.pos}
                      onPress={() => pickFrom(d.pos)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={d.stop.name}
                      style={[styles.stop, on && styles.stopOn]}
                    >
                      <Text style={[styles.stopName, on && { fontFamily: F.bold, color: C.ink }]}>{d.stop.name}</Text>
                      <Text style={[text.small, on && { color: C.ink }]}>{km(d.meters)}</Text>
                      <View style={[styles.radio, on && styles.radioOn]}>{on ? <CheckIcon size={14} color={C.ink} /> : null}</View>
                    </Pressable>
                  );
                })}
              </Panel>
            ) : null}

            {ride && preview ? (
              <Panel style={styles.result}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.resultTitle}>{busLabel(ride)}</Text>
                  <Text style={styles.resultDetail}>
                    {ride.from} → {ride.to}
                  </Text>
                  <Text style={styles.resultDetail}>
                    {km(ride.meters)} · {ride.stops === 1 ? '1 fermata' : `${ride.stops} fermate`}
                  </Text>
                </View>
                <PointsChip points={preview.total} />
              </Panel>
            ) : null}

            {arrival ? (
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
                L&apos;arrivo è verificato dalla posizione, linea e partenza le dichiari tu: per questo se ne possono registrare {DECLARED_PER_DAY} al
                giorno{check?.ok && check.left < DECLARED_PER_DAY ? ` (oggi te ne resta ${check.left})` : ''}. Se avvii il tragitto con &quot;Metro,
                bus, tram&quot; quando sali, il bus viene riconosciuto da solo e non c&apos;è limite. Linee e fermate: dati aperti di Roma Servizi per
                la Mobilità, aggiornati al {BUS_ROMA.downloaded}.
              </Text>
            </Panel>

            {problem ? (
              <Text style={styles.problem} accessibilityRole="alert">
                {problem}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      {!blocked && ride ? (
        <View style={[styles.cta, { bottom: insets.bottom + 16 }]}>
          <PrimaryButton label={saving ? 'Registro…' : 'Registra il viaggio'} onPress={save} disabled={saving} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: 116 },
  section: { gap: 10 },
  blocked: { backgroundColor: C.coralSoft },
  blockedText: { fontFamily: F.semi, fontSize: 14.5, lineHeight: 21, color: C.ink },
  searching: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  problem: { fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.alert },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: '47%', flexGrow: 1, borderRadius: 20, backgroundColor: C.tonal, paddingVertical: 10, paddingHorizontal: 14 },
  chipOn: { backgroundColor: C.lime },
  chipLine: { fontFamily: F.displayBold, fontSize: 18, color: C.text },
  chipHead: { fontFamily: F.medium, fontSize: 12.5, color: C.dim },
  stop: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 14 },
  stopOn: { backgroundColor: C.limeSoft },
  stopName: { flex: 1, fontFamily: F.semi, fontSize: 15, color: C.text },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, borderColor: C.outline, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: C.lime },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.lime },
  resultTitle: { fontFamily: F.displayBold, fontSize: 19, lineHeight: 23, color: C.ink },
  resultDetail: { fontFamily: F.semi, fontSize: 13, lineHeight: 18, color: C.ink },
  commute: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, paddingVertical: 12 },
  commuteTitle: { fontFamily: F.bold, fontSize: 15, color: C.text },
  info: { flexDirection: 'row', gap: 12, borderRadius: 20, paddingVertical: 12, backgroundColor: C.card },
  cta: { position: 'absolute', left: 20, right: 20 },
});
