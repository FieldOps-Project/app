import { nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import Constants from 'expo-constants';

const FALLBACK_VERSION = '0.0.0';

export const appVersion =
  nativeApplicationVersion ?? Constants.expoConfig?.version ?? FALLBACK_VERSION;

export const buildNumber = nativeBuildVersion ?? '0';

export const appVersionLabel = `${appVersion} (${buildNumber})`;
