import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { WaterButtons, WaterSheet, type Hydration } from '@/modules/hydration';
import type { Profile } from '@/modules/settings';
import { dayKey, hourOfDay, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { DayTotalsRepository } from '../application/ports';
import { expectedProgress, paceColor } from '../domain/gauge';
import { GaugeBar } from './GaugeBar';

type Props = {
  profile: Profile;
  clock: Clock;
  dayTotals: DayTotalsRepository;
  hydration: Hydration;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
};

const liters = (ml: number) => (ml / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export function TodayScreen({ profile, clock, dayTotals, hydration, run }: Props) {
  const now = useNow(clock);
  const day = dayKey(now, profile.timezone);
  const hour = hourOfDay(now, profile.timezone);
  const [waterMl, setWaterMl] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Listener errors show on the SyncIcon, which watches the same document.
  useEffect(() => dayTotals.observe(day, (totals) => setWaterMl(totals.waterMl), () => {}), [dayTotals, day]);

  const goal = profile.goals.waterMl;
  const addWater = (ml: number) => run(() => hydration.addWater(ml));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <GaugeBar
        label="Eau"
        text={`${liters(waterMl)} / ${liters(goal)} L`}
        progress={goal > 0 ? waterMl / goal : 1}
        expected={expectedProgress(hour)}
        color={paceColor(waterMl, goal, hour)}
        onPress={() => setSheetOpen(true)}
      />
      <WaterButtons containers={profile.waterContainers} onAdd={addWater} />
      <WaterSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        day={day}
        timezone={profile.timezone}
        containers={profile.waterContainers}
        hydration={hydration}
        run={run}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 16 } });
