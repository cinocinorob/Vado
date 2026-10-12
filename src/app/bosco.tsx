/**
 * Schermata "Il tuo germoglio": la pianta che cresce con la CO₂ evitata, il
 * bosco degli alberi completati, l'interruttore della pausa e come si calcola.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CAR_G_PER_KM, formatCo2, treeTime } from '../core/co2';
import {
  PAUSE_MAX_DAYS,
  SAPLING_G,
  SPROUT_G,
  TREE_G,
  THIRSTY_DAYS,
  WILTED_DAYS,
  activePause,
  endPause,
  pauseDaysLeft,
  pauseLastDay,
  plantState,
  speciesName,
  startPause,
  type Health,
  type Stage,
} from '../core/plant';
import { dayKey, type Trip } from '../core/scoring';
import { savePauses } from '../storage/pause';
import { loadTrips } from '../storage/trips';
import { SectionTitle } from '../ui/expressive';
import { dateLabel } from '../ui/format';
import { CloseIcon } from '../ui/Icons';
import { Header, Panel, RoundButton, Screen, Toggle, text } from '../ui/parts';
import { Sprout, Tree } from '../ui/Sprout';
import { C, F, R } from '../ui/theme';
import { usePauses } from '../ui/usePlant';
import { WavyBar } from '../ui/Wavy';

const STAGE_NAME: Record<Stage, string> = { seme: 'Seme', germoglio: 'Germoglio', piantina: 'Piantina' };
const NEXT_NAME: Record<Stage, string> = { seme: 'germoglio', germoglio: 'piantina', piantina: 'albero' };

function healthText(health: Health, idle: number, pauseEnd: string | null): string {
  switch (health) {
    case 'pausa':
      return `In pausa fino a ${pauseEnd ?? 'domani'}: non appassisce.`;
    case 'sete':
      return `Ha sete: ${idle} giorni senza tragitti senza auto. Basta un tragitto e si riprende.`;
    case 'appassita':
      return `Appassita: ${idle} giorni senza tragitti senza auto. Non muore: basta un tragitto e si riprende.`;
    default:
      return 'In forma.';
  }
}

function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return dateLabel(new Date(y, m - 1, d, 12).getTime()).toLowerCase();
}

export default function Bosco() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [pauses, setPauses] = usePauses();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setNow(Date.now());
      loadTrips().then((loaded) => {
        if (alive) setTrips(loaded);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const today = dayKey(now);
  const plant = plantState(trips, now, pauses);
  const pause = activePause(pauses, today);
  const pauseEnd = pause ? dayLabel(pauseLastDay(pause)) : null;
  const ratio = plant.nextG > 0 ? plant.cycleG / plant.nextG : 0;

  async function togglePause(on: boolean) {
    const next = on ? startPause(pauses, today) : endPause(pauses, today);
    setPauses(next);
    await savePauses(next);
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header
          caption="CO₂ evitata e bosco"
          title="Il tuo germoglio"
          right={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} color={C.ink} />
            </RoundButton>
          }
        />

        <View style={styles.plantCard}>
          <Sprout size={190} stage={plant.stage} health={plant.health} label={`${STAGE_NAME[plant.stage]}, ${plant.health}`} />
          <Text style={styles.stage}>{STAGE_NAME[plant.stage]}</Text>
          <Text style={styles.health}>{healthText(plant.health, plant.idleDays, pauseEnd)}</Text>
          <View style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel={`${formatCo2(plant.cycleG)} di ${formatCo2(plant.nextG)} per diventare ${NEXT_NAME[plant.stage]}`}>
            <WavyBar ratio={ratio} color={C.onMint} track="rgba(4, 36, 29, 0.16)" height={18} stroke={6} />
            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>
                {formatCo2(plant.cycleG)} di {formatCo2(plant.nextG)}
              </Text>
              <Text style={styles.progressText}>poi diventa {NEXT_NAME[plant.stage]}</Text>
            </View>
          </View>
        </View>

        <View style={styles.total}>
          <Text style={styles.totalLabel}>CO₂ evitata da quando usi Vado</Text>
          <Text style={styles.totalValue}>{formatCo2(plant.totalG)}</Text>
          <Text style={styles.totalBody}>
            {plant.totalG > 0 ? `Un albero adulto ci mette ${treeTime(plant.totalG)} ad assorbirla.` : 'Il primo tragitto senza auto pianta il seme.'}
          </Text>
        </View>

        <SectionTitle title={plant.forest.length > 0 ? `Il tuo bosco: ${plant.forest.length === 1 ? '1 albero' : `${plant.forest.length} alberi`}` : 'Il tuo bosco'} />
        <View style={styles.forest}>
          {plant.forest.length === 0 ? (
            <Text style={[text.body, { padding: 6 }]}>Ancora nessun albero. Il primo arriva a {formatCo2(TREE_G)} di CO₂ evitata: va nel bosco e nasce un seme nuovo.</Text>
          ) : (
            plant.forest.map((species, i) => (
              <View key={`${species}-${i}`} style={styles.tree}>
                <Tree species={species} size={64} label={speciesName(species)} />
                <Text style={styles.treeName} numberOfLines={1}>
                  {speciesName(species)}
                </Text>
              </View>
            ))
          )}
        </View>

        <Panel style={styles.pause}>
          <View style={styles.pauseRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pauseTitle}>Sono in pausa</Text>
              <Text style={text.small}>
                {pause
                  ? `Fino a ${pauseEnd}, ancora ${pauseDaysLeft(pause, today)} ${pauseDaysLeft(pause, today) === 1 ? 'giorno' : 'giorni'}.`
                  : `Malato o in vacanza? Il germoglio non appassisce, per al massimo ${PAUSE_MAX_DAYS} giorni.`}
              </Text>
            </View>
            <Toggle value={!!pause} onChange={togglePause} label="Sono in pausa" />
          </View>
          <Text style={text.small}>Punti, serie e medaglie non cambiano: la pausa vale solo per la pianta.</Text>
        </Panel>

        <SectionTitle title="Come funziona" />
        <Panel style={{ gap: 10 }}>
          <Text style={text.body}>
            Cresce con la CO₂ che eviti: germoglio a {formatCo2(SPROUT_G)}, piantina a {formatCo2(SAPLING_G)}, albero a {formatCo2(TREE_G)}. La crescita non torna mai indietro.
          </Text>
          <Text style={text.body}>
            Se per {THIRSTY_DAYS} giorni non fai tragitti senza auto ha sete, dopo {WILTED_DAYS} appassisce. Non muore: un tragitto e si riprende.
          </Text>
          <Text style={text.body}>
            La CO₂ è una stima: {String(CAR_G_PER_KM).replace('.', ',')} g per ogni km fatto senza auto, la media di un&apos;auto italiana secondo ISPRA. Per mezzi
            pubblici e treno non si toglie la CO₂ del mezzo, come nel metodo ISPRA: lì la stima è un po&apos; alta. Car sharing e auto non contano.
          </Text>
          <Text style={text.body}>
            Un albero adulto assorbe circa {formatCo2(TREE_G)} di CO₂ l&apos;anno (Agenzia europea dell&apos;ambiente). È un ordine di grandezza: secondo specie, età e clima
            va da circa 10 a oltre 20 kg.
          </Text>
        </Panel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40, gap: 12 },
  plantCard: { backgroundColor: C.mint, borderRadius: R.hero, padding: 20, alignItems: 'center' },
  stage: { fontFamily: F.displayBold, fontSize: 30, color: C.onMint, marginTop: 4 },
  health: { fontFamily: F.medium, fontSize: 14.5, lineHeight: 20, color: C.onMintDim, textAlign: 'center', marginTop: 4 },
  progress: { alignSelf: 'stretch', marginTop: 16 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressText: { fontFamily: F.semi, fontSize: 13, color: C.onMintDim },
  total: {
    backgroundColor: C.card,
    borderTopLeftRadius: 10,
    borderTopRightRadius: R.card,
    borderBottomLeftRadius: R.card,
    borderBottomRightRadius: R.card,
    padding: 18,
  },
  totalLabel: { fontFamily: F.semi, fontSize: 13, color: C.dim },
  totalValue: { fontFamily: F.displayBold, fontSize: 36, lineHeight: 42, color: C.ink },
  totalBody: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.dim },
  forest: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.card, borderRadius: R.card, padding: 10, rowGap: 8 },
  tree: { width: '25%', alignItems: 'center', gap: 2 },
  treeName: { fontFamily: F.medium, fontSize: 12, color: C.dim },
  pause: { gap: 10, marginTop: 4 },
  pauseRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pauseTitle: { fontFamily: F.bold, fontSize: 16, color: C.text },
});
