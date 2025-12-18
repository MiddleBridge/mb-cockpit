import { createServerSupabaseClient } from '@/server/supabase/server';
import { createHash } from 'crypto';

export type ProcessBankStatementResult =
  | {
      ok: true;
      inserted: number;
      skipped: number;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Categorize transaction based on description
 */
function categoriseTransaction(description: string): { category: string; subcategory: string | null } {
  const desc = description.toUpperCase();

  if (desc.includes('ZUS')) {
    return { category: 'tax', subcategory: 'zus' };
  }

  if (desc.includes('US') || desc.includes('URZĄD SKARBOWY') || desc.includes('URZĄD SKARBOWY')) {
    return { category: 'tax', subcategory: 'pit_cit_vat' };
  }

  if (desc.includes('BLIK')) {
    return { category: 'payment', subcategory: 'blik' };
  }

  if (desc.includes('KARTA') || desc.includes('CARD')) {
    return { category: 'card_payment', subcategory: null };
  }

  if (desc.includes('WYPŁATA') || desc.includes('ATM')) {
    return { category: 'cash', subcategory: 'atm_withdrawal' };
  }

  if (desc.includes('PRZELEW WŁASNY')) {
    return { category: 'transfer', subcategory: 'internal' };
  }

  if (desc.includes('WYNAGRODZENIE') || desc.includes('SALARY') || desc.includes('WYPŁATA')) {
    return { category: 'income', subcategory: 'salary' };
  }

  return { category: 'uncategorised', subcategory: null };
}

/**
 * Calculate transaction hash for idempotency
 */
function calculateTransactionHash(row: {
  booking_date: string;
  amount: number;
  currency: string;
  description: string;
  counterparty_account?: string | null;
  counterparty_name?: string | null;
}): string {
  const hashString = [
    row.booking_date,
    row.amount.toString(),
    row.currency,
    row.description || '',
    row.counterparty_account || '',
    row.counterparty_name || '',
  ].join('|');

  return createHash('sha256').update(hashString).digest('hex');
}

/**
 * Parse CSV content to transaction rows
 * Handles mBank format with semicolon separator
 */
function parseCSV(csvContent: string): Array<Record<string, string>> {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return [];
  }

  // Detect separator (mBank uses semicolon, but try comma too)
  const firstLine = lines[0];
  const hasSemicolon = firstLine.includes(';');
  const separator = hasSemicolon ? ';' : ',';

  // Try to detect header row
  const headerLine = lines[0].toLowerCase();
  const hasHeader = headerLine.includes('data') || headerLine.includes('kwota') || headerLine.includes('data operacji');

  let startIndex = hasHeader ? 1 : 0;
  const headers = hasHeader 
    ? lines[0].split(separator).map(h => h.trim().toLowerCase())
    : null;

  const rows: Array<Record<string, string>> = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;

    const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
    
    if (headers) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    } else {
      // No header - assume positional: date, amount, description, etc.
      if (values.length >= 3) {
        rows.push({
          'data operacji': values[0] || '',
          'kwota': values[1] || '',
          'tytuł': values[2] || '',
          'kontrahent': values[3] || '',
          'rachunek': values[4] || '',
        });
      }
    }
  }

  return rows;
}

/**
 * Map CSV row to transaction object
 */
function mapCSVRowToTransaction(
  row: Record<string, string>,
  orgId: string,
  documentId: string
): {
  org_id: string;
  source_document_id: string;
  booking_date: string;
  value_date: string | null;
  amount: number;
  currency: string;
  description: string;
  counterparty_name: string | null;
  counterparty_account: string | null;
  direction: 'in' | 'out';
  category: string;
  subcategory: string | null;
  transaction_hash: string;
  raw: Record<string, any>;
} | null {
  // Try different column name variations (mBank format)
  const dateStr = row['data operacji'] || row['data'] || row['data księgowania'] || row['booking_date'] || '';
  const amountStr = row['kwota'] || row['amount'] || row['kwota w walucie rachunku'] || '';
  const descriptionStr = row['tytuł'] || row['opis'] || row['description'] || row['tytuł operacji'] || '';
  const counterpartyName = row['kontrahent'] || row['counterparty'] || row['nazwa kontrahenta'] || null;
  const counterpartyAccount = row['rachunek'] || row['account'] || row['numer rachunku'] || null;
  const currencyStr = row['waluta'] || row['currency'] || 'PLN';

  if (!dateStr || !amountStr) {
    return null; // Skip invalid rows
  }

  // Parse date (mBank format: YYYY-MM-DD or DD.MM.YYYY)
  let bookingDate: string;
  if (dateStr.includes('.')) {
    // DD.MM.YYYY format
    const [day, month, year] = dateStr.split('.');
    bookingDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } else {
    // Assume YYYY-MM-DD
    bookingDate = dateStr;
  }

  // Parse amount (remove spaces, replace comma with dot)
  const cleanAmountStr = amountStr.replace(/\s/g, '').replace(',', '.');
  const amount = parseFloat(cleanAmountStr);

  if (isNaN(amount) || amount === 0) {
    return null; // Skip invalid amounts
  }

  const direction: 'in' | 'out' = amount > 0 ? 'in' : 'out';
  const absAmount = Math.abs(amount);

  // Categorize transaction
  const { category, subcategory } = categoriseTransaction(descriptionStr);

  // Calculate hash for idempotency
  const transactionHash = calculateTransactionHash({
    booking_date: bookingDate,
    amount: absAmount,
    currency: currencyStr,
    description: descriptionStr,
    counterparty_account: counterpartyAccount,
    counterparty_name: counterpartyName,
  });

  return {
    org_id: orgId,
    source_document_id: documentId,
    booking_date: bookingDate,
    value_date: null, // mBank usually doesn't have separate value date
    amount: absAmount,
    currency: currencyStr,
    description: descriptionStr,
    counterparty_name: counterpartyName,
    counterparty_account: counterpartyAccount,
    direction,
    category,
    subcategory,
    transaction_hash: transactionHash,
    raw: row,
  };
}

