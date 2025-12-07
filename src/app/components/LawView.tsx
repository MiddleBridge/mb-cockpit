"use client";

import { useState, useEffect } from "react";
import * as lawNotesDb from "../../lib/db/law_notes";
import { format } from "date-fns";

// Document types matching DocumentsView
const DOCUMENT_TYPES = [
  "NDA",
  "Invoice",
  "One-pager",
  "Marketing materials",
  "Contract",
  "Offer",
  "Proposal",
  "Report",
  "Presentation",
  "Agreement",
  "Other"
];

export default function LawView() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [createdDate, setCreatedDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load note from database on mount
  useEffect(() => {
    async function loadNote() {
      setIsLoading(true);
      const savedNote = await lawNotesDb.getLawNote();
      if (savedNote) {
        setTitle(savedNote.title || "");
        setContent(savedNote.content || "");
        setDocumentType(savedNote.document_type || "");
        setCreatedDate(savedNote.created_at || new Date().toISOString());
      } else {
        // If no note exists, set today's date
        setCreatedDate(new Date().toISOString());
      }
      setIsLoading(false);
    }
    loadNote();
  }, []);

  // Handle save button click
  const handleSave = async () => {
    setIsSaving(true);
    const success = await lawNotesDb.saveLawNote({
      title,
      content,
      document_type: documentType
    });
    setIsSaving(false);
    
    if (success) {
      // Collapse the note after successful save
      setIsExpanded(false);
    }
  };

  const formattedDate = createdDate 
    ? format(new Date(createdDate), "dd.MM.yyyy")
    : format(new Date(), "dd.MM.yyyy");

  const hasNote = title.trim().length > 0 || content.trim().length > 0 || documentType.length > 0;

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">Law Notes</h2>
        <p className="text-sm text-neutral-400">
          Dodaj notatkę z tytułem, typem dokumentu i treścią.
        </p>
      </div>

      <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900">
        {/* Header with title (always visible) and expand/collapse button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            {title ? (
              <span className="text-white font-medium">{title}</span>
            ) : (
              <span className="text-neutral-400 font-medium">Nowa notatka</span>
            )}
            {hasNote && (
              <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded">
                {formattedDate}
                {documentType && ` • ${documentType}`}
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-neutral-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 py-4 border-t border-neutral-800 bg-neutral-950 space-y-4">
            {isLoading ? (
              <div className="text-neutral-400 text-sm">Loading...</div>
            ) : (
              <>
                {/* Title - always visible */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">
                    Tytuł notatki
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Wpisz tytuł notatki..."
                    className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>

                {/* Date and Document Type row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">
                      Data dodania
                    </label>
                    <div className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-neutral-300">
                      {formattedDate}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">
                      Rodzaj dokumentu
                    </label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    >
                      <option value="">Wybierz rodzaj dokumentu...</option>
                      {DOCUMENT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Content area - empty initially */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">
                    Treść notatki
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Wpisz treść notatki..."
                    className="w-full h-96 p-4 text-sm text-neutral-300 bg-neutral-800/50 border border-neutral-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
                    style={{ minHeight: "300px" }}
                  />
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Zapisuję...
                      </>
                    ) : (
                      "Save note"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
