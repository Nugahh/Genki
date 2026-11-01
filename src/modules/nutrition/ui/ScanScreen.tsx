import { useEffect, useRef, useState, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import type { FoodUseCases } from '../application/foodUseCases';
import type { ProductSearch } from '../application/productSearch';
import type { Food } from '../domain/food';
import type { Choice } from './FoodSearch';

/** The camera preview of the phone, reading barcodes: it calls `onScan` with the text of each code it reads, as often as it reads it. */
export type ScanCamera = (props: { onScan: (code: string) => void }) => ReactElement | null;

type Props = {
  camera: ScanCamera;
  foods: FoodUseCases;
  products: ProductSearch;
  /** The foods of the user: a barcode they already used is found there first, without the network. */
  custom: Food[];
  onFound: (choice: Choice) => void;
  /** An unknown product: create the food, with its barcode. */
  onCreate: (barcode: string) => void;
  onBack: () => void;
};

type State =
  | { phase: 'scanning' }
  | { phase: 'looking' }
  | { phase: 'message'; code: string; text: string; again: boolean };

/** The barcode of a product (EAN-8, EAN-13, UPC-A) from what the camera read; a UPC-A of 12 digits is an EAN-13 with a leading zero. */
function barcodeOf(text: string): string | undefined {
  if (!/^\d{8}$|^\d{12,14}$/.test(text)) return undefined;
  return text.length === 12 ? `0${text}` : text;
}

/** Scans the barcode of a product: the food of the user with this code, else Open Food Facts. A QR code is not read. */
export function ScanScreen({ camera: Camera, foods, products, custom, onFound, onCreate, onBack }: Props) {
  const [state, setState] = useState<State>({ phase: 'scanning' });
  // The camera reads the same code many times a second: only the first one starts a lookup.
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function look(code: string) {
    busy.current = true;
    setState({ phase: 'looking' });
    const mine = foods.findByBarcode(code, custom);
    if (mine) return onFound({ food: mine });
    controller.current = new AbortController();
    try {
      const found = await products.lookup(code, controller.current.signal);
      if (found.kind === 'found') return onFound({ product: found.food });
      busy.current = false;
      setState({ phase: 'message', code, again: false, text: found.kind === 'unknown' ? 'Ce produit n’est pas dans Open Food Facts.' : found.reason });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      console.warn(error);
      busy.current = false;
      setState({ phase: 'message', code, again: true, text: 'Impossible de joindre Open Food Facts. Ce produit n’a encore jamais été utilisé : il faut du réseau.' });
    }
  }

  const onScan = (text: string) => {
    const code = barcodeOf(text);
    if (code && !busy.current) void look(code);
  };

  return (
    <View style={styles.screen}>
      {state.phase === 'scanning' && <Camera onScan={onScan} />}
      {state.phase === 'looking' && (
        <View style={styles.status} accessible accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" />
          <Text variant="bodyLarge">Recherche du produit…</Text>
        </View>
      )}
      {state.phase === 'message' && (
        <View style={styles.message}>
          <Text variant="bodyLarge" accessibilityLiveRegion="polite">
            {state.text}
          </Text>
          {state.again && (
            <Button mode="contained" contentStyle={styles.button} onPress={() => void look(state.code)}>
              Réessayer
            </Button>
          )}
          <Button mode={state.again ? 'outlined' : 'contained'} contentStyle={styles.button} onPress={() => onCreate(state.code)}>
            Créer un aliment
          </Button>
          <Button mode="outlined" contentStyle={styles.button} onPress={() => setState({ phase: 'scanning' })}>
            Scanner à nouveau
          </Button>
        </View>
      )}
      <Button contentStyle={styles.button} onPress={onBack}>
        Retour
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 12 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  message: { gap: 12 },
  button: { minHeight: 48 },
});
