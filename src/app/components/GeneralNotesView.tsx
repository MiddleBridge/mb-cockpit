"use client";

import { useState, useEffect } from "react";
import { useOrganisations } from "../hooks/useSharedLists";
import * as generalNotesDb from "../../lib/db/general_notes";
import { format } from "date-fns";

export default function GeneralNotesView() {
  const { organisations, loading: orgsLoading } = useOrganisations();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [notes, setNotes] = useState<generalNotesDb.GeneralNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  // Form state for creating/editing
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [tags, setTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (organisations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organisations[0].id);
    }
  }, [organisations]);

  useEffect(() => {
    if (selectedOrgId !== undefined) {
      loadNotes();
    }
  }, [selectedOrgId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await generalNotesDb.getGeneralNotes(selectedOrgId);
      setNotes(data);
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedNoteId(null);
    setTitle("");
    setContent("");
    setSource("");
    setTags("");
    setExpandedNoteIds(new Set());
  };

  const handleSave = async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      if (selectedNoteId) {
        // Update existing note
        await generalNotesDb.updateGeneralNote(selectedNoteId, {
          title: title.trim() || null,
          content: content.trim(),
          source: source.trim() || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          org_id: selectedOrgId,
        });
      } else {
        // Create new note
        await generalNotesDb.createGeneralNote({
          title: title.trim() || null,
          content: content.trim(),
          source: source.trim() || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          org_id: selectedOrgId,
        });
      }
      await loadNotes();
      handleCreateNew();
    } catch (error) {
      console.error("Error saving note:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę notatkę?")) return;

    const success = await generalNotesDb.deleteGeneralNote(noteId);
    if (success) {
      await loadNotes();
      if (selectedNoteId === noteId) {
        handleCreateNew();
      }
    }
  };

  const handleEdit = (note: generalNotesDb.GeneralNote) => {
    setSelectedNoteId(note.id);
    setTitle(note.title || "");
    setContent(note.content);
    setSource(note.source || "");
    setTags((note.tags || []).join(", "));
    setExpandedNoteIds(new Set([note.id]));
  };

  const toggleExpand = (noteId: string) => {
    const newExpanded = new Set(expandedNoteIds);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedNoteIds(newExpanded);
  };

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      !searchQuery ||
      note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSource = !sourceFilter || note.source === sourceFilter;

    return matchesSearch && matchesSource;
  });

  // Get unique sources for filter
  const uniqueSources = Array.from(
    new Set(notes.map((n) => n.source).filter(Boolean))
  ) as string[];

  const selectedNote = selectedNoteId
    ? notes.find((n) => n.id === selectedNoteId)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">General Notes</h2>
          <p className="text-sm text-neutral-400">
            Zapisuj notatki z książek, rady od osób, artykuły i inne źródła wiedzy.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {organisations.length > 0 && (
            <select
              value={selectedOrgId || ""}
              onChange={(e) => setSelectedOrgId(e.target.value || null)}
              className="text-sm bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
            >
              <option value="">All organisations</option>
              {organisations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            + New Note
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Szukaj w tytułach, treści, źródłach, tagach..."
          className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500"
        />
        {uniqueSources.length > 0 && (
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
          >
            <option value="">All sources</option>
            {uniqueSources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Notes List */}
        <div className="col-span-12 lg:col-span-5 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-neutral-400">Loading...</div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-12 bg-neutral-800/50 border border-neutral-700 rounded-lg">
              <p className="text-neutral-400 mb-4">Brak notatek</p>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
              >
                Utwórz pierwszą notatkę
              </button>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isExpanded = expandedNoteIds.has(note.id);
              const isSelected = selectedNoteId === note.id;
              return (
                <div
                  key={note.id}
                  className={`border border-neutral-700 rounded-lg overflow-hidden bg-neutral-900 ${
                    isSelected ? "ring-2 ring-blue-500" : ""
                  }`}
                >
                  <button
                    onClick={() => toggleExpand(note.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium truncate">
                          {note.title || "Bez tytułu"}
                        </span>
                        {note.source && (
                          <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded">
                            {note.source}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {note.created_at &&
                          format(new Date(note.created_at), "dd.MM.yyyy")}
                      </div>
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {note.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-xs text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <svg
                      className={`w-5 h-5 text-neutral-400 transition-transform flex-shrink-0 ml-2 ${
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

                  {isExpanded && (
                    <div className="px-4 py-3 border-t border-neutral-800 bg-neutral-950">
                      <div className="text-sm text-neutral-300 whitespace-pre-wrap break-words mb-3">
                        {note.content}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(note);
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(note.id);
                          }}
                          className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Editor Panel */}
        <div className="col-span-12 lg:col-span-7">
          <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900">
            <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950">
              <h3 className="text-white font-medium">
                {selectedNoteId ? "Edytuj notatkę" : "Nowa notatka"}
              </h3>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  Tytuł (opcjonalnie)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Krótki tytuł notatki..."
                  className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  Źródło (opcjonalnie)
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="np. Książka: XYZ, Osoba: Jan Kowalski, Artykuł: ..."
                  className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  Tagi (oddzielone przecinkami)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="np. biznes, marketing, strategia"
                  className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  Treść notatki *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Wpisz treść notatki..."
                  rows={15}
                  className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-3 text-sm text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {selectedNoteId && (
                  <button
                    onClick={handleCreateNew}
                    className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving || !content.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Zapisuję...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
