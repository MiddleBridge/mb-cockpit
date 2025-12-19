/**
 * Card source options for trip expenses
 */
export const CARD_SOURCES = [
  { value: 'MB', label: 'MB' },
  { value: 'PKO', label: 'PKO' },
  { value: 'REVOLUT', label: 'Revolut' },
] as const;

export type CardSource = typeof CARD_SOURCES[number]['value'] | null;

