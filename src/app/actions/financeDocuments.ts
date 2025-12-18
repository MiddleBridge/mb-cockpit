'use server';

import * as transactionDocuments from '@/server/finance/documents/transactionDocuments';
import * as suggest from '@/server/finance/documents/suggest';

export interface TransactionDocument {
  linkId: string;
  documentId: string;
  title: string;
  docType: string;
  storagePath: string;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  metadata: Record<string, any>;
  role: string;
  note?: string;
  createdAt: string;
  linkedAt: string;
}

export interface DocumentSuggestion {
  documentId: string;
  title: string;
  docType: string;
  score: number;
  explanation: string;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * List all documents linked to a finance transaction
 */
export async function listTransactionDocuments(
  orgId: string,
  transactionId: string
): Promise<TransactionDocument[]> {
  return transactionDocuments.listTransactionDocuments(orgId, transactionId);
}

/**
 * Get document suggestions for a transaction
 */
export async function suggestTransactionDocuments(
  orgId: string,
  transactionId: string,
  transaction: {
    booking_date: string;
    amount: number;
    currency: string;
    direction: 'IN' | 'OUT';
    counterparty_name?: string;
    counterparty_key?: string;
    reference?: string;
    description?: string;
  }
): Promise<DocumentSuggestion[]> {
  return suggest.suggestDocumentsForTransaction(orgId, transactionId, transaction);
}

