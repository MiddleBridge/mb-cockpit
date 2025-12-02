"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useViewMode } from "../hooks/useViewMode";
import ViewModeToggle from "./ViewModeToggle";
import * as documentsDb from "../../lib/db/documents";
import * as contactsDb from "../../lib/db/contacts";
import * as organisationsDb from "../../lib/db/organisations";
import * as storage from "../../lib/storage";
import { convertGoogleDocsUrl, isGoogleDocsUrl } from "../../lib/storage";
import type { Document } from "../../lib/db/documents";
import type { Contact } from "../../lib/db/contacts";
import type { Organisation } from "../../lib/db/organisations";
import { format } from "date-fns";

export default function DocumentsView() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    file_url: "",
    file_type: "",
    contact_id: "",
    organisation_id: "",
    notes: "",
    edit_url: "", // Original Google Docs edit URL
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterContact, setFilterContact] = useState<string>("");
  const [filterOrganisation, setFilterOrganisation] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    file_url: "",
    file_type: "",
    contact_id: "",
    organisation_id: "",
    notes: "",
    edit_url: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  // View mode
  const [viewMode, setViewMode] = useViewMode("documents");

  useEffect(() => {
    loadData();
    loadGooglePicker();
  }, []);

  // Load Google Picker API
  const loadGooglePicker = () => {
    if (typeof window !== 'undefined' && !(window as any).gapi) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        (window as any).gapi.load('picker', {});
      };
      document.body.appendChild(script);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [docsData, contactsData, orgsData] = await Promise.all([
        documentsDb.getDocuments(),
        contactsDb.getContacts(),
        organisationsDb.getOrganisations(),
      ]);
      setDocuments(docsData);
      setContacts(contactsData);
      setOrganisations(orgsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      alert("Please enter a document name");
      return;
    }

    if (!formData.file_url.trim()) {
      alert("Please provide a file URL or upload a file");
      return;
    }

    // Basic URL validation
    try {
      new URL(formData.file_url);
    } catch {
      alert("Please enter a valid file URL");
      return;
    }

    const newDocument = {
      name: formData.name,
      file_url: formData.file_url,
      file_type: formData.file_type || undefined,
      contact_id: formData.contact_id || undefined,
      organisation_id: formData.organisation_id || undefined,
      notes: formData.notes || undefined,
      edit_url: formData.edit_url || undefined,
    };

    const result = await documentsDb.createDocument(newDocument);
    if (result) {
      await loadData();
      setFormData({
        name: "",
        file_url: "",
        file_type: "",
        contact_id: "",
        organisation_id: "",
        notes: "",
        edit_url: "",
      });
      setIsAdding(false);
      // Notify other components
      window.dispatchEvent(new Event('documents-updated'));
    } else {
      alert("Failed to create document. Please try again.");
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      // Upload to Supabase Storage
      const uploadResult = await storage.uploadFile(file);
      
      if (uploadResult.error) {
        // Show more helpful error message
        const errorMsg = uploadResult.error.includes('Bucket') 
          ? `Upload failed: ${uploadResult.error}\n\nTo fix this:\n1. Go to Supabase Dashboard → Storage\n2. Click "New bucket"\n3. Name: "mb-cockpit"\n4. Make it Public\n5. Click "Create bucket"`
          : `Upload failed: ${uploadResult.error}`;
        
        alert(errorMsg);
        setUploading(false);
        setUploadProgress("");
        return;
      }

      // Auto-fill form with uploaded file info
      const fileType = storage.getFileType(file);
      setFormData((prev) => ({
        ...prev,
        name: prev.name || file.name,
        file_url: uploadResult.url,
        file_type: fileType,
      }));

      setUploadProgress(`Uploaded! URL: ${uploadResult.url}`);
      setTimeout(() => setUploadProgress(""), 3000);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Drag and drop handlers
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
      handleFileUpload(file);
    }
  }, []);

  // Google Drive Picker
  const handleGoogleDrivePick = () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!apiKey) {
      alert('Google API Key not configured. Please set NEXT_PUBLIC_GOOGLE_API_KEY in .env');
      return;
    }

    const gapi = (window as any).gapi;
    if (!gapi || !gapi.picker) {
      alert('Google Picker API not loaded. Please wait a moment and try again.');
      return;
    }

    const view = new gapi.picker.View(gapi.picker.ViewId.DOCS);
    view.setMimeTypes('application/pdf,application/vnd.google-apps.document,application/vnd.google-apps.spreadsheet');
    
    const picker = new gapi.picker.PickerBuilder()
      .enableFeature(gapi.picker.Feature.NAV_HIDDEN)
      .setOAuthToken('') // For public files, empty token works
      .addView(view)
      .setCallback((data: any) => {
        if (data[gapi.picker.Response.ACTION] === gapi.picker.Action.PICKED) {
          const doc = data[gapi.picker.Response.DOCUMENTS][0];
          const fileUrl = doc.url;
          const fileName = doc.name;
          const mimeType = doc.mimeType;

          // Convert Google Docs URL to export URL
          let exportUrl = fileUrl;
          if (mimeType === 'application/vnd.google-apps.document') {
            exportUrl = `https://docs.google.com/document/d/${doc.id}/export?format=pdf`;
          } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            exportUrl = `https://docs.google.com/spreadsheets/d/${doc.id}/export?format=xlsx`;
          }

          // Save original edit URL
          const editUrl = fileUrl; // Original Google Docs URL for editing

          setFormData((prev) => ({
            ...prev,
            name: prev.name || fileName,
            file_url: exportUrl || fileUrl,
            file_type: mimeType.includes('pdf') ? 'pdf' : mimeType.includes('document') ? 'docx' : 'xlsx',
            edit_url: editUrl, // Save original Google Docs URL
          }));
        }
      })
      .build();

    picker.setVisible(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      const success = await documentsDb.deleteDocument(id);
      if (success) {
        await loadData();
        // Notify other components
        window.dispatchEvent(new Event('documents-updated'));
      }
    }
  };

  const handleEdit = (doc: Document) => {
    setEditingDocId(doc.id);
    setEditFormData({
      name: doc.name,
      file_url: doc.file_url,
      file_type: doc.file_type || "",
      contact_id: doc.contact_id || "",
      organisation_id: doc.organisation_id || "",
      notes: doc.notes || "",
      edit_url: doc.edit_url || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingDocId(null);
    setEditFormData({
      name: "",
      file_url: "",
      file_type: "",
      contact_id: "",
      organisation_id: "",
      notes: "",
      edit_url: "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingDocId) return;

    if (!editFormData.name.trim()) {
      alert("Please enter a document name");
      return;
    }

    if (!editFormData.file_url.trim()) {
      alert("Please provide a file URL");
      return;
    }

    try {
      new URL(editFormData.file_url);
    } catch {
      alert("Please enter a valid file URL");
      return;
    }

    const updates = {
      name: editFormData.name,
      file_url: editFormData.file_url,
      file_type: editFormData.file_type || undefined,
      contact_id: editFormData.contact_id || undefined,
      organisation_id: editFormData.organisation_id || undefined,
      notes: editFormData.notes || undefined,
      edit_url: editFormData.edit_url || undefined,
    };

    const result = await documentsDb.updateDocument(editingDocId, updates);
    if (result) {
      await loadData();
      handleCancelEdit();
      // Notify other components
      window.dispatchEvent(new Event('documents-updated'));
    } else {
      alert("Failed to update document. Please try again.");
    }
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return "📄";
    const type = fileType.toLowerCase();
    if (type.includes("pdf")) return "📕";
    if (type.includes("word") || type.includes("doc")) return "📘";
    if (type.includes("excel") || type.includes("xls")) return "📗";
    if (type.includes("image")) return "🖼️";
    return "📄";
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    if (searchQuery && !doc.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterContact && doc.contact_id !== filterContact) {
      return false;
    }
    if (filterOrganisation && doc.organisation_id !== filterOrganisation) {
      return false;
    }
    return true;
  });

  if (loading) {
    return <div className="text-neutral-400 text-sm">Loading documents...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Documents</h3>
        <div className="flex items-center gap-2">
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          <button
            onClick={() => setIsAdding(true)}
            className="px-3 py-1.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-100 transition-colors"
          >
            + Add Document
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-900 space-y-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search documents..."
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterContact}
            onChange={(e) => setFilterContact(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
          >
            <option value="">All contacts</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
          <select
            value={filterOrganisation}
            onChange={(e) => setFilterOrganisation(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
          >
            <option value="">All organisations</option>
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isAdding && (
        <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900 space-y-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Document name"
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">File *</label>
            
            {/* Drag and Drop Zone */}
            <div
              ref={dropZoneRef}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-neutral-700 bg-neutral-800/50 hover:border-neutral-600"
              }`}
            >
              <div className="space-y-2">
                <div className="text-2xl">📎</div>
                <div className="text-sm text-neutral-400">
                  {isDragging ? "Drop file here" : "Drag and drop file here"}
                </div>
                <div className="text-xs text-neutral-500">or</div>
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Choose File
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleDrivePick}
                    disabled={uploading}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    📁 Google Drive
                  </button>
                </div>
                {uploadProgress && (
                  <div className="text-xs text-blue-400 mt-2">{uploadProgress}</div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                className="hidden"
                disabled={uploading}
              />
            </div>

            {/* File URL input (fallback) */}
            <div className="mt-2">
              <label className="block text-xs text-neutral-400 mb-1">
                Or enter URL manually (supports Google Docs links):
              </label>
              <input
                type="url"
                value={formData.file_url}
                onChange={(e) => {
                  let url = e.target.value;
                  const originalUrl = url; // Keep original for edit_url
                  
                  // Auto-convert Google Docs URLs
                  if (isGoogleDocsUrl(url)) {
                    url = convertGoogleDocsUrl(url, 'pdf');
                    // Auto-detect file type
                    const fileType = originalUrl.includes('spreadsheets') ? 'xlsx' : 
                                   originalUrl.includes('presentation') ? 'pptx' : 
                                   originalUrl.includes('document') ? 'pdf' : 'pdf';
                    setFormData({ 
                      ...formData, 
                      file_url: url,
                      file_type: fileType,
                      edit_url: originalUrl // Save original Google Docs URL for editing
                    });
                  } else {
                    setFormData({ ...formData, file_url: url, edit_url: '' });
                  }
                }}
                onBlur={(e) => {
                  // Convert on blur if it's a Google Docs URL
                  if (isGoogleDocsUrl(e.target.value)) {
                    const originalUrl = e.target.value;
                    const convertedUrl = convertGoogleDocsUrl(originalUrl, 'pdf');
                    if (convertedUrl !== originalUrl) {
                      setFormData((prev) => ({
                        ...prev,
                        file_url: convertedUrl,
                        edit_url: originalUrl // Save original for editing
                      }));
                    }
                  }
                }}
                placeholder="https://example.com/document.pdf or https://docs.google.com/document/d/..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
              {isGoogleDocsUrl(formData.file_url) && (
                <div className="text-xs text-blue-400 mt-1">
                  ✓ Google Docs link detected - will be converted to PDF export URL
                </div>
              )}
              {formData.file_url && !formData.file_url.trim().match(/^https?:\/\/.+\..+/) && (
                <div className="text-xs text-yellow-400 mt-1">
                  ⚠ URL appears incomplete. Please provide a complete file URL.
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">File Type</label>
            <input
              type="text"
              value={formData.file_type}
              onChange={(e) => setFormData({ ...formData, file_type: e.target.value })}
              placeholder="pdf, docx, etc."
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Contact (optional)</label>
              <select
                value={formData.contact_id}
                onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
              >
                <option value="">None</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Organisation (optional)</label>
              <select
                value={formData.organisation_id}
                onChange={(e) => setFormData({ ...formData, organisation_id: e.target.value })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
              >
                <option value="">None</option>
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600 resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setIsAdding(false);
                setFormData({
                  name: "",
                  file_url: "",
                  file_type: "",
                  contact_id: "",
                  organisation_id: "",
                  notes: "",
                  edit_url: "",
                });
              }}
              className="px-3 py-1.5 border border-neutral-700 rounded text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!formData.name.trim() || !formData.file_url.trim() || uploading}
              className="px-3 py-1.5 bg-white text-black rounded text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={
                !formData.name.trim() 
                  ? "Please enter document name" 
                  : !formData.file_url.trim() 
                  ? "Please provide file URL or upload a file" 
                  : uploading 
                  ? "Upload in progress..." 
                  : ""
              }
            >
              {uploading ? "Uploading..." : "Add Document"}
            </button>
          </div>
        </div>
      )}

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-8 text-neutral-400 text-sm">
          {documents.length === 0
            ? "No documents yet. Click 'Add Document' to get started."
            : "No documents match the filters."}
        </div>
      ) : (
        <>
          {viewMode === "compact" && (
            <div className="space-y-1">
              {filteredDocuments.map((doc) => {
                const contact = contacts.find((c) => c.id === doc.contact_id);
                const organisation = organisations.find((o) => o.id === doc.organisation_id);
                const isEditing = editingDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className="group border border-neutral-800 rounded px-2 py-1.5 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
                          placeholder="Name"
                        />
                        <input
                          type="url"
                          value={editFormData.file_url}
                          onChange={(e) => setEditFormData({ ...editFormData, file_url: e.target.value })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
                          placeholder="File URL"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="px-2 py-1 text-xs border border-neutral-700 rounded text-neutral-300 hover:bg-neutral-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={!editFormData.name.trim() || !editFormData.file_url.trim()}
                            className="px-2 py-1 text-xs bg-white text-black rounded disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm flex-shrink-0">{getFileIcon(doc.file_type)}</span>
                        <div className="flex-1 min-w-0">
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 truncate block"
                            title={doc.name}
                          >
                            {doc.name}
                          </a>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                            {doc.file_type && <span>{doc.file_type}</span>}
                            {contact && <span>👤 {contact.name}</span>}
                            {organisation && <span>🏢 {organisation.name}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {doc.edit_url && (
                            <a
                              href={doc.edit_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-green-400 hover:text-green-300"
                              title="Edit"
                            >
                              ✏️
                            </a>
                          )}
                          <button
                            onClick={() => handleEdit(doc)}
                            className="text-xs px-1.5 py-0.5 bg-blue-900/20 text-blue-400 rounded hover:bg-blue-900/40"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-xs px-1.5 py-0.5 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === "list" && (
            <div className="space-y-1">
              {filteredDocuments.map((doc) => {
                const contact = contacts.find((c) => c.id === doc.contact_id);
                const organisation = organisations.find((o) => o.id === doc.organisation_id);
                const isEditing = editingDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className="group border border-neutral-800 rounded px-2.5 py-2 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
                          placeholder="Name"
                        />
                        <input
                          type="url"
                          value={editFormData.file_url}
                          onChange={(e) => setEditFormData({ ...editFormData, file_url: e.target.value })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
                          placeholder="File URL"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="px-2 py-1 text-xs border border-neutral-700 rounded text-neutral-300 hover:bg-neutral-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={!editFormData.name.trim() || !editFormData.file_url.trim()}
                            className="px-2 py-1 text-xs bg-white text-black rounded disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-base flex-shrink-0">{getFileIcon(doc.file_type)}</span>
                        <div className="flex-1 min-w-0">
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-white hover:text-blue-400 truncate block"
                            title={doc.name}
                          >
                            {doc.name}
                          </a>
                          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                            {doc.file_type && (
                              <span className="px-1.5 py-0.5 bg-neutral-800/50 text-neutral-300 rounded text-[10px]">
                                {doc.file_type}
                              </span>
                            )}
                            {contact && <span>👤 {contact.name}</span>}
                            {organisation && <span>🏢 {organisation.name}</span>}
                            {doc.created_at && (
                              <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {doc.edit_url && (
                            <a
                              href={doc.edit_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-green-400 hover:text-green-300"
                              title="Edit"
                            >
                              ✏️
                            </a>
                          )}
                          <button
                            onClick={() => handleEdit(doc)}
                            className="text-xs px-1.5 py-0.5 bg-blue-900/20 text-blue-400 rounded hover:bg-blue-900/40"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-xs px-1.5 py-0.5 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === "grid" && (
            <div className="grid grid-cols-2 gap-2">
              {filteredDocuments.map((doc) => {
                const contact = contacts.find((c) => c.id === doc.contact_id);
                const organisation = organisations.find((o) => o.id === doc.organisation_id);
                const isEditing = editingDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className="group border border-neutral-800 rounded p-2 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          placeholder="Name"
                        />
                        <input
                          type="url"
                          value={editFormData.file_url}
                          onChange={(e) => setEditFormData({ ...editFormData, file_url: e.target.value })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          placeholder="File URL"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={handleCancelEdit}
                            className="px-1.5 py-0.5 text-[10px] border border-neutral-700 rounded text-neutral-300 hover:bg-neutral-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={!editFormData.name.trim() || !editFormData.file_url.trim()}
                            className="px-1.5 py-0.5 text-[10px] bg-white text-black rounded disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-lg flex-shrink-0">{getFileIcon(doc.file_type)}</span>
                          <div className="flex-1 min-w-0">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-white hover:text-blue-400 truncate block"
                              title={doc.name}
                            >
                              {doc.name}
                            </a>
                            {doc.file_type && (
                              <span className="text-[10px] text-neutral-500 mt-0.5 block">{doc.file_type}</span>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(doc)}
                              className="text-[10px] px-1 py-0.5 bg-blue-900/20 text-blue-400 rounded hover:bg-blue-900/40"
                              title="Edit"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="text-[10px] px-1 py-0.5 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40"
                              title="Delete"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {contact && <span>👤 {contact.name}</span>}
                          {organisation && <span className="ml-1">🏢 {organisation.name}</span>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

