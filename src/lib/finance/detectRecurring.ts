/**
 * Detects if transactions form a recurring payment pattern
 * Based on similarity in: description, amount, and date intervals
 */

export interface TransactionForDetection {
  id: string;
  booking_date: string;
  amount: number;
  description: string;
}

export interface RecurringPattern {
  pattern: 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'one_time';
  confidence: number;
  groupId: string;
}

/**
 * Normalize description for comparison
 */
function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Check if two descriptions are similar (for recurring detection)
 */
function descriptionsSimilar(desc1: string, desc2: string): boolean {
  const norm1 = normalizeDescription(desc1);
  const norm2 = normalizeDescription(desc2);
  
  // Exact match
  if (norm1 === norm2) return true;
  
  // Check if one contains the other (for partial matches)
  if (norm1.length > 10 && norm2.length > 10) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  }
  
  // Check word overlap (at least 3 words in common for descriptions > 20 chars)
  if (norm1.length > 20 && norm2.length > 20) {
    const words1 = new Set(norm1.split(' ').filter(w => w.length > 3));
    const words2 = new Set(norm2.split(' ').filter(w => w.length > 3));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    if (intersection.size >= 3) return true;
  }
  
  return false;
}

/**
 * Check if amounts are similar (within 1% or exact match)
 */
function amountsSimilar(amount1: number, amount2: number): boolean {
  const abs1 = Math.abs(amount1);
  const abs2 = Math.abs(amount2);
  
  // Exact match
  if (abs1 === abs2) return true;
  
  // Within 1% (for small variations like taxes)
  const diff = Math.abs(abs1 - abs2);
  const avg = (abs1 + abs2) / 2;
  if (avg > 0 && diff / avg < 0.01) return true;
  
  return false;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.abs(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Detect pattern from date intervals
 */
function detectPatternFromInterval(days: number): 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'one_time' {
  // Allow some tolerance for date matching
  if (days >= 360 && days <= 370) return 'yearly'; // ~365 days
  if (days >= 88 && days <= 95) return 'quarterly'; // ~90 days
  if (days >= 28 && days <= 32) return 'monthly'; // ~30 days
  if (days >= 6 && days <= 8) return 'weekly'; // ~7 days
  return 'one_time';
}

/**
 * Detect recurring pattern for a transaction by comparing with previous transactions
 */
export function detectRecurringPattern(
  transaction: TransactionForDetection,
  previousTransactions: TransactionForDetection[]
): RecurringPattern {
  // Find similar transactions (same description and amount)
  const similar = previousTransactions.filter(t => 
    descriptionsSimilar(t.description, transaction.description) &&
    amountsSimilar(t.amount, transaction.amount)
  );

  if (similar.length === 0) {
    return {
      pattern: 'one_time',
      confidence: 0,
      groupId: transaction.id,
    };
  }

  // Calculate intervals
  const intervals: number[] = [];
  for (const similarTx of similar) {
    const days = daysBetween(similarTx.booking_date, transaction.booking_date);
    if (days > 0 && days < 400) { // Reasonable range
      intervals.push(days);
    }
  }

  if (intervals.length === 0) {
    return {
      pattern: 'one_time',
      confidence: 0.3,
      groupId: transaction.id,
    };
  }

  // Find most common interval pattern
  const patternCounts: Record<string, number> = {};
  intervals.forEach(days => {
    const pattern = detectPatternFromInterval(days);
    patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
  });

  // Get most common pattern
  const mostCommonPattern = Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (!mostCommonPattern || mostCommonPattern[1] < 1) {
    return {
      pattern: 'one_time',
      confidence: 0.5,
      groupId: transaction.id,
    };
  }

  const pattern = mostCommonPattern[0] as 'monthly' | 'quarterly' | 'yearly' | 'weekly';
  const confidence = Math.min(0.5 + (mostCommonPattern[1] / similar.length) * 0.5, 0.95);

  // Generate group ID from normalized description and amount
  const normalizedDesc = normalizeDescription(transaction.description);
  const normalizedAmount = Math.abs(transaction.amount).toFixed(2);
  const groupId = `${normalizedDesc}_${normalizedAmount}`.substring(0, 100);

  return {
    pattern,
    confidence,
    groupId,
  };
}

