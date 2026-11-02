import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { GaugeRow } from './GaugeRow';

const tint = theme.colors.metric.protein;
const draw = (props: Partial<React.ComponentProps<typeof GaugeRow>> = {}) =>
  render(
    <PaperProvider theme={theme}>
      <GaugeRow icon="arm-flex" tint={tint} title="Protéines – 14 / 130 g" progress={0.11} fillColor={theme.colors.chart.protein} {...props} />
    </PaperProvider>,
  );

test('puts the title and the percentage on one line, the percentage to the right', async () => {
  await draw();
  const head = within(screen.getByTestId('gauge-head'));
  expect(head.getByText('Protéines – 14 / 130 g')).toBeTruthy();
  expect(head.getByText('11 %')).toBeTruthy();
});

test('the bar is under that line, not beside the percentage', async () => {
  await draw();
  expect(within(screen.getByTestId('gauge-head')).queryByTestId('gauge-track')).toBeNull();
  expect(screen.getByTestId('gauge-track')).toBeTruthy();
});

test('the percentage is the real one, past the goal too', async () => {
  await draw({ progress: 1.25 });
  expect(screen.getByText('125 %')).toBeTruthy();
});

test('wears the icon on a disc of its own tint', async () => {
  await draw({ badgeTestID: 'disc' });
  expect(StyleSheet.flatten(screen.getByTestId('disc').props.style).backgroundColor).toBe(tint.container);
});

test('has a tick only when it is given one, where the day should be by now', async () => {
  await draw();
  expect(screen.queryByTestId('gauge-marker')).toBeNull();
  await screen.unmount();
  await draw({ marker: 0.5 });
  expect(StyleSheet.flatten(screen.getByTestId('gauge-marker').props.style).left).toBe('50%');
});

test('holds what the screen puts at its end and under its bar', async () => {
  await draw({ trailing: <Text>fin</Text>, children: <Text>sous la barre</Text> });
  expect(screen.getByText('fin')).toBeTruthy();
  expect(screen.getByText('sous la barre')).toBeTruthy();
});
