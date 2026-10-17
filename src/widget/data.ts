/** I numeri del widget, letti dallo storico del telefono. */
import { formatCo2, tripCo2 } from '../core/co2';
import { isHalloweenSeason } from '../core/look';
import { DAILY_GOAL, dayKey, summarizeDay } from '../core/scoring';
import { loadTrips } from '../storage/trips';
import type { WidgetData } from './OggiWidget';

export async function widgetData(now: number): Promise<WidgetData> {
  const trips = await loadTrips();
  const today = summarizeDay(trips, dayKey(now));
  return {
    points: today.points,
    goal: DAILY_GOAL,
    co2: formatCo2(today.trips.reduce((s, t) => s + tripCo2(t), 0)),
    halloween: isHalloweenSeason(now),
  };
}
