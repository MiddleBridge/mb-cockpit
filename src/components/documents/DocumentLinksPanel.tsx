'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import * as documentsActions from '@/app/actions/documents';
import { supabase } from '@/lib/supabase';

interface DocumentLinksPanelProps {
  documentId: string;
  orgId: string;
}

export default function DocumentLinksPanel({ documentId, orgId }: DocumentLinksPanelProps) {
  const [links, setLinks] = useState<documentsActions.DocumentLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLinks();
  }, [documentId]);

  const loadLinks = async () => {
    try {
      setLoading(true);
      const documentLinks = await documentsActions.getDocumentLinks(documentId);
      setLinks(documentLinks);
    } catch (error) {
      console.error('Error loading document links:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDetach = async (linkId: string) => {
    if (!confirm('Detach this link?')) return;
    try {
      await documentsActions.softDeleteDocumentLink(orgId, linkId);
      loadLinks();
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      if (errorMsg.includes('ORG_REQUIRED') || errorMsg.includes('Wybierz organizację')) {
        alert('Błąd: ' + errorMsg + '\n\nNajpierw utwórz organizację w sekcji "Organisations".');
      } else {
        alert('Failed to detach link: ' + errorMsg);
      }
    }
  };

  const getEntityDisplayName = (link: documentsActions.DocumentLink): string => {
    switch (link.entityType) {
      case 'FINANCE_TRANSACTION':
        return `Transaction ${link.entityId.slice(0, 8)}...`;
      case 'INVOICE':
        return `Invoice ${link.entityId.slice(0, 8)}...`;
      case 'DEAL':
        return `Deal ${link.entityId.slice(0, 8)}...`;
      case 'ORGANISATION':
        return `Organisation ${link.entityId.slice(0, 8)}...`;
      case 'CONTACT':
        return `Contact ${link.entityId.slice(0, 8)}...`;
      case 'PROJECT':
        return `Project ${link.entityId.slice(0, 8)}...`;
      default:
        return `${link.entityType} ${link.entityId.slice(0, 8)}...`;
    }
  };

  const getEntityUrl = (link: documentsActions.DocumentLink): string | null => {
    // TODO: Implement navigation to entity based on type
    // For now, return null
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Linked To</h3>
      </div>

      {loading ? (
        <div className="text-xs text-neutral-400">Loading links...</div>
      ) : links.length === 0 ? (
        <div className="text-xs text-neutral-500">No links</div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const entityName = getEntityDisplayName(link);
            const entityUrl = getEntityUrl(link);
            const EntityComponent = entityUrl ? 'a' : 'div';

            return (
              <div
                key={link.id}
                className="flex items-start justify-between p-2 bg-neutral-900 rounded border border-neutral-800"
              >
                <div className="flex-1 min-w-0">
                  <EntityComponent
                    href={entityUrl || undefined}
                    target={entityUrl ? '_blank' : undefined}
                    rel={entityUrl ? 'noopener noreferrer' : undefined}
                    className={`text-xs font-medium ${
                      entityUrl
                        ? 'text-blue-400 hover:text-blue-300'
                        : 'text-white'
                    }`}
                  >
                    {link.entityType} - {entityName}
                  </EntityComponent>
                  <div className="flex items-center gap-2 mt-1">
                    {link.role !== 'SUPPORTING' && (
                      <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded">
                        {link.role}
                      </span>
                    )}
                    <span className="text-xs text-neutral-500">
                      {format(new Date(link.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {link.note && (
                    <div className="text-xs text-neutral-400 mt-1">{link.note}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDetach(link.id)}
                  className="ml-2 px-2 py-1 text-xs text-neutral-400 hover:text-red-400"
                  title="Detach"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

