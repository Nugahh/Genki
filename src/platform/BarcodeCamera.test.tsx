import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { BarcodeCamera } from './BarcodeCamera';

const mockPermission = jest.fn();
const mockRequest = jest.fn();
let mockCameraProps: Record<string, any> = {};

jest.mock('expo-camera', () => {
  const { View } = jest.requireActual('react-native');
  return {
    useCameraPermissions: () => [mockPermission(), mockRequest],
    CameraView: (props: Record<string, any>) => {
      mockCameraProps = props;
      return <View testID="camera" />;
    },
  };
});

const draw = (onScan = jest.fn()) => render(<PaperProvider><BarcodeCamera onScan={onScan} /></PaperProvider>).then(() => onScan);

beforeEach(() => {
  mockPermission.mockReset();
  mockRequest.mockReset();
  mockCameraProps = {};
});

test('shows nothing until the state of the permission is known', async () => {
  mockPermission.mockReturnValue(null);
  await draw();
  expect(screen.queryByTestId('camera')).toBeNull();
  expect(screen.queryByText('Autoriser la caméra')).toBeNull();
});

test('before the permission is asked, says why and asks only when the button is touched', async () => {
  mockPermission.mockReturnValue({ granted: false, canAskAgain: true });
  await draw();
  expect(screen.getByText(/a besoin de la caméra/)).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Autoriser la caméra'));
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

test('after a refusal that cannot be asked again, says how to allow it in the settings of Android', async () => {
  mockPermission.mockReturnValue({ granted: false, canAskAgain: false });
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  await draw();
  expect(screen.getByText(/Applications, Genki, Autorisations, Caméra/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Ouvrir les réglages'));
  expect(openSettings).toHaveBeenCalled();
});

test('with the permission, reads only the barcodes of products and gives their text', async () => {
  mockPermission.mockReturnValue({ granted: true, canAskAgain: true });
  const onScan = await draw();
  expect(screen.getByTestId('camera')).toBeTruthy();
  expect(mockCameraProps.barcodeScannerSettings).toEqual({ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] });
  expect(mockCameraProps.facing).toBe('back');
  mockCameraProps.onBarcodeScanned({ type: 'ean13', data: '5449000000996' });
  expect(onScan).toHaveBeenCalledWith('5449000000996');
});
