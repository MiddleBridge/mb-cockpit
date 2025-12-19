'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as projectsDb from '@/lib/db/projects';
import * as timelineDb from '@/lib/db/timeline';
import { getTransactions, Transaction } from '@/lib/finance/queries/getTransactions';
import type { Project } from '@/lib/db/projects';
import type { TimelineItem } from '@/lib/db/timeline';
import EvidenceUploader from '@/components/evidence/EvidenceUploader';
import EvidenceGallery from '@/components/evidence/EvidenceGallery';
import ReimbursementSummary from '@/components/evidence/ReimbursementSummary';
import TransactionDrawer from '@/components/finance/TransactionDrawer';

interface TripProjectViewProps {
  projectId: string;
  onClose?: () => void;
}

type Tab = 'overview' | 'expenses' | 'evidence' | 'reimbursement';

export default function TripProjectView({ projectId, onClose }: TripProjectViewProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<TimelineItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [noteText, setNoteText] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectData, notesData, transactionsData] = await Promise.all([
        loadProject(),
        loadNotes(),
        loadTransactions(),
      ]);
      
      setProject(projectData);
      setNotes(notesData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error loading trip data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProject = async () => {
    const projects = await projectsDb.getProjects();
    return projects.find(p => p.id === projectId) || null;
  };

  const loadNotes = async () => {
    // Get timeline items of type 'note' for this project
    const items = await timelineDb.getTimelineItemsForProject(projectId, 1000);
    return items.filter(item => item.type === 'note');
  };

  const loadTransactions = async () => {
    const result = await getTransactions({ projectId });
    return result.transactions;
  };

  const handleSaveNote = async (noteId?: string) => {
    if (!project) return;

    const text = noteId ? noteText[noteId] : newNoteText;
    if (!text?.trim()) return;

    try {
      if (noteId) {
        // Update existing note
        await timelineDb.updateTimelineItem(noteId, { body: text });
      } else {
        // Create new note
        await timelineDb.createTimelineItem({
          projectId: project.id,
          type: 'note',
          title: 'Trip Note',
          body: text,
        });
        setNewNoteText('');
      }
      await loadNotes();
      setEditingNote(null);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await timelineDb.deleteTimelineItem(noteId);
      await loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-neutral-400">Loading...</div>;
  }

  if (!project) {
    return <div className="text-center py-8 text-neutral-400">Project not found</div>;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency || 'PLN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{project.title || project.name}</h2>
          {project.description && (
            <p className="text-sm text-neutral-400 mt-1">{project.description}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-xl"
          >
            ×
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'overview'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'expenses'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Expenses ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('evidence')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'evidence'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Evidence
        </button>
        <button
          onClick={() => setActiveTab('reimbursement')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'reimbursement'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Reimbursement
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Notes Section */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Notes</h3>
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="bg-neutral-800/50 border border-neutral-700 rounded p-3">
                  {editingNote === note.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={noteText[note.id] || note.body || ''}
                        onChange={(e) => setNoteText(prev => ({ ...prev, [note.id]: e.target.value }))}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                        rows={4}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveNote(note.id)}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingNote(null);
                            setNoteText(prev => {
                              const newState = { ...prev };
                              delete newState[note.id];
                              return newState;
                            });
                          }}
                          className="text-xs bg-neutral-700 hover:bg-neutral-600 text-white px-3 py-1 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-white whitespace-pre-wrap">{note.body || 'Empty note'}</div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs text-neutral-500">
                          {formatDate(note.happened_at)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingNote(note.id);
                              setNoteText(prev => ({ ...prev, [note.id]: note.body || '' }));
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {note.id && project.organisation_ids && project.organisation_ids[0] && (
                        <div className="mt-2">
                          <EvidenceGallery
                            orgId={project.organisation_ids[0]}
                            noteId={note.id}
                            projectId={projectId}
                          />
                          <EvidenceUploader
                            orgId={project.organisation_ids[0]}
                            projectId={projectId}
                            linkType="note"
                            linkId={note.id}
                            onUploadSuccess={loadData}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {/* New Note */}
              <div className="bg-neutral-800/50 border border-neutral-700 rounded p-3">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Add a new note..."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                  rows={4}
                />
                <button
                  onClick={() => handleSaveNote()}
                  className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                >
                  Add Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="text-sm text-neutral-400">
            Showing {transactions.length} transactions for this trip
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Date</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Description</th>
                  <th className="text-right py-2 px-2 text-neutral-400 font-medium">Amount</th>
                  <th className="text-left py-2 px-2 text-neutral-400 font-medium">Category</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    onClick={() => setSelectedTransaction(transaction)}
                    className="border-b border-neutral-800 hover:bg-neutral-800/50 cursor-pointer"
                  >
                    <td className="py-2 px-2 text-neutral-300">{formatDate(transaction.booking_date)}</td>
                    <td className="py-2 px-2 text-white">{transaction.description || 'No description'}</td>
                    <td className={`py-2 px-2 text-right font-medium ${
                      transaction.direction === 'in' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {transaction.direction === 'in' ? '+' : ''}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </td>
                    <td className="py-2 px-2 text-neutral-300">{transaction.category || 'uncategorised'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'evidence' && project.organisation_ids && project.organisation_ids[0] && (
        <div className="space-y-4">
          <EvidenceGallery
            orgId={project.organisation_ids[0]}
            projectId={projectId}
          />
          <EvidenceUploader
            orgId={project.organisation_ids[0]}
            projectId={projectId}
            onUploadSuccess={loadData}
          />
        </div>
      )}

      {activeTab === 'reimbursement' && (
        <div className="space-y-4">
          <ReimbursementSummary transactions={transactions} />
        </div>
      )}

      {/* Transaction Drawer */}
      {selectedTransaction && (
        <TransactionDrawer
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          categories={[]}
        />
      )}
    </div>
  );
}

