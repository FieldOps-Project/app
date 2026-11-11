import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/infrastructure/database/database';

let tail: Promise<unknown> = Promise.resolve();

export function writeTransaction<TResult>(
  task: (database: SQLiteDatabase) => Promise<TResult>
): Promise<TResult> {
  const run = tail.then(async () => {
    const database = await getDatabase();
    await database.execAsync('BEGIN IMMEDIATE');
    try {
      const result = await task(database);
      await database.execAsync('COMMIT');
      return result;
    } catch (error) {
      await database.execAsync('ROLLBACK');
      throw error;
    }
  });
  tail = run.catch(() => undefined);
  return run;
}
