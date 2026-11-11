import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from '@/infrastructure/database/migrations';

const DATABASE_NAME = 'fieldops.db';

let opening: Promise<SQLiteDatabase> | null = null;

export async function migrate(
  database: SQLiteDatabase,
  target: number = MIGRATIONS.length
): Promise<void> {
  const current = await readSchemaVersion(database);

  for (let version = current; version < target; version += 1) {
    await database.execAsync('BEGIN IMMEDIATE');
    try {
      await database.execAsync(MIGRATIONS[version] ?? '');
      await database.execAsync(`PRAGMA user_version = ${version + 1}`);
      await database.execAsync('COMMIT');
    } catch (error) {
      await database.execAsync('ROLLBACK');
      throw error;
    }
  }
}

export async function readSchemaVersion(database: SQLiteDatabase): Promise<number> {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

async function open(): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync(DATABASE_NAME);
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(database);
  return database;
}

export function getDatabase(): Promise<SQLiteDatabase> {
  opening ??= open().catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}
