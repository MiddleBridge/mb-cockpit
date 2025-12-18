import { supabase } from '@/lib/supabase';

export interface SubscriptionRule {
  id: string;
  org_id: string;
  vendor_key: string;
  display_name: string;
  match_regex: string;
  cadence: string;
  is_enabled: boolean;
}

export interface DetectedSubscription {
  vendor_key: string;
  display_name: string;
  cadence: 'monthly';
  currency: string;
  avg_amount: number;
  amount_tolerance: number;
  last_charge_date: string;
  next_expected_date: string | null;
  first_seen_date: string;
  active: boolean;
  confidence: number;
  source: 'rule' | 'auto';
  transaction_ids: string[];
  servicePeriodMonths: (string | null)[];
}

export interface DetectionResult {
  subscriptions: DetectedSubscription[];
  monthlyTotal: number;
  processed: number;
  matched: number;
}

// Polish month names mapping
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
 * Infer service period month from description (e.g., "ZA PAŹDZIERNIK 2025")
 */
export function inferServicePeriodMonth(description: string, fallbackDate: Date): Date {
  const d = description.toLowerCase();

  // Pattern: "ZA PAŹDZIERNIK 2025" or "GOOGLE WORKSPACE SIERPIEŃ"
  const monthWordMatch = d.match(/\b(styczeń|stycznia|luty|lutego|marzec|marca|kwiecień|kwietnia|maj|maja|czerwiec|czerwca|lipiec|lipca|sierpień|sierpnia|wrzesień|września|październik|października|listopad|listopada|grudzień|grudnia)\b/);
  const yearMatch = d.match(/\b(20\d{2})\b/);

  if (monthWordMatch && yearMatch) {
    const m = PL_MONTHS[monthWordMatch[1]];
    const y = Number(yearMatch[1]);
    if (m && y) {
      return new Date(Date.UTC(y, m - 1, 1));
    }
  }

  // Fallback: month of booking date
  return new Date(Date.UTC(fallbackDate.getUTCFullYear(), fallbackDate.getUTCMonth(), 1));
}

/**
 * Normalise vendor key (make SQSP stable despite WEBSIT# numbers)
 */
export function normaliseVendorKey(rawDesc: string): string {
  const s = rawDesc
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[#*]/g, " ")
    .replace(/\bWEBSIT\s*\d+\b/g, " ")
    .replace(/\bWEBSIT\d+\b/g, " ")
    .replace(/\bGCPLD\d+\b/g, " GCPLD ")
    .replace(/\bZAKUP PRZY UŻYCIU KARTY\b.*$/g, " ")
    .replace(/\bPRZELEW\b.*$/g, " ")
    .trim();

  // Take a strong prefix as signature
  return s.slice(0, 48).trim().replace(/\s+/g, "_").toLowerCase();
}

/**
 * Load subscription rules for an organization
 */
async function loadRules(orgId: string): Promise<SubscriptionRule[]> {
  const { data, error } = await supabase
    .from('finance_subscription_rules')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_enabled', true);

  if (error) {
    console.error('[detectSubscriptions] Error loading rules:', error);
    return [];
  }

  return (data || []) as SubscriptionRule[];
}

/**
 * Match transaction against rules
 */
function matchRule(description: string, rules: SubscriptionRule[]): SubscriptionRule | null {
  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.match_regex);
      if (regex.test(description)) {
        return rule;
      }
    } catch (e) {
      console.warn('[detectSubscriptions] Invalid regex in rule:', rule.id, rule.match_regex);
    }
  }
  return null;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  return Math.abs(Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Detect if transactions form a monthly recurring pattern
 */
function detectMonthlyPattern(dates: Date[]): { isMonthly: boolean; confidence: number } {
  if (dates.length < 3) {
    return { isMonthly: false, confidence: 0 };
  }

  // Sort dates
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  // Calculate intervals
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(daysBetween(sorted[i - 1], sorted[i]));
  }

  // Check if intervals are around 28-35 days (monthly)
  const monthlyIntervals = intervals.filter(d => d >= 28 && d <= 35);
  const ratio = monthlyIntervals.length / intervals.length;

  if (ratio >= 0.7 && monthlyIntervals.length >= 2) {
    // High confidence if most intervals are monthly
    const confidence = Math.min(95, 50 + (ratio * 45));
    return { isMonthly: true, confidence };
  }

  return { isMonthly: false, confidence: 0 };
}

/**
 * Check if amounts are similar (within tolerance)
 */
function amountsSimilar(amount1: number, amount2: number, tolerance: number = 5.00): boolean {
  const abs1 = Math.abs(amount1);
  const abs2 = Math.abs(amount2);
  const diff = Math.abs(abs1 - abs2);
  return diff <= tolerance;
}

/**
 * Main detection function
 */
