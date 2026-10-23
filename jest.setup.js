// Icon fonts can't load under Jest (jest-expo mocks a different asset registry than RN 0.88 uses): treat them as loaded.
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), isLoaded: () => true, loadAsync: () => Promise.resolve() }));
