/**
 * Client-side subscription detector
 * Analyzes transactions array directly (no API, no DB dependency)
 */

export interface TransactionInput {
  id: string;
  date: string | Date;
  description?: string | null;
  title?: string | null;
  counterparty?: string | null;
  counterparty_name?: string | null;
  amount: number | string;
  currency?: string;
}

export interface DetectedSubscription {
  vendorKey: string;
  displayName: string;
  cadence: 'monthly';
  currency: string;
  monthlyAmount: number; // positive
  lastChargeDate: string; // ISO date
  occurrences: number;
  confidence: number; // 0-100
  matchedTransactionIds: string[];
}

export interface DetectionResult {
  subscriptions: DetectedSubscription[];
  totalMonthly: number;
  debug: {
    inputCount: number;
    expenseCount: number;
    matchedCounts: Record<string, number>;
    sampleMatches: Record<string, string[]>;
  };
}

// Polish month names
const PL_MONTHS: Record<string, number> = {
  "styczeń": 1, "stycznia": 1,
  "luty": 2, "lutego": 2,
  "marzec": 3, "marca": 3,
  "kwiecień": 4, "kwietnia": 4,
  "maj": 5, "maja": 5,
  "czerwiec": 6, "czerwca": 6,
  "lipiec": 7, "lipca": 7,
  "sierpień": 8, "sierpnia": 8,
  "wrzesień": 9, "września": 9,
  "październik": 10, "października": 10,
  "listopad": 11, "listopada": 11,
  "grudzień": 12, "grudnia": 12
};

/**
 * Infer service month from text and booking date
 */
