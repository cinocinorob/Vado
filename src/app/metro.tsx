/**
 * "Ho preso la metro": registra a posteriori un viaggio in metro.
 * La stazione di arrivo è quella dove ci si trova (dalla posizione), quella di
 * partenza si sceglie dall'elenco; i chilometri vengono dalla rete.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canDeclare, declaredTrip, type DeclareCheck } from '../core/declared';
import { ARRIVAL_RADIUS_M, DECLARED_PER_DAY, routeBetween, routeLabel, routeLines, type Station } from '../core/metro';
import { COMMUTE_BONUS, type Trip } from '../core/scoring';
import { ROMA } from '../data/metro';
import { locateArrival, type Arrival } from '../metro/arrival';
import { loadTrips, saveTrip } from '../storage/trips';
import { useActiveTrip } from '../tracking/store';
import { km } from '../ui/format';
import { CheckIcon, CloseIcon, ShieldIcon } from '../ui/Icons';
import { GhostButton, Header, LineBadge, Panel, PointsChip, PrimaryButton, RoundButton, Screen, Toggle, text } from '../ui/parts';
import { C, F } from '../ui/theme';

// L'ora letta al momento di un'azione, fuori dal disegno della schermata.
const clock = () => Date.now();

const PROBLEMS: Record<Exclude<Arrival['kind'], 'ok'>, string> = {
  permesso: 'Serve la posizione per riconoscere la stazione dove ti trovi. Concedi il permesso "Mentre usi l\'app" dalle impostazioni del telefono e riprova.',
  assente: 'Non arriva nessuna posizione. Esci all\'aperto, controlla che il GPS sia acceso e riprova.',
  incerta: 'La posizione è ancora troppo incerta per capire a quale stazione sei. Aspetta qualche secondo all\'aperto e riprova.',
  simulata: 'La posizione arriva da un\'app di simulazione: così il viaggio non si può registrare.',
  lontano: `Non sei vicino a una stazione della metro. Il viaggio si registra all'uscita, entro ${ARRIVAL_RADIUS_M} metri dalla stazione.`,
};

export default function HoPresoLaMetro() {
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const active = useActiveTrip();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [check, setCheck] = useState<DeclareCheck | null>(null);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [lineId, setLineId] = useState(ROMA.data.lines[0].id);
  const [fromId, setFromId] = useState<string | null>(null);
  const [commute, setCommute] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // L'ora dell'anteprima si aggiorna quando si apre la schermata, non a ogni ridisegno.
  const [now, setNow] = useState(() => Date.now());

  const locate = useCallback(async () => {
    setArrival(null);
    const found = await locateArrival();
    setArrival(found);
    // Si parte dall'elenco della linea su cui si è arrivati: è il caso più frequente.
    if (found.kind === 'ok') setLineId(found.station.lines[0] ?? ROMA.data.lines[0].id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadTrips().then((loaded) => {
        if (!alive) return;
        const opened = clock();
        setNow(opened);
        setTrips(loaded);
        const allowed = canDeclare(loaded, opened);
        setCheck(allowed);
        // La posizione si chiede solo se il viaggio si può davvero registrare.
        if (allowed.ok) locate();
      });
      return () => {
        alive = false;
      };
    }, [locate]),
  );

  const to: Station | null = arrival?.kind === 'ok' ? arrival.station : null;
  const line = ROMA.data.lines.find((l) => l.id === lineId) ?? ROMA.data.lines[0];
  const route = to && fromId && fromId !== to.id ? routeBetween(ROMA, fromId, to.id) : null;
  const preview = route && trips ? declaredTrip(route, { now, commute, trips }) : null;

  function choose(id: string) {
    setFromId(id);
    // L'elenco è lungo: scelta la partenza si va in fondo, dove compaiono percorso, punti e pulsante.
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
  }

  async function save() {
    if (!route) return;
    setSaving(true);
    setProblem(null);
    const at = clock();
    const fresh = await loadTrips();
    const allowed = canDeclare(fresh, at);
    if (!allowed.ok) {
      setCheck(allowed);
      setSaving(false);
      return;
    }
    try {
      const trip = declaredTrip(route, { now: at, commute, trips: fresh });
      await saveTrip(trip);
      router.replace({ pathname: '/riepilogo', params: { id: trip.id } });
    } catch {
      setProblem('Non sono riuscito a salvare il viaggio. Riprova.');
      setSaving(false);
    }
  }

  const blocked = active
    ? 'Hai un tragitto in corso: se sei con i mezzi pubblici, la metro viene calcolata lì. Terminalo prima di registrarne un altro.'
    : check && !check.ok
      ? check.reason
      : null;

  return (
    <Screen>
      <ScrollView ref={scroller} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header
          caption="Hai dimenticato di avviare?"
          title="Ho preso la metro"
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
              <Text style={text.caption}>Sei arrivato a</Text>
              {arrival === null ? (
                <View style={styles.searching}>
                  <ActivityIndicator color={C.text} />
                  <Text style={text.body}>Cerco la stazione dove ti trovi…</Text>
                </View>
              ) : arrival.kind === 'ok' ? (
                <View style={styles.arrival}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.station} accessibilityLabel={`Stazione di arrivo: ${arrival.station.name}`}>
                      {arrival.station.name}
                    </Text>
                    <View style={styles.verified}>
                      <ShieldIcon size={15} color={C.teal} />
                      <Text style={styles.verifiedText}>Riconosciuta dalla posizione</Text>
                    </View>
                  </View>
                  <View style={styles.badges}>
                    {arrival.station.lines.map((id) => (
                      <LineBadge key={id} line={id} />
                    ))}
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.problem} accessibilityRole="alert">
                    {PROBLEMS[arrival.kind]}
                  </Text>
                  <GhostButton label="Riprova" onPress={locate} />
                </>
              )}
            </Panel>

            {to ? (
              <Panel style={styles.section}>
                <Text style={text.caption}>Da dove sei partito</Text>
                <View style={styles.lines} accessibilityRole="tablist" accessibilityLabel="Linea">
                  {ROMA.data.lines.map((l) => {
                    const selected = l.id === line.id;
                    return (
                      <Pressable
                        key={l.id}
                        onPress={() => setLineId(l.id)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={l.name}
                        style={[styles.lineTab, selected && styles.lineTabOn]}
                      >
                        <LineBadge line={l.id} size={28} />
                      </Pressable>
                    );
                  })}
                </View>
                <View>
                  {line.stations
                    .filter((id) => id !== to.id)
                    .map((id) => {
                      const station = ROMA.stations.get(id);
                      if (!station) return null;
                      const selected = id === fromId;
                      return (
                        <Pressable
                          key={id}
                          onPress={() => choose(id)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={station.name}
                          style={[styles.stop, selected && styles.stopOn]}
                        >
                          <Text style={[styles.stopName, selected && { fontFamily: F.bold, color: C.ink }]}>{station.name}</Text>
                          <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <CheckIcon size={14} color={C.ink} /> : null}</View>
                        </Pressable>
                      );
                    })}
                </View>
              </Panel>
            ) : null}

            {route && preview ? (
              <Panel style={styles.result}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.resultTitle}>{routeLabel(route)}</Text>
                  <Text style={styles.resultDetail}>{routeLines(route)}</Text>
                  <Text style={styles.resultDetail}>
                    {km(route.meters)} · {route.stops === 1 ? '1 fermata' : `${route.stops} fermate`}
                  </Text>
                </View>
                <PointsChip points={preview.total} />
              </Panel>
            ) : null}

            {to ? (
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
                L&apos;arrivo è verificato dalla posizione, la partenza la dichiari tu: per questo se ne possono registrare{' '}
                {DECLARED_PER_DAY} al giorno{check?.ok && check.left < DECLARED_PER_DAY ? ` (oggi te ne resta ${check.left})` : ''}. Se avvii il
                tragitto prima di scendere in metro non c&apos;è limite: la distanza viene calcolata da sola. La posizione viene letta una
                volta sola e non viene salvata.
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

      {!blocked && route ? (
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
  blockedText: { fontFamily: F.semi, fontSize: 14.5, lineHeight: 21, color: C.text },
  searching: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  arrival: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  station: { fontFamily: F.displayBold, fontSize: 26, lineHeight: 30, color: C.text },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  verifiedText: { fontFamily: F.bold, fontSize: 12.5, color: C.teal },
  badges: { flexDirection: 'row', gap: 6 },
  problem: { fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.alert },
  lines: { flexDirection: 'row', gap: 8 },
  lineTab: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.tonal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  lineTabOn: { backgroundColor: C.lime },
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
  info: { flexDirection: 'row', gap: 12, borderRadius: 20, paddingVertical: 12, backgroundColor: C.limeSoft },
  cta: { position: 'absolute', left: 20, right: 20 },
});
