import type { ViewStyle } from 'react-native';
import { Chip } from 'react-native-paper';
import type { FoodState } from '../domain/food';

/** « cru » or « cuit » beside a food; nothing for a food that is neither. */
export function StateChip({ state, style }: { state: FoodState; style?: ViewStyle }) {
  if (state === 'other') return null;
  return (
    <Chip compact accessibilityRole="text" style={style}>
      {state === 'raw' ? 'cru' : 'cuit'}
    </Chip>
  );
}
