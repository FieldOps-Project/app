/** `3 inspeções`, `1 inspeção`: the count with the right form of the noun. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
