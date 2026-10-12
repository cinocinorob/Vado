/**
 * Schermata "Riservatezza": quali dati usa l'app e dove restano.
 * È anche la spiegazione che Connessione Salute chiede a ogni app che ne legge i dati.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { IMPORT_DAYS } from '../core/health';
import { ROMA } from '../data/metro';
import { social, type Profile } from '../social';
import { CloseIcon } from '../ui/Icons';
import { GhostButton, Header, Panel, RoundButton, Screen, text } from '../ui/parts';
import { C, F } from '../ui/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Posizione',
    body:
      'Usata solo mentre un tragitto è aperto, anche a schermo spento, per misurare la distanza. Le coordinate restano in memoria finché il tragitto è in corso e non vengono mai salvate: nello storico finiscono solo distanza, tempo, passi, mezzo e punti.',
  },
  {
    title: 'Metro',
    body:
      'Sottoterra il GPS non arriva: la distanza viene calcolata sulla rete tra la stazione di ingresso e quella di uscita. Per i viaggi in metro nello storico restano scritti i nomi delle due stazioni, che servono a mostrarti da dove viene la distanza. Con "Ho preso la metro" la posizione viene letta una volta sola, per riconoscere la stazione dove ti trovi, e non viene salvata.',
  },
  {
    title: 'Da dove vengono i dati della metro',
    body: `Stazioni e tracciati vengono dai dati aperti di ${ROMA.data.source}, scaricati il ${ROMA.data.downloaded.split('-').reverse().join('/')}. Stanno dentro l'app: per usarli non serve la connessione.`,
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
    title: 'Classifica, leghe e sfide',
    body:
      "Solo se scegli un soprannome. Da quel momento al server di Vado arrivano: il soprannome, le leghe e le sfide a cui partecipi e, per ogni tragitto che ti ha dato punti, l'ora in cui è finito, i punti e il mezzo principale. Servono a sommare i punti della settimana e delle sfide. I compagni di lega vedono il tuo soprannome, il totale dei punti e il mezzo che usi di più; non i singoli tragitti. Non arrivano mai posizioni, distanze o nomi di stazioni. Niente email né password: il telefono si fa riconoscere con una chiave casuale.",
  },
  {
    title: 'Backup',
    body:
      "Il file di backup lo crei tu e va dove lo mandi tu (Drive, una chat, un'email): contiene i tragitti, con distanze, orari, passi, mezzi e i nomi delle stazioni della metro, e il codice di recupero della classifica. Vado non ne tiene una copia. Chi ha il file o il codice può usare il tuo profilo della classifica: tienili per te.",
  },
  {
    title: 'Dove restano i dati',
    body:
      "Tragitti, passi e dati di Connessione Salute restano su questo telefono. Lasciano il telefono solo i dati della classifica descritti qui sopra, conservati in Germania (Francoforte), nell'Unione Europea, su un server gestito da Supabase. Nessun dato viene venduto, usato per la pubblicità o condiviso con altri. Se disinstalli l'app, i dati sul telefono vengono cancellati con lei.",
  },

  {
    title: 'Come togliere i permessi',
    body:
      "Posizione, attività fisica e notifiche: dalle impostazioni del telefono, alla voce dell'app. Connessione Salute: da \"Gestisci i permessi\" nella schermata Oggi, oppure dalle impostazioni di Connessione Salute.",
  },
];

export default function Riservatezza() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      social.profile().then((who) => {
        if (alive) setProfile(who);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  async function remove() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    await social.reset();
    setProfile(null);
    setConfirm(false);
    setDeleted(true);
  }

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
        {!social.demo && (profile || deleted) ? (
          <Panel style={styles.section}>
            <Text style={styles.title} accessibilityRole="header">
              Cancellare il profilo della classifica
            </Text>
            {profile ? (
              <>
                <Text style={text.body}>
                  Cancella dal server il soprannome &quot;{profile.nickname}&quot;, i punti inviati e la tua presenza in leghe e sfide. I tragitti
                  sul telefono restano. Non si può annullare.
                </Text>
                <GhostButton label={confirm ? 'Tocca di nuovo per cancellare' : 'Cancella il profilo'} onPress={remove} />
              </>
            ) : (
              <Text style={[text.body, { color: C.teal, fontFamily: F.bold }]} accessibilityRole="alert">
                Profilo cancellato dal server.
              </Text>
            )}
          </Panel>
        ) : null}
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
