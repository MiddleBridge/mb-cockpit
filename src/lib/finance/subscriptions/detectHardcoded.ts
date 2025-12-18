/**
 * Hardcoded subscription detector - works without DB tables
 * Detects recurring costs from transaction descriptions
 */

export interface Transaction {
  id: string;
  org_id: string;
  booking_date: string;
  description: string;
  amount: number;
  currency: string;
}

export interface DetectedSubscription {
  vendorKey: string;
  displayName: string;
  monthlyAmount: number;
  currency: string;
  lastChargeDate: string;
  occurrences: number;
  serviceMonths: string[]; // YYYY-MM-01 format
}

export interface DetectionResult {
  subscriptions: DetectedSubscription[];
  totalMonthly: number;
  debug: {
    fetchedCount: number;
    matchedCounts: Record<string, number>;
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
 * Infer service period month from description
 */
function inferServiceMonth(description: string, bookingDate: string): string {
  const d = description.toLowerCase();
  
  // Pattern: "ZA PAŹDZIERNIK 2025" or "GOOGLE WORKSPACE SIERPIEŃ"
  const monthWordMatch = d.match(/\b(styczeń|stycznia|luty|lutego|marzec|marca|kwiecień|kwietnia|maj|maja|czerwiec|czerwca|lipiec|lipca|sierpień|sierpnia|wrzesień|września|październik|października|listopad|listopada|grudzień|grudnia)\b/);
  const yearMatch = d.match(/\b(20\d{2})\b/);

  if (monthWordMatch && yearMatch) {
    const m = PL_MONTHS[monthWordMatch[1]];
    const y = Number(yearMatch[1]);
    if (m && y) {
      return `${y}-${String(m).padStart(2, '0')}-01`;
    }
  }

  // Fallback: month of booking date
  const date = new Date(bookingDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
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
      /(^|\s)sqsp\*/i,
      /squarespace/i,
    ],
  },
  {
    vendorKey: 'hermi',
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
function matchVendor(description: string): { vendorKey: string; displayName: string } | null {
  for (const vendor of VENDOR_MATCHERS) {
    for (const pattern of vendor.patterns) {
      if (pattern.test(description)) {
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
 * Detect subscriptions from transactions (hardcoded, no DB dependency)
 */
export function detectHardcoded(transactions: Transaction[]): DetectionResult {
  console.info('[detectHardcoded] Processing', transactions.length, 'transactions');

  // Filter to expenses only (amount < 0)
  const expenses = transactions.filter(tx => tx.amount < 0);
  console.info('[detectHardcoded] Expenses:', expenses.length);

  // Group by vendor
  const vendorGroups = new Map<string, Transaction[]>();
  const matchedCounts: Record<string, number> = {};

  for (const tx of expenses) {
    const match = matchVendor(tx.description);
    if (match) {
      if (!vendorGroups.has(match.vendorKey)) {
        vendorGroups.set(match.vendorKey, []);
        matchedCounts[match.vendorKey] = 0;
      }
      vendorGroups.get(match.vendorKey)!.push(tx);
      matchedCounts[match.vendorKey]++;
    }
  }

  console.info('[detectHardcoded] Matched vendors:', matchedCounts);

  // Process each vendor group
  const subscriptions: DetectedSubscription[] = [];

  for (const [vendorKey, txs] of vendorGroups.entries()) {
    if (txs.length === 0) continue;

    // Get display name from first match
    const firstMatch = matchVendor(txs[0].description);
    const displayName = firstMatch?.displayName || vendorKey;

    // Group by service month
    const byServiceMonth = new Map<string, Transaction[]>();
    for (const tx of txs) {
      const serviceMonth = inferServiceMonth(tx.description, tx.booking_date);
      if (!byServiceMonth.has(serviceMonth)) {
        byServiceMonth.set(serviceMonth, []);
      }
      byServiceMonth.get(serviceMonth)!.push(tx);
    }

    // Calculate monthly sums for each service month
    const monthlySums: number[] = [];
    const serviceMonths: string[] = [];

    for (const [month, monthTxs] of byServiceMonth.entries()) {
      const monthSum = Math.abs(monthTxs.reduce((sum, tx) => sum + tx.amount, 0));
      monthlySums.push(monthSum);
      serviceMonths.push(month);
    }

    // Sort service months descending (most recent first)
    serviceMonths.sort((a, b) => b.localeCompare(a));

    // Take last 3 months
    const last3Months = serviceMonths.slice(0, 3);
    const last3Sums = last3Months.map(month => {
      const monthTxs = byServiceMonth.get(month) || [];
      return Math.abs(monthTxs.reduce((sum, tx) => sum + tx.amount, 0));
    });

    // Calculate monthly amount (median of last 3 months, or average if less)
    const monthlyAmount = last3Sums.length > 0
      ? (last3Sums.length >= 3 ? median(last3Sums) : last3Sums.reduce((a, b) => a + b, 0) / last3Sums.length)
      : monthlySums.length > 0
        ? (monthlySums.length >= 3 ? median(monthlySums) : monthlySums.reduce((a, b) => a + b, 0) / monthlySums.length)
        : 0;

    // Find last charge date
    const lastChargeDate = txs.reduce((latest, tx) => {
      return tx.booking_date > latest ? tx.booking_date : latest;
    }, txs[0].booking_date);

    // Get currency (most common)
    const currencies = txs.map(tx => tx.currency || 'PLN');
    const currencyCounts = new Map<string, number>();
    for (const curr of currencies) {
      currencyCounts.set(curr, (currencyCounts.get(curr) || 0) + 1);
    }
    const currency = Array.from(currencyCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'PLN';

    subscriptions.push({
      vendorKey,
      displayName,
      monthlyAmount,
      currency,
      lastChargeDate,
      occurrences: txs.length,
      serviceMonths: last3Months,
    });
  }

  // Calculate total monthly
  const totalMonthly = subscriptions.reduce((sum, sub) => sum + sub.monthlyAmount, 0);

  console.info('[detectHardcoded] Detected', subscriptions.length, 'subscriptions, total monthly:', totalMonthly);

  return {
    subscriptions,
    totalMonthly,
    debug: {
      fetchedCount: transactions.length,
      matchedCounts,
    },
  };
}

