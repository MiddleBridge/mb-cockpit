/**
 * Quick Add Parser for trip expenses
 * Parses single-line input like "Hotel Atlantis 4200 AED" into structured expense data
 */

export interface ParsedExpense {
  vendor: string | null;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: Date | null; // Defaults to today if not specified
}

/**
 * Extract amount from string, handling EU and US number formats
 */
function extractAmount(text: string): { amount: number | null; remainingText: string } {
  // Match numbers with optional thousands separators (space, comma, dot) and optional decimals
  // Patterns: 4200, 4 200, 4,200, 4.200, 4200.50, 4200,50
  const amountPattern = /(\d{1,3}(?:\s|,|\.)?\d{3}(?:(?:\s|,|\.)\d{3})*(?:[,.]\d+)?|\d+(?:[,.]\d+)?)/g;
  const matches = text.match(amountPattern);
  
  if (!matches || matches.length === 0) {
    return { amount: null, remainingText: text };
  }

  // Get the last match (most likely to be the amount)
  const lastMatch = matches[matches.length - 1];
  
  // Normalize: remove spaces, handle comma as decimal separator
  let normalized = lastMatch.replace(/\s/g, '');
  
  // Determine if comma or dot is decimal separator
  // If has both, last one is decimal
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  
  if (hasComma && hasDot) {
    // Both present - last one is decimal
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      // Comma is decimal
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot is decimal
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma && normalized.split(',')[1]?.length <= 2) {
    // Comma likely decimal (has 1-2 digits after)
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // Comma likely thousands separator
    normalized = normalized.replace(/,/g, '');
  } else if (hasDot) {
    // Check if dot is decimal (has 1-2 digits after)
    const parts = normalized.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Likely decimal
    } else {
      // Likely thousands separator
      normalized = normalized.replace(/\./g, '');
    }
  }

  const amount = parseFloat(normalized);
  if (isNaN(amount)) {
    return { amount: null, remainingText: text };
  }

  // Remove the matched amount from text
  const lastIndex = text.lastIndexOf(lastMatch);
  const remainingText = (text.substring(0, lastIndex) + text.substring(lastIndex + lastMatch.length)).trim();

  return { amount, remainingText };
}

/**
 * Extract currency from string
 */
function extractCurrency(text: string): { currency: string | null; remainingText: string } {
  const currencyPattern = /\b(AED|PLN|USD|EUR|GBP|zł|zl)\b/i;
  const match = text.match(currencyPattern);
  
  if (!match) {
    return { currency: null, remainingText: text };
  }

  const currency = match[1].toUpperCase();
  // Normalize zł to PLN
  const normalizedCurrency = currency === 'ZŁ' || currency === 'ZL' ? 'PLN' : currency;
  
  // Remove currency from text
  const remainingText = text.replace(currencyPattern, '').trim();

  return { currency: normalizedCurrency, remainingText };
}

/**
 * Auto-detect category from keywords
 */
function detectCategory(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Hotel keywords
  if (/hotel|hostel|booking|accommodation|stay/i.test(lowerText)) {
    return 'HOTEL';
  }
  
  // Flight keywords
  if (/flight|emirates|ryanair|wizz|airline|airport/i.test(lowerText)) {
    return 'FLIGHT';
  }
  
  // Transport keywords
  if (/uber|bolt|taxi|metro|transport|bus|train/i.test(lowerText)) {
    return 'TRANSPORT';
  }
  
  // Food keywords
  if (/restaurant|lunch|dinner|coffee|food|meal|cafe|bar/i.test(lowerText)) {
    return 'FOOD';
  }
  
  return 'OTHER';
}

/**
 * Extract vendor/description
 * Vendor = first 1-2 capitalized words, description = full text
 */
function extractVendorAndDescription(text: string): { vendor: string | null; description: string } {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) {
    return { vendor: null, description: '' };
  }

  // First word as vendor (capitalize first letter)
  const vendor = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
  
  // Full text as description
  const description = text.trim();

  return { vendor, description };
}

/**
 * Parse quick add input string into expense data
 */
export function parseQuickAdd(input: string, defaultCurrency: string = 'PLN'): ParsedExpense {
  let text = input.trim();
  
  if (!text) {
    throw new Error('Input cannot be empty');
  }

  // Extract amount (last number in string)
  const { amount, remainingText: textAfterAmount } = extractAmount(text);
  if (amount === null) {
    throw new Error('Could not find amount in input');
  }

  // Extract currency
  const { currency, remainingText: textAfterCurrency } = extractCurrency(textAfterAmount || text);
  const finalCurrency = currency || defaultCurrency;

  // Detect category
  const category = detectCategory(textAfterCurrency || text);

  // Extract vendor and description (use original text minus amount/currency)
  // Try to remove amount pattern and currency from original
  let cleanText = text;
  if (textAfterCurrency) {
    cleanText = textAfterCurrency;
  } else if (textAfterAmount) {
    cleanText = textAfterAmount;
  }
  
  const { vendor, description } = extractVendorAndDescription(cleanText || text);

  return {
    vendor,
    description: description || input.trim(),
    amount,
    currency: finalCurrency,
    category,
    date: new Date(), // Default to today
  };
}

