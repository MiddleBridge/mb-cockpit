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
import type { Document, InvoiceType } from "../../lib/db/documents";
import type { Contact } from "../../lib/db/contacts";
import type { Organisation } from "../../lib/db/organisations";
import type { Project } from "../../lib/db/projects";
import { format } from "date-fns";
import { getAvatarUrl } from "../../lib/avatar-utils";

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

// Get icon for document type
const getDocumentTypeIcon = (documentType?: string) => {
  if (!documentType) return "📄";
  const type = documentType.toLowerCase();
  if (type === "nda") return "🔒";
  if (type === "invoice") return "💰";
  if (type === "one-pager") return "📋";
  if (type === "marketing materials") return "📢";
  if (type === "contract") return "📝";
  if (type === "offer") return "💼";
  if (type === "proposal") return "📊";
  if (type === "report") return "📈";
  if (type === "presentation") return "📽️";
  if (type === "agreement") return "🤝";
  return "📄";
};

export default function DocumentsView() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Array<{id: string, text: string, contactId: string, contactName: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [invoiceTypeForModal, setInvoiceTypeForModal] = useState<InvoiceType | null>(null);
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
    invoice_type: null as InvoiceType | null,
    amount_original: "",
    currency: "",
    invoice_date: "",
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState<"all" | "income-expenses">("all");
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterContact, setFilterContact] = useState<string>("");
  const [filterOrganisation, setFilterOrganisation] = useState<string>("");
  const [filterDocumentType, setFilterDocumentType] = useState<string>("");
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
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gmail_user_email');
    }
    return null;
  });
  const [importingFromGmail, setImportingFromGmail] = useState(false);
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
    full_text?: string;
    summary?: string;
  }>>({});
  const [copyingToClipboard, setCopyingToClipboard] = useState<Record<string, boolean>>({});
  const [generatingSummary, setGeneratingSummary] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, { fullText: boolean; summary: boolean }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  // View mode
  const [viewMode, setViewMode] = useViewMode("documents");

  useEffect(() => {
    loadData();
    loadGooglePicker();
    
    // Check if we just returned from OAuth callback and should continue import
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('gmail_connected') === 'true') {
        const userEmailParam = params.get('userEmail');
        if (userEmailParam) {
          localStorage.setItem('gmail_user_email', userEmailParam);
          setUserEmail(userEmailParam);
          // Remove the parameter from URL
          params.delete('gmail_connected');
          params.delete('userEmail');
          const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
          window.history.replaceState({}, '', newUrl);
          
          // Check if we have pending import
          const pendingImport = localStorage.getItem('gmail_pending_import');
          const pendingEmail = localStorage.getItem('gmail_pending_email');
          
          if (pendingImport === 'true' && pendingEmail) {
            // Clear the flag
            localStorage.removeItem('gmail_pending_import');
            localStorage.removeItem('gmail_pending_email');
            // Wait a bit for token to be saved, then try import
            setTimeout(async () => {
              await performGmailImport(pendingEmail);
            }, 1500);
          }
        }
      }
    }
  }, []);

  const handleImportFromGmail = async () => {
    if (!userEmail || userEmail.trim() === '') {
      const email = prompt('Please enter your Gmail address:');
      if (!email || email.trim() === '') {
        return;
      }
      const trimmedEmail = email.trim();
      localStorage.setItem('gmail_user_email', trimmedEmail);
      setUserEmail(trimmedEmail);
      
      // performGmailImport will check connection and offer to connect if needed
      await performGmailImport(trimmedEmail);
    } else {
      // performGmailImport will check connection and offer to connect if needed
      await performGmailImport(userEmail);
    }
  };

  const connectGmailForUser = async (email: string): Promise<boolean> => {
    // Use backend OAuth flow which gives refresh_token
    // Redirect to /api/gmail/auth which will handle the OAuth flow
    // After callback, user will be redirected back and we can check connection
    window.location.href = `/api/gmail/auth?userEmail=${encodeURIComponent(email)}`;
    // Note: This will redirect, so the promise won't resolve until user comes back
    // The actual connection check will happen after redirect
    return false; // Will be handled by redirect
  };

  const performGmailImport = async (email: string) => {
    setImportingFromGmail(true);
    try {
      // First, check if Gmail is connected
      const checkResponse = await fetch(`/api/gmail/check-connection?userEmail=${encodeURIComponent(email)}`);
      let isConnected = false;
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        isConnected = checkData.connected || false;
      } else {
        const errorData = await checkResponse.json();
        console.error('❌ Error checking Gmail connection:', errorData);
        
        // If check failed, try debug endpoint
        const debugResponse = await fetch(`/api/gmail/debug?userEmail=${encodeURIComponent(email)}`);
        if (debugResponse.ok) {
          const debugData = await debugResponse.json();
          
          // Check if table doesn't exist
          if (debugData.checks?.gmail_credentials?.error?.code === 'PGRST116' || 
              debugData.checks?.gmail_credentials?.error?.message?.includes('does not exist')) {
            alert('Tabela gmail_credentials nie istnieje. Uruchom migrację w Supabase SQL Editor.');
            setImportingFromGmail(false);
            return;
          }
        }
      }

      // If not connected, automatically trigger connection flow
      if (!isConnected) {
        const shouldConnect = confirm('Gmail nie jest podłączony. Czy chcesz teraz podłączyć konto Google?\n\nPo kliknięciu "OK" otworzy się okno Google do autoryzacji. Po autoryzacji import rozpocznie się automatycznie.');
        if (!shouldConnect) {
          setImportingFromGmail(false);
          return;
        }
        
        // Store that we want to continue import after OAuth
        if (typeof window !== 'undefined') {
          localStorage.setItem('gmail_pending_import', 'true');
          localStorage.setItem('gmail_pending_email', email);
        }
        
        // Trigger connection - this will redirect to OAuth
        // After OAuth callback, useEffect will detect gmail_connected=true and continue import
        connectGmailForUser(email);
        setImportingFromGmail(false);
        return; // Will continue after redirect
      }

      // Step 1: Sync attachments
      const syncResponse = await fetch('/api/gmail/sync-attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email })
      });

      if (!syncResponse.ok) {
        const error = await syncResponse.json();
        console.error('❌ Sync error:', error);
        
        // Provide helpful error messages
        let errorMessage = error.details 
          ? `${error.error}: ${error.details}` 
          : error.error || 'Failed to sync Gmail attachments';
        
        // Check for specific error types
        if (error.details?.includes('gmail_credentials table does not exist')) {
          errorMessage = 'Tabela gmail_credentials nie istnieje. Uruchom migrację w Supabase SQL Editor.';
        } else if (error.details?.includes('Gmail not connected')) {
          errorMessage = 'Gmail is not connected. Click "Connect with Google" at the top of the page to connect your account.';
        } else if (error.details?.includes('gmail_messages table does not exist')) {
          errorMessage = 'Tabela gmail_messages nie istnieje. Uruchom migration-add-gmail-sync-tables.sql w Supabase SQL Editor.';
        } else if (error.details?.includes('gmail_attachments table does not exist')) {
          errorMessage = 'Tabela gmail_attachments nie istnieje. Uruchom migration-add-gmail-sync-tables.sql w Supabase SQL Editor.';
        }
        
        throw new Error(errorMessage);
      }

      const syncData = await syncResponse.json();
      
      // Step 2: Import attachments to documents
      const importResponse = await fetch('/api/gmail/import-attachments-to-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email })
      });

      if (!importResponse.ok) {
        const error = await importResponse.json();
        throw new Error(error.error || 'Failed to import attachments');
      }

      const importData = await importResponse.json();
      
      // Show success message with error details if any
      let message = `Synced ${syncData.messagesProcessed} emails with attachments, imported ${importData.documentsCreated} attachments as documents`;
      
      if (importData.errors && importData.errors.length > 0) {
        const errorCount = importData.errors.length;
        message += `\n\n⚠️ ${errorCount} attachment${errorCount !== 1 ? 's' : ''} failed to import.`;
        
        // Show first few errors in console
        console.error('Import errors:', importData.errors.slice(0, 5));
        if (errorCount > 5) {
          console.error(`... and ${errorCount - 5} more errors`);
        }
        
        // Show detailed error message if only a few errors
        if (errorCount <= 3) {
          const errorDetails = importData.errors.map((e: any) => 
            `- ${e.fileName || 'unknown'}: ${e.error}`
          ).join('\n');
          message += `\n\nErrors:\n${errorDetails}`;
        }
      }
      
      alert(message);
      
      // Reload documents
      await loadData();
      
      // Redirect to invoice classification view only if documents were created
      if (importData.documentsCreated > 0) {
        window.location.href = '/documents/invoices/import';
      }
    } catch (error: any) {
      console.error('Error importing from Gmail:', error);
      alert('Failed to import from Gmail: ' + (error.message || 'Unknown error'));
    } finally {
      setImportingFromGmail(false);
    }
  };

  // Initialize invoice_type when modal opens with invoice type
  useEffect(() => {
    if (isAdding && invoiceTypeForModal) {
      setFormData(prev => ({ ...prev, invoice_type: invoiceTypeForModal }));
    }
  }, [isAdding, invoiceTypeForModal]);

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
      // Auto-fill missing organisations from contacts
      const documentsToUpdate: Array<{ id: string; organisation_id: string }> = [];
      for (const doc of docsData) {
        // If document has contact but no organisation, try to get it from contact
        if (doc.contact_id && !doc.organisation_id) {
          const contact = contactsData.find(c => c.id === doc.contact_id);
          if (contact) {
            // Get organisation from contact (check both legacy field and new array)
            const contactOrgName = contact.organizations && contact.organizations.length > 0
              ? contact.organizations[0]
              : (contact.organization || null);
            
            if (contactOrgName) {
              let matchingOrg = orgsData.find(org => 
                org.name.toLowerCase() === contactOrgName.toLowerCase()
              );
              
              // If organisation doesn't exist, create it
              if (!matchingOrg) {
                console.log(`📝 Creating missing organisation "${contactOrgName}" from contact "${contact.name}"`);
                const newOrg = await organisationsDb.createOrganisation({
                  name: contactOrgName,
                  categories: [],
                  priority: 'mid',
                  status: 'ongoing'
                });
                if (newOrg) {
                  matchingOrg = newOrg;
                  // Reload organisations to include the new one
                  const updatedOrgs = await organisationsDb.getOrganisations();
                  setOrganisations(updatedOrgs);
                  orgsData.push(newOrg);
                  console.log(`✅ Created organisation "${contactOrgName}"`);
                }
              }
              
              if (matchingOrg) {
                documentsToUpdate.push({ id: doc.id, organisation_id: matchingOrg.id });
                console.log(`✅ Auto-filling organisation "${matchingOrg.name}" for document "${doc.name}" from contact "${contact.name}"`);
              }
            }
          }
        }
      }
      
      // Update documents with missing organisations
      if (documentsToUpdate.length > 0) {
        console.log(`🔄 Auto-updating ${documentsToUpdate.length} documents with organisations from contacts`);
        for (const update of documentsToUpdate) {
          await documentsDb.updateDocument(update.id, { organisation_id: update.organisation_id });
        }
        // Reload documents after updates
        const updatedDocs = await documentsDb.getDocuments();
        setDocuments(updatedDocs);
      } else {
        setDocuments(docsData);
      }
      
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

    // Validate invoice fields if invoice_type is set
    const invoiceType = invoiceTypeForModal || formData.invoice_type;
    if (invoiceType) {
      if (!formData.amount_original || parseFloat(formData.amount_original) <= 0) {
        alert("Please enter a valid amount");
        return;
      }
      if (!formData.currency) {
        alert("Please select a currency");
        return;
      }
      if (!formData.invoice_date) {
        alert("Please select an invoice date");
        return;
      }
    }

    // Calculate invoice_year and invoice_month from invoice_date
    let invoice_year: number | undefined = undefined;
    let invoice_month: number | undefined = undefined;
    if (formData.invoice_date) {
      const date = new Date(formData.invoice_date);
      invoice_year = date.getFullYear();
      invoice_month = date.getMonth() + 1; // getMonth() returns 0-11
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
      invoice_type: invoiceType || undefined,
      amount_original: invoiceType && formData.amount_original ? parseFloat(formData.amount_original) : undefined,
      currency: invoiceType && formData.currency ? formData.currency : undefined,
      amount_base: invoiceType && formData.amount_original ? parseFloat(formData.amount_original) : undefined, // For now same as original
      base_currency: invoiceType ? 'PLN' : undefined,
      invoice_date: invoiceType && formData.invoice_date ? formData.invoice_date : undefined,
      invoice_year: invoice_year,
      invoice_month: invoice_month,
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
        invoice_type: null,
        amount_original: "",
        currency: "",
        invoice_date: "",
      });
      setInvoiceTypeForModal(null);
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

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show brief success feedback (you could use a toast here)
      const originalText = document.activeElement?.textContent;
      // Visual feedback could be added here
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      alert('Failed to copy to clipboard');
    }
  };

  const handleGenerateSummary = async (docId: string) => {
    setGeneratingSummary(prev => ({ ...prev, [docId]: true }));
    try {
      const response = await fetch(`/api/documents/${docId}/summarize`, {
        method: 'POST',
      });
      if (response.ok) {
        await loadData();
      } else {
        const error = await response.json();
        alert('Failed to generate summary: ' + (error.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error generating summary:', err);
      alert('Failed to generate summary');
    } finally {
      setGeneratingSummary(prev => ({ ...prev, [docId]: false }));
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

  // Count documents by type
  const documentTypeCounts = DOCUMENT_TYPES.reduce((acc, type) => {
    acc[type] = documents.filter(doc => doc.document_type === type).length;
    return acc;
  }, {} as Record<string, number>);
  const otherCount = documents.filter(doc => !doc.document_type || !DOCUMENT_TYPES.includes(doc.document_type)).length;
  const totalCount = documents.length;

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
    if (filterDocumentType) {
      if (filterDocumentType === "Other") {
        if (doc.document_type && DOCUMENT_TYPES.includes(doc.document_type)) {
          return false;
        }
      } else {
        if (doc.document_type !== filterDocumentType) {
          return false;
        }
      }
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
            onClick={handleImportFromGmail}
            disabled={importingFromGmail}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importingFromGmail ? 'Importing...' : '📧 Import from Gmail'}
          </button>
          <button
            onClick={() => {
              setInvoiceTypeForModal(null);
              setIsAdding(true);
            }}
            className="px-3 py-1.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-100 transition-colors"
          >
            + Add Document
          </button>
          <button
            onClick={() => {
              setInvoiceTypeForModal('cost');
              setIsAdding(true);
            }}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            + Add Cost Invoice
          </button>
          <button
            onClick={() => {
              setInvoiceTypeForModal('revenue');
              setIsAdding(true);
            }}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            + Add Revenue Invoice
          </button>
        </div>
      </div>

      {/* Document type summary */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => setFilterDocumentType("")}
          className={`px-2 py-1 rounded transition-colors ${
            !filterDocumentType 
              ? 'bg-white text-black font-medium' 
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
        >
          All ({totalCount})
        </button>
        {DOCUMENT_TYPES.map(type => {
          const count = documentTypeCounts[type] || 0;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => setFilterDocumentType(filterDocumentType === type ? "" : type)}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                filterDocumentType === type 
                  ? 'bg-white text-black font-medium' 
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              <span>{getDocumentTypeIcon(type)}</span>
              <span>{type} ({count})</span>
            </button>
          );
        })}
        {otherCount > 0 && (
          <button
            onClick={() => setFilterDocumentType(filterDocumentType === "Other" ? "" : "Other")}
            className={`px-2 py-1 rounded transition-colors ${
              filterDocumentType === "Other" 
                ? 'bg-white text-black font-medium' 
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            Other ({otherCount})
          </button>
        )}
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
          {invoiceTypeForModal && (
            <div className="px-4 py-2 bg-blue-600/20 border border-blue-600/50 rounded-lg">
              <p className="text-sm text-blue-300">
                Creating {invoiceTypeForModal === 'cost' ? 'Cost' : 'Revenue'} Invoice
              </p>
            </div>
          )}
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

            {/* Finance Details - only show when invoice_type is set */}
            {(invoiceTypeForModal || formData.invoice_type) && (
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wide mb-3">Finance Details</label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">
                      Amount * <span className="text-neutral-500">({invoiceTypeForModal || formData.invoice_type === 'cost' ? 'Expense' : 'Income'})</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount_original}
                      onChange={(e) => setFormData({ ...formData, amount_original: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Currency *</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    >
                      <option value="">Select currency...</option>
                      <option value="PLN">PLN</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="SAR">SAR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Invoice Date *</label>
                    <input
                      type="date"
                      value={formData.invoice_date}
                      onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                      className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-neutral-800/50">
            <button
              onClick={() => {
                setIsAdding(false);
                setInvoiceTypeForModal(null);
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
                  invoice_type: null,
                  amount_original: "",
                  currency: "",
                  invoice_date: "",
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
              {uploading ? "Uploading..." : (invoiceTypeForModal ? `Add ${invoiceTypeForModal === 'cost' ? 'Cost' : 'Revenue'} Invoice` : "Add Document")}
            </button>
          </div>
        </div>
      )}

      {/* Summary bar for invoices */}
      {documents.some(d => d.invoice_type || d.tax_type) && (
        <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900 space-y-4 mb-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-neutral-400">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              {(() => {
                const currentYear = new Date().getFullYear();
                const years = new Set<number>();
                documents.forEach(doc => {
                  if (doc.invoice_year) years.add(doc.invoice_year);
                });
                if (years.size === 0) years.add(currentYear);
                const yearList = Array.from(years).sort((a, b) => b - a);
                if (!yearList.includes(currentYear)) yearList.unshift(currentYear);
                // Add a few years around current year if not present
                for (let i = currentYear - 2; i <= currentYear + 2; i++) {
                  if (!yearList.includes(i)) yearList.push(i);
                }
                return yearList.sort((a, b) => b - a).map(year => (
                  <option key={year} value={year}>{year}</option>
                ));
              })()}
            </select>
          </div>
          
          {/* Monthly income/expenses table */}
          <div className="border border-neutral-800 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 sticky left-0 bg-neutral-900/50 z-10 min-w-[120px]">Category</th>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                    const monthNames = [
                      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                    ];
                    return (
                      <th key={month} className="text-right py-3 px-3 text-xs font-semibold text-neutral-400 min-w-[90px]">
                        {monthNames[month - 1]}
                      </th>
                    );
                  })}
                  <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-400 bg-neutral-900/70 sticky right-0 min-w-[100px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Calculate values for each month
                  const monthData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                    const monthDocs = documents.filter(
                      d => d.invoice_year === selectedYear && d.invoice_month === month
                    );
                    return {
                      month,
                      income: monthDocs
                        .filter(d => d.invoice_type === 'revenue' && d.amount_base)
                        .reduce((sum, d) => sum + (d.amount_base || 0), 0),
                      expenses: monthDocs
                        .filter(d => d.invoice_type === 'cost' && d.amount_base)
                        .reduce((sum, d) => sum + (d.amount_base || 0), 0),
                      cit: monthDocs
                        .filter(d => d.tax_type === 'CIT' && d.amount_base)
                        .reduce((sum, d) => sum + (d.amount_base || 0), 0),
                      vat: monthDocs
                        .filter(d => d.tax_type === 'VAT' && d.amount_base)
                        .reduce((sum, d) => sum + (d.amount_base || 0), 0),
                    };
                  });
                  
                  // Calculate totals
                  const totalIncome = monthData.reduce((sum, m) => sum + m.income, 0);
                  const totalExpenses = monthData.reduce((sum, m) => sum + m.expenses, 0);
                  const totalCIT = monthData.reduce((sum, m) => sum + m.cit, 0);
                  const totalVAT = monthData.reduce((sum, m) => sum + m.vat, 0);
                  
                  const formatAmount = (amount: number) => {
                    return Math.round(amount).toLocaleString('pl-PL');
                  };
                  
                  return [
                    // Revenue row (green)
                    <tr key="income" className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                      <td className="py-3 px-4 text-green-400 font-medium sticky left-0 bg-neutral-900/95 z-10">Revenue</td>
                      {monthData.map((m) => (
                        <td key={m.month} className="py-3 px-3 text-right text-green-400 tabular-nums">
                          {formatAmount(m.income)}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right text-green-400 font-semibold bg-neutral-900/70 sticky right-0 tabular-nums">
                        {formatAmount(totalIncome)}
                      </td>
                    </tr>,
                    // Expenses row (red)
                    <tr key="expenses" className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                      <td className="py-3 px-4 text-red-400 font-medium sticky left-0 bg-neutral-900/95 z-10">Expenses</td>
                      {monthData.map((m) => (
                        <td key={m.month} className="py-3 px-3 text-right text-red-400 tabular-nums">
                          {formatAmount(m.expenses)}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right text-red-400 font-semibold bg-neutral-900/70 sticky right-0 tabular-nums">
                        {formatAmount(totalExpenses)}
                      </td>
                    </tr>,
                    // VAT row
                    <tr key="vat" className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                      <td className="py-3 px-4 text-neutral-300 font-medium sticky left-0 bg-neutral-900/95 z-10">VAT Tax</td>
                      {monthData.map((m) => (
                        <td key={m.month} className="py-3 px-3 text-right text-neutral-300 tabular-nums">
                          {formatAmount(m.vat)}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right text-neutral-200 font-semibold bg-neutral-900/70 sticky right-0 tabular-nums">
                        {formatAmount(totalVAT)}
                      </td>
                    </tr>,
                    // CIT row
                    <tr key="cit" className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                      <td className="py-3 px-4 text-neutral-300 font-medium sticky left-0 bg-neutral-900/95 z-10">CIT Tax</td>
                      {monthData.map((m) => (
                        <td key={m.month} className="py-3 px-3 text-right text-neutral-300 tabular-nums">
                          {formatAmount(m.cit)}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right text-neutral-200 font-semibold bg-neutral-900/70 sticky right-0 tabular-nums">
                        {formatAmount(totalCIT)}
                      </td>
                    </tr>,
                  ];
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab toggle */}
      {documents.some(d => d.invoice_type || d.tax_type) && (
        <div className="flex gap-2 border-b border-neutral-800">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "all"
                ? "text-white border-b-2 border-white"
                : "text-neutral-400 hover:text-neutral-300"
            }`}
          >
            All documents
          </button>
          <button
            onClick={() => setActiveTab("income-expenses")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "income-expenses"
                ? "text-white border-b-2 border-white"
                : "text-neutral-400 hover:text-neutral-300"
            }`}
          >
            Income & expenses
          </button>
        </div>
      )}

      {/* Monthly income/expenses table */}
      {activeTab === "income-expenses" && documents.some(d => d.invoice_type || d.tax_type) ? (
        <div className="border border-neutral-800 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-400 sticky left-0 bg-neutral-900/50 z-10 min-w-[120px]">Category</th>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                  const monthNames = [
                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                  ];
                  return (
                    <th key={month} className="text-right py-3 px-3 text-xs font-semibold text-neutral-400 min-w-[90px]">
                      {monthNames[month - 1]}
                    </th>
                  );
                })}
                <th className="text-right py-3 px-4 text-xs font-semibold text-neutral-400 bg-neutral-900/70 sticky right-0 min-w-[100px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const monthNames = [
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ];
                
                // Calculate values for each month
                const monthData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                  const monthDocs = documents.filter(
                    d => d.invoice_year === selectedYear && d.invoice_month === month
                  );
                  return {
                    month,
                    income: monthDocs
                      .filter(d => d.invoice_type === 'revenue' && d.amount_base)
                      .reduce((sum, d) => sum + (d.amount_base || 0), 0),
                    expenses: monthDocs
                      .filter(d => d.invoice_type === 'cost' && d.amount_base)
                      .reduce((sum, d) => sum + (d.amount_base || 0), 0),
                    cit: monthDocs
                      .filter(d => d.tax_type === 'CIT' && d.amount_base)
                      .reduce((sum, d) => sum + (d.amount_base || 0), 0),
                    vat: monthDocs
                      .filter(d => d.tax_type === 'VAT' && d.amount_base)
                      .reduce((sum, d) => sum + (d.amount_base || 0), 0),
                  };
                });
                
                // Calculate totals
                const totalIncome = monthData.reduce((sum, m) => sum + m.income, 0);
                const totalExpenses = monthData.reduce((sum, m) => sum + m.expenses, 0);
                const totalCIT = monthData.reduce((sum, m) => sum + m.cit, 0);
                const totalVAT = monthData.reduce((sum, m) => sum + m.vat, 0);
                
                const formatAmount = (amount: number) => {
                  return Math.round(amount).toLocaleString('pl-PL');
                };
                
                const renderCategoryRow = (
                  categoryKey: string,
                  categoryName: string,
                  monthValues: number[],
                  total: number,
                  filterFn: (doc: Document) => boolean
                ) => {
                  // Determine color based on category
                  const isRevenue = categoryKey === 'income';
                  const isExpense = categoryKey === 'expenses';
                  const textColor = isRevenue ? 'text-green-400' : isExpense ? 'text-red-400' : 'text-neutral-300';
                  const hoverColor = isRevenue ? 'hover:text-green-300' : isExpense ? 'hover:text-red-300' : 'hover:text-white';
                  
                  return (
                    <>
                      <tr key={categoryKey} className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                        <td className={`py-3 px-4 ${textColor} font-medium sticky left-0 bg-neutral-900/95 z-10`}>{categoryName}</td>
                        {monthData.map((m) => {
                          const cellKey = `${categoryKey}-${m.month}`;
                          const isExpanded = expandedCells.has(cellKey);
                          const monthDocs = documents.filter(
                            d => d.invoice_year === selectedYear && d.invoice_month === m.month && filterFn(d)
                          );
                          const hasDetails = monthDocs.length > 0;
                          const value = monthValues[m.month - 1];
                          
                          return (
                            <td 
                              key={m.month} 
                              className={`py-3 px-3 text-right ${textColor} tabular-nums ${hasDetails ? `cursor-pointer ${hoverColor} hover:underline` : ''}`}
                              onClick={() => {
                                if (hasDetails) {
                                  const newExpanded = new Set(expandedCells);
                                  if (isExpanded) {
                                    newExpanded.delete(cellKey);
                                  } else {
                                    newExpanded.add(cellKey);
                                  }
                                  setExpandedCells(newExpanded);
                                }
                              }}
                            >
                              {formatAmount(value)}
                            </td>
                          );
                        })}
                        <td className={`py-3 px-4 text-right ${textColor} font-semibold bg-neutral-900/70 sticky right-0 tabular-nums`}>
                          {formatAmount(total)}
                        </td>
                      </tr>
                      {/* Expanded details rows */}
                      {monthData.map((m) => {
                        const cellKey = `${categoryKey}-${m.month}`;
                        const isExpanded = expandedCells.has(cellKey);
                        if (!isExpanded) return null;
                        
                        const monthDocs = documents.filter(
                          d => d.invoice_year === selectedYear && d.invoice_month === m.month && filterFn(d)
                        );
                        
                        return monthDocs.map((doc) => {
                          const contact = contacts.find(c => c.id === doc.contact_id);
                          const organisation = organisations.find(o => o.id === doc.organisation_id);
                          
                          return (
                            <tr key={`${cellKey}-${doc.id}`} className="border-b border-neutral-800/30 bg-neutral-900/20 hover:bg-neutral-900/40">
                              <td className="py-2 px-4 text-neutral-400 text-xs sticky left-0 bg-neutral-900/95 z-10">
                                <div className="flex flex-col gap-1">
                                  <div className="font-medium text-neutral-300">{doc.name}</div>
                                  <div className="text-[10px] text-neutral-500">
                                    {contact && <span>{contact.name}</span>}
                                    {organisation && <span className="ml-2">• {organisation.name}</span>}
                                    {doc.invoice_date && (
                                      <span className="ml-2">
                                        • {format(new Date(doc.invoice_date), 'dd.MM.yyyy')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {monthData.map((month) => {
                                if (month.month === m.month) {
                                  return (
                                    <td key={month.month} className="py-2 px-3 text-right text-xs text-neutral-400 tabular-nums">
                                      {doc.amount_base ? formatAmount(doc.amount_base) : '-'}
                                    </td>
                                  );
                                }
                                return <td key={month.month} className="py-2 px-3"></td>;
                              })}
                              <td className="py-2 px-4 bg-neutral-900/70 sticky right-0"></td>
                            </tr>
                          );
                        });
                      })}
                    </>
                  );
                };
                
                return [
                  renderCategoryRow('income', 'Revenue', monthData.map(m => m.income), totalIncome, d => d.invoice_type === 'revenue' && !!d.amount_base),
                  renderCategoryRow('expenses', 'Expenses', monthData.map(m => m.expenses), totalExpenses, d => d.invoice_type === 'cost' && !!d.amount_base),
                  renderCategoryRow('vat', 'VAT Tax', monthData.map(m => m.vat), totalVAT, d => d.tax_type === 'VAT' && !!d.amount_base),
                  renderCategoryRow('cit', 'CIT Tax', monthData.map(m => m.cit), totalCIT, d => d.tax_type === 'CIT' && !!d.amount_base),
                ];
              })()}
            </tbody>
          </table>
        </div>
      ) : filteredDocuments.length === 0 ? (
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
                          <span className="text-xl flex-shrink-0 mt-0.5">
                            {doc.document_type ? getDocumentTypeIcon(doc.document_type) : getFileIcon(doc.file_type)}
                          </span>
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
                              {/* Avatars */}
                              <div className="flex items-center gap-1 -space-x-1">
                                {contact && (
                                  <div className="relative">
                                    {contact.avatar ? (
                                      <img
                                        src={getAvatarUrl(contact.avatar)}
                                        alt={contact.name}
                                        className="w-5 h-5 rounded-full object-cover border border-neutral-700"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-[8px] font-semibold border border-neutral-700 text-white">
                                        {contact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {organisation && (
                                  <div className="relative">
                                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[8px] font-semibold border border-neutral-700 text-white">
                                      {organisation.name.substring(0, 2).toUpperCase()}
                                    </div>
                                  </div>
                                )}
                              </div>
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
                              👁️
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

                        {/* All fields in one line */}
                        <div className="flex items-end gap-4 pt-1.5 border-t border-neutral-800/50 overflow-x-auto flex-nowrap">
                          <div className="space-y-0.5 flex-shrink-0 min-w-[90px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Contact</label>
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
                                    // If contact is assigned, get organisation from contact
                                    let organisation_id = doc.organisation_id;
                                    if (newValue) {
                                      const contact = contacts.find(c => c.id === newValue);
                                      if (contact) {
                                        // Get organisation from contact (check both legacy field and new array)
                                        const contactOrgName = contact.organizations && contact.organizations.length > 0
                                          ? contact.organizations[0]
                                          : (contact.organization || null);
                                        
                                        if (contactOrgName) {
                                          const matchingOrg = organisations.find(org => 
                                            org.name.toLowerCase() === contactOrgName.toLowerCase()
                                          );
                                          if (matchingOrg) {
                                            organisation_id = matchingOrg.id;
                                            console.log(`✅ Auto-assigned organisation "${matchingOrg.name}" from contact "${contact.name}"`);
                                          }
                                        }
                                      }
                                    }
                                    
                                    await documentsDb.updateDocument(doc.id, { 
                                      contact_id: newValue,
                                      organisation_id: organisation_id || undefined
                                    });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, contact_id: newValue, organisation_id: organisation_id || undefined } : d
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[90px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Organisation</label>
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[90px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Project</label>
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[90px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Task</label>
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[90px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Document Type</label>
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[120px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Google Docs</label>
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800 placeholder:text-neutral-500"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[80px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Full Text</label>
                            <div 
                              className="flex items-center gap-1 cursor-pointer hover:bg-neutral-800/30 rounded px-1 py-0.5 transition-colors"
                              onClick={() => setExpandedSections(prev => ({
                                ...prev,
                                [doc.id]: { ...prev[doc.id], fullText: !prev[doc.id]?.fullText }
                              }))}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${doc.full_text ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              {doc.full_text && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCopyingToClipboard(prev => ({ ...prev, [doc.id]: true }));
                                    handleCopyToClipboard(doc.full_text || '');
                                    setTimeout(() => setCopyingToClipboard(prev => ({ ...prev, [doc.id]: false })), 1000);
                                  }}
                                  disabled={copyingToClipboard[doc.id]}
                                  className="px-1 py-0.5 text-[8px] bg-blue-600/30 text-blue-400 border border-blue-600/50 rounded hover:bg-blue-600/50 transition-colors disabled:opacity-50"
                                  title="Copy"
                                >
                                  {copyingToClipboard[doc.id] ? '✓' : 'Copy'}
                                </button>
                              )}
                              <span className="text-neutral-500 text-[8px]">
                                {expandedSections[doc.id]?.fullText ? '▼' : '▶'}
                              </span>
                            </div>
                          </div>
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[80px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Summary</label>
                            <div 
                              className="flex items-center gap-1 cursor-pointer hover:bg-neutral-800/30 rounded px-1 py-0.5 transition-colors"
                              onClick={() => setExpandedSections(prev => ({
                                ...prev,
                                [doc.id]: { ...prev[doc.id], summary: !prev[doc.id]?.summary }
                              }))}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${doc.summary ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              {doc.full_text && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGenerateSummary(doc.id);
                                  }}
                                  disabled={generatingSummary[doc.id]}
                                  className="px-1 py-0.5 text-[8px] bg-purple-600/30 text-purple-400 border border-purple-600/50 rounded hover:bg-purple-600/50 transition-colors disabled:opacity-50"
                                  title="Generate"
                                >
                                  {generatingSummary[doc.id] ? '...' : 'Gen'}
                                </button>
                              )}
                              <span className="text-neutral-500 text-[8px]">
                                {expandedSections[doc.id]?.summary ? '▼' : '▶'}
                              </span>
                            </div>
                          </div>
                        </div>
                        {(expandedSections[doc.id]?.fullText || expandedSections[doc.id]?.summary) && (
                          <div className="pt-1 border-t border-neutral-800/50 space-y-1">
                            {expandedSections[doc.id]?.fullText && (
                              <div className="mt-1">
                                {isEditingField && editingField.field === 'full_text' ? (
                                  <textarea
                                    value={editData.full_text ?? doc.full_text ?? ''}
                                    onChange={(e) => setInlineEditData(prev => ({
                                      ...prev,
                                      [doc.id]: { ...prev[doc.id], full_text: e.target.value }
                                    }))}
                                    onBlur={async () => {
                                      if (editData.full_text !== doc.full_text) {
                                        await documentsDb.updateDocument(doc.id, { full_text: editData.full_text || undefined });
                                        setDocuments(prev => prev.map(d => 
                                          d.id === doc.id ? { ...d, full_text: editData.full_text || undefined } : d
                                        ));
                                      }
                                      setEditingField(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        setInlineEditData(prev => {
                                          const newData = { ...prev };
                                          delete newData[doc.id]?.full_text;
                                          return newData;
                                        });
                                        setEditingField(null);
                                      }
                                    }}
                                    autoFocus
                                    rows={6}
                                    className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800 resize-y"
                                    placeholder="Full text content..."
                                  />
                                ) : (
                                  <div
                                    onDoubleClick={() => setEditingField({ docId: doc.id, field: 'full_text' })}
                                    className={`text-xs text-neutral-300 whitespace-pre-wrap cursor-text p-2 rounded bg-neutral-800/30 border border-neutral-800/50 min-h-[80px] ${
                                      doc.full_text ? '' : 'text-neutral-500 italic'
                                    }`}
                                  >
                                    {doc.full_text || 'Double-click to add full text...'}
                                  </div>
                                )}
                              </div>
                            )}
                            {expandedSections[doc.id]?.summary && (
                              <div className="mt-1">
                                {isEditingField && editingField.field === 'summary' ? (
                                  <textarea
                                    value={editData.summary ?? doc.summary ?? ''}
                                    onChange={(e) => setInlineEditData(prev => ({
                                      ...prev,
                                      [doc.id]: { ...prev[doc.id], summary: e.target.value }
                                    }))}
                                    onBlur={async () => {
                                      if (editData.summary !== doc.summary) {
                                        await documentsDb.updateDocument(doc.id, { summary: editData.summary || undefined });
                                        setDocuments(prev => prev.map(d => 
                                          d.id === doc.id ? { ...d, summary: editData.summary || undefined } : d
                                        ));
                                      }
                                      setEditingField(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        setInlineEditData(prev => {
                                          const newData = { ...prev };
                                          delete newData[doc.id]?.summary;
                                          return newData;
                                        });
                                        setEditingField(null);
                                      }
                                    }}
                                    autoFocus
                                    rows={6}
                                    className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800 resize-y"
                                    placeholder="Summary / Key Points..."
                                  />
                                ) : (
                                  <div
                                    onDoubleClick={() => setEditingField({ docId: doc.id, field: 'summary' })}
                                    className={`text-xs text-neutral-300 whitespace-pre-wrap cursor-text p-2 rounded bg-neutral-800/30 border border-neutral-800/50 min-h-[80px] ${
                                      doc.summary ? '' : 'text-neutral-500 italic'
                                    }`}
                                  >
                                    {doc.summary || 'Double-click to add summary...'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Notes */}
                        {doc.notes && (
                          <div className="pt-1 border-t border-neutral-800/50">
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
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === "list" && (
            <div className="space-y-1.5">
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
                    className="group border border-neutral-800/60 rounded-lg p-2 bg-gradient-to-br from-neutral-900/60 to-neutral-900/40 hover:from-neutral-900/80 hover:to-neutral-900/60 hover:border-neutral-700/60 transition-all shadow-sm hover:shadow-md"
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
                      <div className="space-y-1.5">
                        {/* Header with icon and name */}
                        <div className="flex items-start gap-2">
                          <span className="text-lg flex-shrink-0 mt-0.5">
                            {doc.document_type ? getDocumentTypeIcon(doc.document_type) : getFileIcon(doc.file_type)}
                          </span>
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
                                className="w-full bg-neutral-800/50 border border-blue-500/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              />
                            ) : (
                              <div
                                onClick={() => setEditingField({ docId: doc.id, field: 'name' })}
                                className="text-sm font-semibold text-white hover:underline cursor-pointer transition-colors"
                              >
                                {doc.name}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                              👁️
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

                        {/* All fields in one line */}
                        <div className="flex items-end gap-4 pt-1.5 border-t border-neutral-800/50 overflow-x-auto flex-nowrap">
                          <div className="space-y-0.5 flex-shrink-0 min-w-[90px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Contact</label>
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
                                    // If contact is assigned, get organisation from contact
                                    let organisation_id = doc.organisation_id;
                                    if (newValue) {
                                      const contact = contacts.find(c => c.id === newValue);
                                      if (contact) {
                                        // Get organisation from contact (check both legacy field and new array)
                                        const contactOrgName = contact.organizations && contact.organizations.length > 0
                                          ? contact.organizations[0]
                                          : (contact.organization || null);
                                        
                                        if (contactOrgName) {
                                          const matchingOrg = organisations.find(org => 
                                            org.name.toLowerCase() === contactOrgName.toLowerCase()
                                          );
                                          if (matchingOrg) {
                                            organisation_id = matchingOrg.id;
                                            console.log(`✅ Auto-assigned organisation "${matchingOrg.name}" from contact "${contact.name}"`);
                                          }
                                        }
                                      }
                                    }
                                    
                                    await documentsDb.updateDocument(doc.id, { 
                                      contact_id: newValue,
                                      organisation_id: organisation_id || undefined
                                    });
                                    // Update local state
                                    setDocuments(prev => prev.map(d => 
                                      d.id === doc.id ? { ...d, contact_id: newValue, organisation_id: organisation_id || undefined } : d
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[90px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Organisation</label>
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[90px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Project</label>
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[90px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Task</label>
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[90px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Document Type</label>
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[120px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Google Docs</label>
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
                                className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800 placeholder:text-neutral-500"
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
                                className={`text-xs py-1 px-2 rounded transition-all cursor-pointer ${
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
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[80px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Full Text</label>
                            <div 
                              className="flex items-center gap-1 cursor-pointer hover:bg-neutral-800/30 rounded px-1 py-0.5 transition-colors"
                              onClick={() => setExpandedSections(prev => ({
                                ...prev,
                                [doc.id]: { ...prev[doc.id], fullText: !prev[doc.id]?.fullText }
                              }))}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${doc.full_text ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              {doc.full_text && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCopyingToClipboard(prev => ({ ...prev, [doc.id]: true }));
                                    handleCopyToClipboard(doc.full_text || '');
                                    setTimeout(() => setCopyingToClipboard(prev => ({ ...prev, [doc.id]: false })), 1000);
                                  }}
                                  disabled={copyingToClipboard[doc.id]}
                                  className="px-1 py-0.5 text-[8px] bg-blue-600/30 text-blue-400 border border-blue-600/50 rounded hover:bg-blue-600/50 transition-colors disabled:opacity-50"
                                  title="Copy"
                                >
                                  {copyingToClipboard[doc.id] ? '✓' : 'Copy'}
                                </button>
                              )}
                              <span className="text-neutral-500 text-[8px]">
                                {expandedSections[doc.id]?.fullText ? '▼' : '▶'}
                              </span>
                            </div>
                          </div>
                          <div className="w-px h-8 bg-neutral-800/50 flex-shrink-0"></div>
                          <div className="space-y-0.5 flex-shrink-0 min-w-[80px]">
                            <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium block">Summary</label>
                            <div 
                              className="flex items-center gap-1 cursor-pointer hover:bg-neutral-800/30 rounded px-1 py-0.5 transition-colors"
                              onClick={() => setExpandedSections(prev => ({
                                ...prev,
                                [doc.id]: { ...prev[doc.id], summary: !prev[doc.id]?.summary }
                              }))}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${doc.summary ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              {doc.full_text && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGenerateSummary(doc.id);
                                  }}
                                  disabled={generatingSummary[doc.id]}
                                  className="px-1 py-0.5 text-[8px] bg-purple-600/30 text-purple-400 border border-purple-600/50 rounded hover:bg-purple-600/50 transition-colors disabled:opacity-50"
                                  title="Generate"
                                >
                                  {generatingSummary[doc.id] ? '...' : 'Gen'}
                                </button>
                              )}
                              <span className="text-neutral-500 text-[8px]">
                                {expandedSections[doc.id]?.summary ? '▼' : '▶'}
                              </span>
                            </div>
                          </div>
                        </div>
                        {(expandedSections[doc.id]?.fullText || expandedSections[doc.id]?.summary) && (
                          <div className="pt-1 border-t border-neutral-800/50 space-y-1">
                            {expandedSections[doc.id]?.fullText && (
                              <div className="mt-1 space-y-1">
                                {isEditingField && editingField.field === 'full_text' ? (
                                  <textarea
                                    value={editData.full_text ?? doc.full_text ?? ''}
                                    onChange={(e) => setInlineEditData(prev => ({
                                      ...prev,
                                      [doc.id]: { ...prev[doc.id], full_text: e.target.value }
                                    }))}
                                    onBlur={async () => {
                                      if (editData.full_text !== doc.full_text) {
                                        await documentsDb.updateDocument(doc.id, { full_text: editData.full_text || undefined });
                                        setDocuments(prev => prev.map(d => 
                                          d.id === doc.id ? { ...d, full_text: editData.full_text || undefined } : d
                                        ));
                                      }
                                      setEditingField(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        setInlineEditData(prev => {
                                          const newData = { ...prev };
                                          delete newData[doc.id]?.full_text;
                                          return newData;
                                        });
                                        setEditingField(null);
                                      }
                                    }}
                                    autoFocus
                                    rows={6}
                                    className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800 resize-y"
                                    placeholder="Full text content..."
                                  />
                                ) : (
                                  <div
                                    onDoubleClick={() => setEditingField({ docId: doc.id, field: 'full_text' })}
                                    className={`text-xs text-neutral-300 whitespace-pre-wrap cursor-text p-2 rounded bg-neutral-800/30 border border-neutral-800/50 min-h-[80px] ${
                                      doc.full_text ? '' : 'text-neutral-500 italic'
                                    }`}
                                  >
                                    {doc.full_text || 'Double-click to add full text...'}
                                  </div>
                                )}
                              </div>
                            )}
                            {expandedSections[doc.id]?.summary && (
                              <div className="mt-1 space-y-1">
                                {isEditingField && editingField.field === 'summary' ? (
                                  <textarea
                                    value={editData.summary ?? doc.summary ?? ''}
                                    onChange={(e) => setInlineEditData(prev => ({
                                      ...prev,
                                      [doc.id]: { ...prev[doc.id], summary: e.target.value }
                                    }))}
                                    onBlur={async () => {
                                      if (editData.summary !== doc.summary) {
                                        await documentsDb.updateDocument(doc.id, { summary: editData.summary || undefined });
                                        setDocuments(prev => prev.map(d => 
                                          d.id === doc.id ? { ...d, summary: editData.summary || undefined } : d
                                        ));
                                      }
                                      setEditingField(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        setInlineEditData(prev => {
                                          const newData = { ...prev };
                                          delete newData[doc.id]?.summary;
                                          return newData;
                                        });
                                        setEditingField(null);
                                      }
                                    }}
                                    autoFocus
                                    rows={6}
                                    className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800 resize-y"
                                    placeholder="Summary / Key Points..."
                                  />
                                ) : (
                                  <div
                                    onDoubleClick={() => setEditingField({ docId: doc.id, field: 'summary' })}
                                    className={`text-xs text-neutral-300 whitespace-pre-wrap cursor-text p-2 rounded bg-neutral-800/30 border border-neutral-800/50 min-h-[80px] ${
                                      doc.summary ? '' : 'text-neutral-500 italic'
                                    }`}
                                  >
                                    {doc.summary || 'Double-click to add summary...'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Notes */}
                        {doc.notes && (
                          <div className="pt-1 border-t border-neutral-800/50 space-y-1">
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
                                    className="w-full bg-neutral-800/60 border border-neutral-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neutral-600 focus:bg-neutral-800"
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
                          <span className="text-lg flex-shrink-0">
                            {doc.document_type ? getDocumentTypeIcon(doc.document_type) : getFileIcon(doc.file_type)}
                          </span>
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
                            <div className="flex items-center gap-1 mt-1 -space-x-1">
                              {contact && (
                                <div className="relative">
                                  {contact.avatar ? (
                                    <img
                                      src={getAvatarUrl(contact.avatar)}
                                      alt={contact.name}
                                      className="w-4 h-4 rounded-full object-cover border border-neutral-700"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-[7px] font-semibold border border-neutral-700 text-white">
                                      {contact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              )}
                              {organisation && (
                                <div className="relative">
                                  <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[7px] font-semibold border border-neutral-700 text-white">
                                    {organisation.name.substring(0, 2).toUpperCase()}
                                  </div>
                                </div>
                              )}
                            </div>
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

