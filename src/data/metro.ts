/**
 * La rete della metro di Roma, pronta all'uso.
 *
 * I dati vengono dai dati aperti di Roma Servizi per la Mobilità e si
 * rigenerano con scripts/rete_metro.py (vedi .github/workflows/rete.yml).
 */
import { buildNetwork, type NetworkData } from '../core/metro';
import data from './metro-roma.json';

export const ROMA = buildNetwork(data as unknown as NetworkData);
