export type WaterContainer = { label: string; ml: number };

/** The part of `users/{uid}` this milestone reads. Nothing writes the profile before M6, so the defaults are the profile. */
export type Profile = {
  timezone: string;
  goals: { waterMl: number };
  waterContainers: WaterContainer[];
};

export const DEFAULT_PROFILE: Profile = {
  timezone: 'Europe/Paris',
  goals: { waterMl: 2500 },
  waterContainers: [
    { label: 'Verre', ml: 250 },
    { label: 'Bouteille', ml: 500 },
  ],
};
