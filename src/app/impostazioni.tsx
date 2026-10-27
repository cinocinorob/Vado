/** Schermata "Impostazioni": aspetto, promemoria, backup, riservatezza e azzeramento dei dati. */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LOOK_CHOICES, type LookChoice } from '../core/look';
import { forgetImportedBefore } from '../health/sync';
import { social } from '../social';
import { readLookChoice, writeLookChoice } from '../storage/lookFile';
import { clearPauses } from '../storage/pause';
import { loadReminders, saveReminders, type Reminders } from '../storage/reminders';
import { loadTree, saveTree } from '../storage/tree';
import { clearTrips } from '../storage/trips';
import { disableHomeReminder, enableHomeReminder, homeReminderOn } from '../reminders/home';
import { AUTO_SUPPORTED, autoStatus, disableAuto, enableAuto } from '../auto/movimento';
import { applyReminders } from '../reminders/schedule';
import { Group, SectionTitle } from '../ui/expressive';
import { ChevronIcon, CloseIcon } from '../ui/Icons';
import { GhostButton, Header, RoundButton, Screen, Toggle, text } from '../ui/parts';
import { C, F, LOOK } from '../ui/theme';

/** L'ora letta solo in risposta a un tocco. */
const clock = () => Date.now();

const LOOK_TEXT: Record<LookChoice, { title: string; detail: string }> = {
  auto: { title: 'Automatico', detail: 'Halloween dal 15 ottobre al 2 novembre, Natale dal 1° dicembre al 6 gennaio, il resto dell’anno come il telefono' },
  chiaro: { title: 'Chiaro', detail: 'Sempre chiaro' },
  scuro: { title: 'Scuro', detail: 'Sempre scuro' },
  halloween: { title: 'Halloween', detail: 'Notte, zucche e pipistrelli tutto l’anno' },
  natale: { title: 'Natale', detail: 'Abeti, neve e cappelli rossi tutto l’anno' },
};

const REMINDER_TEXT: Record<keyof Reminders, { title: string; detail: string }> = {
  forgot: { title: 'Hai dimenticato Termina?', detail: 'Se un tragitto resta aperto ma sei fermo da 15 minuti' },
  thirsty: { title: 'La tua pianta ha sete', detail: 'Dopo due giorni senza tragitti senza auto, alle 18' },
  overtaken: { title: 'Qualcuno ti ha superato', detail: 'Nella classifica della tua lega; controllato ogni qualche ora' },
  weekly: { title: 'La tua settimana', detail: 'Il lunedì alle 9: km, CO₂ e punti della settimana appena finita' },
};