/**
 * Process bank statement document: download CSV, parse, and insert transactions
 */
export async function processBankStatementDocument(params: {
  documentId: string;
  orgId: string;
}): Promise<ProcessBankStatementResult> {
  try {
    const { documentId, orgId } = params;
    const supabase = createServerSupabaseClient();

    // 1. Get document from DB
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, storage_path, file_url, mime_type')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('❌ [BANK_STATEMENT] Document not found:', docError);
      return {
        ok: false,
        error: `Document not found: ${docError?.message || 'Unknown error'}`,
      };
    }

    if (!document.storage_path) {
      return {
        ok: false,
        error: 'Document has no storage_path',
      };
    }

    // 2. Download file from Storage
    const bucketName = 'mb-cockpit';
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(document.storage_path);

    if (downloadError || !fileData) {
      console.error('❌ [BANK_STATEMENT] Download error:', downloadError);
      return {
        ok: false,
        error: `Failed to download file: ${downloadError?.message || 'Unknown error'}`,
      };
    }

    // 3. Convert to text (try UTF-8, fallback to latin2 for Polish characters)
    let csvContent: string;
    try {
      csvContent = await fileData.text();
    } catch (e) {
      // Fallback: try as ArrayBuffer and decode
      const buffer = await fileData.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      csvContent = decoder.decode(buffer);
    }

    // 4. Parse CSV
    const csvRows = parseCSV(csvContent);
    console.log(`📊 [BANK_STATEMENT] Parsed ${csvRows.length} rows from CSV`);

    if (csvRows.length === 0) {
      return {
        ok: false,
        error: 'No valid rows found in CSV',
      };
    }

    // 5. Map rows to transactions
    const transactions = csvRows
      .map(row => mapCSVRowToTransaction(row, orgId, documentId))
      .filter((t): t is NonNullable<typeof t> => t !== null);

    console.log(`📊 [BANK_STATEMENT] Mapped ${transactions.length} valid transactions`);

    if (transactions.length === 0) {
      return {
        ok: false,
        error: 'No valid transactions found after mapping',
      };
    }

    // Log example transaction (without sensitive data)
    if (transactions.length > 0) {
      const example = transactions[0];
      console.log('📊 [BANK_STATEMENT] Example transaction:', {
        booking_date: example.booking_date,
        amount: example.amount,
        currency: example.currency,
        direction: example.direction,
        category: example.category,
        description: example.description.substring(0, 50), // First 50 chars only
      });
    }

    // 6. Insert transactions with idempotency (check existing hashes first)
    // Get existing transaction hashes for this org to avoid duplicates
    const existingHashes = new Set<string>();
    const { data: existing } = await supabase
      .from('finance_transactions')
      .select('transaction_hash')
      .eq('org_id', orgId);

    if (existing) {
      existing.forEach(t => existingHashes.add(t.transaction_hash));
    }

    // Filter out duplicates
    const newTransactions = transactions.filter(t => !existingHashes.has(t.transaction_hash));
    const skipped = transactions.length - newTransactions.length;

    console.log(`📊 [BANK_STATEMENT] ${newTransactions.length} new transactions, ${skipped} duplicates skipped`);

    let inserted = 0;

    // Insert in batches to avoid too large queries
    const batchSize = 100;
    for (let i = 0; i < newTransactions.length; i += batchSize) {
      const batch = newTransactions.slice(i, i + batchSize);

      const { data: insertedData, error: insertError } = await supabase
        .from('finance_transactions')
        .insert(batch)
        .select('id');

      if (insertError) {
        console.error('❌ [BANK_STATEMENT] Insert error:', insertError);
        // Continue with next batch even if one fails
      } else {
        inserted += insertedData?.length || 0;
      }
    }

    console.log(`✅ [BANK_STATEMENT] Import complete: ${inserted} inserted, ${skipped} skipped (duplicates)`);

    return {
      ok: true,
      inserted,
      skipped,
    };
  } catch (error: any) {
    console.error('❌ [BANK_STATEMENT] Process error:', error);
    return {
      ok: false,
      error: error?.message || 'Unknown error processing bank statement',
    };
  }
}

