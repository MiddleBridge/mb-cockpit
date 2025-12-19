'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import * as evidenceDb from '@/lib/db/evidence';
import type { EvidenceWithLinks } from '@/lib/db/evidence';

interface EvidenceUploaderProps {
  orgId: string;
  projectId: string;
  linkType?: 'transaction' | 'note';
  linkId?: string;
  onUploadSuccess?: (evidence: EvidenceWithLinks) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

export default function EvidenceUploader({
  orgId,
  projectId,
  linkType,
  linkId,
  onUploadSuccess,
  onUploadError,
  className = '',
}: EvidenceUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.some(type => file.type.startsWith(type.split('/')[0]) || file.type === type)) {
      onUploadError?.('Invalid file type. Please upload PDF, images, or documents.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgId', orgId);
      formData.append('projectId', projectId);
      if (linkType && linkId) {
        formData.append('linkType', linkType);
        formData.append('linkId', linkId);
      }

      const response = await fetch('/api/evidence/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      
      // Fetch full evidence with links
      const evidence = await evidenceDb.getEvidenceByProject(projectId);
      const uploaded = evidence.find(e => e.id === result.evidence.id);
      
      if (uploaded) {
        onUploadSuccess?.(uploaded);
      }
    } catch (error: any) {
      console.error('Error uploading evidence:', error);
      onUploadError?.(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }, [orgId, projectId, linkType, linkId, onUploadSuccess, onUploadError]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  // Handle paste from clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1 || item.type.indexOf('application') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleUpload(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleUpload]);

  return (
    <div className={className}>
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-4 transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-900/20' : 'border-neutral-700 bg-neutral-800/50'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-neutral-600'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          disabled={uploading}
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
        />
        
        <div className="text-center">
          {uploading ? (
            <div className="text-sm text-neutral-400">Uploading...</div>
          ) : (
            <>
              <div className="text-sm text-neutral-400 mb-2">
                Drag & drop files here, or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  browse
                </button>
                {' '}or paste (Ctrl+V)
              </div>
              <div className="text-xs text-neutral-500">
                PDF, images, documents
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

