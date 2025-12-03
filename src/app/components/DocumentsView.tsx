"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useViewMode } from "../hooks/useViewMode";
import ViewModeToggle from "./ViewModeToggle";
import * as documentsDb from "../../lib/db/documents";
import * as contactsDb from "../../lib/db/contacts";
import * as organisationsDb from "../../lib/db/organisations";
import * as projectsDb from "../../lib/db/projects";
import * as storage from "../../lib/storage";
import { convertGoogleDocsUrl, isGoogleDocsUrl } from "../../lib/storage";
import type { Document } from "../../lib/db/documents";
import type { Contact } from "../../lib/db/contacts";
import type { Organisation } from "../../lib/db/organisations";
import type { Project } from "../../lib/db/projects";
import { format } from "date-fns";

// Predefined document types
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

export default function DocumentsView() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Array<{id: string, text: string, contactId: string, contactName: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    file_url: "",
    file_type: "",
    document_type: "",
    contact_id: "",
    organisation_id: "",
    notes: "",
    edit_url: "", // Original Google Docs edit URL
    google_docs_url: "", // Link to Google Docs where work is being done (for PDF files)
    project_id: "", // Link to project
    task_id: "", // Link to task (format: "contactId-taskId")
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterContact, setFilterContact] = useState<string>("");
  const [filterOrganisation, setFilterOrganisation] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ docId: string; field: string } | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    file_url: "",
    file_type: "",
    document_type: "",
    contact_id: "",
    organisation_id: "",
    notes: "",
    edit_url: "",
    google_docs_url: "",
    project_id: "",
    task_id: "",
  });
  const [inlineEditData, setInlineEditData] = useState<Record<string, {
    name?: string;
    file_url?: string;
    google_docs_url?: string;
    document_type?: string;
    contact_id?: string;
    organisation_id?: string;
    project_id?: string;
    task_id?: string;
    notes?: string;
  }>>({});
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
      const [docsData, contactsData, orgsData, projectsData] = await Promise.all([
        documentsDb.getDocuments(),
        contactsDb.getContacts(),
        organisationsDb.getOrganisations(),
        projectsDb.getProjects(),
      ]);
      setDocuments(docsData);
      setContacts(contactsData);
      setOrganisations(orgsData);
      // Filter only internal projects
      setProjects(projectsData.filter(p => p.project_type === 'internal'));
      
      // Extract only active (incomplete) tasks from contacts
      const allTasks: Array<{id: string, text: string, contactId: string, contactName: string}> = [];
      contactsData.forEach(contact => {
        if (contact.tasks && Array.isArray(contact.tasks)) {
          contact.tasks.forEach(task => {
            // Only include incomplete tasks
            if (!task.completed) {
              allTasks.push({
                id: `${contact.id}-${task.id}`,
                text: task.text || '',
                contactId: contact.id,
                contactName: contact.name,
              });
            }
          });
        }
      });
      setTasks(allTasks);
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
      document_type: formData.document_type || undefined,
      contact_id: formData.contact_id || undefined,
      organisation_id: formData.organisation_id || undefined,
      notes: formData.notes || undefined,
      edit_url: formData.edit_url || undefined,
      google_docs_url: formData.google_docs_url || undefined,
      project_id: formData.project_id || undefined,
      task_id: formData.task_id || undefined,
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
        google_docs_url: "",
        document_type: "",
        project_id: "",
        task_id: "",
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
      document_type: doc.document_type || "",
      contact_id: doc.contact_id || "",
      organisation_id: doc.organisation_id || "",
      notes: doc.notes || "",
      edit_url: doc.edit_url || "",
      google_docs_url: doc.google_docs_url || "",
      project_id: doc.project_id || "",
      task_id: doc.task_id || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingDocId(null);
    setEditFormData({
      name: "",
      file_url: "",
      file_type: "",
      document_type: "",
      contact_id: "",
      organisation_id: "",
      notes: "",
      edit_url: "",
      google_docs_url: "",
      project_id: "",
      task_id: "",
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
      document_type: editFormData.document_type || undefined,
      contact_id: editFormData.contact_id || undefined,
      organisation_id: editFormData.organisation_id || undefined,
      notes: editFormData.notes || undefined,
      edit_url: editFormData.edit_url || undefined,
      google_docs_url: editFormData.google_docs_url || undefined,
      project_id: editFormData.project_id || undefined,
      task_id: editFormData.task_id || undefined,
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
        <div className="border border-neutral-800 rounded-xl p-6 bg-neutral-900/80 backdrop-blur-sm space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wide mb-2">Document Information</label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Document name"
                    className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">File Type</label>
                  <input
                    type="text"
                    value={formData.file_type}
                    onChange={(e) => setFormData({ ...formData, file_type: e.target.value })}
                    placeholder="pdf, docx, etc."
                    className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">Document Type</label>
                  <select
                    value={formData.document_type}
                    onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                    className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  >
                    <option value="">Select document type...</option>
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wide mb-3">File Upload</label>
              
              {/* Drag and Drop Zone */}
              <div
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDragging
                    ? "border-blue-500 bg-blue-500/10 scale-[1.02]"
                    : "border-neutral-700/50 bg-neutral-800/30 hover:border-neutral-600/50 hover:bg-neutral-800/40"
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
              <div className="mt-3">
                <label className="block text-xs text-neutral-400 mb-1.5">
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
                  className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
                {isGoogleDocsUrl(formData.file_url) && (
                  <div className="text-xs text-blue-400 mt-1.5 flex items-center gap-1">
                    <span>✓</span> Google Docs link detected - will be converted to PDF export URL
                  </div>
                )}
                {formData.file_url && !formData.file_url.trim().match(/^https?:\/\/.+\..+/) && (
                  <div className="text-xs text-yellow-400 mt-1.5 flex items-center gap-1">
                    <span>⚠</span> URL appears incomplete. Please provide a complete file URL.
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-4 pt-2 border-t border-neutral-800/50">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wide mb-3">Link to Entities</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">Contact</label>
                  <select
                    value={formData.contact_id}
                    onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                    className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
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
                  <label className="block text-xs text-neutral-400 mb-1.5">Organisation</label>
                  <select
                    value={formData.organisation_id}
                    onChange={(e) => setFormData({ ...formData, organisation_id: e.target.value })}
                    className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  >
                    <option value="">None</option>
                    {organisations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">Project</label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  >
                    <option value="">None</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name || project.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">Task</label>
                  <select
                    value={formData.task_id}
                    onChange={(e) => setFormData({ ...formData, task_id: e.target.value })}
                    className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  >
                    <option value="">None</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.text} ({task.contactName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wide mb-3">Additional Information</label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">
                    Google Docs URL <span className="text-neutral-500">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={formData.google_docs_url}
                    onChange={(e) => setFormData({ ...formData, google_docs_url: e.target.value })}
                    placeholder="https://docs.google.com/document/d/..."
                    className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                  <div className="text-xs text-neutral-500 mt-1.5">
                    Link to the Google Docs document where you're working on this document
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                    className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-neutral-800/50">
            <button
              onClick={() => {
                setIsAdding(false);
                setFormData({
                  name: "",
                  file_url: "",
                  file_type: "",
                  document_type: "",
                  contact_id: "",
                  organisation_id: "",
                  notes: "",
                  edit_url: "",
                  google_docs_url: "",
                  project_id: "",
                  task_id: "",
                });
              }}
              className="px-5 py-2.5 border border-neutral-700/50 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800/50 hover:border-neutral-600 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!formData.name.trim() || !formData.file_url.trim() || uploading}
              className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-white/10"
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
            <div className="space-y-2">
              {filteredDocuments.map((doc) => {
                const contact = contacts.find((c) => c.id === doc.contact_id);
                const organisation = organisations.find((o) => o.id === doc.organisation_id);
                const project = projects.find((p) => p.id === doc.project_id);
                const task = tasks.find(t => t.id === doc.task_id);
                const taskContact = task ? contacts.find(c => c.id === task.contactId) : null;
                const isEditing = editingDocId === doc.id;
                const editData = inlineEditData[doc.id] || {};
                const isEditingField = editingField?.docId === doc.id;

                return (
                  <div
                    key={doc.id}
                    data-document-id={doc.id}
                    className="group border border-neutral-800/60 rounded-lg px-3 py-2 bg-gradient-to-r from-neutral-900/60 to-neutral-900/40 hover:from-neutral-900/80 hover:to-neutral-900/60 hover:border-neutral-700/60 transition-all"
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
                        <input
                          type="url"
                          value={editFormData.google_docs_url}
                          onChange={(e) => setEditFormData({ ...editFormData, google_docs_url: e.target.value })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
                          placeholder="Google Docs URL (optional)"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editFormData.contact_id}
                            onChange={(e) => setEditFormData({ ...editFormData, contact_id: e.target.value })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="">No Contact</option>
                            {contacts.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <select
                            value={editFormData.organisation_id}
                            onChange={(e) => setEditFormData({ ...editFormData, organisation_id: e.target.value })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="">No Organisation</option>
                            {organisations.map((o) => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editFormData.project_id}
                            onChange={(e) => setEditFormData({ ...editFormData, project_id: e.target.value })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="">No Project</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>{p.name || p.title}</option>
                            ))}
                          </select>
                          <select
                            value={editFormData.task_id}
                            onChange={(e) => setEditFormData({ ...editFormData, task_id: e.target.value })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="">No Task</option>
                            {tasks.map((t) => (
                              <option key={t.id} value={t.id}>{t.text} ({t.contactName})</option>
                            ))}
                          </select>
                        </div>
                        <select
                          value={editFormData.document_type}
                          onChange={(e) => setEditFormData({ ...editFormData, document_type: e.target.value })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                        >
                          <option value="">No Document Type</option>
                          {DOCUMENT_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
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
                      <div className="space-y-3">
                        {/* Header Row */}
                        <div className="flex items-start gap-3">
                          <span className="text-xl flex-shrink-0 mt-0.5">{getFileIcon(doc.file_type)}</span>
                          <div className="flex-1 min-w-0">
                            {isEditingField && editingField.field === 'name' ? (
                              <input
                                type="text"
                                value={editData.name ?? doc.name}
                                onChange={(e) => setInlineEditData(prev => ({
                                  ...prev,
                                  [doc.id]: { ...prev[doc.id], name: e.target.value }
                                }))}
                                onBlur={async () => {
                                  if (editData.name && editData.name !== doc.name) {
                                    await documentsDb.updateDocument(doc.id, { name: editData.name });
                                    // Update local state instead of reloading everything
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, name: editData.name ?? d.name } : d
                                    ));
                                  }
                                  setEditingField(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                  else if (e.key === 'Escape') {
                                    setInlineEditData(prev => {
                                      const newData = { ...prev };
                                      delete newData[doc.id]?.name;
                                      return newData;
                                    });
                                    setEditingField(null);
                                  }
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/50 border border-blue-500/50 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              />
                            ) : (
                              <div
                                onClick={() => setEditingField({ docId: doc.id, field: 'name' })}
                                className="text-sm font-semibold text-white hover:underline cursor-pointer transition-colors"
                                title="Click to edit"
                              >
                                {doc.name}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {doc.file_type && (
                                <span className="px-1.5 py-0.5 bg-neutral-800/60 text-neutral-300 rounded text-[10px] font-medium">
                                  {doc.file_type.toUpperCase()}
                                </span>
                              )}
                              {doc.created_at && (
                                <span className="text-[10px] text-neutral-500">
                                  {format(new Date(doc.created_at), "MMM d, yyyy")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {doc.edit_url && (
                              <a
                                href={doc.edit_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
                                title="Edit in Google Docs"
                              >
                                ✏️
                              </a>
                            )}
                            {doc.google_docs_url && !doc.edit_url && (
                              <a
                                href={doc.google_docs_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
                                title="Open in Google Docs"
                              >
                                📝
                              </a>
                            )}
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10 transition-colors"
                              title="Open file"
                            >
                              🔗
                            </a>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="text-sm text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                              title="Delete"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800/50">
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Contact</label>
                            {isEditingField && editingField.field === 'contact_id' ? (
                              <select
                                data-doc-id={doc.id}
                                data-field="contact_id"
                                value={editData.contact_id !== undefined ? editData.contact_id : (doc.contact_id ?? '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], contact_id: e.target.value }
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={async (e) => {
                                  e.stopPropagation();
                                  const newValue = (e.target as HTMLSelectElement).value || undefined;
                                  const currentValue = doc.contact_id || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { contact_id: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, contact_id: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].contact_id;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                              >
                                <option value="">None</option>
                                {contacts.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      contact_id: doc.contact_id || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'contact_id' });
                                  // Auto-open select after it renders
                                  setTimeout(() => {
                                    const select = document.querySelector(`select[data-doc-id="${doc.id}"][data-field="contact_id"]`) as HTMLSelectElement;
                                    if (select) {
                                      select.focus();
                                      select.click();
                                    }
                                  }, 50);
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  contact 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title="Click to edit"
                              >
                                {contact ? contact.name : 'Click to add'}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Organisation</label>
                            {isEditingField && editingField.field === 'organisation_id' ? (
                              <select
                                data-doc-id={doc.id}
                                data-field="organisation_id"
                                value={editData.organisation_id !== undefined ? editData.organisation_id : (doc.organisation_id ?? '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], organisation_id: e.target.value }
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={async (e) => {
                                  e.stopPropagation();
                                  const newValue = (e.target as HTMLSelectElement).value || undefined;
                                  const currentValue = doc.organisation_id || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { organisation_id: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, organisation_id: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].organisation_id;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                              >
                                <option value="">None</option>
                                {organisations.map(o => (
                                  <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      organisation_id: doc.organisation_id || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'organisation_id' });
                                  // Auto-open select after it renders
                                  setTimeout(() => {
                                    const select = document.querySelector(`select[data-doc-id="${doc.id}"][data-field="organisation_id"]`) as HTMLSelectElement;
                                    if (select) {
                                      select.focus();
                                      select.click();
                                    }
                                  }, 50);
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  organisation 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title="Click to edit"
                              >
                                {organisation ? organisation.name : 'Click to add'}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Project</label>
                            {isEditingField && editingField.field === 'project_id' ? (
                              <select
                                data-doc-id={doc.id}
                                data-field="project_id"
                                value={editData.project_id !== undefined ? editData.project_id : (doc.project_id ?? '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], project_id: e.target.value }
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={async (e) => {
                                  e.stopPropagation();
                                  const newValue = (e.target as HTMLSelectElement).value || undefined;
                                  const currentValue = doc.project_id || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { project_id: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, project_id: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].project_id;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                              >
                                <option value="">None</option>
                                {projects.map(p => (
                                  <option key={p.id} value={p.id}>{p.name || p.title}</option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      project_id: doc.project_id || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'project_id' });
                                  // Auto-open select after it renders
                                  setTimeout(() => {
                                    const select = document.querySelector(`select[data-doc-id="${doc.id}"][data-field="project_id"]`) as HTMLSelectElement;
                                    if (select) {
                                      select.focus();
                                      select.click();
                                    }
                                  }, 50);
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  project 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title="Click to edit"
                              >
                                {project ? (project.name || project.title) : 'Click to add'}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Task</label>
                            {isEditingField && editingField.field === 'task_id' ? (
                              <select
                                data-doc-id={doc.id}
                                data-field="task_id"
                                value={editData.task_id !== undefined ? editData.task_id : (doc.task_id ?? '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], task_id: e.target.value }
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={async (e) => {
                                  e.stopPropagation();
                                  const newValue = (e.target as HTMLSelectElement).value || undefined;
                                  const currentValue = doc.task_id || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { task_id: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, task_id: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].task_id;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                              >
                                <option value="">None</option>
                                {tasks.map(t => (
                                  <option key={t.id} value={t.id}>{t.text} ({t.contactName})</option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      task_id: doc.task_id || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'task_id' });
                                  // Auto-open select after it renders
                                  setTimeout(() => {
                                    const select = document.querySelector(`select[data-doc-id="${doc.id}"][data-field="task_id"]`) as HTMLSelectElement;
                                    if (select) {
                                      select.focus();
                                      select.click();
                                    }
                                  }, 50);
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  task 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title={task ? `${task.text} - ${taskContact?.name || ''}` : 'Click to assign task'}
                              >
                                {task ? (
                                  <div>
                                    <div className="font-medium">{task.text}</div>
                                    {taskContact && <div className="text-xs text-neutral-400 mt-0.5">from {taskContact.name}</div>}
                                  </div>
                                ) : (
                                  'Click to add'
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Document Type and Google Docs URL */}
                        <div className="pt-4 border-t border-neutral-800/50 space-y-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Document Type</label>
                            {isEditingField && editingField.field === 'document_type' ? (
                              <select
                                data-doc-id={doc.id}
                                data-field="document_type"
                                value={editData.document_type !== undefined ? editData.document_type : (doc.document_type ?? '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], document_type: e.target.value }
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={async (e) => {
                                  e.stopPropagation();
                                  const newValue = (e.target as HTMLSelectElement).value || undefined;
                                  const currentValue = doc.document_type || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { document_type: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, document_type: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].document_type;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                              >
                                <option value="">None</option>
                                {DOCUMENT_TYPES.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      document_type: doc.document_type || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'document_type' });
                                  // Auto-open select after it renders
                                  setTimeout(() => {
                                    const select = document.querySelector(`select[data-doc-id="${doc.id}"][data-field="document_type"]`) as HTMLSelectElement;
                                    if (select) {
                                      select.focus();
                                      select.click();
                                    }
                                  }, 50);
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  doc.document_type 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title="Click to edit"
                              >
                                {doc.document_type ? doc.document_type : 'Click to add'}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Google Docs</label>
                            {isEditingField && editingField.field === 'google_docs_url' ? (
                              <input
                                type="url"
                                value={editData.google_docs_url ?? doc.google_docs_url ?? ''}
                                onChange={(e) => setInlineEditData(prev => ({
                                  ...prev,
                                  [doc.id]: { ...prev[doc.id], google_docs_url: e.target.value }
                                }))}
                                onBlur={async (e) => {
                                  const newValue = e.currentTarget.value || undefined;
                                  const currentValue = doc.google_docs_url || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { google_docs_url: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, google_docs_url: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].google_docs_url;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                  else if (e.key === 'Escape') {
                                    setInlineEditData(prev => {
                                      const newData = { ...prev };
                                      delete newData[doc.id]?.google_docs_url;
                                      return newData;
                                    });
                                    setEditingField(null);
                                  }
                                }}
                                autoFocus
                                placeholder="https://docs.google.com/document/d/..."
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800 placeholder:text-neutral-500"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      google_docs_url: doc.google_docs_url || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'google_docs_url' });
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  doc.google_docs_url 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title={doc.google_docs_url ? "Click to edit" : "Click to add Google Docs link"}
                              >
                                {doc.google_docs_url ? (
                                  <a
                                    href={doc.google_docs_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-green-400 hover:text-green-300 break-all"
                                  >
                                    {doc.google_docs_url}
                                  </a>
                                ) : (
                                  'Click to add'
                                )}
                              </div>
                            )}
                          </div>
                          {doc.notes && (
                            <div>
                              <label className="text-[10px] text-neutral-500 uppercase tracking-wide font-semibold block mb-1">Notes</label>
                              {isEditingField && editingField.field === 'notes' ? (
                                <textarea
                                  value={editData.notes ?? doc.notes ?? ''}
                                  onChange={(e) => setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], notes: e.target.value }
                                  }))}
                                  onBlur={async () => {
                                    if (editData.notes !== doc.notes) {
                                      await documentsDb.updateDocument(doc.id, { notes: editData.notes || undefined });
                                      // Update local state instead of reloading everything
                                      setDocuments(prev => prev.map(d => 
                                        d.id === doc.id ? { ...d, notes: editData.notes || undefined } : d
                                      ));
                                    }
                                    setEditingField(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      setInlineEditData(prev => {
                                        const newData = { ...prev };
                                        delete newData[doc.id]?.notes;
                                        return newData;
                                      });
                                      setEditingField(null);
                                    }
                                  }}
                                  autoFocus
                                  rows={2}
                                  className="w-full bg-neutral-800/50 border border-blue-500/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                />
                              ) : (
                                <div
                                  onDoubleClick={() => setEditingField({ docId: doc.id, field: 'notes' })}
                                  className="text-xs text-neutral-300 whitespace-pre-wrap cursor-text"
                                >
                                  {doc.notes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === "list" && (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => {
                const contact = contacts.find((c) => c.id === doc.contact_id);
                const organisation = organisations.find((o) => o.id === doc.organisation_id);
                const project = projects.find((p) => p.id === doc.project_id);
                const task = tasks.find(t => t.id === doc.task_id);
                const taskContact = task ? contacts.find(c => c.id === task.contactId) : null;
                const isEditing = editingDocId === doc.id;
                const editData = inlineEditData[doc.id] || {};
                const isEditingField = editingField?.docId === doc.id;

                return (
                  <div
                    key={doc.id}
                    data-document-id={doc.id}
                    className="group border border-neutral-800/60 rounded-xl p-4 bg-gradient-to-br from-neutral-900/60 to-neutral-900/40 hover:from-neutral-900/80 hover:to-neutral-900/60 hover:border-neutral-700/60 transition-all shadow-sm hover:shadow-md"
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
                        <input
                          type="url"
                          value={editFormData.google_docs_url}
                          onChange={(e) => setEditFormData({ ...editFormData, google_docs_url: e.target.value })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
                          placeholder="Google Docs URL (optional)"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editFormData.contact_id}
                            onChange={(e) => setEditFormData({ ...editFormData, contact_id: e.target.value })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="">No Contact</option>
                            {contacts.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <select
                            value={editFormData.organisation_id}
                            onChange={(e) => setEditFormData({ ...editFormData, organisation_id: e.target.value })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="">No Organisation</option>
                            {organisations.map((o) => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editFormData.project_id}
                            onChange={(e) => setEditFormData({ ...editFormData, project_id: e.target.value })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="">No Project</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>{p.name || p.title}</option>
                            ))}
                          </select>
                          <select
                            value={editFormData.task_id}
                            onChange={(e) => setEditFormData({ ...editFormData, task_id: e.target.value })}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="">No Task</option>
                            {tasks.map((t) => (
                              <option key={t.id} value={t.id}>{t.text} ({t.contactName})</option>
                            ))}
                          </select>
                        </div>
                        <select
                          value={editFormData.document_type}
                          onChange={(e) => setEditFormData({ ...editFormData, document_type: e.target.value })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                        >
                          <option value="">No Document Type</option>
                          {DOCUMENT_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
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
                      <div className="space-y-3">
                        {/* Header with icon and name */}
                        <div className="flex items-start gap-3">
                          <span className="text-2xl flex-shrink-0 mt-0.5">{getFileIcon(doc.file_type)}</span>
                          <div className="flex-1 min-w-0">
                            {isEditingField && editingField.field === 'name' ? (
                              <input
                                type="text"
                                value={editData.name ?? doc.name}
                                onChange={(e) => setInlineEditData(prev => ({
                                  ...prev,
                                  [doc.id]: { ...prev[doc.id], name: e.target.value }
                                }))}
                                onBlur={async () => {
                                  if (editData.name && editData.name !== doc.name) {
                                    await documentsDb.updateDocument(doc.id, { name: editData.name });
                                    // Update local state instead of reloading everything
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, name: editData.name ?? d.name } : d
                                    ));
                                  }
                                  setEditingField(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  } else if (e.key === 'Escape') {
                                    setInlineEditData(prev => {
                                      const newData = { ...prev };
                                      delete newData[doc.id]?.name;
                                      return newData;
                                    });
                                    setEditingField(null);
                                  }
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/50 border border-blue-500/50 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              />
                            ) : (
                              <div
                                onClick={() => setEditingField({ docId: doc.id, field: 'name' })}
                                className="text-base font-semibold text-white hover:underline cursor-pointer transition-colors"
                              >
                                {doc.name}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {doc.file_type && (
                                <span className="px-2 py-0.5 bg-neutral-800/60 text-neutral-300 rounded text-xs font-medium">
                                  {doc.file_type.toUpperCase()}
                                </span>
                              )}
                              {doc.created_at && (
                                <span className="text-xs text-neutral-500">
                                  {format(new Date(doc.created_at), "MMM d, yyyy")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {doc.edit_url && (
                              <a
                                href={doc.edit_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
                                title="Edit in Google Docs"
                              >
                                ✏️
                              </a>
                            )}
                            {doc.google_docs_url && !doc.edit_url && (
                              <a
                                href={doc.google_docs_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
                                title="Open in Google Docs"
                              >
                                📝
                              </a>
                            )}
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10 transition-colors"
                              title="Open file"
                            >
                              🔗
                            </a>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="text-sm text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                              title="Delete"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800/50">
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Contact</label>
                            {isEditingField && editingField.field === 'contact_id' ? (
                              <select
                                data-doc-id={doc.id}
                                data-field="contact_id"
                                value={editData.contact_id !== undefined ? editData.contact_id : (doc.contact_id ?? '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], contact_id: e.target.value }
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={async (e) => {
                                  e.stopPropagation();
                                  const newValue = (e.target as HTMLSelectElement).value || undefined;
                                  const currentValue = doc.contact_id || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { contact_id: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, contact_id: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].contact_id;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                              >
                                <option value="">None</option>
                                {contacts.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      contact_id: doc.contact_id || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'contact_id' });
                                  // Auto-open select after it renders
                                  setTimeout(() => {
                                    const select = document.querySelector(`select[data-doc-id="${doc.id}"][data-field="contact_id"]`) as HTMLSelectElement;
                                    if (select) {
                                      select.focus();
                                      select.click();
                                    }
                                  }, 50);
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  contact 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title="Click to edit"
                              >
                                {contact ? contact.name : 'Click to add'}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Organisation</label>
                            {isEditingField && editingField.field === 'organisation_id' ? (
                              <select
                                data-doc-id={doc.id}
                                data-field="organisation_id"
                                value={editData.organisation_id !== undefined ? editData.organisation_id : (doc.organisation_id ?? '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], organisation_id: e.target.value }
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={async (e) => {
                                  e.stopPropagation();
                                  const newValue = (e.target as HTMLSelectElement).value || undefined;
                                  const currentValue = doc.organisation_id || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { organisation_id: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, organisation_id: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].organisation_id;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                              >
                                <option value="">None</option>
                                {organisations.map(o => (
                                  <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      organisation_id: doc.organisation_id || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'organisation_id' });
                                  // Auto-open select after it renders
                                  setTimeout(() => {
                                    const select = document.querySelector(`select[data-doc-id="${doc.id}"][data-field="organisation_id"]`) as HTMLSelectElement;
                                    if (select) {
                                      select.focus();
                                      select.click();
                                    }
                                  }, 50);
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  organisation 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title="Click to edit"
                              >
                                {organisation ? organisation.name : 'Click to add'}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Project</label>
                            {isEditingField && editingField.field === 'project_id' ? (
                              <select
                                data-doc-id={doc.id}
                                data-field="project_id"
                                value={editData.project_id !== undefined ? editData.project_id : (doc.project_id ?? '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], project_id: e.target.value }
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={async (e) => {
                                  e.stopPropagation();
                                  const newValue = (e.target as HTMLSelectElement).value || undefined;
                                  const currentValue = doc.project_id || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { project_id: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, project_id: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].project_id;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                              >
                                <option value="">None</option>
                                {projects.map(p => (
                                  <option key={p.id} value={p.id}>{p.name || p.title}</option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      project_id: doc.project_id || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'project_id' });
                                  // Auto-open select after it renders
                                  setTimeout(() => {
                                    const select = document.querySelector(`select[data-doc-id="${doc.id}"][data-field="project_id"]`) as HTMLSelectElement;
                                    if (select) {
                                      select.focus();
                                      select.click();
                                    }
                                  }, 50);
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  project 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title="Click to edit"
                              >
                                {project ? (project.name || project.title) : 'Click to add'}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Task</label>
                            {isEditingField && editingField.field === 'task_id' ? (
                              <select
                                data-doc-id={doc.id}
                                data-field="task_id"
                                value={editData.task_id !== undefined ? editData.task_id : (doc.task_id ?? '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], task_id: e.target.value }
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={async (e) => {
                                  e.stopPropagation();
                                  const newValue = (e.target as HTMLSelectElement).value || undefined;
                                  const currentValue = doc.task_id || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { task_id: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, task_id: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].task_id;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                              >
                                <option value="">None</option>
                                {tasks.map(t => (
                                  <option key={t.id} value={t.id}>{t.text} ({t.contactName})</option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      task_id: doc.task_id || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'task_id' });
                                  // Auto-open select after it renders
                                  setTimeout(() => {
                                    const select = document.querySelector(`select[data-doc-id="${doc.id}"][data-field="task_id"]`) as HTMLSelectElement;
                                    if (select) {
                                      select.focus();
                                      select.click();
                                    }
                                  }, 50);
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  task 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title={task ? `${task.text} - ${taskContact?.name || ''}` : 'Click to assign task'}
                              >
                                {task ? (
                                  <div>
                                    <div className="font-medium">{task.text}</div>
                                    {taskContact && <div className="text-xs text-neutral-400 mt-0.5">from {taskContact.name}</div>}
                                  </div>
                                ) : (
                                  'Click to add'
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Document Type and Google Docs URL */}
                        <div className="pt-4 border-t border-neutral-800/50 space-y-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Document Type</label>
                            {isEditingField && editingField.field === 'document_type' ? (
                              <select
                                data-doc-id={doc.id}
                                data-field="document_type"
                                value={editData.document_type !== undefined ? editData.document_type : (doc.document_type ?? '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: { ...prev[doc.id], document_type: e.target.value }
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={async (e) => {
                                  e.stopPropagation();
                                  const newValue = (e.target as HTMLSelectElement).value || undefined;
                                  const currentValue = doc.document_type || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { document_type: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, document_type: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].document_type;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                autoFocus
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                              >
                                <option value="">None</option>
                                {DOCUMENT_TYPES.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            ) : (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      document_type: doc.document_type || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'document_type' });
                                  // Auto-open select after it renders
                                  setTimeout(() => {
                                    const select = document.querySelector(`select[data-doc-id="${doc.id}"][data-field="document_type"]`) as HTMLSelectElement;
                                    if (select) {
                                      select.focus();
                                      select.click();
                                    }
                                  }, 50);
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  doc.document_type 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title="Click to edit"
                              >
                                {doc.document_type ? doc.document_type : 'Click to add'}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400 uppercase tracking-wider font-medium block">Google Docs</label>
                            {isEditingField && editingField.field === 'google_docs_url' ? (
                              <input
                                type="url"
                                value={editData.google_docs_url ?? doc.google_docs_url ?? ''}
                                onChange={(e) => setInlineEditData(prev => ({
                                  ...prev,
                                  [doc.id]: { ...prev[doc.id], google_docs_url: e.target.value }
                                }))}
                                onBlur={async (e) => {
                                  const newValue = e.currentTarget.value || undefined;
                                  const currentValue = doc.google_docs_url || undefined;
                                  
                                  if (newValue !== currentValue) {
                                    await documentsDb.updateDocument(doc.id, { google_docs_url: newValue });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, google_docs_url: newValue } : d
                                    ));
                                  }
                                  
                                  // Clear editing state and inline edit data
                                  setEditingField(null);
                                  setInlineEditData(prev => {
                                    const newData = { ...prev };
                                    if (newData[doc.id]) {
                                      delete newData[doc.id].google_docs_url;
                                      if (Object.keys(newData[doc.id]).length === 0) {
                                        delete newData[doc.id];
                                      }
                                    }
                                    return newData;
                                  });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                  else if (e.key === 'Escape') {
                                    setInlineEditData(prev => {
                                      const newData = { ...prev };
                                      delete newData[doc.id]?.google_docs_url;
                                      return newData;
                                    });
                                    setEditingField(null);
                                  }
                                }}
                                autoFocus
                                placeholder="https://docs.google.com/document/d/..."
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800 placeholder:text-neutral-500"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  // Initialize editData with current value
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      google_docs_url: doc.google_docs_url || ''
                                    }
                                  }));
                                  setEditingField({ docId: doc.id, field: 'google_docs_url' });
                                }}
                                className={`text-sm py-2 px-3 rounded-md transition-all cursor-pointer ${
                                  doc.google_docs_url 
                                    ? 'bg-neutral-800/40 text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/50' 
                                    : 'bg-neutral-800/20 text-neutral-500 italic hover:bg-neutral-800/40 border border-dashed border-neutral-700/30'
                                }`}
                                title={doc.google_docs_url ? "Click to edit" : "Click to add Google Docs link"}
                              >
                                {doc.google_docs_url ? (
                                  <a
                                    href={doc.google_docs_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-green-400 hover:text-green-300 break-all"
                                  >
                                    {doc.google_docs_url}
                                  </a>
                                ) : (
                                  'Click to add'
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Notes */}
                        {doc.notes && (
                          <div className="pt-2 border-t border-neutral-800/50 space-y-2">
                            {doc.google_docs_url && (
                              <div>
                                <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold block mb-1">Google Docs</label>
                                {isEditingField && editingField.field === 'google_docs_url' ? (
                                  <input
                                    type="url"
                                    value={editData.google_docs_url ?? doc.google_docs_url ?? ''}
                                    onChange={(e) => setInlineEditData(prev => ({
                                      ...prev,
                                      [doc.id]: { ...prev[doc.id], google_docs_url: e.target.value }
                                    }))}
                                    onBlur={async (e) => {
                                      const newValue = e.currentTarget.value || undefined;
                                      const currentValue = doc.google_docs_url || undefined;
                                      
                                      if (newValue !== currentValue) {
                                        await documentsDb.updateDocument(doc.id, { google_docs_url: newValue });
                                        // Update local state
                                        setDocuments(prev => prev.map(d => 
                                          d.id === doc.id ? { ...d, google_docs_url: newValue } : d
                                        ));
                                      }
                                      
                                      // Clear editing state and inline edit data
                                      setEditingField(null);
                                      setInlineEditData(prev => {
                                        const newData = { ...prev };
                                        if (newData[doc.id]) {
                                          delete newData[doc.id].google_docs_url;
                                          if (Object.keys(newData[doc.id]).length === 0) {
                                            delete newData[doc.id];
                                          }
                                        }
                                        return newData;
                                      });
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      } else if (e.key === 'Escape') {
                                        setInlineEditData(prev => {
                                          const newData = { ...prev };
                                          delete newData[doc.id]?.google_docs_url;
                                          return newData;
                                        });
                                        setEditingField(null);
                                      }
                                    }}
                                    autoFocus
                                    className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
                                  />
                                ) : (
                                  <a
                                    href={doc.google_docs_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setEditingField({ docId: doc.id, field: 'google_docs_url' });
                                    }}
                                    className="text-sm text-green-400 hover:text-green-300 break-all"
                                  >
                                    {doc.google_docs_url}
                                  </a>
                                )}
                              </div>
                            )}
                            {doc.notes && (
                              <div>
                                <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold block mb-1">Notes</label>
                                {isEditingField && editingField.field === 'notes' ? (
                                  <textarea
                                    value={editData.notes ?? doc.notes ?? ''}
                                    onChange={(e) => setInlineEditData(prev => ({
                                      ...prev,
                                      [doc.id]: { ...prev[doc.id], notes: e.target.value }
                                    }))}
                                    onBlur={async () => {
                                      if (editData.notes !== doc.notes) {
                                        await documentsDb.updateDocument(doc.id, { notes: editData.notes || undefined });
                                        await loadData();
                                      }
                                      setEditingField(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        setInlineEditData(prev => {
                                          const newData = { ...prev };
                                          delete newData[doc.id]?.notes;
                                          return newData;
                                        });
                                        setEditingField(null);
                                      }
                                    }}
                                    autoFocus
                                    rows={3}
                                    className="w-full bg-neutral-800/50 border border-blue-500/50 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                  />
                                ) : (
                                  <div
                                    onDoubleClick={() => setEditingField({ docId: doc.id, field: 'notes' })}
                                    className="text-sm text-neutral-300 whitespace-pre-wrap cursor-text"
                                  >
                                    {doc.notes}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
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
                    data-document-id={doc.id}
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
                              className="text-sm font-medium text-white hover:underline truncate block cursor-pointer"
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

