/** Schermata "Nuova lega": crearne una oppure entrare con un codice. */
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { CODE_LENGTH } from '../core/social';
import { social, type LeagueSummary, type Result } from '../social';
import { leagueToOpen } from '../social/selection';
import { CloseIcon } from '../ui/Icons';
import { Header, PLACEHOLDER, Panel, PrimaryButton, RoundButton, Screen, input, text } from '../ui/parts';
import { C, F } from '../ui/theme';

export default function NuovaLega() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [createProblem, setCreateProblem] = useState<string | null>(null);
  const [joinProblem, setJoinProblem] = useState<string | null>(null);

  async function finish(work: Promise<Result<LeagueSummary>>, onProblem: (problem: string) => void) {
    setBusy(true);
    const result = await work;
    setBusy(false);
    if (!result.ok) {
      onProblem(result.problem);
      return;
    }
    leagueToOpen.set(result.value.id);
    router.back();
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Header
          caption="Con amici, colleghi, famiglia"
          title="Nuova lega"
          left={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} />
            </RoundButton>
          }
        />

        <Panel style={styles.panel}>
          <Text style={styles.title} accessibilityRole="header">
            Crea una lega
          </Text>
          <Text style={text.small}>Le dai un nome e ricevi un codice da mandare a chi vuoi invitare.</Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              setCreateProblem(null);
            }}
            placeholder="Per esempio Colleghi"
            placeholderTextColor={PLACEHOLDER}
            maxLength={24}
            autoCapitalize="sentences"
            returnKeyType="done"
            accessibilityLabel="Nome della lega"
            style={input}
          />
          {createProblem ? (
            <Text style={styles.problem} accessibilityRole="alert">
              {createProblem}
            </Text>
          ) : null}
          <PrimaryButton label="Crea la lega" onPress={() => finish(social.createLeague(name), setCreateProblem)} disabled={busy} />
        </Panel>

        <Panel style={styles.panel}>
          <Text style={styles.title} accessibilityRole="header">
            Entra con un codice
          </Text>
          <Text style={text.small}>Sei caratteri, ricevuti da chi ha creato la lega.</Text>
          <TextInput
            value={code}
            onChangeText={(value) => {
              setCode(value.toUpperCase());
              setJoinProblem(null);
            }}
            placeholder="ABC234"
            placeholderTextColor={PLACEHOLDER}
            maxLength={CODE_LENGTH + 2}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="Codice d'invito"
            style={[input, styles.codeInput]}
          />
          {joinProblem ? (
            <Text style={styles.problem} accessibilityRole="alert">
              {joinProblem}
            </Text>
          ) : null}
          <PrimaryButton label="Entra nella lega" onPress={() => finish(social.joinLeague(code), setJoinProblem)} disabled={busy} />
          {social.demo ? (
            <Text style={text.small}>In anteprima qualunque codice valido apre una lega di esempio: le leghe vere arrivano con il server.</Text>
          ) : null}
        </Panel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 18, paddingBottom: 40 },
  panel: { gap: 12 },
  title: { fontFamily: F.displayBold, fontSize: 18, color: C.text },
  codeInput: { fontFamily: F.display, fontSize: 22, letterSpacing: 4 },
  problem: { fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.alert },
});
