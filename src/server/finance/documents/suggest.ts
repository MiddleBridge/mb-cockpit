import { supabase } from '@/lib/supabase';

export interface DocumentSuggestion {
  documentId: string;
  title: string;
  docType: string;
  score: number;
  explanation: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface Transaction {
  booking_date: string;
  amount: number;
  currency: string;
  direction: 'IN' | 'OUT';
  counterparty_name?: string;
  counterparty_key?: string;
  reference?: string;
  description?: string;
}

/**
 * Suggest documents that might be linked to a transaction
 * Returns top 10 suggestions with score 0..1 and explanation
 */
export async function suggestDocumentsForTransaction(
  orgId: string,
  transactionId: string,
  transaction: Transaction
): Promise<DocumentSuggestion[]> {
  // Get all documents for this org (excluding already linked ones)
  const { data: allDocuments, error: docsError } = await supabase
    .from('documents')
    .select('id, title, doc_type, metadata, file_name')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100); // Limit to recent 100 documents for performance

  if (docsError) {
    console.error('Error fetching documents for suggestions:', docsError);
    return [];
  }

  // Get already linked document IDs
  const { data: linkedDocs } = await supabase
    .from('document_links')
    .select('document_id')
    .eq('organisation_id', orgId)
    .eq('entity_type', 'FINANCE_TRANSACTION')
    .eq('entity_id', transactionId)
    .eq('is_deleted', false);

  const linkedDocumentIds = new Set((linkedDocs || []).map((l: any) => l.document_id));

  // Score each document
  const suggestions: DocumentSuggestion[] = [];

  for (const doc of allDocuments || []) {
    // Skip already linked documents
    if (linkedDocumentIds.has(doc.id)) {
      continue;
    }

    const score = calculateScore(transaction, doc);
    if (score >= 0.55) {
      // Only include suggestions with score >= 0.55
      const explanation = generateExplanation(transaction, doc, score);
      suggestions.push({
        documentId: doc.id,
        title: doc.title,
        docType: doc.doc_type,
        score,
        explanation,
        confidence: score >= 0.80 ? 'high' : score >= 0.70 ? 'medium' : 'low',
      });
    }
  }

