import { ScrollView, StyleSheet } from 'react-native';
import { Divider, List } from 'react-native-paper';
import { goalModeText } from './goalMode';
import type { Profile } from '../domain/profile';

export type SettingsPage = 'goals' | 'profile' | 'water' | 'tobacco' | 'data';
type Props = { profile: Profile; onOpen: (page: SettingsPage) => void };

const longDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const kcal = (n: number) => `${n.toLocaleString('fr-FR')} kcal`;

/** The list of settings pages, each with what it holds now. */
export function SettingsScreen({ profile, onOpen }: Props) {
  const row = (page: SettingsPage, title: string, description: string, icon: string) => (
    <List.Item
      title={title}
      description={description}
      left={(props) => <List.Icon {...props} icon={icon} />}
      right={(props) => <List.Icon {...props} icon="chevron-right" />}
      accessibilityLabel={`${title}, ${description}`}
      onPress={() => onOpen(page)}
      style={styles.row}
    />
  );
  return (
    <ScrollView>
      {row('goals', 'Objectifs', `${kcal(profile.goals.kcal)} · ${goalModeText(profile.goalMode)}`, 'target')}
      {row('profile', 'Profil', `${profile.heightCm} cm · né en ${profile.birthYear}`, 'account-outline')}
      {row('water', 'Eau', profile.waterContainers.map((c) => `${c.label} ${c.ml} ml`).join(' · '), 'cup-water')}
      {row('tobacco', 'Tabac', profile.quitDate ? `Arrêt le ${longDate(profile.quitDate)}` : 'Pas de date d’arrêt', 'smoking-off')}
      {row('data', 'Données', 'Exporter, importer, recalculer les totaux', 'database-outline')}
      <Divider />
      {/* shortcut: the use cases fix the time zone at composition; it becomes editable once the app composes after reading the profile. */}
      <List.Item title="Fuseau horaire" description={profile.timezone} left={(props) => <List.Icon {...props} icon="map-clock-outline" />} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ row: { minHeight: 64 } });
