/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface EasProfile {
  autoIncrement?: boolean;
  env: Record<string, string>;
}

process.env.EXPO_PUBLIC_API_URL = 'http://api.test:8080';
const { APP_ENVIRONMENTS } = jest.requireActual<typeof import('@/config/env')>('@/config/env');

const ROOT = join(__dirname, '..', '..');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as T;
}

const { expo } = readJson<{
  expo: {
    name: string;
    version: string;
    orientation: string;
    android: { package: string; versionCode: number; blockedPermissions: string[] };
    ios: { bundleIdentifier: string; buildNumber: string };
    plugins: (string | [string, Record<string, unknown>])[];
  };
}>('app.json');

const { cli, build } = readJson<{
  cli: { appVersionSource: string };
  build: Record<string, EasProfile>;
}>('eas.json');

describe('app identity', () => {
  it('names the app and fixes the package identifier', () => {
    expect(expo.name).toBe('FieldOps');
    expect(expo.android.package).toBe('com.fieldops.app');
    expect(expo.ios.bundleIdentifier).toBe('com.fieldops.app');
  });

  it('is used upright, with one hand', () => {
    expect(expo.orientation).toBe('portrait');
  });

  it('has a readable version and an integer build number to increment', () => {
    expect(expo.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Number.isInteger(expo.android.versionCode)).toBe(true);
    expect(expo.ios.buildNumber).toMatch(/^\d+$/);
  });
});

describe('permissions', () => {
  it('blocks every default permission the app does not use', () => {
    expect(expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.VIBRATE',
        'android.permission.ACCESS_WIFI_STATE',
      ])
    );
  });

  it('declares camera and location with a justification text', () => {
    const options = (name: string) => {
      const plugin = expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === name);
      return Array.isArray(plugin) ? plugin[1] : undefined;
    };

    expect(options('expo-camera')?.cameraPermission).toEqual(expect.stringContaining('câmera'));
    expect(options('expo-camera')?.microphonePermission).toBe(false);
    expect(options('expo-location')?.locationWhenInUsePermission).toEqual(
      expect.stringContaining('posição')
    );
    expect(options('expo-location')?.isAndroidBackgroundLocationEnabled).toBe(false);
  });
});

describe('environments', () => {
  const profiles = Object.entries(build);

  it('has one build profile per environment, each selecting its own', () => {
    expect(profiles.map(([, profile]) => profile.env.EXPO_PUBLIC_APP_ENV).sort()).toEqual(
      [...APP_ENVIRONMENTS].sort()
    );
  });

  it('points every environment at a different API', () => {
    const urls = profiles.map(([, profile]) => profile.env.EXPO_PUBLIC_API_URL);

    expect(new Set(urls).size).toBe(urls.length);
    urls.forEach((url) => expect(() => new URL(url as string)).not.toThrow());
  });

  it('lets EAS own the build number, so every distributable build increments it', () => {
    expect(cli.appVersionSource).toBe('remote');
    profiles
      .filter(([name]) => name !== 'local')
      .forEach(([, profile]) => expect(profile.autoIncrement).toBe(true));
  });

  it('embeds nothing but public settings in the bundle', () => {
    const names = profiles.flatMap(([, profile]) => Object.keys(profile.env));

    names.forEach((name) => expect(name).toMatch(/^EXPO_PUBLIC_/));
    names.forEach((name) => expect(name).not.toMatch(/SECRET|PASSWORD|TOKEN|KEY/i));
  });
});