  // Sort by score descending and return top 10
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/**
 * Calculate matching score between transaction and document
 */
function calculateScore(transaction: Transaction, document: any): number {
  let score = 0;
  const metadata = document.metadata || {};
  const docTitle = document.title || '';
  const docFileName = document.file_name || '';

  // +0.40 if invoice_no appears in description or reference
  const invoiceNo = metadata.invoice_no;
  if (invoiceNo) {
    const normalizedInvoiceNo = normalizeText(String(invoiceNo));
    const normalizedRef = normalizeText(transaction.reference || '');
    const normalizedDesc = normalizeText(transaction.description || '');
    
    if (normalizedRef.includes(normalizedInvoiceNo) || normalizedDesc.includes(normalizedInvoiceNo)) {
      score += 0.40;
    }
  }

  // +0.25 if issuer_name matches counterparty_key (normalized contains)
  const issuerName = metadata.issuer_name;
  const counterpartyKey = transaction.counterparty_key || transaction.counterparty_name || '';
  if (issuerName && counterpartyKey) {
    const normalizedIssuer = normalizeText(String(issuerName));
    const normalizedCounterparty = normalizeText(counterpartyKey);
    
    if (normalizedIssuer.includes(normalizedCounterparty) || 
        normalizedCounterparty.includes(normalizedIssuer)) {
      score += 0.25;
    }
  }

  // +0.20 if amount matches within tolerance
  const docTotalGross = metadata.total_gross;
  if (docTotalGross !== undefined && docTotalGross !== null) {
    const docAmount = parseFloat(String(docTotalGross));
    const txAmount = Math.abs(transaction.amount);
    const currency = transaction.currency || 'PLN';
    
    // Tolerance: max(5 in currency, 1% of amount)
    const tolerance = Math.max(
      currency === 'PLN' ? 5 : 1, // 5 PLN or 1 unit for other currencies
      txAmount * 0.01
    );
    
    if (Math.abs(docAmount - txAmount) <= tolerance) {
      score += 0.20;
    }
  }

  // +0.10 if date proximity
  const issueDate = metadata.issue_date;
  const dueDate = metadata.due_date;
  const bookingDate = new Date(transaction.booking_date);
  
  if (issueDate) {
    const issue = new Date(issueDate);
    const daysDiff = Math.floor((bookingDate.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24));
    // issue_date within -30..+90 days of booking_date
    if (daysDiff >= -30 && daysDiff <= 90) {
      score += 0.10;
    }
  }
  
  if (dueDate) {
    const due = new Date(dueDate);
    const daysDiff = Math.floor((bookingDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    // due_date within -30..+30 days
    if (daysDiff >= -30 && daysDiff <= 30) {
      score += 0.10;
    }
  }

  // +0.05 if currency matches
  const docCurrency = metadata.currency;
  if (docCurrency && transaction.currency) {
    if (normalizeText(String(docCurrency)) === normalizeText(transaction.currency)) {
      score += 0.05;
    }
  }

  return Math.min(score, 1.0); // Cap at 1.0
}

/**
 * Generate human-readable explanation for the suggestion
 */
function generateExplanation(transaction: Transaction, document: any, score: number): string {
  const reasons: string[] = [];
  const metadata = document.metadata || {};

  // Invoice number match
  const invoiceNo = metadata.invoice_no;
  if (invoiceNo) {
    const normalizedInvoiceNo = normalizeText(String(invoiceNo));
    const normalizedRef = normalizeText(transaction.reference || '');
    const normalizedDesc = normalizeText(transaction.description || '');
    
    if (normalizedRef.includes(normalizedInvoiceNo) || normalizedDesc.includes(normalizedInvoiceNo)) {
      reasons.push(`Invoice number ${invoiceNo} matches transaction reference/description`);
    }
  }

  // Issuer name match
  const issuerName = metadata.issuer_name;
  const counterpartyKey = transaction.counterparty_key || transaction.counterparty_name || '';
  if (issuerName && counterpartyKey) {
    const normalizedIssuer = normalizeText(String(issuerName));
    const normalizedCounterparty = normalizeText(counterpartyKey);
    
    if (normalizedIssuer.includes(normalizedCounterparty) || 
        normalizedCounterparty.includes(normalizedIssuer)) {
      reasons.push(`Issuer "${issuerName}" matches counterparty "${counterpartyKey}"`);
    }
  }

  // Amount match
  const docTotalGross = metadata.total_gross;
  if (docTotalGross !== undefined && docTotalGross !== null) {
    const docAmount = parseFloat(String(docTotalGross));
    const txAmount = Math.abs(transaction.amount);
    const currency = transaction.currency || 'PLN';
    const tolerance = Math.max(currency === 'PLN' ? 5 : 1, txAmount * 0.01);
    
    if (Math.abs(docAmount - txAmount) <= tolerance) {
      reasons.push(`Amount ${docAmount} ${currency} matches transaction amount`);
    }
  }

  // Date proximity
  const issueDate = metadata.issue_date;
  const dueDate = metadata.due_date;
  const bookingDate = new Date(transaction.booking_date);
  
  if (issueDate) {
    const issue = new Date(issueDate);
    const daysDiff = Math.floor((bookingDate.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff >= -30 && daysDiff <= 90) {
      reasons.push(`Issue date ${issueDate} is close to transaction date`);
    }
  }
  
  if (dueDate) {
    const due = new Date(dueDate);
    const daysDiff = Math.floor((bookingDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff >= -30 && daysDiff <= 30) {
      reasons.push(`Due date ${dueDate} is close to transaction date`);
    }
  }

  // Currency match
  const docCurrency = metadata.currency;
  if (docCurrency && transaction.currency) {
    if (normalizeText(String(docCurrency)) === normalizeText(transaction.currency)) {
      reasons.push(`Currency ${docCurrency} matches`);
    }
  }

  if (reasons.length === 0) {
    return `Partial match (score: ${(score * 100).toFixed(0)}%)`;
  }

  return reasons.join('; ') + ` (score: ${(score * 100).toFixed(0)}%)`;
}

/**
 * Normalize text for comparison (lowercase, remove special chars)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

