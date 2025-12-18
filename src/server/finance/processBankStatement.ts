import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { parse } from 'csv-parse/sync';

export type ProcessBankStatementResult =
  | {
      ok: true;
      parsed: number;
      valid: number;
      invalid: number;
      inserted: number;
      skipped: number;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Pick first non-empty value from row using multiple possible keys
 */
function pick(row: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return value;
  }
  return null;
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

    // Create admin Supabase client with service role key
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return {
        ok: false,
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
      };
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // 1. Get document from DB
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, organisation_id, storage_path, mime_type')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('[BANK_STATEMENT] Document not found:', docError);
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
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucketName)
      .download(document.storage_path);

    if (downloadError || !fileData) {
      console.error('[BANK_STATEMENT] Download error:', downloadError);
      return {
        ok: false,
        error: `Failed to download file: ${downloadError?.message || 'Unknown error'}`,
      };
    }

    // 3. Convert to text CSV
    const csvText = await new Response(fileData).text();
    console.info('[BANK_STATEMENT] csv bytes', { size: csvText.length });
    console.info('[BANK_STATEMENT] csv preview', csvText.slice(0, 120));

    // 4. Auto-detect delimiter
    const firstLine = csvText.split('\n')[0] || '';
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    // 5. Parse CSV
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      delimiter,
    });

    console.info('[BANK_STATEMENT] parsed', {
      rows: records.length,
      headers: Object.keys(records[0] ?? {}),
    });

    if (records.length === 0) {
      return {
        ok: false,
        error: 'Parsed 0 rows',
      };
    }

    // 6. Map rows to transactions
    const validRows: Array<{
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
      transaction_hash: string;
      raw: Record<string, any>;
    }> = [];

    let invalid = 0;

    for (const row of records) {
      // Map fields using pick helper
      const bookingDateStr = pick(row, ['Data księgowania', 'Data ksiegowania', 'Data operacji', 'Data']);
      const valueDateStr = pick(row, ['Data waluty', 'Data wartości', 'Data wartosci']);
      const amountStr = pick(row, ['Kwota', 'Kwota operacji', 'Amount']);
      const currencyStr = pick(row, ['Waluta', 'Currency']) || 'PLN';
      const descriptionStr = pick(row, ['Opis operacji', 'Tytuł', 'Tytul', 'Opis']) || '';
      const counterpartyName = pick(row, ['Kontrahent', 'Nadawca/Odbiorca', 'Odbiorca', 'Nadawca', 'Nazwa kontrahenta']);
      const counterpartyAccount = pick(row, ['Rachunek kontrahenta', 'Numer rachunku', 'Nr rachunku', 'Konto']);

      if (!bookingDateStr || !amountStr) {
        invalid++;
        continue;
      }

      // Parse date (handle DD.MM.YYYY or YYYY-MM-DD)
      let bookingDate: string;
      if (bookingDateStr.includes('.')) {
        const [day, month, year] = bookingDateStr.split('.');
        bookingDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        bookingDate = bookingDateStr;
      }

      // Parse value_date if present
      let valueDate: string | null = null;
      if (valueDateStr) {
        if (valueDateStr.includes('.')) {
          const [day, month, year] = valueDateStr.split('.');
          valueDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          valueDate = valueDateStr;
        }
      }

      // Parse amount: remove spaces, replace comma with dot, remove currency
      let cleanAmountStr = amountStr.replace(/\s/g, '').replace(',', '.').replace(/PLN/g, '').trim();
      const amount = parseFloat(cleanAmountStr);

      if (isNaN(amount) || amount === 0) {
        invalid++;
        continue;
      }

      const direction: 'in' | 'out' = amount < 0 ? 'out' : 'in';
      const absAmount = Math.abs(amount);

      // Calculate transaction hash for idempotency
      const hashString = [
        bookingDate,
        absAmount.toString(),
        currencyStr,
        descriptionStr || '',
        counterpartyAccount || '',
        counterpartyName || '',
      ].join('|');

      const transactionHash = createHash('sha256').update(hashString).digest('hex');

      validRows.push({
        org_id: orgId,
        source_document_id: documentId,
        booking_date: bookingDate,
        value_date: valueDate,
        amount: absAmount,
        currency: currencyStr,
        description: descriptionStr,
        counterparty_name: counterpartyName,
        counterparty_account: counterpartyAccount,
        direction,
        category: 'uncategorised', // Will be categorized later if needed
        transaction_hash: transactionHash,
        raw: row,
      });
    }

    console.info('[BANK_STATEMENT] mapped', { valid: validRows.length, invalid });

    if (validRows.length === 0) {
      return {
        ok: false,
        error: 'No valid transactions found after mapping',
      };
    }

    // 7. Insert transactions with idempotency
    // Get existing transaction hashes for this org to avoid duplicates
    const existingHashes = new Set<string>();
    const { data: existing } = await supabaseAdmin
      .from('finance_transactions')
      .select('transaction_hash')
      .eq('org_id', orgId);

    if (existing) {
      existing.forEach(t => existingHashes.add(t.transaction_hash));
    }

    // Filter out duplicates
    const newTransactions = validRows.filter(t => !existingHashes.has(t.transaction_hash));
    const skipped = validRows.length - newTransactions.length;

    let inserted = 0;

    // Insert in batches of 200
    const batchSize = 200;
    for (let i = 0; i < newTransactions.length; i += batchSize) {
      const batch = newTransactions.slice(i, i + batchSize);

      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('finance_transactions')
        .upsert(batch, {
          onConflict: 'org_id,transaction_hash',
        })
        .select('id');

      if (insertError) {
        console.error('[BANK_STATEMENT] Insert error:', insertError);
        // Continue with next batch even if one fails
      } else {
        inserted += insertedData?.length || 0;
      }
    }

    console.info('[BANK_STATEMENT] insert', { inserted, skipped });

    return {
      ok: true,
      parsed: records.length,
      valid: validRows.length,
      invalid,
      inserted,
      skipped,
    };
  } catch (error: any) {
    console.error('[BANK_STATEMENT] Process error:', error);
    return {
      ok: false,
      error: error?.message || 'Unknown error processing bank statement',
    };
  }
}
