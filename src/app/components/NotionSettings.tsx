"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface NotionConnection {
  id: string;
  user_email: string;
  workspace_id: string;
  workspace_name: string | null;
  notion_parent_id: string | null;
  notion_parent_type: 'database' | 'data_source' | null;
  created_at: string;
}

export default function NotionSettings() {
  const [userEmail, setUserEmail] = useState<string>('');
  const [connection, setConnection] = useState<NotionConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [parentId, setParentId] = useState('');
  const [parentType, setParentType] = useState<'database' | 'data_source'>('database');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Get user email (adapt to your auth system)
    const email = localStorage.getItem('userEmail') || '';
    setUserEmail(email);
    
    if (email) {
      loadConnection(email);
    } else {
      setLoading(false);
    }
  }, []);

  const loadConnection = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('notion_connections')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading connection:', error);
      } else if (data) {
        setConnection(data);
        setParentId(data.notion_parent_id || '');
        setParentType(data.notion_parent_type || 'database');
      }
    } catch (error) {
      console.error('Error loading Notion connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!userEmail) {
      alert('Please set userEmail first');
      return;
    }

    setConnecting(true);
    try {
      window.location.href = `/api/notion/oauth/start?userEmail=${encodeURIComponent(userEmail)}`;
    } catch (error) {
      console.error('Error starting OAuth:', error);
      alert('Failed to start Notion connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Notion?')) {
      return;
    }

    try {
      const response = await fetch('/api/notion/oauth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnection(null);
      setParentId('');
      alert('Notion disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting:', error);
      alert('Failed to disconnect Notion');
    }
  };

  const handleSaveParent = async () => {
    if (!connection || !parentId.trim()) {
      alert('Please enter a database or data source ID');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notion_connections')
        .update({
          notion_parent_id: parentId.trim(),
          notion_parent_type: parentType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      if (error) throw error;

      setConnection({ ...connection, notion_parent_id: parentId.trim(), notion_parent_type: parentType });
      alert('Parent configuration saved');
    } catch (error) {
      console.error('Error saving parent:', error);
      alert('Failed to save parent configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-neutral-400 text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Notion Integration</h2>

      {!connection ? (
        <div className="space-y-3">
          <p className="text-neutral-400 text-sm">
            Connect your Notion workspace to create and sync notes for MB Cockpit entities.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting || !userEmail}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? 'Connecting...' : 'Connect Notion'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-neutral-800 rounded border border-neutral-700">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-white font-medium">
                  {connection.workspace_name || 'Notion Workspace'}
                </div>
                <div className="text-neutral-400 text-xs mt-1">
                  Workspace ID: {connection.workspace_id}
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Disconnect
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Notion Database or Data Source ID
              </label>
              <p className="text-xs text-neutral-500 mb-2">
                This is where MB Cockpit will create new Notion pages. You can find the ID in your Notion database URL.
              </p>
              <div className="flex gap-2">
                <select
                  value={parentType}
                  onChange={(e) => setParentType(e.target.value as 'database' | 'data_source')}
                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white text-sm"
                >
                  <option value="database">Database</option>
                  <option value="data_source">Data Source</option>
                </select>
                <input
                  type="text"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  placeholder="Enter database or data source ID"
                  className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white text-sm"
                />
                <button
                  onClick={handleSaveParent}
                  disabled={saving || !parentId.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {!connection.notion_parent_id && (
              <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded text-sm text-yellow-200">
                <strong>Setup required:</strong> Please configure a Notion database or data source ID above to enable creating notes from MB Cockpit.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Check for OAuth callback success/error */}
      {typeof window !== 'undefined' && (
        <OAuthCallbackHandler onConnectionUpdate={loadConnection} />
      )}
    </div>
  );
}

function OAuthCallbackHandler({ onConnectionUpdate }: { onConnectionUpdate: (email: string) => void }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notionConnected = params.get('notion_connected');
    const notionError = params.get('notion_error');

    if (notionConnected) {
      const email = localStorage.getItem('userEmail') || '';
      if (email) {
        onConnectionUpdate(email);
      }
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (notionError) {
      alert(`Notion connection error: ${notionError}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [onConnectionUpdate]);

  return null;
}

