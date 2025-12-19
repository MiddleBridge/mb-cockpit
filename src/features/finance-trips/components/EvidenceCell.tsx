'use client';

import { useState, useEffect } from 'react';
import * as tripEvidenceDb from '../db/trip-evidence';
import type { FinanceTripEvidence } from '../db/trips';
import EvidenceUploader from './EvidenceUploader';

interface EvidenceCellProps {
  tripItemId: string;
  tripId: string;
  orgId: string;
  onUpdate: () => void;
}

export default function EvidenceCell({ tripItemId, tripId, orgId, onUpdate }: EvidenceCellProps) {
  const [evidence, setEvidence] = useState<FinanceTripEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewEvidence, setPreviewEvidence] = useState<FinanceTripEvidence | null>(null);

  useEffect(() => {
    loadEvidence();
  }, [tripItemId]);

  const loadEvidence = async () => {
    setLoading(true);
    try {
      const data = await tripEvidenceDb.getTripEvidenceByItem(tripItemId);
      setEvidence(data);
    } catch (error) {
      console.error('Error loading evidence:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (ev: FinanceTripEvidence) => {
    try {
      const response = await fetch(`/api/trip-evidence/signed-url?path=${encodeURIComponent(ev.storage_path)}`);
      if (response.ok) {
        const data = await response.json();
        setPreviewUrl(data.url);
        setPreviewEvidence(ev);
      }
    } catch (error) {
      console.error('Error getting signed URL:', error);
    }
  };

  const handleDelete = async (evidenceId: string) => {
    if (!confirm('Delete this evidence?')) return;
    
    const success = await tripEvidenceDb.deleteTripEvidence(evidenceId);
    if (success) {
      await loadEvidence();
      onUpdate();
    }
  };

  const isImage = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  if (loading) {
    return <span className="text-xs text-neutral-500">Loading...</span>;
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {evidence.length > 0 && (
          <span className="text-xs text-neutral-400">({evidence.length})</span>
        )}
        <button
          onClick={() => setShowUploader(!showUploader)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {evidence.length === 0 ? 'Attach' : 'Manage'}
        </button>
      </div>

      {/* Uploader panel */}
      {showUploader && (
        <div className="absolute top-full left-0 z-50 mt-2 bg-neutral-900 border border-neutral-700 rounded-lg p-4 min-w-[300px] shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-white">Evidence</h4>
            <button
              onClick={() => setShowUploader(false)}
              className="text-neutral-400 hover:text-white text-lg"
            >
              ×
            </button>
          </div>
          
          <EvidenceUploader
            tripId={tripId}
            tripItemId={tripItemId}
            orgId={orgId}
            onUploadSuccess={() => {
              loadEvidence();
              onUpdate();
            }}
          />

          {evidence.length > 0 && (
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
              {evidence.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between bg-neutral-800/50 rounded p-2">
                  <button
                    onClick={() => handlePreview(ev)}
                    className="flex-1 text-left text-xs text-white hover:text-blue-400 truncate"
                  >
                    {ev.file_name}
                  </button>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    className="ml-2 text-xs text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && previewEvidence && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setPreviewUrl(null);
            setPreviewEvidence(null);
          }}
        >
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">{previewEvidence.file_name}</h3>
              <button
                onClick={() => {
                  setPreviewUrl(null);
                  setPreviewEvidence(null);
                }}
                className="text-neutral-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            {isImage(previewEvidence.mime_type) ? (
              <img src={previewUrl} alt={previewEvidence.file_name} className="max-w-full" />
            ) : (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                Open in new tab
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

