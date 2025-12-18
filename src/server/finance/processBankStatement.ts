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
 * Note: organisation_id is read from the document row, not passed as parameter
 */
export async function processBankStatementDocument(params: {
  documentId: string;
}): Promise<ProcessBankStatementResult> {
  try {
    const { documentId } = params;

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

    // 1. Load the document row using select("*") and log keys
    const { data: docRow, error: docErr } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docErr) {
      console.error('[BANK_STATEMENT] load_document error:', docErr);
      return {
        ok: false,
        error: `Document not found: ${docErr.message}`,
      };
    }

    console.info('[BANK_STATEMENT] doc keys', Object.keys(docRow ?? {}));
    console.info('[BANK_STATEMENT] doc fields', {
      id: docRow?.id,
      doc_type: docRow?.doc_type,
      organisation_id: docRow?.organisation_id,
      storage_path: docRow?.storage_path,
      file_url: docRow?.file_url,
      file_name: docRow?.file_name,
      mime_type: docRow?.mime_type,
    });

    // 2. Validate required inputs for import
    if (docRow?.doc_type !== 'BANK_CONFIRMATION') {
      console.error('[BANK_STATEMENT] validation_failed: wrong doc_type', { doc_type: docRow?.doc_type });
      return {
        ok: false,
        error: `Document is not BANK_CONFIRMATION, got: ${docRow?.doc_type}`,
      };
    }

    if (!docRow?.organisation_id) {
      console.error('[BANK_STATEMENT] validation_failed: missing organisation_id');
      return {
        ok: false,
        error: 'Document has no organisation_id',
      };
    }

    if (!docRow?.storage_path) {
      console.error('[BANK_STATEMENT] validation_failed: missing storage_path');
      return {
        ok: false,
        error: 'Document has no storage_path',
      };
    }

    const organisationId = docRow.organisation_id;
    const storagePath = docRow.storage_path;

    // 3. Download CSV. Prefer Storage download, fallback to fetch(file_url)
    const bucket = 'mb-cockpit';
    let csvText: string | null = null;

    const dl = await supabaseAdmin.storage.from(bucket).download(storagePath);
    if (!dl.error && dl.data) {
      csvText = await new Response(dl.data).text();
      console.info('[BANK_STATEMENT] download ok', { bytes: csvText.length });
    } else {
      console.warn('[BANK_STATEMENT] download failed', { error: dl.error?.message });
    }

    if (!csvText) {
      const resp = await fetch(docRow.file_url);
      console.info('[BANK_STATEMENT] fetch status', { status: resp.status });
      if (!resp.ok) {
        return {
          ok: false,
          error: `Failed to fetch file: ${resp.status} ${resp.statusText}`,
        };
      }
      csvText = await resp.text();
      console.info('[BANK_STATEMENT] fetch ok', { bytes: csvText.length });
    }

    console.info('[BANK_STATEMENT] csv preview', csvText.slice(0, 200));

    // 4. Parse CSV with delimiter autodetect
    const firstLine = (csvText.split(/\r?\n/)[0] ?? '');
    const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
    console.info('[BANK_STATEMENT] delimiter', { delimiter, firstLine: firstLine.slice(0, 120) });

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
        org_id: organisationId, // Use organisation_id from document
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
      .eq('org_id', organisationId);

    if (existing) {
      existing.forEach(t => existingHashes.add(t.transaction_hash));
    }

    // Filter out duplicates
    const newTransactions = validRows.filter(t => !existingHashes.has(t.transaction_hash));
    const skipped = validRows.length - newTransactions.length;

    console.info('[BANK_STATEMENT] mapped', { valid: validRows.length, invalid, new: newTransactions.length, skipped });

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
