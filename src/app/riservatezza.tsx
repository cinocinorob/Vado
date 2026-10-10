/**
 * Schermata "Riservatezza": quali dati usa l'app e dove restano.
 * È anche la spiegazione che Connessione Salute chiede a ogni app che ne legge i dati.
 */
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { IMPORT_DAYS } from '../core/health';
import { CloseIcon } from '../ui/Icons';
import { Header, Panel, RoundButton, Screen, text } from '../ui/parts';
import { C, F } from '../ui/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Posizione',
    body:
      'Usata solo mentre un tragitto è aperto, anche a schermo spento, per misurare la distanza. Le coordinate restano in memoria finché il tragitto è in corso e non vengono mai salvate: nello storico finiscono solo distanza, tempo, passi, mezzo e punti.',
  },
  {
    title: 'Passi del telefono',
    body: 'Contati durante i tratti a piedi per confermare che la distanza è stata fatta camminando.',
  },
  {
    title: 'Connessione Salute',
    body: `Solo se la colleghi tu. L'app legge tre cose: i passi, le attività registrate (camminate, corse, escursioni, giri in bici) e la loro distanza, degli ultimi ${IMPORT_DAYS} giorni. Li usa per confermare i tratti a piedi e per assegnare punti alle attività. Non scrive nulla in Connessione Salute e legge solo quando l'app è aperta.`,
  },
  {
    title: 'Dove restano i dati',
    body:
      "Tutto resta su questo telefono. Nessun dato viene inviato a un server, venduto, usato per la pubblicità o condiviso con altri. Se disinstalli l'app, i dati vengono cancellati con lei.",
  },
  {
    title: 'Come togliere i permessi',
    body:
      "Posizione, attività fisica e notifiche: dalle impostazioni del telefono, alla voce dell'app. Connessione Salute: da \"Gestisci i permessi\" nella schermata Oggi, oppure dalle impostazioni di Connessione Salute.",
  },
];

export default function Riservatezza() {
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header
          caption="Cosa usa l'app e perché"
          title="Riservatezza"
          left={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} />
            </RoundButton>
          }
        />
        {SECTIONS.map((section) => (
          <Panel key={section.title} style={styles.section}>
            <Text style={styles.title} accessibilityRole="header">
              {section.title}
            </Text>
            <Text style={text.body}>{section.body}</Text>
          </Panel>
        ))}
        <View style={{ height: 8 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: 40 },
  section: { gap: 6, borderRadius: 20 },
  title: { fontFamily: F.displayBold, fontSize: 17, color: C.text },
});
