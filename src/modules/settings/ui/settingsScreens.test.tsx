import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { DEFAULT_PROFILE, type Profile } from '../domain/profile';
import { GoalsScreen } from './GoalsScreen';
import { ProfileScreen } from './ProfileScreen';
import { SettingsScreen } from './SettingsScreen';
import { TobaccoSettingsScreen } from './TobaccoSettingsScreen';
import { WaterContainersScreen } from './WaterContainersScreen';

const draw = (ui: React.ReactElement) => render(<PaperProvider theme={theme}>{ui}</PaperProvider>);
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

describe('SettingsScreen', () => {
  test('lists the pages with what they hold, and opens one', async () => {
    const onOpen = jest.fn();
    await draw(<SettingsScreen profile={{ ...DEFAULT_PROFILE, quitDate: '2026-10-01' }} onOpen={onOpen} />);
    expect(screen.getByLabelText(/^Objectifs, 2.200 kcal · maintien/)).toBeTruthy();
    expect(screen.getByLabelText('Tabac, Arrêt le 1 octobre 2026')).toBeTruthy();
    expect(screen.getByText('Europe/Paris')).toBeTruthy();
    await fireEvent.press(screen.getByText('Eau'));
    expect(onOpen).toHaveBeenCalledWith('water');
  });
});

describe('GoalsScreen', () => {
  const setup = async (profile: Profile = DEFAULT_PROFILE, weightKg?: number) => {
    const onSave = jest.fn();
    await draw(<GoalsScreen profile={profile} weightKg={weightKg} year={2026} onSave={onSave} />);
    return { onSave };
  };

  test('shows the goals of the profile', async () => {
    await setup();
    expect(screen.getByLabelText('Calories (kcal par jour)')).toHaveDisplayValue('2200');
    expect(screen.getByLabelText('Pas (par jour)')).toHaveDisplayValue('8000');
  });

  test('proposes goals for the mode and a weight, with the notes of the guard-rails', async () => {
    await setup(DEFAULT_PROFILE, 80);
    await fireEvent.press(screen.getByText('Déficit'));
    await fireEvent.press(screen.getByText('Proposer à partir de mon profil'));
    // Default profile: a 175 cm man born in 1996, moderately active: 2 404 kcal spent, minus 400.
    expect(screen.getByLabelText('Calories (kcal par jour)')).toHaveDisplayValue('2000');
    expect(screen.getByLabelText('Protéines (g par jour)')).toHaveDisplayValue('135');
    expect(screen.getByText(/Consulte un professionnel/)).toBeTruthy();
  });

  test('cannot propose without a weight', async () => {
    await setup();
    expect(screen.getByText('Proposer à partir de mon profil')).toBeDisabled();
    await type('Poids (kg)', '80');
    expect(screen.getByText('Proposer à partir de mon profil')).toBeEnabled();
  });

  test('says when the floor applied', async () => {
    await setup({ ...DEFAULT_PROFILE, sex: 'female', heightCm: 150, birthYear: 1970, activityLevel: 'sedentary' }, 45);
    await fireEvent.press(screen.getByText('Déficit'));
    await fireEvent.press(screen.getByText('Proposer à partir de mon profil'));
    expect(screen.getByLabelText('Calories (kcal par jour)')).toHaveDisplayValue('1500');
    expect(screen.getByText(/Plancher de 1 500 kcal appliqué\./)).toBeTruthy();
  });

  test('warns, without forbidding, under 1 500 kcal', async () => {
    const { onSave } = await setup();
    await type('Calories (kcal par jour)', '1400');
    expect(screen.getByText(/Moins de 1 500 kcal par jour/)).toBeTruthy();
    expect(screen.getByText('Enregistrer')).toBeEnabled();
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ goals: expect.objectContaining({ kcal: 1400 }) }));
  });

  test('refuses a value out of range with its message', async () => {
    await setup();
    await type('Eau (ml par jour)', '100');
    expect(screen.getByText('L’eau est comprise entre 0,5 et 10 L par jour.').props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByText('Enregistrer')).toBeDisabled();
  });

  test('saves the mode, the weekly loss and the goals', async () => {
    const { onSave } = await setup();
    await fireEvent.press(screen.getByText('Déficit'));
    await type('Perte visée (kg par semaine)', '0,5');
    await type('Calories (kcal par jour)', '1900');
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSave).toHaveBeenCalledWith({ goalMode: 'deficit', weeklyLossKg: 0.5, goals: { kcal: 1900, proteinG: 130, waterMl: 2500, steps: 8000 } });
  });

  test('a loss left in the hidden field does not block the screen outside a deficit', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Déficit'));
    await type('Perte visée (kg par semaine)', '3');
    expect(screen.getByText('Enregistrer')).toBeDisabled();
    await fireEvent.press(screen.getByText('Maintien'));
    expect(screen.getByText('Enregistrer')).toBeEnabled();
  });

  test('takes the weekly loss off outside a deficit', async () => {
    const { onSave } = await setup({ ...DEFAULT_PROFILE, goalMode: 'deficit', weeklyLossKg: 0.5 });
    await fireEvent.press(screen.getByText('Maintien'));
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ goalMode: 'maintenance', weeklyLossKg: null }));
  });
});

