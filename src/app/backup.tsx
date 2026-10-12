/**
 * Schermata "Backup": salvare tragitti e profilo della classifica in un file,
 * rimetterli su un altro telefono, e il codice di recupero della classifica.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { exportBackup, importBackup, type Outcome } from '../backup/file';
import { social, type Profile } from '../social';
import { CloseIcon } from '../ui/Icons';
import { GhostButton, Header, PLACEHOLDER, Panel, PrimaryButton, RoundButton, Screen, input, text } from '../ui/parts';
import { C, F } from '../ui/theme';

// L'ora letta al momento di un tocco, fuori dal disegno della schermata.
const clock = () => Date.now();

function Result({ outcome }: { outcome: Outcome | null }) {
  if (!outcome || outcome.ok === 'annullato') return null;
  return (
    <Text style={[styles.result, { color: outcome.ok ? C.teal : C.alert }]} accessibilityRole="alert">
      {outcome.ok ? outcome.message : outcome.problem}
    </Text>
  );
}

export default function Backup() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Outcome | null>(null);
  const [restored, setRestored] = useState<Outcome | null>(null);
  const [typed, setTyped] = useState('');
  const [recovered, setRecovered] = useState<Outcome | null>(null);
  const [confirm, setConfirm] = useState(false);

  const refresh = useCallback(async () => {
    const who = await social.profile();
    setProfile(who);
    setCode(await social.recoveryCode());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => undefined);
    }, [refresh]),
  );

  async function save() {
    setBusy(true);
    setSaved(null);
    setSaved(await exportBackup(clock()));
    setBusy(false);
  }

  async function restore() {
    setBusy(true);
    setRestored(null);
    setRestored(await importBackup());
    await refresh();
    setBusy(false);
  }

  async function recover() {
    if (profile && !confirm) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    const result = await social.recover(typed);
    setBusy(false);
    setConfirm(false);
    if (result.ok) {
      setTyped('');
      setRecovered({ ok: true, message: `Profilo "${result.value.nickname}" ritrovato: leghe, sfide e punti sono di nuovo qui.` });
      await refresh();
    } else {
      setRecovered({ ok: false, problem: result.problem });
    }
  }

  async function shareCode() {
    if (!code) return;
    try {
      await Share.share({ message: `Codice di recupero della classifica di Vado: ${code}` });
    } catch {
      // Condivisione annullata: il codice resta sullo schermo.
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Header
          caption="Per cambiare telefono senza perdere nulla"
          title="Backup"
          left={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} />
            </RoundButton>
          }
        />

        <Panel style={styles.panel}>
          <Text style={styles.title} accessibilityRole="header">
            Salva un backup
          </Text>
          <Text style={text.body}>
            Un file con tutti i tuoi tragitti{profile ? ' e il codice di recupero della classifica' : ''}. Mandalo dove lo ritrovi: Google Drive, una
            chat con te stesso, un&apos;email.
          </Text>
          <PrimaryButton label={busy ? 'Un momento…' : 'Crea il backup'} onPress={save} disabled={busy} />
          <Result outcome={saved} />
        </Panel>

        <Panel style={styles.panel}>
          <Text style={styles.title} accessibilityRole="header">
            Rimetti un backup
          </Text>
          <Text style={text.body}>
            Sul telefono nuovo scegli il file. I tragitti si aggiungono a quelli presenti, nulla viene cancellato; se sul telefono non c&apos;è un
            profilo della classifica, torna anche quello.
          </Text>
          <GhostButton label="Scegli il file" onPress={restore} />
          <Result outcome={restored} />
        </Panel>

        <Panel style={styles.panel}>
          <Text style={styles.title} accessibilityRole="header">
            Codice di recupero della classifica
          </Text>
          {profile && code ? (
            <>
              <Text style={text.body}>
                Con questo codice ritrovi &quot;{profile.nickname}&quot;, le tue leghe e i tuoi punti su un altro telefono. Tienilo per te: chi lo ha
                può usare il tuo profilo.
              </Text>
              {shown ? (
                <>
                  <Text style={styles.code} selectable accessibilityLabel={`Codice di recupero: ${code.split('').join(' ')}`}>
                    {code}
                  </Text>
                  <GhostButton label="Condividi il codice" onPress={shareCode} />
                </>
              ) : (
                <GhostButton label="Mostra il codice" onPress={() => setShown(true)} />
              )}
            </>
          ) : (
            <Text style={text.body}>Su questo telefono non c&apos;è ancora un profilo della classifica.</Text>
          )}

          <View style={styles.divider} />
          <Text style={styles.subtitle}>Hai un codice da un altro telefono?</Text>
          <TextInput
            value={typed}
            onChangeText={(value) => {
              setTyped(value);
              setRecovered(null);
              setConfirm(false);
            }}
            placeholder="ABCDEF-GHJKLM-…"
            placeholderTextColor={PLACEHOLDER}
            autoCapitalize="characters"
            autoCorrect={false}
            multiline
            accessibilityLabel="Codice di recupero da inserire"
            style={[input, styles.codeInput]}
          />
          {confirm && profile ? (
            <Text style={[styles.result, { color: C.alert }]} accessibilityRole="alert">
              Su questo telefono c&apos;è il profilo &quot;{profile.nickname}&quot;: verrà sostituito. Se ti serve ancora, annota prima il suo codice.
              Tocca di nuovo per confermare.
            </Text>
          ) : null}
          <GhostButton label={busy ? 'Un momento…' : confirm ? 'Sostituisci il profilo' : 'Ritrova il profilo'} onPress={recover} />
          <Result outcome={recovered} />
        </Panel>

        <Pressable onPress={() => router.push('/riservatezza')} accessibilityRole="link" style={styles.note}>
          <Text style={text.small}>
            Android può copiare da solo i dati delle app sul tuo account Google, ma per Vado non è verificato: il file e il codice sono la strada
            sicura. Cosa c&apos;è nel file e dove va: vedi Riservatezza.
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: 40 },
  panel: { gap: 12 },
  title: { fontFamily: F.displayBold, fontSize: 18, color: C.text },
  subtitle: { fontFamily: F.bold, fontSize: 15, color: C.text },
  result: { fontFamily: F.bold, fontSize: 14, lineHeight: 20 },
  code: { fontFamily: F.display, fontSize: 19, lineHeight: 28, letterSpacing: 1.5, color: C.ink, backgroundColor: C.limeSoft, borderRadius: 14, padding: 12 },
  codeInput: { minHeight: 76, fontFamily: F.display, fontSize: 17, letterSpacing: 1, textAlignVertical: 'top', paddingTop: 12 },
  divider: { height: 2, backgroundColor: C.line, marginVertical: 4 },
  note: { paddingHorizontal: 4 },
});