export async function detectSubscriptions(orgId: string): Promise<DetectionResult> {
  console.log('[detectSubscriptions] Starting for orgId:', orgId);

  // Load rules
  const rules = await loadRules(orgId);
  console.log('[detectSubscriptions] Loaded rules:', rules.length);

  // Fetch last 18 months of expense transactions
  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - 18);

  const { data: transactions, error } = await supabase
    .from('finance_transactions')
    .select('id, booking_date, amount, currency, description, counterparty_name')
    .eq('org_id', orgId)
    .eq('direction', 'out')
    .gte('booking_date', dateFrom.toISOString().split('T')[0])
    .order('booking_date', { ascending: true });

  if (error) {
    console.error('[detectSubscriptions] Error fetching transactions:', error);
    return { subscriptions: [], monthlyTotal: 0, processed: 0, matched: 0 };
  }

  if (!transactions || transactions.length === 0) {
    console.log('[detectSubscriptions] No transactions found');
    return { subscriptions: [], monthlyTotal: 0, processed: 0, matched: 0 };
  }

  console.log('[detectSubscriptions] Processing', transactions.length, 'transactions');

  // Group transactions by vendor
  const vendorGroups = new Map<string, {
    rule: SubscriptionRule | null;
    transactions: typeof transactions;
    vendorKey: string;
    displayName: string;
  }>();

  for (const tx of transactions) {
    // Try rule match first
    const matchedRule = matchRule(tx.description, rules);
    
    let vendorKey: string;
    let displayName: string;

    if (matchedRule) {
      vendorKey = matchedRule.vendor_key;
      displayName = matchedRule.display_name;
    } else {
      // Use normalised vendor key
      vendorKey = normaliseVendorKey(tx.description);
      displayName = tx.counterparty_name || tx.description.slice(0, 50);
    }

    if (!vendorGroups.has(vendorKey)) {
      vendorGroups.set(vendorKey, {
        rule: matchedRule || null,
        transactions: [],
        vendorKey,
        displayName,
      });
    }

    vendorGroups.get(vendorKey)!.transactions.push(tx);
  }

  console.log('[detectSubscriptions] Found', vendorGroups.size, 'vendor groups');

  // Process each vendor group
  const detected: DetectedSubscription[] = [];
  const now = new Date();

  for (const [vendorKey, group] of vendorGroups.entries()) {
    const txs = group.transactions;

    if (txs.length < 2) continue; // Need at least 2 transactions

    // Extract amounts and dates
    const amounts = txs.map(tx => Math.abs(tx.amount));
    const dates = txs.map(tx => new Date(tx.booking_date));
    const currencies = [...new Set(txs.map(tx => tx.currency || 'PLN'))];

    // Check if amounts are similar (within tolerance)
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    const tolerance = Math.max(5.00, avgAmount * 0.05); // 5% or 5 PLN, whichever is larger

    const allSimilar = amounts.every(amt => amountsSimilar(amt, avgAmount, tolerance));

    // Detect monthly pattern
    const pattern = detectMonthlyPattern(dates);

    // Determine if this is a subscription
    let isSubscription = false;
    let confidence = 0;
    let source: 'rule' | 'auto' = 'auto';

    if (group.rule) {
      // Rule match = high confidence
      isSubscription = true;
      confidence = 90;
      source = 'rule';
    } else if (pattern.isMonthly && allSimilar && txs.length >= 3) {
      // Heuristic match = medium confidence
      isSubscription = true;
      confidence = pattern.confidence;
      source = 'auto';
    }

    if (!isSubscription) continue;

    // Calculate dates
    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];

    // Calculate next expected date (30 days from last)
    const nextExpected = new Date(lastDate);
    nextExpected.setDate(nextExpected.getDate() + 30);

    // Check if active (last charge within 45 days)
    const daysSinceLast = daysBetween(now, lastDate);
    const active = daysSinceLast <= 45;

    // Get service period months
    const servicePeriodMonths = txs.map(tx => {
      const servicePeriod = inferServicePeriodMonth(tx.description, new Date(tx.booking_date));
      return servicePeriod.toISOString().split('T')[0];
    });

    detected.push({
      vendor_key: vendorKey,
      display_name: group.displayName,
      cadence: 'monthly',
      currency: currencies[0] || 'PLN',
      avg_amount: avgAmount,
      amount_tolerance: tolerance,
      last_charge_date: lastDate.toISOString().split('T')[0],
      next_expected_date: nextExpected.toISOString().split('T')[0],
      first_seen_date: firstDate.toISOString().split('T')[0],
      active,
      confidence,
      source,
      transaction_ids: txs.map(tx => tx.id),
      servicePeriodMonths,
    });
  }

  // Calculate monthly total (sum of active monthly subscriptions)
  const monthlyTotal = detected
    .filter(s => s.active && s.cadence === 'monthly')
    .reduce((sum, s) => sum + s.avg_amount, 0);

  console.log('[detectSubscriptions] Detected', detected.length, 'subscriptions, monthly total:', monthlyTotal);

  // Upsert to database
  for (const sub of detected) {
    // Upsert subscription
    const { data: subData, error: subError } = await supabase
      .from('finance_subscriptions')
      .upsert({
        org_id: orgId,
        vendor_key: sub.vendor_key,
        display_name: sub.display_name,
        cadence: sub.cadence,
        currency: sub.currency,
        avg_amount: sub.avg_amount,
        amount_tolerance: sub.amount_tolerance,
        last_charge_date: sub.last_charge_date,
        next_expected_date: sub.next_expected_date,
        first_seen_date: sub.first_seen_date,
        active: sub.active,
        confidence: sub.confidence,
        source: sub.source,
      }, {
        onConflict: 'org_id,vendor_key,cadence,currency',
      })
      .select('id')
      .single();

    if (subError) {
      console.error('[detectSubscriptions] Error upserting subscription:', subError);
      continue;
    }

    const subscriptionId = subData.id;

    // Upsert transaction links
    for (let i = 0; i < sub.transaction_ids.length; i++) {
      const txId = sub.transaction_ids[i];
      const servicePeriod = sub.servicePeriodMonths[i];

      await supabase
        .from('finance_subscription_transactions')
        .upsert({
          org_id: orgId,
          subscription_id: subscriptionId,
          transaction_id: txId,
          service_period_month: servicePeriod,
        }, {
          onConflict: 'org_id,subscription_id,transaction_id',
        });
    }
  }

  return {
    subscriptions: detected,
    monthlyTotal,
    processed: transactions.length,
    matched: detected.length,
  };
}

