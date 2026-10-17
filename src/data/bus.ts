/** Linee di bus e tram di Roma (dati aperti di Roma Servizi per la Mobilità). */
import { buildBusNetwork, type BusData } from '../core/bus';
import data from './bus-roma.json';

export const BUS_ROMA = buildBusNetwork(data as unknown as BusData);
