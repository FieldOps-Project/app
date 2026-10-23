/**
 * Dates as the technician reads them (document 13.9): local time, Brazilian
 * format. The stored value stays an ISO instant; formatting happens only here,
 * at the edge of the screen.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Data inválida';
  }
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
