export type SyncRunResult = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export const SYNC_RESULT_LABELS: Readonly<Record<SyncRunResult, string>> = {
  SUCCESS: 'tudo sincronizado',
  PARTIAL: 'concluída, mas o servidor recusou alguns registros',
  FAILED: 'não concluída: sem conexão ou servidor indisponível',
};
