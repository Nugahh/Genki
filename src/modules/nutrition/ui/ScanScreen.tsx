import { useEffect, useRef, useState, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import type { FoodUseCases } from '../application/foodUseCases';
import type { ProductSearch } from '../application/productSearch';
import type { Food } from '../domain/food';
import type { Choice } from './FoodSearch';

/** The camera preview of the phone, reading barcodes: it calls `onScan` with the text of each code it reads, as often as it reads it. */
/** `type` is the kind of code the camera says it read (« ean13 », « upc_e »…). */
export type ScanCamera = (props: { onScan: (code: string, type?: string) => void }) => ReactElement | null;

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

/** The 12 digits of the UPC-A that a UPC-E (8 digits, the zeros left out) stands for. */
function upcEToA(e: string): string {
  const d = e.split('');
  const last = d[6];
  if ('012'.includes(last)) return `${d[0]}${d[1]}${d[2]}${last}0000${d[3]}${d[4]}${d[5]}${d[7]}`;
  if (last === '3') return `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}${d[5]}${d[7]}`;
  if (last === '4') return `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}00000${d[5]}${d[7]}`;
  return `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}${d[5]}0000${last}${d[7]}`;
}

/**
 * The barcode of a product as Open Food Facts keeps it (an EAN-13) from what the camera read. An EAN-8 and an EAN-13 are as they are; a UPC-A of 12
 * digits has a leading zero; a UPC-E, which the camera names, is first spelled out as a UPC-A.
 */
function barcodeOf(text: string, type?: string): string | undefined {
  if (type === 'upc_e' && /^\d{8}$/.test(text)) return `0${upcEToA(text)}`;
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

  const onScan = (text: string, type?: string) => {
    const code = barcodeOf(text, type);
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
