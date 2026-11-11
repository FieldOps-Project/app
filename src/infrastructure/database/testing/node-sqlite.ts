/// <reference types="node" />

import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { migrate } from '@/infrastructure/database/database';

type Params = SQLInputValue[] | [SQLInputValue[]];

function bind(params: Params): SQLInputValue[] {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : (params as SQLInputValue[]);
}

export interface TestDatabaseOptions {
  /** A file to open instead of memory, so a test can close the app and open it again. */
  readonly path?: string;
  /** Stop at this schema version, to stand in for a device still on an older app. */
  readonly schemaVersion?: number;
}

export interface TestDatabase extends SQLiteDatabase {
  /** Closes the native handle, as killing the app would. */
  closeNow(): void;
}

/**
 * A SQLite exposing the slice of the `expo-sqlite` API the repositories use,
 * backed by Node's built-in driver. Tests run the real SQL and the real
 * migrations against it, without a device.
 */
export async function openTestDatabase(options: TestDatabaseOptions = {}): Promise<TestDatabase> {
  const native = new DatabaseSync(options.path ?? ':memory:');
  native.exec('PRAGMA foreign_keys = ON');

  const database = {
    execAsync: async (source: string) => {
      native.exec(source);
    },
    runAsync: async (source: string, ...params: Params) => {
      const result = native.prepare(source).run(...bind(params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getFirstAsync: async (source: string, ...params: Params) =>
      native.prepare(source).get(...bind(params)) ?? null,
    getAllAsync: async (source: string, ...params: Params) =>
      native.prepare(source).all(...bind(params)),
    closeNow: () => native.close(),
  };

  const typed = database as unknown as TestDatabase;
  await migrate(typed, options.schemaVersion);
  return typed;
}
