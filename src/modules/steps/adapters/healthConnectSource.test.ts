import * as library from 'react-native-health-connect';
import { healthConnectSource } from './healthConnectSource';

jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 },
  getSdkStatus: jest.fn(),
  initialize: jest.fn(),
  getGrantedPermissions: jest.fn(),
  requestPermission: jest.fn(),
  aggregateRecord: jest.fn(),
  readRecords: jest.fn(),
  openHealthConnectSettings: jest.fn(),
}));

const hc = jest.mocked(library);
beforeEach(() => jest.resetAllMocks());

describe('status', () => {
  test('is ready when the service is there and starts', async () => {
    hc.getSdkStatus.mockResolvedValue(3);
    hc.initialize.mockResolvedValue(true);
    expect(await healthConnectSource().status()).toBe('ready');
  });

  test('starts the client once, however often it is asked', async () => {
    hc.getSdkStatus.mockResolvedValue(3);
    hc.initialize.mockResolvedValue(true);
    const source = healthConnectSource();
    await source.status();
    await source.status();
    expect(hc.initialize).toHaveBeenCalledTimes(1);
  });

  test('asks for an update when the provider is old, and says unavailable when it is absent', async () => {
    hc.getSdkStatus.mockResolvedValueOnce(2);
    expect(await healthConnectSource().status()).toBe('update-needed');
    hc.getSdkStatus.mockResolvedValueOnce(1);
    expect(await healthConnectSource().status()).toBe('unavailable');
  });

  test('a start that failed is tried again at the next call, not remembered', async () => {
    hc.getSdkStatus.mockResolvedValue(3);
    hc.initialize.mockRejectedValueOnce(new Error('ClientNotInitialized')).mockResolvedValueOnce(true);
    const source = healthConnectSource();
    await expect(source.status()).rejects.toThrow('ClientNotInitialized');
    expect(await source.status()).toBe('ready');
  });
});

describe('permission', () => {
  test('is granted when the steps can be read', async () => {
    hc.getGrantedPermissions.mockResolvedValue([{ accessType: 'read', recordType: 'Steps' }]);
    expect(await healthConnectSource().hasPermission()).toBe(true);
  });

  test('is not granted for another record type, for writing, or for nothing', async () => {
    const source = healthConnectSource();
    hc.getGrantedPermissions.mockResolvedValueOnce([{ accessType: 'read', recordType: 'Weight' }]);
    expect(await source.hasPermission()).toBe(false);
    hc.getGrantedPermissions.mockResolvedValueOnce([{ accessType: 'write', recordType: 'Steps' }]);
    expect(await source.hasPermission()).toBe(false);
    hc.getGrantedPermissions.mockResolvedValueOnce([]);
    expect(await source.hasPermission()).toBe(false);
  });

  test('asks for the read permission on the steps, and says whether it was given', async () => {
    hc.requestPermission.mockResolvedValueOnce([{ accessType: 'read', recordType: 'Steps' }]);
    expect(await healthConnectSource().requestPermission()).toBe(true);
    expect(hc.requestPermission).toHaveBeenCalledWith([{ accessType: 'read', recordType: 'Steps' }]);
    hc.requestPermission.mockResolvedValueOnce([]);
    expect(await healthConnectSource().requestPermission()).toBe(false);
  });
});

describe('daySteps', () => {
  test('is the total of the aggregate over the day of the zone, with the apps that wrote it', async () => {
    hc.aggregateRecord.mockResolvedValue({ COUNT_TOTAL: 8341.6, dataOrigins: ['com.fitbit.FitbitMobile'] } as never);
    const result = await healthConnectSource().daySteps('2026-11-03', 'Europe/Paris');
    expect(result).toEqual({ steps: 8342, origins: ['com.fitbit.FitbitMobile'] });
    expect(hc.aggregateRecord).toHaveBeenCalledWith({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: '2026-11-02T23:00:00.000Z', endTime: '2026-11-03T23:00:00.000Z' },
    });
  });

  test('is zero for a day with no record', async () => {
    hc.aggregateRecord.mockResolvedValue({ dataOrigins: [] } as never);
    expect(await healthConnectSource().daySteps('2026-11-03', 'Europe/Paris')).toEqual({ steps: 0, origins: [] });
  });
});

test('the sources are the apps of the records of yesterday and today, each with the end of its last one', async () => {
  hc.readRecords.mockResolvedValue({
    records: [
      { recordType: 'Steps', count: 10, startTime: 'a', endTime: '2026-11-03T09:00:00.000Z', metadata: { dataOrigin: 'com.fitbit.FitbitMobile' } },
      { recordType: 'Steps', count: 10, startTime: 'a', endTime: '2026-11-03T09:45:00.000Z', metadata: { dataOrigin: 'com.fitbit.FitbitMobile' } },
      { recordType: 'Steps', count: 10, startTime: 'a', endTime: '2026-11-03T08:00:00.000Z', metadata: { dataOrigin: 'com.google.android.apps.fitness' } },
      { recordType: 'Steps', count: 10, startTime: 'a', endTime: '2026-11-03T08:00:00.000Z' },
    ],
  } as never);
  const sources = await healthConnectSource().recentSources('2026-11-03', 'Europe/Paris');
  expect(hc.readRecords).toHaveBeenCalledWith('Steps', expect.objectContaining({ timeRangeFilter: { operator: 'between', startTime: '2026-11-01T23:00:00.000Z', endTime: '2026-11-03T23:00:00.000Z' } }));
  expect(sources).toEqual([
    { origin: 'com.fitbit.FitbitMobile', lastDataAt: new Date('2026-11-03T09:45:00.000Z') },
    { origin: 'com.google.android.apps.fitness', lastDataAt: new Date('2026-11-03T08:00:00.000Z') },
  ]);
});

test('opens the settings of Health Connect, where the priority is chosen', () => {
  healthConnectSource().openSettings();
  expect(hc.openHealthConnectSettings).toHaveBeenCalled();
});
