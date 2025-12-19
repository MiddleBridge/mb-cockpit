/**
 * Card source options for trip expenses
 */
export const CARD_SOURCES = [
  { value: 'MB', label: 'MB' },
  { value: 'PKO', label: 'PKO' },
  { value: 'REVOLUT', label: 'Revolut' },
] as const;

export type CardSource = typeof CARD_SOURCES[number]['value'] | null;

/**
 * Expense category options
 */
export const EXPENSE_CATEGORIES = [
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'OTHER', label: 'Inne' },
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['value'];

/**
 * Currency options
 */
export const CURRENCIES = [
  { value: 'PLN', label: 'PLN' },
  { value: 'AED', label: 'AED' },
  { value: 'EUR', label: 'EUR' },
  { value: 'SAR', label: 'SAR' },
] as const;

export type Currency = typeof CURRENCIES[number]['value'];

