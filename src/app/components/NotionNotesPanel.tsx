"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface NotionLink {
  id: string;
  notion_page_id: string;
  notion_url: string;
  last_synced_at: string | null;
}

interface EntityNote {
  id: string;
  title: string | null;
  content_markdown: string;
  content_text: string;
  notion_page_id: string;
  notion_last_edited_time: string | null;
  updated_at: string;
}

interface NotionNotesPanelProps {
  userEmail: string;
  mbEntityType: 'contact' | 'organisation' | 'project' | 'document';
  mbEntityId: string;
  entityName?: string;
}

export default function NotionNotesPanel({
  userEmail,
  mbEntityType,
  mbEntityId,
  entityName,
}: NotionNotesPanelProps) {
  const [link, setLink] = useState<NotionLink | null>(null);
  const [notes, setNotes] = useState<EntityNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showParentConfig, setShowParentConfig] = useState(false);
  const [parentId, setParentId] = useState('');
  const [parentType, setParentType] = useState<'database' | 'data_source'>('database');
  const [savingParent, setSavingParent] = useState(false);

  useEffect(() => {
    if (userEmail && mbEntityId) {
      loadLinkAndNotes();
    }
  }, [userEmail, mbEntityType, mbEntityId]);

  const loadLinkAndNotes = async () => {
    try {
      // Load link
      const { data: linkData } = await supabase
        .from('notion_links')
        .select('id, notion_page_id, notion_url, last_synced_at')
        .eq('user_email', userEmail)
        .eq('mb_entity_type', mbEntityType)
        .eq('mb_entity_id', mbEntityId)
        .single();

      if (linkData) {
        setLink(linkData);

        // Load notes for this page
        const { data: notesData } = await supabase
          .from('entity_notes')
          .select('*')
          .eq('user_email', userEmail)
          .eq('notion_page_id', linkData.notion_page_id)
          .order('updated_at', { ascending: false });

        if (notesData) {
          setNotes(notesData);
        }
      }
    } catch (error) {
      console.error('Error loading Notion link:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!userEmail) {
      alert('User email required');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/notion/create-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          mbEntityType,
          mbEntityId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        // If parent not configured, show config form
        if (error.error?.includes('parent not configured')) {
          setShowParentConfig(true);
          return;
        }
        throw new Error(error.error || 'Failed to create note');
      }

      const data = await response.json();
      window.open(data.notionUrl, '_blank');
      
      // Reload link
      await loadLinkAndNotes();
    } catch (error: any) {
      console.error('Error creating note:', error);
      alert(error.message || 'Failed to create Notion note');
    } finally {
      setCreating(false);
    }
  };

  const handleSyncNow = async () => {
    if (!link) return;

    setSyncing(true);
    try {
      const response = await fetch('/api/notion/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          notionPageId: link.notion_page_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync');
      }

      // Wait a bit then reload
      setTimeout(() => {
        loadLinkAndNotes();
      }, 2000);
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync. The sync job has been enqueued and will run shortly.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 border border-neutral-800 rounded bg-neutral-900">
        <div className="text-neutral-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-neutral-800 rounded bg-neutral-900">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Notion Notes</h3>
        {link && (
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-white rounded disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>

      {showParentConfig ? (
        <div className="space-y-3">
          <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded text-sm text-yellow-200">
            <strong>Konfiguracja wymagana:</strong> Musisz najpierw skonfigurować Notion database lub data source.
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-300">
              Typ
            </label>
            <select
              value={parentType}
              onChange={(e) => setParentType(e.target.value as 'database' | 'data_source')}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white text-sm"
            >
              <option value="database">Database</option>
              <option value="data_source">Data Source</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-300">
              Database/Data Source ID
            </label>
            <input
              type="text"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="Wklej ID z URL Notion database"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white text-sm"
            />
            <p className="text-xs text-neutral-500">
              ID znajdziesz w URL: notion.so/workspace/DATABASE_ID?v=...
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!parentId.trim()) {
                  alert('Wprowadź Database/Data Source ID');
                  return;
                }
                setSavingParent(true);
                try {
                  const { supabase } = await import('@/lib/supabase');
                  const { error } = await supabase
                    .from('notion_connections')
                    .update({
                      notion_parent_id: parentId.trim(),
                      notion_parent_type: parentType,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('user_email', userEmail);
                  
                  if (error) throw error;
                  
                  setShowParentConfig(false);
                  setParentId('');
                  alert('Konfiguracja zapisana! Możesz teraz utworzyć notatkę.');
                } catch (err: any) {
                  alert('Błąd zapisu: ' + err.message);
                } finally {
                  setSavingParent(false);
                }
              }}
              disabled={savingParent || !parentId.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
            >
              {savingParent ? 'Zapisywanie...' : 'Zapisz i kontynuuj'}
            </button>
            <button
              onClick={() => {
                setShowParentConfig(false);
                setParentId('');
              }}
              className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-sm"
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : !link ? (
        <div className="space-y-3">
          <p className="text-neutral-400 text-sm">
            Create a Notion page for this {mbEntityType} to start taking notes.
          </p>
          <button
            onClick={handleCreateNote}
            disabled={creating}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Notion Note'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <a
              href={link.notion_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Open in Notion →
            </a>
            {link.last_synced_at && (
              <span className="text-xs text-neutral-500">
                Last synced: {new Date(link.last_synced_at).toLocaleString()}
              </span>
            )}
          </div>

          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="p-3 bg-neutral-800 rounded border border-neutral-700">
                  {note.title && (
                    <h4 className="text-sm font-medium text-white mb-2">{note.title}</h4>
                  )}
                  <div className="text-xs text-neutral-300 whitespace-pre-wrap">
                    {note.content_text.substring(0, 500)}
                    {note.content_text.length > 500 && '...'}
                  </div>
                  {note.notion_last_edited_time && (
                    <div className="text-xs text-neutral-500 mt-2">
                      Last edited: {new Date(note.notion_last_edited_time).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-neutral-400 text-sm">
              No notes synced yet. Click "Sync Now" to fetch content from Notion.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

