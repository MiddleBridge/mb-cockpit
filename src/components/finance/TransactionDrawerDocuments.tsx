'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import * as financeDocuments from '@/app/actions/financeDocuments';
import * as documentsActions from '@/app/actions/documents';
import { supabase } from '@/lib/supabase';

interface TransactionDrawerDocumentsProps {
  orgId: string;
  transactionId: string;
  transaction?: {
    booking_date: string;
    amount: number;
    currency: string;
    direction: 'IN' | 'OUT';
    counterparty_name?: string;
    counterparty_key?: string;
    reference?: string;
    description?: string;
  };
}

export default function TransactionDrawerDocuments({
  orgId,
  transactionId,
  transaction,
}: TransactionDrawerDocumentsProps) {
  const [documents, setDocuments] = useState<financeDocuments.TransactionDocument[]>([]);
  const [suggestions, setSuggestions] = useState<financeDocuments.DocumentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttachDialog, setShowAttachDialog] = useState(false);
  const [attachTab, setAttachTab] = useState<'upload' | 'link'>('upload');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<documentsActions.DocumentLink['document'][]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load documents and suggestions
  useEffect(() => {
    loadDocuments();
    if (transaction) {
      loadSuggestions();
    }
  }, [orgId, transactionId, transaction]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await financeDocuments.listTransactionDocuments(orgId, transactionId);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    if (!transaction) return;
    try {
      const suggs = await financeDocuments.suggestTransactionDocuments(orgId, transactionId, transaction);
      setSuggestions(suggs);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await documentsActions.searchDocuments({
        orgId,
        query: searchQuery,
        limit: 20,
      });
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching documents:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await documentsActions.uploadDocumentAndLinkToEntity(orgId, file, {
        entity: {
          type: 'FINANCE_TRANSACTION',
          id: transactionId,
          role: 'SUPPORTING',
        },
      });
      setShowAttachDialog(false);
      loadDocuments();
    } catch (error: any) {
      alert('Failed to upload document: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleLinkDocument = async (documentId: string) => {
    try {
      await documentsActions.linkExistingDocumentToEntity(
        orgId, // Can be null, will be resolved server-side
        documentId,
        'FINANCE_TRANSACTION',
        transactionId,
        'SUPPORTING'
      );
      setShowAttachDialog(false);
      setSearchQuery('');
      setSearchResults([]);
      loadDocuments();
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      if (errorMsg.includes('ORG_REQUIRED') || errorMsg.includes('Wybierz organizację')) {
        alert('Błąd: ' + errorMsg + '\n\nNajpierw utwórz organizację w sekcji "Organisations".');
      } else {
        alert('Failed to link document: ' + errorMsg);
      }
    }
  };

  const handleDetach = async (linkId: string) => {
    if (!confirm('Detach this document from the transaction?')) return;
    try {
      await documentsActions.softDeleteDocumentLink(orgId, linkId);
      loadDocuments();
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      if (errorMsg.includes('ORG_REQUIRED') || errorMsg.includes('Wybierz organizację')) {
        alert('Błąd: ' + errorMsg + '\n\nNajpierw utwórz organizację w sekcji "Organisations".');
      } else {
        alert('Failed to detach document: ' + errorMsg);
      }
    }
  };

  const handleSetPrimary = async (linkId: string) => {
    // TODO: Implement set primary role
    alert('Set primary role - to be implemented');
  };

  const handleLinkSuggestion = async (documentId: string) => {
    try {
      await documentsActions.linkExistingDocumentToEntity(
        orgId, // Can be null, will be resolved server-side
        documentId,
        'FINANCE_TRANSACTION',
        transactionId,
        'SUPPORTING'
      );
      loadDocuments();
      loadSuggestions();
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      if (errorMsg.includes('ORG_REQUIRED') || errorMsg.includes('Wybierz organizację')) {
        alert('Błąd: ' + errorMsg + '\n\nNajpierw utwórz organizację w sekcji "Organisations".');
      } else {
        alert('Failed to link document: ' + errorMsg);
      }
    }
  };

  const getDocumentUrl = (storagePath: string) => {
    // Get public URL from Supabase Storage
    // Use same bucket resolution as upload (documents or mb-cockpit)
    const bucketName = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'documents';
    const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    return data?.publicUrl || '';
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Documents</h3>
        <button
          onClick={() => setShowAttachDialog(true)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-700"
        >
          Attach
        </button>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="text-xs text-neutral-400">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="text-xs text-neutral-500">No documents attached</div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.linkId}
              className="flex items-start justify-between p-2 bg-neutral-900 rounded border border-neutral-800"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={getDocumentUrl(doc.storagePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-white hover:text-blue-400 truncate"
                  >
                    {doc.title}
                  </a>
                  <span className="text-xs text-neutral-500">({doc.docType})</span>
                  {doc.role !== 'SUPPORTING' && (
                    <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded">
                      {doc.role}
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {format(new Date(doc.linkedAt), 'MMM d, yyyy')}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => handleSetPrimary(doc.linkId)}
                  className="px-2 py-1 text-xs text-neutral-400 hover:text-white"
                  title="Set as primary"
                >
                  ⭐
                </button>
                <button
                  onClick={() => handleDetach(doc.linkId)}
                  className="px-2 py-1 text-xs text-neutral-400 hover:text-red-400"
                  title="Detach"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions Block */}
      {suggestions.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900 rounded border border-neutral-800"
          >
            <span>Suggestions ({suggestions.length})</span>
            <span>{showSuggestions ? '▼' : '▶'}</span>
          </button>
          {showSuggestions && (
            <div className="mt-2 space-y-2">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.documentId}
                  className="p-2 bg-neutral-900 rounded border border-neutral-800"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white">{suggestion.title}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{suggestion.explanation}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            suggestion.confidence === 'high'
                              ? 'bg-green-900/30 text-green-400'
                              : suggestion.confidence === 'medium'
                              ? 'bg-yellow-900/30 text-yellow-400'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {suggestion.confidence === 'high' ? 'High' : suggestion.confidence === 'medium' ? 'Medium' : 'Low'} confidence
                        </span>
                        <span className="text-xs text-neutral-500">
                          {Math.round(suggestion.score * 100)}% match
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleLinkSuggestion(suggestion.documentId)}
                      className="ml-2 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attach Dialog */}
      {showAttachDialog && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAttachDialog(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Attach Document</h3>
              <button
                onClick={() => setShowAttachDialog(false)}
                className="text-neutral-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-neutral-800 mb-4">
              <button
                onClick={() => setAttachTab('upload')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  attachTab === 'upload'
                    ? 'text-white border-b-2 border-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Upload
              </button>
              <button
                onClick={() => setAttachTab('link')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  attachTab === 'link'
                    ? 'text-white border-b-2 border-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Link Existing
              </button>
            </div>

            {/* Upload Tab */}
            {attachTab === 'upload' && (
              <div>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleUpload(file);
                    }
                  }}
                  disabled={uploading}
                  className="block w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
                {uploading && (
                  <div className="mt-2 text-xs text-neutral-400">Uploading...</div>
                )}
              </div>
            )}

            {/* Link Existing Tab */}
            {attachTab === 'link' && (
              <div>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                    placeholder="Search by title, filename, or invoice number..."
                    className="flex-1 px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 bg-neutral-800 rounded border border-neutral-700"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{doc.title}</div>
                          <div className="text-xs text-neutral-500">{doc.docType}</div>
                        </div>
                        <button
                          onClick={() => handleLinkDocument(doc.id)}
                          className="ml-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                        >
                          Link
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && searchResults.length === 0 && !searching && (
                  <div className="text-xs text-neutral-500 text-center py-4">
                    No documents found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

