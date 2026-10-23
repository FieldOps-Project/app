import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/infrastructure/database/database';

let tail: Promise<unknown> = Promise.resolve();

/**
 * Runs `task` as one transaction on the app's single connection, after every
 * write queued before it.
 *
 * `withExclusiveTransactionAsync` is deliberately not used: it opens a second
 * native connection per call, which loses the connection's `foreign_keys`
 * setting and lets two writers collide with SQLITE_BUSY. Funnelling every
 * write through this queue keeps one writer at a time on one connection, so a
 * read-then-write inside `task` (claim an operation, fold an edit) is atomic
 * with respect to every other write.
 *
 * `task` must not call `writeTransaction` itself: it would wait for its own
 * turn forever.
 */
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
