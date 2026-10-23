/// <reference types="node" />

import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { migrate } from '@/infrastructure/database/database';

type Params = SQLInputValue[] | [SQLInputValue[]];

function bind(params: Params): SQLInputValue[] {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : (params as SQLInputValue[]);
}

/**
 * An in-memory SQLite exposing the slice of the `expo-sqlite` API the
 * repositories use, backed by Node's built-in driver. Tests run the real SQL
 * and the real migrations against it, without a device.
 */
export async function openTestDatabase(): Promise<SQLiteDatabase> {
  const native = new DatabaseSync(':memory:');
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
  };

  const typed = database as unknown as SQLiteDatabase;
  await migrate(typed);
  return typed;
}
