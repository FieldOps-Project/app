import { appVersion, buildNumber } from '@/config/app-info';

export const CLIENT_HEADERS = {
  Accept: 'application/json',
  'X-App-Version': appVersion,
  'X-App-Build': buildNumber,
} as const;
