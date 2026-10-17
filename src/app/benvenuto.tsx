/** Presentazione al primo avvio: come funziona, i permessi, la scelta dell'albero. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SpeciesId } from '../core/plant';
import { askReminderPermission } from '../reminders/schedule';
import { loadTree, saveTree } from '../storage/tree';
import { markWelcomeSeen } from '../storage/welcome';
import { askLocation, askSteps } from '../tracking/tracker';
import { ShapeBadge } from '../ui/expressive';
import { GhostButton, PrimaryButton, Screen, text } from '../ui/parts';
import { Sprout } from '../ui/Sprout';
import { C, F, R } from '../ui/theme';
import { TreePicker } from '../ui/TreeAvatar';

type Step = 0 | 1 | 2;

export default function Benvenuto() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(0);
  const [asked, setAsked] = useState<string | null>(null);
  const [species, setSpecies] = useState<SpeciesId | null>(null);

  async function done() {
    if (species) await saveTree({ ...(await loadTree()), species });
    await markWelcomeSeen();
    router.back();
  }

  async function permissions() {
    const location = await askLocation();
    const steps = await askSteps();
    const notes = await askReminderPermission();
    setAsked(
      [location ? 'Posizione: sì' : 'Posizione: no (la chiederò ad Avvia)', steps ? 'passi: sì' : 'passi: no', notes ? 'promemoria: sì' : 'promemoria: no'].join(' · '),
    );
  }

  return (
    <Screen style={{ paddingBottom: insets.bottom + 16 }}>
      <View style={styles.top}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
          ))}
        </View>
        <Pressable onPress={done} accessibilityRole="button" accessibilityLabel="Salta la presentazione" hitSlop={10}>
          <Text style={styles.skip}>Salta</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <>
            <ShapeBadge shape="cookie12" color={C.mint} size={180}>
              <Sprout size={150} stage="germoglio" />
            </ShapeBadge>
            <Text style={styles.title}>Muoviti senza auto, fai crescere un albero</Text>
            <Text style={styles.lead}>
              Premi Parti quando esci: a piedi, in bici, in metro o in bus. Ogni km vale punti e CO₂ evitata, e il tuo germoglio cresce fino a
              diventare un albero.
            </Text>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.title}>Cosa serve all&apos;app</Text>
            <View style={styles.list}>
              <Item title="Posizione, solo durante un tragitto" body="Per misurare la distanza. Il percorso non viene salvato e non lascia il telefono." />
              <Item title="Attività fisica" body="Per contare i passi a piedi e confermare che stai camminando." />
              <Item title="Notifiche" body="Per il tragitto in corso a schermo spento e per i promemoria, che puoi spegnere nelle impostazioni." />
            </View>
            <GhostButton label={asked ? 'Permessi chiesti' : 'Concedi i permessi'} onPress={permissions} />
            {asked ? <Text style={[text.small, { textAlign: 'center' }]}>{asked}</Text> : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.title}>Scegli il tuo albero</Text>
            <Text style={styles.lead}>Il germoglio diventa questo albero, ed è il tuo avatar in classifica. Puoi cambiarlo quando vuoi.</Text>
            <TreePicker value={species} onChange={setSpecies} />
          </>
        ) : null}
      </ScrollView>

      <PrimaryButton label={step < 2 ? 'Avanti' : 'Inizia'} onPress={() => (step < 2 ? setStep((step + 1) as Step) : done())} />
    </Screen>
  );
}

function Item({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={text.small}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.faint },
  dotOn: { width: 24, backgroundColor: C.text },
  skip: { fontFamily: F.semi, fontSize: 15, color: C.dim },
  body: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 18, paddingVertical: 20 },
  title: { fontFamily: F.displayBold, fontSize: 30, lineHeight: 36, color: C.text, textAlign: 'center', letterSpacing: -0.5 },
  lead: { fontFamily: F.medium, fontSize: 16, lineHeight: 23, color: C.dim, textAlign: 'center' },
  list: { alignSelf: 'stretch', gap: 3 },
  item: { backgroundColor: C.card, borderRadius: R.inner, padding: 14, gap: 3 },
  itemTitle: { fontFamily: F.semi, fontSize: 15, color: C.text },
});
