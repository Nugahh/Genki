import { CameraView, useCameraPermissions } from 'expo-camera';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

/**
 * The camera of the phone reading the barcodes of products (EAN-13, EAN-8, UPC-A, UPC-E; a QR code is not read). The permission is asked here,
 * the first time the scan opens, after a word about why.
 */
export function BarcodeCamera({ onScan }: { onScan: (code: string) => void }) {
  const [permission, request] = useCameraPermissions();
  // The state of the permission is not read yet.
  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.box}>
        <Text variant="bodyLarge" accessibilityLiveRegion="polite">
          {permission.canAskAgain
            ? 'Genki a besoin de la caméra pour lire le code-barres d’un produit. L’image n’est ni enregistrée ni envoyée : seul le code l’est, à Open Food Facts.'
            : 'La caméra est refusée. Pour scanner, autorise-la dans les réglages d’Android : Applications, Genki, Autorisations, Caméra.'}
        </Text>
        {permission.canAskAgain ? (
          <Button mode="contained" contentStyle={styles.button} onPress={() => void request()}>
            Autoriser la caméra
          </Button>
        ) : (
          <Button mode="contained" contentStyle={styles.button} onPress={() => void Linking.openSettings()}>
            Ouvrir les réglages
          </Button>
        )}
      </View>
    );
  }

  return (
    <CameraView
      style={styles.camera}
      facing="back"
      accessibilityLabel="Caméra : place le code-barres du produit dans le cadre"
      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
      onBarcodeScanned={({ data }) => onScan(data)}
    />
  );
}

const styles = StyleSheet.create({
  box: { gap: 12 },
  camera: { height: 320, borderRadius: 16, overflow: 'hidden' },
  button: { minHeight: 48 },
});