describe('ProfileScreen', () => {
  test('saves the sex, the birth year, the height and the activity', async () => {
    const onSave = jest.fn();
    await draw(<ProfileScreen profile={DEFAULT_PROFILE} onSave={onSave} />);
    await fireEvent.press(screen.getByText('Femme'));
    await fireEvent.press(screen.getByText('Actif'));
    await type('Année de naissance', '1988');
    await type('Taille (cm)', '168,5');
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSave).toHaveBeenCalledWith({ sex: 'female', birthYear: 1988, heightCm: 168.5, activityLevel: 'active' });
  });

  test('refuses a height out of range', async () => {
    await draw(<ProfileScreen profile={DEFAULT_PROFILE} onSave={() => {}} />);
    await type('Taille (cm)', '90');
    expect(screen.getByText('La taille est comprise entre 100 et 250 cm.')).toBeTruthy();
    expect(screen.getByText('Enregistrer')).toBeDisabled();
  });
});

describe('WaterContainersScreen', () => {
  const setup = async () => {
    const onSave = jest.fn();
    await draw(<WaterContainersScreen profile={DEFAULT_PROFILE} onSave={onSave} />);
    return { onSave };
  };

  test('renames, changes the amount, adds and removes, then saves', async () => {
    const { onSave } = await setup();
    await type('Nom, contenant 1', 'Petit verre');
    await type('Contenance (ml), contenant 1', '200');
    await fireEvent.press(screen.getByLabelText('Supprimer le contenant Bouteille'));
    await fireEvent.press(screen.getByText('Ajouter un contenant'));
    await type('Nom, contenant 2', 'Gourde');
    await type('Contenance (ml), contenant 2', '750');
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSave).toHaveBeenCalledWith({
      waterContainers: [
        { label: 'Petit verre', ml: 200 },
        { label: 'Gourde', ml: 750 },
      ],
    });
  });

  test('keeps one container at least, and six at most', async () => {
    await setup();
    await fireEvent.press(screen.getByLabelText('Supprimer le contenant Bouteille'));
    expect(screen.getByLabelText('Supprimer le contenant Verre')).toBeDisabled();
    for (let i = 0; i < 5; i++) {
      await fireEvent.press(screen.getByText('Ajouter un contenant'));
      await type(`Nom, contenant ${i + 2}`, `C${i}`);
    }
    expect(screen.getByText('Ajouter un contenant')).toBeDisabled();
  });

  test('refuses an empty name', async () => {
    await setup();
    await type('Nom, contenant 1', ' ');
    expect(screen.getByText('Le nom d’un contenant fait entre 1 et 30 caractères.')).toBeTruthy();
    expect(screen.getByText('Enregistrer')).toBeDisabled();
  });
});

describe('TobaccoSettingsScreen', () => {
  const setup = async (profile: Profile = DEFAULT_PROFILE) => {
    const onSave = jest.fn();
    await draw(<TobaccoSettingsScreen profile={profile} today="2026-11-03" onSave={onSave} />);
    return { onSave };
  };

  test('saves the quit date and what a cigarette costs', async () => {
    const { onSave } = await setup();
    await fireEvent.press(screen.getByText('Aujourd’hui'));
    expect(screen.getByLabelText('Date d’arrêt (AAAA-MM-JJ)')).toHaveDisplayValue('2026-11-03');
    await type('Cigarettes par jour (avant l’arrêt)', '15');
    await type('Prix du paquet (€)', '12,5');
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSave).toHaveBeenCalledWith({ quitDate: '2026-11-03', cigarettesPerDay: 15, packSize: 20, packPrice: 12.5 });
  });

  test('takes the fields off when they are emptied', async () => {
    const { onSave } = await setup({ ...DEFAULT_PROFILE, quitDate: '2026-10-01', cigarettesPerDay: 10, packPrice: 11 });
    await type('Date d’arrêt (AAAA-MM-JJ)', '');
    await type('Cigarettes par jour (avant l’arrêt)', '');
    await type('Prix du paquet (€)', '');
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSave).toHaveBeenCalledWith({ quitDate: null, cigarettesPerDay: null, packSize: 20, packPrice: null });
  });

  test('refuses a date that is not a day', async () => {
    await setup();
    await type('Date d’arrêt (AAAA-MM-JJ)', 'demain');
    expect(screen.getByText('La date d’arrêt du tabac n’est pas valide.')).toBeTruthy();
    expect(screen.getByText('Enregistrer')).toBeDisabled();
  });
});
