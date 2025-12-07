"use client";

import { useState, useEffect, useRef } from "react";
import type { TimelineItem } from "../../lib/db/timeline";
import { formatDistanceToNow, format } from "date-fns";

interface TimelineProps {
  organisationId: string;
  contactId?: string;
}

export default function Timeline({ organisationId, contactId }: TimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteBody, setNoteBody] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const loadItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ organisationId });
      if (contactId) {
        params.append("contactId", contactId);
      }
      const response = await fetch(`/api/timeline?${params.toString()}`);
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error("Error loading timeline items:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [organisationId, contactId]);

  const handleAddNote = async () => {
    if (!noteBody.trim()) return;

    try {
      const response = await fetch("/api/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId,
          contactId,
          type: "note",
          title: noteTitle.trim() || "Note",
          body: noteBody.trim(),
        }),
      });

      if (response.ok) {
        setNoteBody("");
        setNoteTitle("");
        await loadItems();
      }
    } catch (error) {
      console.error("Error adding note:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("organisationId", organisationId);
      if (contactId) {
        formData.append("contactId", contactId);
      }

      const response = await fetch("/api/timeline/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await loadItems();
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setUploadingFile(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const formatFullDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "PPp");
    } catch {
      return dateString;
    }
  };

  const getGmailUrl = (messageId: string) => {
    return `https://mail.google.com/mail/u/0/#inbox/${messageId}`;
  };

  if (loading) {
    return (
      <div className="text-neutral-400 text-sm py-4">Loading timeline...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900">
        <div className="space-y-2">
          <input
            ref={noteInputRef}
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Note title (optional)"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          />
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleAddNote();
              }
            }}
            placeholder="Add a note..."
            rows={3}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600 resize-none"
          />
          <div className="flex items-center justify-between">
            <button
              onClick={handleAddNote}
              disabled={!noteBody.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Note
            </button>
            <span className="text-xs text-neutral-500">
              Press Cmd/Ctrl + Enter to save
            </span>
          </div>
        </div>
      </div>

      {/* File upload */}
      <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900">
        <label className="block text-xs text-neutral-400 mb-2">
          Attach File
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            disabled={uploadingFile}
            className="flex-1 text-sm text-neutral-300 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-neutral-700 file:text-neutral-300 hover:file:bg-neutral-600 disabled:opacity-50"
          />
          {uploadingFile && (
            <span className="text-xs text-neutral-400">Uploading...</span>
          )}
        </div>
      </div>

      {/* Timeline items */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-sm">
            No timeline items yet. Add a note or upload a file to get started.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="border border-neutral-800 rounded-lg p-4 bg-neutral-900 hover:bg-neutral-800/50 transition-colors"
            >
              {/* Item header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {/* Type icon */}
                  {item.type === "note" && (
                    <span className="text-lg">📝</span>
                  )}
                  {item.type === "task" && (
                    <span className="text-lg">
                      {item.status === "done" ? "✅" : "☐"}
                    </span>
                  )}
                  {item.type === "email" && (
                    <span className="text-lg">📧</span>
                  )}
                  {item.type === "file" && (
                    <span className="text-lg">📄</span>
                  )}
                  {item.type === "meeting" && (
                    <span className="text-lg">📅</span>
                  )}

                  <h4 className="font-medium text-white text-sm">
                    {item.title}
                  </h4>

                  {item.type === "email" && item.direction && (
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        item.direction === "inbound"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-green-500/20 text-green-400"
                      }`}
                    >
                      {item.direction === "inbound" ? "Inbound" : "Outbound"}
                    </span>
                  )}

                  {item.type === "task" && item.status && (
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        item.status === "done"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {item.status === "open" ? "Open" : "Done"}
                    </span>
                  )}
                </div>

                <div className="text-xs text-neutral-500">
                  {formatDate(item.happened_at)}
                </div>
              </div>

              {/* Item body */}
              {item.body && (
                <p className="text-sm text-neutral-300 mb-2 whitespace-pre-wrap">
                  {item.body}
                </p>
              )}

              {/* Attachments */}
              {item.attachments && item.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {item.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-2 py-1 bg-neutral-800 text-blue-400 hover:text-blue-300 text-xs rounded"
                    >
                      <span>📎</span>
                      <span>{attachment.file_name}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Email actions */}
              {item.type === "email" && item.external_id && (
                <div className="mt-2">
                  <a
                    href={getGmailUrl(item.external_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Open in Gmail →
                  </a>
                </div>
              )}

              {/* File actions */}
              {item.type === "file" && item.attachments && item.attachments.length > 0 && (
                <div className="mt-2">
                  <a
                    href={item.attachments[0].file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Open file →
                  </a>
                </div>
              )}

              {/* Full timestamp on hover */}
              <div className="mt-2 text-xs text-neutral-500">
                {formatFullDate(item.happened_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

