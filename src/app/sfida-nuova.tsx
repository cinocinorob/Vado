/** Schermata "Nuova sfida": tipo, traguardo o durata, avversari. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CHALLENGE_MAX_PEOPLE,
  DURATION_CHOICES_DAYS,
  TARGET_CHOICES,
  TARGET_MAX_DAYS,
  challengeProblem,
  type ChallengeKind,
} from '../core/social';
import { social, type Person } from '../social';
import { CheckIcon, CloseIcon } from '../ui/Icons';
import { Header, PLACEHOLDER, Panel, PrimaryButton, RoundButton, Screen, Toggle, input, text } from '../ui/parts';
import { Avatar, Chip, Segmented } from '../ui/social';
import { C, F } from '../ui/theme';

export default function NuovaSfida() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ChallengeKind>('traguardo');
  const [target, setTarget] = useState<number>(TARGET_CHOICES[1]);
  const [days, setDays] = useState<number>(DURATION_CHOICES_DAYS[1]);
  const [teams, setTeams] = useState(false);
  const [rivals, setRivals] = useState<Person[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    social.rivals(Date.now()).then((list) => {
      if (alive) setRivals(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  function toggle(id: string) {
    setProblem(null);
    setChosen((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      // Massimo dieci persone, chi crea la sfida compreso.
      return current.length >= CHALLENGE_MAX_PEOPLE - 1 ? current : [...current, id];
    });
  }

  async function create() {
    const input = { title, kind, target, days, teams, opponents: chosen };
    const invalid = challengeProblem({ ...input, people: chosen.length + 1 });
    if (invalid) {
      setProblem(invalid);
      return;
    }
    setBusy(true);
    const result = await social.createChallenge(input, Date.now());
    setBusy(false);
    if (result.ok) router.back();
    else setProblem(result.problem);
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Header
          caption="Si gareggia sui punti"
          title="Nuova sfida"
          left={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} />
            </RoundButton>
          }
        />

        <TextInput
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setProblem(null);
          }}
          placeholder="Nome della sfida"
          placeholderTextColor={PLACEHOLDER}
          maxLength={40}
          autoCapitalize="sentences"
          returnKeyType="done"
          accessibilityLabel="Nome della sfida"
          style={input}
        />

        <Segmented
          label="Tipo di sfida"
          value={kind}
          onChange={setKind}
          options={[
            { id: 'traguardo', label: 'Primo al traguardo' },
            { id: 'tempo', label: 'Chi fa di più' },
          ]}
        />

        <Panel style={styles.panel}>
          {kind === 'traguardo' ? (
            <>
              <Text style={styles.title}>Traguardo</Text>
              <View style={styles.choices}>
                {TARGET_CHOICES.map((value) => (
                  <Chip key={value} label={`${value} punti`} active={target === value} onPress={() => setTarget(value)} />
                ))}
              </View>
              <Text style={text.small}>
                Vince chi ci arriva per primo. Se dopo {TARGET_MAX_DAYS} giorni non ci è arrivato nessuno, vince chi è più avanti.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Durata</Text>
              <View style={styles.choices}>
                {DURATION_CHOICES_DAYS.map((value) => (
                  <Chip key={value} label={`${value} giorni`} active={days === value} onPress={() => setDays(value)} />
                ))}
              </View>
              <Text style={text.small}>Parte adesso. Alla scadenza vince chi ha fatto più punti.</Text>
            </>
          )}
        </Panel>

        <Panel style={styles.teams}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>A squadre</Text>
            <Text style={text.small}>Due squadre: conta la somma dei punti. Servono almeno quattro persone.</Text>
          </View>
          <Toggle
            value={teams}
            onChange={(next) => {
              setTeams(next);
              setProblem(null);
            }}
            label="Sfida a squadre"
          />
        </Panel>

        <Panel style={styles.panel}>
          <Text style={styles.title}>
            {teams ? 'Partecipanti' : 'Avversari'} · {chosen.length} di {CHALLENGE_MAX_PEOPLE - 1}
          </Text>
          {teams ? <Text style={text.small}>Le squadre vengono formate alternando i partecipanti; tu sei nella Squadra lime.</Text> : null}
          {rivals.length === 0 ? (
            <Text style={text.small}>Entra in una lega per avere qualcuno da sfidare.</Text>
          ) : (
            rivals.map((person) => {
              const selected = chosen.includes(person.id);
              return (
                <Pressable
                  key={person.id}
                  onPress={() => toggle(person.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={person.name}
                  style={[styles.rival, selected && styles.rivalOn]}
                >
                  <Avatar id={person.id} name={person.name} tree={person.tree} />
                  <Text style={styles.rivalName}>{person.name}</Text>
                  <View style={[styles.check, selected && styles.checkOn]}>{selected ? <CheckIcon size={16} color={C.ink} /> : null}</View>
                </Pressable>
              );
            })
          )}
        </Panel>

        {problem ? (
          <Text style={styles.problem} accessibilityRole="alert">
            {problem}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.cta, { bottom: insets.bottom + 16 }]}>
        <PrimaryButton label={busy ? 'Creo…' : 'Lancia la sfida'} onPress={create} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 18, paddingBottom: 116 },
  panel: { gap: 12 },
  title: { fontFamily: F.displayBold, fontSize: 17, color: C.text },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  teams: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rival: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 8, borderRadius: 14 },
  rivalOn: { backgroundColor: C.limeSoft },
  rivalName: { flex: 1, fontFamily: F.bold, fontSize: 15, color: C.text },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: C.outline, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.lime },
  problem: { fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.alert },
  cta: { position: 'absolute', left: 20, right: 20 },
});