function inferServiceMonth(text: string, bookingDate: string | Date): string {
  const d = text.toLowerCase();
  const date = typeof bookingDate === 'string' ? new Date(bookingDate) : bookingDate;

  // Pattern: "OPŁATA ZA PAŹDZIERNIK 2025"
  const opłataMatch = d.match(/op\s*łata\s+za\s+(styczeń|stycznia|luty|lutego|marzec|marca|kwiecień|kwietnia|maj|maja|czerwiec|czerwca|lipiec|lipca|sierpień|sierpnia|wrzesień|września|październik|października|listopad|listopada|grudzień|grudnia)/);
  const yearMatch = d.match(/\b(20\d{2})\b/);

  if (opłataMatch && yearMatch) {
    const m = PL_MONTHS[opłataMatch[1]];
    const y = Number(yearMatch[1]);
    if (m && y) {
      return `${y}-${String(m).padStart(2, '0')}-01`;
    }
  }

  // Pattern: "GOOGLE WORKSPACE SIERPIEŃ" or "GOOGLE WORKSPACE SIERPIEŃ 2025"
  const googleMatch = d.match(/google\s+workspace\s+(styczeń|stycznia|luty|lutego|marzec|marca|kwiecień|kwietnia|maj|maja|czerwiec|czerwca|lipiec|lipca|sierpień|sierpnia|wrzesień|września|październik|października|listopad|listopada|grudzień|grudnia)/);
  if (googleMatch) {
    const m = PL_MONTHS[googleMatch[1]];
    const y = yearMatch ? Number(yearMatch[1]) : date.getFullYear();
    if (m && y) {
      return `${y}-${String(m).padStart(2, '0')}-01`;
    }
  }

  // Fallback: month of booking date
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Extract text from transaction (precedence: description || title || counterparty || "")
 */
function getTransactionText(tx: TransactionInput): string {
  return (
    tx.description?.trim() ||
    tx.title?.trim() ||
    tx.counterparty?.trim() ||
    tx.counterparty_name?.trim() ||
    ''
  );
}

/**
 * Parse amount to number (handles "-96,46 zł" or number)
 */
function parseAmount(amount: number | string): number {
  if (typeof amount === 'number') {
    return amount;
  }
  
  // Remove currency symbols and spaces
  let s = String(amount)
    .replace(/[PLN\s]/gi, '')
    .replace(/,/g, '.')
    .trim();
  
  // Remove everything except digits, minus, and dot
  s = s.replace(/[^0-9.\-]/g, '');
  
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Vendor matchers
 */
const VENDOR_MATCHERS: Array<{
  vendorKey: string;
  displayName: string;
  patterns: RegExp[];
}> = [
  {
    vendorKey: 'squarespace',
    displayName: 'Squarespace',
    patterns: [
      /sqsp\*/i,
      /squarespace/i,
    ],
  },
  {
    vendorKey: 'hermi_accounting',
    displayName: 'HERMI (accounting)',
    patterns: [
      /\bhermi\b/i,
      /joanna\s+koszulska/i,
      /biuro\s+rachunkowe\s+hermi/i,
    ],
  },
  {
    vendorKey: 'rent',
    displayName: 'Rent',
    patterns: [
      /\bnajem\b/i,
    ],
  },
  {
    vendorKey: 'google_workspace',
    displayName: 'Google Workspace',
    patterns: [
      /google\s+workspace/i,
      /gsuite/i,
      /gcpld\d+/i,
    ],
  },
];

/**
 * Match transaction to vendor
 */
function matchVendor(text: string): { vendorKey: string; displayName: string } | null {
  for (const vendor of VENDOR_MATCHERS) {
    for (const pattern of vendor.patterns) {
      if (pattern.test(text)) {
        return { vendorKey: vendor.vendorKey, displayName: vendor.displayName };
      }
    }
  }
  return null;
}

/**
 * Calculate median of numbers
 */
function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Detect subscriptions from transactions (client-side, pure function)
 */
export function detectSubscriptionsFromTransactions(
  transactions: TransactionInput[]
): DetectionResult {
  console.info('[detectFromTransactions] Processing', transactions.length, 'transactions');

  // Filter to expenses only (amount < 0)
  const expenses = transactions.filter(tx => {
    const amount = parseAmount(tx.amount);
    return amount < 0;
  });

  console.info('[detectFromTransactions] Expenses:', expenses.length);

  // Group by vendor
  const vendorGroups = new Map<string, TransactionInput[]>();
  const matchedCounts: Record<string, number> = {};
  const sampleMatches: Record<string, string[]> = {};

  for (const tx of expenses) {
    const text = getTransactionText(tx);
    if (!text) continue;

    const match = matchVendor(text);
    if (match) {
      if (!vendorGroups.has(match.vendorKey)) {
        vendorGroups.set(match.vendorKey, []);
        matchedCounts[match.vendorKey] = 0;
        sampleMatches[match.vendorKey] = [];
      }
      vendorGroups.get(match.vendorKey)!.push(tx);
      matchedCounts[match.vendorKey]++;
      
      // Store sample matches (up to 3 per vendor)
      if (sampleMatches[match.vendorKey].length < 3) {
        sampleMatches[match.vendorKey].push(text.slice(0, 80));
      }
    }
  }

  console.info('[detectFromTransactions] Matched vendors:', matchedCounts);

  // Process each vendor group
  const subscriptions: DetectedSubscription[] = [];

  for (const [vendorKey, txs] of vendorGroups.entries()) {
    if (txs.length === 0) continue;

    // Get display name from first match
    const firstText = getTransactionText(txs[0]);
    const firstMatch = matchVendor(firstText);
    const displayName = firstMatch?.displayName || vendorKey;

    // Group by service month
    const byServiceMonth = new Map<string, TransactionInput[]>();
    for (const tx of txs) {
      const text = getTransactionText(tx);
      const serviceMonth = inferServiceMonth(text, tx.date);
      if (!byServiceMonth.has(serviceMonth)) {
        byServiceMonth.set(serviceMonth, []);
      }
      byServiceMonth.get(serviceMonth)!.push(tx);
    }

    // Calculate monthly sums for each service month
    const monthlySums: Array<{ month: string; sum: number }> = [];

    for (const [month, monthTxs] of byServiceMonth.entries()) {
      const monthSum = Math.abs(
        monthTxs.reduce((sum, tx) => sum + parseAmount(tx.amount), 0)
      );
      monthlySums.push({ month, sum: monthSum });
    }

    // Sort by month descending (most recent first)
    monthlySums.sort((a, b) => b.month.localeCompare(a.month));

    // Take last 3 months
    const last3Months = monthlySums.slice(0, 3);
    const last3Sums = last3Months.map(m => m.sum);

    // Calculate monthly amount (median of last 3 months, or average if less)
    const monthlyAmount = last3Sums.length > 0
      ? (last3Sums.length >= 3 
          ? median(last3Sums) 
          : last3Sums.reduce((a, b) => a + b, 0) / last3Sums.length)
      : monthlySums.length > 0
        ? (monthlySums.length >= 3 
            ? median(monthlySums.map(m => m.sum)) 
            : monthlySums.reduce((sum, m) => sum + m.sum, 0) / monthlySums.length)
        : 0;

    // Find last charge date
    const dates = txs.map(tx => {
      const d = typeof tx.date === 'string' ? new Date(tx.date) : tx.date;
      return d.toISOString().split('T')[0];
    });
    const lastChargeDate = dates.reduce((latest, d) => d > latest ? d : latest, dates[0]);

    // Get currency (most common)
    const currencies = txs.map(tx => tx.currency || 'PLN');
    const currencyCounts = new Map<string, number>();
    for (const curr of currencies) {
      currencyCounts.set(curr, (currencyCounts.get(curr) || 0) + 1);
    }
    const currency = Array.from(currencyCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'PLN';

    // Calculate confidence
    let confidence = 80; // Base for deterministic matches
    if (txs.length >= 3) confidence += 10;
    const distinctMonths = new Set(byServiceMonth.keys()).size;
    if (distinctMonths >= 2) confidence += 10;
    confidence = Math.min(100, confidence);

    subscriptions.push({
      vendorKey,
      displayName,
      cadence: 'monthly',
      currency,
      monthlyAmount,
      lastChargeDate,
      occurrences: txs.length,
      confidence,
      matchedTransactionIds: txs.map(tx => tx.id),
    });
  }

  // Calculate total monthly
  const totalMonthly = subscriptions.reduce((sum, sub) => sum + sub.monthlyAmount, 0);

  console.info('[detectFromTransactions] Detected', subscriptions.length, 'subscriptions, total monthly:', totalMonthly);

  return {
    subscriptions,
    totalMonthly,
    debug: {
      inputCount: transactions.length,
      expenseCount: expenses.length,
      matchedCounts,
      sampleMatches,
    },
  };
}

