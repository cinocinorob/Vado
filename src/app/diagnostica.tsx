/**
 * Schermata "Diagnostica": il registro degli ultimi tragitti, senza
 * coordinate, da mandare per capire cosa non ha funzionato.
 */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { autoHistory, autoStatus } from '../auto/movimento';
import { clearDiag, diagText, loadDiag, stamp, type DiagLine } from '../diagnostics/log';
import { CloseIcon, ShareIcon } from '../ui/Icons';
import { GhostButton, Header, Panel, PrimaryButton, RoundButton, Screen, text } from '../ui/parts';
import { C, F } from '../ui/theme';

function header(): string {
  const version = Constants.expoConfig?.version ?? '?';
  const auto = autoStatus();
  const autoText = auto
    ? `avvio automatico ${auto.enabled ? 'acceso' : 'spento'}${auto.lastEvent ? `, ultimo movimento ${auto.lastEvent} ${stamp(auto.lastEventAt)}` : ''}${auto.lastNotified ? `, ultimo avviso ${stamp(auto.lastNotified)}` : ''}`
    : 'avvio automatico non disponibile';
  const history = autoHistory(stamp);
  return `Vado ${version} · ${Platform.OS} ${String(Platform.Version)} · ${new Date().toISOString()} · ${autoText}${
    history.length ? `\nAvvio automatico, ultimi eventi:\n${history.join('\n')}` : ''
  }`;
}

export default function Diagnostica() {
  const [lines, setLines] = useState<DiagLine[] | null>(null);
  const [info] = useState(() => header());

  useEffect(() => {
    loadDiag().then(setLines);
  }, []);

  async function share() {
    const list = lines ?? [];
    await Share.share({ message: diagText(list, header()) }).catch(() => undefined);
  }

  async function clear() {
    await clearDiag();
    setLines([]);
  }

  const shown = [...(lines ?? [])].reverse();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header
          caption="Per capire cosa è successo"
          title="Diagnostica"
          right={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} color={C.text} />
            </RoundButton>
          }
        />
        <Text style={text.body}>
          Qui l&apos;app annota cosa succede durante i tragitti: quando si perde il segnale, i cambi di mezzo, la metro e i bus riconosciuti, come è
          stato valutato ogni tratto. Solo eventi e numeri, nessuna posizione. Resta sul telefono finché non lo condividi.
        </Text>
        <Text style={styles.time} selectable>
          {info}
        </Text>
        <PrimaryButton label="Condividi il registro" onPress={share} icon={<ShareIcon size={20} color={C.ink} />} disabled={!lines || lines.length === 0} />

        <Panel style={styles.log}>
          {lines === null ? null : shown.length === 0 ? (
            <Text style={text.body}>Ancora vuoto: si riempie con il prossimo tragitto.</Text>
          ) : (
            shown.map((l, i) => (
              <View key={`${l.t}-${i}`} style={[styles.row, l.text.startsWith('Tragitto avviato') && styles.start]}>
                <Text style={styles.time}>{stamp(l.t)}</Text>
                <Text style={styles.text} selectable>
                  {l.text}
                </Text>
              </View>
            ))
          )}
        </Panel>

        {lines && lines.length > 0 ? <GhostButton label="Cancella il registro" onPress={clear} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40, gap: 14 },
  log: { gap: 2 },
  row: { paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, gap: 1 },
  start: { borderBottomWidth: 2, borderBottomColor: C.lime },
  time: { fontFamily: F.semi, fontSize: 12, color: C.dim },
  text: { fontFamily: F.medium, fontSize: 13.5, lineHeight: 19, color: C.text },
});
