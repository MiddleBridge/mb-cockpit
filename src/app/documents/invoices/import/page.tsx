"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as documentsDb from "@/lib/db/documents";
import * as organisationsDb from "@/lib/db/organisations";
import type { Document } from "@/lib/db/documents";
import type { Organisation } from "@/lib/db/organisations";
import { format } from "date-fns";

const CURRENCIES = ["PLN", "EUR", "USD", "SAR", "GBP"];

export default function InvoiceClassificationPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, {
    invoice_type?: 'cost' | 'revenue' | null;
    amount_original?: string;
    currency?: string;
    invoice_date?: string;
  }>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [docsData, orgsData] = await Promise.all([
        documentsDb.getDocuments(),
        organisationsDb.getOrganisations(),
      ]);

      // Filter documents that need classification:
      // - have source_gmail_message_id (from Gmail)
      // - are not fully classified (at least one of: invoice_type, amount_original, currency is NULL)
      const unclassifiedDocs = docsData.filter(doc => 
        doc.source_gmail_message_id && 
        (!doc.invoice_type || !doc.amount_original || !doc.currency)
      );

      setDocuments(unclassifiedDocs);
      setOrganisations(orgsData);

      // Initialize form data
      const initialFormData: Record<string, any> = {};
      unclassifiedDocs.forEach(doc => {
        initialFormData[doc.id] = {
          invoice_type: doc.invoice_type || null,
          amount_original: doc.amount_original?.toString() || '',
          currency: doc.currency || '',
          invoice_date: doc.invoice_date || '',
        };
      });
      setFormData(initialFormData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (docId: string) => {
    const data = formData[docId];
    if (!data) return;

    if (!data.invoice_type) {
      alert("Please select an invoice type");
      return;
    }

    if (!data.amount_original || parseFloat(data.amount_original) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (!data.currency) {
      alert("Please select a currency");
      return;
    }

    setSaving(prev => ({ ...prev, [docId]: true }));

    try {
      const response = await fetch(`/api/documents/${docId}/classify-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_type: data.invoice_type,
          amount_original: parseFloat(data.amount_original),
          currency: data.currency,
          invoice_date: data.invoice_date || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to classify invoice');
      }

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Error saving invoice classification:', error);
      alert('Failed to save: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(prev => ({ ...prev, [docId]: false }));
    }
  };

  const getDocumentDate = (doc: Document): string => {
    if (doc.invoice_date) {
      return format(new Date(doc.invoice_date), 'yyyy-MM-dd');
    }
    // Try to get date from Gmail message (would need to fetch from gmail_messages table)
    // For now, return empty string
    return '';
  };

  const getOrganisationName = (doc: Document): string => {
    if (doc.organisation_id) {
      const org = organisations.find(o => o.id === doc.organisation_id);
      if (org) return org.name;
    }
    return doc.organisation_name_guess || '—';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-neutral-400 text-sm">Loading documents...</div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-neutral-400 hover:text-neutral-300 mb-4"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-white mb-2">Invoice Classification</h1>
        </div>
        <div className="text-center py-8 text-neutral-400 text-sm">
          No documents from Gmail need classification. All invoices are already classified.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-neutral-400 hover:text-neutral-300 mb-4"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold text-white mb-2">Invoice Classification</h1>
        <p className="text-sm text-neutral-400">
          Classify {documents.length} document{documents.length !== 1 ? 's' : ''} imported from Gmail
        </p>
      </div>

      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400">Date</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400">Sender</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400">Organisation</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400">Document</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400">Invoice Type</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400">Amount</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400">Currency</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const data = formData[doc.id] || {};
              const isSaving = saving[doc.id] || false;

              return (
                <tr key={doc.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                  <td className="py-3 px-4 text-neutral-300">
                    <input
                      type="date"
                      value={data.invoice_date || getDocumentDate(doc)}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        [doc.id]: { ...prev[doc.id], invoice_date: e.target.value }
                      }))}
                      className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neutral-600"
                    />
                  </td>
                  <td className="py-3 px-4 text-neutral-300">
                    <div className="text-xs">
                      {doc.contact_name && <div>{doc.contact_name}</div>}
                      {doc.contact_email && (
                        <div className="text-neutral-500">{doc.contact_email}</div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-neutral-300 text-xs">
                    {getOrganisationName(doc)}
                  </td>
                  <td className="py-3 px-4">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-xs underline"
                    >
                      {doc.name}
                    </a>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={data.invoice_type || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        [doc.id]: { ...prev[doc.id], invoice_type: e.target.value as 'cost' | 'revenue' || null }
                      }))}
                      className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neutral-600"
                    >
                      <option value="">Select...</option>
                      <option value="cost">Cost</option>
                      <option value="revenue">Revenue</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      step="0.01"
                      value={data.amount_original || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        [doc.id]: { ...prev[doc.id], amount_original: e.target.value }
                      }))}
                      placeholder="0.00"
                      className="w-24 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neutral-600"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={data.currency || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        [doc.id]: { ...prev[doc.id], currency: e.target.value }
                      }))}
                      className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neutral-600"
                    >
                      <option value="">Select...</option>
                      {CURRENCIES.map(currency => (
                        <option key={currency} value={currency}>{currency}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleSave(doc.id)}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

