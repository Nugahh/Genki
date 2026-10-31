import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { inMemoryCravingRepository } from '../adapters/inMemoryCravingRepository';
import { tobaccoUseCases, type QuitProfile } from '../application/tobaccoUseCases';
import { TobaccoCard } from './TobaccoCard';
import { TobaccoExtras } from './TobaccoExtras';

const clock = { now: () => new Date('2026-10-11T10:00:00Z') }; // 12:00 in Paris
const profile: QuitProfile = { quitDate: '2026-10-01', cigarettesPerDay: 20, packPrice: 12, packSize: 20 };
const draw = (ui: React.ReactElement) => render(<PaperProvider theme={theme}>{ui}</PaperProvider>);

function setup() {
  const repo = inMemoryCravingRepository();
  const tobacco = tobaccoUseCases({ repo, clock, timezone: 'Europe/Paris' });
  const run = jest.fn((write: () => Promise<void>) => void write());
  return { repo, tobacco, run };
}

describe('TobaccoCard', () => {
  test('shows the days without tobacco, the record and the money kept, and opens the section', async () => {
    const { tobacco } = setup();
    const onOpen = jest.fn();
    await draw(<TobaccoCard tobacco={tobacco} profile={profile} clock={clock} timezone="Europe/Paris" onOpen={onOpen} />);
    expect(screen.getByText('10 jours')).toBeTruthy();
    expect(screen.getByText('Record : 10 jours · 120 € économisés')).toBeTruthy();
    expect(screen.getByLabelText('Sans tabac, 10 jours, Record : 10 jours · 120 € économisés')).toBeTruthy();
    await fireEvent.press(screen.getByText('Sans tabac'));
    expect(onOpen).toHaveBeenCalled();
  });

  test('says nothing about money without a price, and is not shown without a quit date', async () => {
    const { tobacco } = setup();
    const { unmount } = await draw(<TobaccoCard tobacco={tobacco} profile={{ quitDate: '2026-10-10', packSize: 20 }} clock={clock} timezone="Europe/Paris" onOpen={() => {}} />);
    expect(screen.getByText('1 jour')).toBeTruthy();
    expect(screen.getByText('Record : 1 jour')).toBeTruthy();
    await unmount();
    await draw(<TobaccoCard tobacco={tobacco} profile={{ packSize: 20 }} clock={clock} timezone="Europe/Paris" onOpen={() => {}} />);
    expect(screen.queryByText('Sans tabac')).toBeNull();
  });
});

describe('TobaccoExtras', () => {
  const show = (props: Partial<React.ComponentProps<typeof TobaccoExtras>> & { tobacco: ReturnType<typeof setup>['tobacco']; run: jest.Mock }) =>
    draw(<TobaccoExtras profile={profile} clock={clock} timezone="Europe/Paris" day="2026-10-11" isDay onOpenSettings={() => {}} {...props} />);

  test('sums up the streak', async () => {
    const { tobacco, run } = setup();
    await show({ tobacco, run });
    const summary = within(screen.getByTestId('tobacco-summary'));
    expect(summary.getByText('Jours sans fumer')).toBeTruthy();
    expect(summary.getByText('Économisé')).toBeTruthy();
    expect(summary.getByText('120 €')).toBeTruthy();
  });

  test('notes a resisted craving through run, offers to take it back, and takes it back', async () => {
    const { repo, tobacco, run } = setup();
    await show({ tobacco, run });
    await fireEvent.press(screen.getByText('Envie résistée'));
    expect(run).toHaveBeenCalledTimes(1);
    expect(repo.cravings).toMatchObject([{ resisted: true, day: '2026-10-11' }]);
    expect(screen.getByText('Envie résistée notée.').props.accessibilityLiveRegion).toBe('polite');
    await fireEvent.press(screen.getByText('Annuler'));
    expect(repo.cravings).toEqual([]);
    expect(screen.queryByText('Envie résistée notée.')).toBeNull();
  });

  test('a cigarette smoked restarts the days', async () => {
    const { repo, tobacco, run } = setup();
    await show({ tobacco, run });
    await fireEvent.press(screen.getByText('J’ai fumé'));
    expect(repo.cravings).toMatchObject([{ resisted: false }]);
    expect(await screen.findByText('Cigarette notée.')).toBeTruthy();
    expect(within(screen.getByTestId('tobacco-summary')).getByText('0')).toBeTruthy();
  });

  test('lists the cravings of the day, newest first, each one removable', async () => {
    const { repo, tobacco, run } = setup();
    repo.add({ day: '2026-10-11', createdAt: new Date('2026-10-11T07:00:00Z'), resisted: true });
    repo.add({ day: '2026-10-11', createdAt: new Date('2026-10-11T08:30:00Z'), resisted: false });
    await show({ tobacco, run });
    expect(screen.getAllByText(/ · (envie résistée|cigarette fumée)$/).map((n) => n.props.children)).toEqual(['10:30 · cigarette fumée', '09:00 · envie résistée']);
    await fireEvent.press(screen.getByLabelText('Supprimer l’envie de 09:00'));
    expect(repo.cravings.map((c) => c.id)).toEqual(['2']);
  });

  test('keeps the journal for the day view', async () => {
    const { tobacco, run } = setup();
    await show({ tobacco, run, isDay: false });
    expect(screen.queryByText('Envies du jour')).toBeNull();
  });

  test('asks for a quit date when there is none', async () => {
    const { tobacco, run } = setup();
    const onOpenSettings = jest.fn();
    await show({ tobacco, run, profile: { packSize: 20 }, onOpenSettings });
    expect(screen.queryByTestId('tobacco-summary')).toBeNull();
    await fireEvent.press(screen.getByText('Choisir ma date d’arrêt'));
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
