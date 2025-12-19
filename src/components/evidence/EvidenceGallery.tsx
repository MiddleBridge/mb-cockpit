'use client';

import { useState, useEffect } from 'react';
import * as evidenceDb from '@/lib/db/evidence';
import type { EvidenceWithLinks } from '@/lib/db/evidence';

interface EvidenceGalleryProps {
  orgId: string;
  projectId?: string;
  transactionId?: string;
  noteId?: string;
  onDelete?: (evidenceId: string) => void;
  className?: string;
}

export default function EvidenceGallery({
  orgId,
  projectId,
  transactionId,
  noteId,
  onDelete,
  className = '',
}: EvidenceGalleryProps) {
  const [evidence, setEvidence] = useState<EvidenceWithLinks[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    loadEvidence();
  }, [projectId, transactionId, noteId]);

  const loadEvidence = async () => {
    setLoading(true);
    try {
      let items: EvidenceWithLinks[] = [];
      
      if (transactionId) {
        items = await evidenceDb.getEvidenceByTransaction(transactionId);
      } else if (noteId) {
        items = await evidenceDb.getEvidenceByNote(noteId);
      } else if (projectId) {
        items = await evidenceDb.getEvidenceByProject(projectId);
      }

      setEvidence(items);

      // Load signed URLs for all files
      const urlPromises = items.map(async (item) => {
        if (!item.storage_path) return [item.id, ''];
        try {
          const response = await fetch(`/api/evidence/signed-url?path=${encodeURIComponent(item.storage_path)}`);
          if (response.ok) {
            const data = await response.json();
            return [item.id, data.url];
          }
        } catch (error) {
          console.error('Error loading signed URL:', error);
        }
        return [item.id, ''];
      });

      const urls = await Promise.all(urlPromises);
      setImageUrls(Object.fromEntries(urls));
    } catch (error) {
      console.error('Error loading evidence:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (evidenceId: string) => {
    if (!confirm('Are you sure you want to delete this evidence?')) return;

    try {
      const success = await evidenceDb.deleteEvidence(evidenceId);
      if (success) {
        setEvidence(prev => prev.filter(e => e.id !== evidenceId));
        onDelete?.(evidenceId);
      }
    } catch (error) {
      console.error('Error deleting evidence:', error);
      alert('Failed to delete evidence');
    }
  };

  const isImage = (mimeType?: string) => {
    return mimeType?.startsWith('image/') || false;
  };

  if (loading) {
    return <div className={`text-sm text-neutral-400 ${className}`}>Loading evidence...</div>;
  }

  if (evidence.length === 0) {
    return <div className={`text-sm text-neutral-500 ${className}`}>No evidence attached</div>;
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${className}`}>
      {evidence.map((item) => {
        const url = imageUrls[item.id];
        const image = isImage(item.mime_type);

        return (
          <div key={item.id} className="relative group">
            {image && url ? (
              <img
                src={url}
                alt={item.file_name}
                className="w-full h-32 object-cover rounded border border-neutral-700"
              />
            ) : (
              <div className="w-full h-32 bg-neutral-800 rounded border border-neutral-700 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl mb-1">📄</div>
                  <div className="text-xs text-neutral-400 truncate px-2">{item.file_name}</div>
                </div>
              </div>
            )}
            
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 rounded transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                  >
                    Open
                  </a>
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

