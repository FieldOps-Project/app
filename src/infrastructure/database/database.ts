import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from '@/infrastructure/database/migrations';

const DATABASE_NAME = 'fieldops.db';

let opening: Promise<SQLiteDatabase> | null = null;

/**
 * Brings the schema up to date. The version lives in `PRAGMA user_version`,
 * written inside the same exclusive transaction as the migration itself, so a
 * crash halfway leaves the previous version and the previous schema — never a
 * new number over an old schema.
 */
export async function migrate(database: SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(MIGRATIONS[version] ?? '');
      await transaction.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

async function open(): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync(DATABASE_NAME);
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(database);
  return database;
}

/**
 * The single connection of the app, opened and migrated on first use. A
 * failed opening is not cached, so the next call tries again.
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  opening ??= open().catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}
