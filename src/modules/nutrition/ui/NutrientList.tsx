import { StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';
import { formatAmount, NUTRIENTS, type Nutrients } from '../domain/nutrients';

type Props = {
  /** The amounts of the portion; a nutrient that is not there is not given by the table. */
  nutrients: Nutrients;
  /** The reference intakes of the profile, none under 18. */
  references?: Nutrients;
};

/** The nutrients of a portion, in a list that opens: the amount and, when there is a reference, its share. */
export function NutrientList({ nutrients, references }: Props) {
  const known = NUTRIENTS.filter((n) => nutrients[n.id] !== undefined);
  const missing = NUTRIENTS.length - known.length;
  return (
    <List.Accordion title="Nutriments" style={styles.accordion}>
      {known.map((n) => {
        const amount = formatAmount(nutrients[n.id]!, n.unit);
        const reference = references?.[n.id];
        const pct = reference ? Math.round((nutrients[n.id]! / reference) * 100) : undefined;
        return (
          <List.Item
            key={n.id}
            title={n.label}
            right={() => <Text variant="bodyLarge" style={styles.amount}>{pct === undefined ? amount : `${amount} · ${pct} %`}</Text>}
            accessibilityLabel={`${n.label}, ${amount}${pct === undefined ? '' : `, ${pct} % du repère`}`}
          />
        );
      })}
      {missing > 0 && (
        <List.Item
          title={missing === 1 ? '1 nutriment n’est pas renseigné pour cet aliment.' : `${missing} nutriments ne sont pas renseignés pour cet aliment.`}
          titleNumberOfLines={3}
        />
      )}
    </List.Accordion>
  );
}

const styles = StyleSheet.create({
  accordion: { paddingHorizontal: 0 },
  amount: { alignSelf: 'center' },
});
