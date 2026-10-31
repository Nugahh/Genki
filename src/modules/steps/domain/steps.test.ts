import { FITBIT_PACKAGE, fitbitStatus, isFitbit, originName, stepsChanged, storedSource } from './steps';

test('knows the Fitbit app by its package', () => {
  expect(isFitbit(FITBIT_PACKAGE)).toBe(true);
  expect(isFitbit('android')).toBe(false);
});

test('the source stored with a day is the Fitbit when it wrote some, else the phone', () => {
  expect(storedSource([FITBIT_PACKAGE, 'com.google.android.apps.fitness'])).toBe('fitbit');
  expect(storedSource(['com.google.android.apps.fitness'])).toBe('phone');
  expect(storedSource([])).toBe('phone');
});

test('names the apps it knows, and shows the package of the others as it is', () => {
  expect(originName(FITBIT_PACKAGE)).toBe('Fitbit');
  expect(originName('com.sec.android.app.shealth')).toBe('Samsung Health');
  expect(originName('com.example.counter')).toBe('com.example.counter');
});

describe('fitbitStatus', () => {
  test('waits for the permission first', () => expect(fitbitStatus([{ origin: FITBIT_PACKAGE }], false)).toBe('no-permission'));
  test('sees the Fitbit among the sources', () => expect(fitbitStatus([{ origin: 'x' }, { origin: FITBIT_PACKAGE }], true)).toBe('detected'));
  test('otherwise the phone counts the steps', () => {
    expect(fitbitStatus([{ origin: 'x' }], true)).toBe('phone-counts');
    expect(fitbitStatus([], true)).toBe('phone-counts');
  });
});

test('a total is rewritten only when it changed, or was never written', () => {
  expect(stepsChanged(undefined, 0)).toBe(true);
  expect(stepsChanged(5000, 5000)).toBe(false);
  expect(stepsChanged(5000, 5400)).toBe(true);
});
