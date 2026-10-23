import type { ConfigContext, ExpoConfig } from 'expo/config';
import { existsSync, readFileSync } from 'node:fs';

// Two Firebase projects (dev, prod) and two apps installable side by side.
const prod = process.env.APP_VARIANT === 'production';
const googleServicesFile = prod ? './google-services.json' : './google-services.dev.json';

type GoogleServices = { client: { oauth_client?: { client_id: string; client_type: number }[] }[] };

// Google Sign-In needs the project's Web OAuth client (type 3) to return an idToken Firebase accepts.
function googleWebClientId(): string | undefined {
  if (!existsSync(googleServicesFile)) return undefined;
  const json = JSON.parse(readFileSync(googleServicesFile, 'utf8')) as GoogleServices;
  return json.client.flatMap((c) => c.oauth_client ?? []).find((o) => o.client_type === 3)?.client_id;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: prod ? 'Genki' : 'Genki (dev)',
  slug: 'genki',
  scheme: 'genki',
  android: {
    ...config.android,
    package: prod ? 'com.nugah.genki' : 'com.nugah.genki.dev',
    googleServicesFile,
  },
  extra: { googleWebClientId: googleWebClientId() },
});