export default function Impostazioni() {
  const [look, setLook] = useState<LookChoice>(() => readLookChoice());
  const [reminders, setReminders] = useState<Reminders | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [home, setHome] = useState(false);
  const [homeNote, setHomeNote] = useState<string | null>(null);
  const [auto, setAuto] = useState(() => !!autoStatus()?.enabled);
  const [autoNote, setAutoNote] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadReminders().then(setReminders);
      homeReminderOn().then(setHome);
    }, []),
  );

  function pickLook(next: LookChoice) {
    setLook(next);
    writeLookChoice(next);
  }

  async function toggleReminder(key: keyof Reminders, on: boolean) {
    if (!reminders) return;
    const next = { ...reminders, [key]: on };
    setReminders(next);
    await saveReminders(next);
    await applyReminders(clock()).catch(() => undefined);
  }

  async function toggleAuto(on: boolean) {
    setAutoNote(null);
    if (!on) {
      await disableAuto();
      setAuto(false);
      return;
    }
    const result = await enableAuto();
    setAuto(result.ok);
    if (!result.ok) setAutoNote(result.problem);
  }

  async function toggleHome(on: boolean) {
    setHomeNote(null);
    if (!on) {
      await disableHomeReminder();
      setHome(false);
      return;
    }
    const result = await enableHomeReminder();
    setHome(result.ok);
    setHomeNote(result.ok ? 'Fatto: casa è dove sei adesso (150 metri attorno).' : result.problem);
  }

  async function reset() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    await clearTrips();
    await clearPauses();
    await saveTree({ ...(await loadTree()), history: [] });
    // Le attività già importate non devono rientrare alla prossima lettura.
    await forgetImportedBefore(Date.now());
    // Anche il profilo della classifica, qui e sul server.
    await social.reset();
    setConfirm(false);
    setCleared(true);
  }

  const changed = look !== readLookChoiceAtStart;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header
          caption="Vado"
          title="Impostazioni"
          left={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} />
            </RoundButton>
          }
        />

        <SectionTitle title="Aspetto" />
        <Group>
          {LOOK_CHOICES.map((choice) => {
            const on = choice === look;
            return (
              <Pressable
                key={choice}
                onPress={() => pickLook(choice)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={LOOK_TEXT[choice].title}
                style={styles.row}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{LOOK_TEXT[choice].title}</Text>
                  <Text style={text.small}>{LOOK_TEXT[choice].detail}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.dot} /> : null}</View>
              </Pressable>
            );
          })}
        </Group>
        {changed ? (
          <View style={styles.note}>
            <Text style={text.body}>Il nuovo aspetto si vede alla prossima apertura dell&apos;app.</Text>
            {Platform.OS === 'android' ? <GhostButton label="Chiudi l'app ora" onPress={() => BackHandler.exitApp()} /> : null}
          </View>
        ) : null}

        <SectionTitle title="Promemoria" />
        <Group>
          {(Object.keys(REMINDER_TEXT) as (keyof Reminders)[]).map((key) => (
            <View key={key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{REMINDER_TEXT[key].title}</Text>
                <Text style={text.small}>{REMINDER_TEXT[key].detail}</Text>
              </View>
              <Toggle value={!!reminders?.[key]} onChange={(on) => toggleReminder(key, on)} label={REMINDER_TEXT[key].title} disabled={!reminders} />
            </View>
          ))}
        </Group>

        {AUTO_SUPPORTED ? (
          <>
            <Group>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Avvio automatico</Text>
                  <Text style={text.small}>
                    Quando cominci a camminare, pedalare o sali su un mezzo arriva un avviso: un tocco e il tragitto parte. Usa il permesso &quot;Attività
                    fisica&quot;, non la posizione. Al massimo un avviso ogni 45 minuti, mai di notte.
                  </Text>
                </View>
                <Toggle value={auto} onChange={toggleAuto} label="Avvio automatico" />
              </View>
            </Group>
            {autoNote ? <Text style={[text.small, styles.homeNote]}>{autoNote}</Text> : null}
          </>
        ) : null}

        <Group>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Avvisami quando esco di casa</Text>
              <Text style={text.small}>Accendilo mentre sei a casa. Uscendo arriva un avviso per avviare il tragitto. Serve la posizione &quot;Consenti sempre&quot;.</Text>
            </View>
            <Toggle value={home} onChange={toggleHome} label="Avvisami quando esco di casa" />
          </View>
        </Group>
        {homeNote ? <Text style={[text.small, styles.homeNote]}>{homeNote}</Text> : null}

        <SectionTitle title="I tuoi dati" />
        <Group>
          <Link label="Backup e cambio telefono" onPress={() => router.push('/backup')} />
          <Link label="Riservatezza: come usiamo i dati" onPress={() => router.push('/riservatezza')} />
          <Link label="Il tuo germoglio e il bosco" onPress={() => router.push('/bosco')} />
          <Link label="Diagnostica dei tragitti" onPress={() => router.push('/diagnostica')} />
        </Group>

        <SectionTitle title="Ricominciare da zero" />
        <View style={styles.danger}>
          <Text style={text.body}>Cancella tutti i tragitti, la pianta e il profilo della classifica, qui e sul server. Non si può annullare.</Text>
          {cleared ? (
            <Text style={[text.body, { color: C.teal, fontFamily: F.bold }]} accessibilityRole="alert">
              Dati cancellati.
            </Text>
          ) : (
            <GhostButton label={confirm ? 'Tocca di nuovo per cancellare tutto' : 'Azzera tutti i dati'} onPress={reset} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

/** L'aspetto in uso, deciso all'avvio. */
const readLookChoiceAtStart = readLookChoice();
void LOOK;

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      <Text style={[styles.rowTitle, { flex: 1 }]}>{label}</Text>
      <ChevronIcon size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 8, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10 },
  rowTitle: { fontFamily: F.semi, fontSize: 15.5, color: C.text },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.outline, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.text },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.text },
  note: { gap: 10, padding: 4 },
  homeNote: { paddingHorizontal: 6 },
  danger: { backgroundColor: C.card, borderRadius: 28, padding: 16, gap: 12 },
});
