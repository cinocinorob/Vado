/**
 * Cartoncino da condividere (WhatsApp, Instagram…): il germoglio, i km senza
 * auto e la CO₂ evitata, con il codice della propria lega per invitare.
 * L'immagine si crea sul telefono; nessun dato va a un server.
 */
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { Health, SpeciesId, Stage } from '../core/plant';
import { social } from '../social';
import { ShapeBadge } from './expressive';
import { buzz } from './motion';
import { Sprout } from './Sprout';
import { C, F, R } from './theme';

export type ShareData = {
  /** "Il mio tragitto", "La mia settimana". */
  caption: string;
  /** Numero grande, per esempio "6,5 km". */
  big: string;
  /** Sotto il numero: "senza auto". */
  bigLabel: string;
  stats: { label: string; value: string }[];
  /** Una riga in fondo, per esempio l'equivalenza con l'albero. */
  note?: string;
  plant: { stage: Stage; health: Health; species?: SpeciesId };
};

/** Il codice della prima lega con invito, se c'è: per far entrare chi vede l'immagine. */
async function inviteCode(): Promise<string | null> {
  try {
    if (!(await social.profile())) return null;
    const leagues = await social.leagues(Date.now());
    return leagues.find((l) => l.kind === 'invito' && l.code)?.code ?? null;
  } catch {
    return null;
  }
}

function Card({ data, code }: { data: ShareData; code: string | null }) {
  return (
    <View style={styles.card}>
      <View style={styles.glow} />
      <View style={styles.head}>
        <Text style={styles.brand}>Vado</Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{data.caption}</Text>
        </View>
      </View>
      <View style={styles.middle}>
        <ShapeBadge shape="cookie12" color="rgba(255, 255, 255, 0.55)" size={128}>
          <Sprout size={118} stage={data.plant.stage} health={data.plant.health} species={data.plant.species} ground={false} crop />
        </ShapeBadge>
        <View style={{ flex: 1 }}>
          <Text style={styles.big} adjustsFontSizeToFit numberOfLines={1}>
            {data.big.split(' ')[0]}
            {data.big.includes(' ') ? <Text style={styles.bigUnit}> {data.big.split(' ').slice(1).join(' ')}</Text> : null}
          </Text>
          <Text style={styles.bigLabel}>{data.bigLabel}</Text>
        </View>
      </View>
      <View style={styles.stats}>
        {data.stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statValue} adjustsFontSizeToFit numberOfLines={1}>
              {s.value}
            </Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
      {data.note ? <Text style={styles.note}>{data.note}</Text> : null}
      <View style={styles.foot}>
        <Text style={styles.footText}>{code ? `Sfidami su Vado: codice lega ${code}` : 'Muoviti senza auto con Vado'}</Text>
      </View>
    </View>
  );
}

export function ShareSheet({ data, onClose }: { data: ShareData | null; onClose: () => void }) {
  const ref = useRef<View>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (data) inviteCode().then(setCode);
  }, [data]);

  async function share() {
    setBusy(true);
    setProblem(null);
    try {
      buzz('tocco');
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) throw new Error('condivisione assente');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Condividi con' });
    } catch {
      setProblem("Non sono riuscito a creare l'immagine. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={!!data} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {data ? (
          <View ref={ref} collapsable={false} style={styles.shot}>
            <Card data={data} code={code} />
          </View>
        ) : null}
        {problem ? <Text style={styles.problem}>{problem}</Text> : null}
        <View style={styles.actions}>
          <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.close, pressed && { opacity: 0.8 }]}>
            <Text style={styles.closeText}>Chiudi</Text>
          </Pressable>
          <Pressable onPress={share} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.share, (pressed || busy) && { opacity: 0.8 }]}>
            <Text style={styles.shareText}>{busy ? 'Preparo…' : 'Condividi immagine'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.72)', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 18 },
  shot: { borderRadius: R.hero, overflow: 'hidden' },
  card: { width: 340, backgroundColor: C.hero, padding: 22, gap: 16, overflow: 'hidden' },
  glow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, left: -110, top: -140, backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: F.displayBold, fontSize: 30, letterSpacing: -1, color: C.ink },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: C.ink, justifyContent: 'center' },
  chipText: { fontFamily: F.bold, fontSize: 13, color: C.hero },
  middle: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  big: { fontFamily: F.displayBold, fontSize: 44, lineHeight: 50, letterSpacing: -1.5, color: C.ink },
  bigUnit: { fontFamily: F.bold, fontSize: 22, letterSpacing: 0, color: C.ink },
  bigLabel: { fontFamily: F.semi, fontSize: 16, color: C.ink, opacity: 0.8 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.5)', borderRadius: 20, padding: 12, gap: 2 },
  statValue: { fontFamily: F.displayBold, fontSize: 22, color: C.ink },
  statLabel: { fontFamily: F.medium, fontSize: 12.5, color: C.ink, opacity: 0.8 },
  note: { fontFamily: F.medium, fontSize: 14, lineHeight: 19, color: C.ink },
  foot: { backgroundColor: C.ink, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  footText: { fontFamily: F.bold, fontSize: 14, color: C.hero, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, width: 340 },
  close: { height: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: 'rgba(255, 255, 255, 0.16)', justifyContent: 'center' },
  closeText: { fontFamily: F.bold, fontSize: 15, color: '#FFFFFF' },
  share: { flex: 1, height: 52, borderRadius: 26, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
  shareText: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  problem: { fontFamily: F.semi, fontSize: 14, color: '#FFB4A6' },
});
