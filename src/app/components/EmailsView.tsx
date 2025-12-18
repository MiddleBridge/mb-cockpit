"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import * as documentsDb from "../../lib/db/documents";
import * as contactsDb from "../../lib/db/contacts";
import * as organisationsDb from "../../lib/db/organisations";
import type { Document } from "../../lib/db/documents";
import type { Contact } from "../../lib/db/contacts";
import type { Organisation } from "../../lib/db/organisations";

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number | null;
}

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  date: string;
  snippet: string;
  hasAttachments: boolean;
  attachmentCount: number;
  attachments?: Attachment[];
  isRead: boolean;
  labelIds: string[];
  hasDocuments?: boolean; // Whether this email has documents imported
}

export default function EmailsView() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("in:inbox");
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [savingAttachmentId, setSavingAttachmentId] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "with-attachments" | "without-attachments" | "with-documents" | "without-documents" | "unread" | "read">("all");
  
  // Invoice/Tax modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceModalData, setInvoiceModalData] = useState<{
    messageId: string;
    attachmentId: string;
    filename: string;
    mimeType: string;
    type: 'cost' | 'revenue' | 'CIT' | 'VAT';
  } | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState('PLN');
  const [invoiceMonth, setInvoiceMonth] = useState('');
  const [invoiceYear, setInvoiceYear] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);
  
  // Documents sidebar state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [assigningDocId, setAssigningDocId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactOrg, setNewContactOrg] = useState("");
  const [addingContactForDoc, setAddingContactForDoc] = useState<string | null>(null);
  const [addingContactForMessage, setAddingContactForMessage] = useState<GmailMessage | null>(null);
  const [sortBy, setSortBy] = useState<"none" | "contact" | "email" | "date">("date");
  const [contentSearch, setContentSearch] = useState("");

  // Get user email from localStorage or URL params (same as DocumentsView)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // First check URL params (from OAuth callback)
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
          return;
        }
      }
      
      // Then check localStorage
      const storedEmail = localStorage.getItem('gmail_user_email');
      if (storedEmail) {
        setUserEmail(storedEmail);
      }
    }
  }, []);

  // Check Gmail connection
  useEffect(() => {
    async function checkConnection() {
      if (!userEmail) return;
      
      setCheckingConnection(true);
      try {
        const response = await fetch(`/api/gmail/check-connection?userEmail=${encodeURIComponent(userEmail)}`);
        const data = await response.json();
        setIsConnected(data.connected || false);
      } catch (err) {
        console.error("Error checking connection:", err);
        setIsConnected(false);
      } finally {
        setCheckingConnection(false);
      }
    }
    
    if (userEmail) {
      checkConnection();
    }
  }, [userEmail]);

  // Fetch messages
  const fetchMessages = async (pageToken?: string | null, autoLoadAll: boolean = false) => {
    if (!userEmail) return;

    setLoading(true);
    setError(null);

    try {
      const params: URLSearchParams = new URLSearchParams({
        userEmail,
        limit: autoLoadAll ? "500" : "50",
        query: searchQuery,
      });
      
      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      console.log('📧 Fetching Gmail messages...', { userEmail, query: searchQuery, limit: autoLoadAll ? "500" : "50" });
      const response = await fetch(`/api/gmail/all-messages?${params.toString()}`);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error('❌ Failed to fetch Gmail messages:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error,
          details: errorData.details,
        });
        throw new Error(errorData.error || errorData.details || "Failed to fetch messages");
      }

      const data = await response.json();
      console.log(`✅ Fetched ${data.messages?.length || 0} messages`, { nextPageToken: data.nextPageToken });
      
      if (pageToken) {
        // Append to existing messages
        setMessages(prev => [...prev, ...data.messages]);
      } else {
        // Replace messages
        setMessages(data.messages || []);
      }
      
      setNextPageToken(data.nextPageToken || null);
      
      // If autoLoadAll is enabled and there's a next page, continue loading
      if (autoLoadAll && data.nextPageToken) {
        await fetchMessages(data.nextPageToken, true);
      }
    } catch (err: any) {
      console.error("❌ Error fetching messages:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
        fullError: err,
      });
      const errorMessage = err.message || "Failed to fetch messages";
      setError(errorMessage);
      
      // If it's a connection error, suggest reconnecting
      if (errorMessage.includes('not connected') || errorMessage.includes('401')) {
        console.warn('⚠️ Gmail connection issue. Try reconnecting your Gmail account.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail && isConnected) {
      // Auto-load all messages on first load
      fetchMessages(null, true);
    }
  }, [userEmail, isConnected, searchQuery]);

  // Load contacts and organisations
  useEffect(() => {
    async function loadData() {
      const [contactsData, orgsData] = await Promise.all([
        contactsDb.getContacts(),
        organisationsDb.getOrganisations(),
      ]);
      setContacts(contactsData);
      setOrganisations(orgsData);
    }
    loadData();
  }, []);

  // Load ALL documents with Gmail source to check for duplicates
  useEffect(() => {
    async function loadAllGmailDocuments() {
      setLoadingDocuments(true);
      try {
        // Load ALL documents that have Gmail source (attachment_id or message_id)
        // This ensures we can detect if a file is already saved, even from different emails
        const allGmailDocs = await documentsDb.getDocuments();
        const gmailDocs = allGmailDocs.filter(doc => 
          doc.source_gmail_attachment_id || doc.source_gmail_message_id
        );
        
        setDocuments(gmailDocs);
      } catch (err) {
        console.error('Error loading Gmail documents:', err);
        setDocuments([]);
      } finally {
        setLoadingDocuments(false);
      }
    }
    loadAllGmailDocuments();
  }, []); // Load once on mount, not on messages change

  // Helper function to extract email from "From" field
  const extractEmailFromFrom = (from: string): string => {
    const match = from.match(/<(.+?)>/);
    if (match) return match[1].toLowerCase();
    return from.toLowerCase();
  };

  // Helper function to extract contact name from "From" field
  const extractContactNameFromFrom = (from: string): string => {
    const match = from.match(/^(.+?)\s*</);
    if (match) return match[1].trim();
    return from.split('@')[0] || '';
  };

  // Filter and sort messages
  let filteredMessages = messages.filter((message) => {
    // Apply filter
    if (filter === "with-attachments") {
      if (!message.hasAttachments) return false;
    } else if (filter === "without-attachments") {
      if (message.hasAttachments) return false;
    } else if (filter === "with-documents") {
      if (message.hasDocuments !== true) return false;
    } else if (filter === "without-documents") {
      if (message.hasDocuments) return false;
    } else if (filter === "unread") {
      if (message.isRead) return false;
    } else if (filter === "read") {
      if (!message.isRead) return false;
    }

    // Apply content search
    if (contentSearch.trim()) {
      const searchLower = contentSearch.toLowerCase();
      const matchesSubject = message.subject.toLowerCase().includes(searchLower);
      const matchesSnippet = message.snippet.toLowerCase().includes(searchLower);
      const matchesFrom = message.from.toLowerCase().includes(searchLower);
      const matchesTo = message.to.toLowerCase().includes(searchLower);
      
      if (!matchesSubject && !matchesSnippet && !matchesFrom && !matchesTo) {
        return false;
      }
    }

    return true;
  });

  // Sort messages
  if (sortBy === "contact") {
    filteredMessages = [...filteredMessages].sort((a, b) => {
      const nameA = extractContactNameFromFrom(a.from).toLowerCase();
      const nameB = extractContactNameFromFrom(b.from).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } else if (sortBy === "email") {
    filteredMessages = [...filteredMessages].sort((a, b) => {
      const emailA = extractEmailFromFrom(a.from);
      const emailB = extractEmailFromFrom(b.from);
      return emailA.localeCompare(emailB);
    });
  } else if (sortBy === "date") {
    filteredMessages = [...filteredMessages].sort((a, b) => {
      try {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA; // Newest first
      } catch {
        return 0;
      }
    });
  }

  const handleConnectGmail = () => {
    if (!userEmail) {
      alert("Please enter your email address first");
      return;
    }
    window.location.href = `/api/gmail/auth?userEmail=${encodeURIComponent(userEmail)}`;
  };

  const handleLoadMore = () => {
    if (nextPageToken) {
      fetchMessages(nextPageToken);
    }
  };

  const handleLoadAll = async () => {
    if (!userEmail || !nextPageToken) return;
    
    setLoading(true);
    let currentPageToken: string | null = nextPageToken;
    let allMessages: GmailMessage[] = [...messages];
    
    try {
      // Keep loading pages until there's no more nextPageToken
      while (currentPageToken) {
        const params: URLSearchParams = new URLSearchParams({
          userEmail,
          limit: "500", // Load more per page
          query: searchQuery,
          pageToken: currentPageToken,
        });

        const response = await fetch(`/api/gmail/all-messages?${params.toString()}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch messages");
        }

        const data = await response.json();
        allMessages = [...allMessages, ...data.messages];
        currentPageToken = data.nextPageToken || null;
        
        // Update state incrementally so user sees progress
        setMessages(allMessages);
        setNextPageToken(currentPageToken);
      }
    } catch (err: any) {
      console.error("Error loading all messages:", err);
      setError(err.message || "Failed to load all messages");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening message detail
    e.preventDefault();
    
    if (!confirm("Czy na pewno chcesz usunąć ten email? Tej operacji nie można cofnąć.")) {
      return;
    }

    if (!userEmail) {
      alert('Brak adresu email użytkownika');
      return;
    }

    setDeletingMessageId(messageId);
    try {
      const url = `/api/gmail/delete-message?userEmail=${encodeURIComponent(userEmail.trim())}&messageId=${encodeURIComponent(messageId)}`;
      console.log('Deleting message:', url);
      
      const response = await fetch(url, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Delete response error:', responseData);
        throw new Error(responseData.error || responseData.details || 'Failed to delete email');
      }

      // Remove from local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // If deleted message was selected, close modal
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
      }
      
      // Show success message
      setToastMessage('Email został usunięty');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      console.error('Error deleting email:', err);
      alert('Nie udało się usunąć emaila: ' + (err.message || 'Nieznany błąd'));
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleDownloadAttachment = async (messageId: string, attachmentId: string, filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userEmail) return;

    setDownloadingAttachmentId(attachmentId);
    try {
      const url = `/api/gmail/download-attachment?messageId=${encodeURIComponent(messageId)}&attachmentId=${encodeURIComponent(attachmentId)}&userEmail=${encodeURIComponent(userEmail)}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        const error = await response.json().catch(() => ({ error: 'Failed to download file' }));
        alert('Failed to download: ' + (error.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('Error downloading attachment:', err);
      alert('Failed to download file: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const handleSaveAttachment = async (messageId: string, attachmentId: string, filename: string, mimeType: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userEmail) {
      alert('User email not set');
      return;
    }

    setSavingAttachmentId(attachmentId);
    try {
      const message = messages.find(m => m.id === messageId);
      const response = await fetch('/api/gmail/save-attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          attachmentId,
          userEmail,
          fileName: filename,
          mimeType,
          emailSubject: message?.subject || filename,
          emailDate: message?.date,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Reload documents for this message
        const docs = await documentsDb.getDocumentsByGmailMessage(messageId);
        setDocuments(prev => {
          const filtered = prev.filter(d => d.source_gmail_message_id !== messageId);
          return [...filtered, ...docs];
        });
        
        // Update message to mark as having documents
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { ...m, hasDocuments: true }
            : m
        ));
        
        setShowToast(true);
        setToastMessage('✓ Attachment saved to database');
        setTimeout(() => setShowToast(false), 3000);
      } else {
        const error = await response.json();
        alert('Failed to save: ' + (error.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('Error saving attachment:', err);
      alert('Failed to save attachment');
    } finally {
      setSavingAttachmentId(null);
    }
  };

  const handleOpenInvoiceModal = (messageId: string, attachmentId: string, filename: string, mimeType: string, type: 'cost' | 'revenue' | 'CIT' | 'VAT', e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Find the message to get email date
    const message = messages.find(m => m.id === messageId);
    
    setInvoiceModalData({ messageId, attachmentId, filename, mimeType, type });
    setInvoiceAmount('');
    setInvoiceCurrency('PLN');
    
    // Automatically set month and year to one month before email date
    if (message?.date) {
      try {
        const emailDate = new Date(message.date);
        const oneMonthAgo = new Date(emailDate);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        setInvoiceMonth(String(oneMonthAgo.getMonth() + 1).padStart(2, '0'));
        setInvoiceYear(String(oneMonthAgo.getFullYear()));
      } catch (err) {
        // If date parsing fails, use current date minus one month
        const now = new Date();
        now.setMonth(now.getMonth() - 1);
        setInvoiceMonth(String(now.getMonth() + 1).padStart(2, '0'));
        setInvoiceYear(String(now.getFullYear()));
      }
    } else {
      // If no email date, use current date minus one month
      const now = new Date();
      now.setMonth(now.getMonth() - 1);
      setInvoiceMonth(String(now.getMonth() + 1).padStart(2, '0'));
      setInvoiceYear(String(now.getFullYear()));
    }
    
    setShowInvoiceModal(true);
  };

  const handleSaveInvoice = async () => {
    if (!userEmail || !invoiceModalData || !invoiceAmount || !invoiceCurrency || !invoiceMonth || !invoiceYear) {
      alert('Please fill in all fields');
      return;
    }

    const amount = parseFloat(invoiceAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setSavingInvoice(true);
    try {
      const invoiceDate = `${invoiceYear}-${invoiceMonth}-01`;
      const message = messages.find(m => m.id === invoiceModalData.messageId);
      
      const body: any = {
        messageId: invoiceModalData.messageId,
        attachmentId: invoiceModalData.attachmentId,
        userEmail: userEmail,
        fileName: invoiceModalData.filename,
        mimeType: invoiceModalData.mimeType,
        amountOriginal: amount,
        currency: invoiceCurrency,
        invoiceDate: invoiceDate,
        invoiceYear: parseInt(invoiceYear),
        invoiceMonth: parseInt(invoiceMonth),
        emailSubject: message?.subject || invoiceModalData.filename,
        emailDate: message?.date,
      };

      if (invoiceModalData.type === 'cost' || invoiceModalData.type === 'revenue') {
        body.invoiceType = invoiceModalData.type;
      } else {
        body.taxType = invoiceModalData.type;
      }

      const response = await fetch('/api/gmail/save-attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        setShowInvoiceModal(false);
        setInvoiceModalData(null);
        setInvoiceAmount('');
        setInvoiceCurrency('PLN');
        setInvoiceMonth('');
        setInvoiceYear('');
        
        setShowToast(true);
        setToastMessage('Saved successfully');
        setTimeout(() => setShowToast(false), 3000);
        
        // Reload documents
        const docs = await documentsDb.getDocumentsByGmailMessage(invoiceModalData.messageId);
        setDocuments(prev => {
          const filtered = prev.filter(d => d.source_gmail_message_id !== invoiceModalData.messageId);
          return [...filtered, ...docs];
        });
      } else {
        const error = await response.json();
        alert('Failed to save: ' + (error.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('Error saving invoice:', err);
      alert('Failed to save');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleAssignDocument = async (docId: string, contactId?: string, organisationId?: string) => {
    if (!contactId && !organisationId) return;
    
    setAssigningDocId(docId);
    try {
      const updates: Partial<Document> = {};
      if (contactId) {
        updates.contact_id = contactId;
        // Auto-assign organisation if contact has one
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
          // Check for organizations array first (new field)
          if (contact.organizations && contact.organizations.length > 0) {
            const orgName = contact.organizations[0];
            const org = organisations.find(o => o.name === orgName);
            if (org) {
              updates.organisation_id = org.id;
            }
          }
          // Fallback to legacy organization field
          else if (contact.organization) {
            const org = organisations.find(o => o.name === contact.organization);
            if (org) {
              updates.organisation_id = org.id;
            }
          }
        }
      }
      if (organisationId) updates.organisation_id = organisationId;
      
      const updated = await documentsDb.updateDocument(docId, updates);
      if (updated) {
        setDocuments(prev => prev.map(doc => doc.id === docId ? updated : doc));
        window.dispatchEvent(new Event('documents-updated'));
        
        // Show success toast
        const doc = documents.find(d => d.id === docId);
        setToastMessage(`✓ Document "${doc?.name || 'Document'}" assigned successfully!`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (err: any) {
      console.error('Error assigning document:', err);
      alert('Failed to assign document: ' + (err.message || 'Unknown error'));
    } finally {
      setAssigningDocId(null);
    }
  };

  const handleAddContact = async (docId: string) => {
    if (!newContactName.trim()) {
      alert('Please enter contact name');
      return;
    }

    setAddingContactForDoc(docId);
    try {
      const newContact = {
        name: newContactName.trim(),
        email: newContactEmail.trim() || undefined,
        organization: newContactOrg.trim() || undefined,
        categories: [],
        status: 'mid' as const,
        tasks: [],
      };

      const result = await contactsDb.createContact(newContact);
      if (result) {
        // Reload contacts
        const updatedContacts = await contactsDb.getContacts();
        setContacts(updatedContacts);
        
        // Auto-assign to document
        let orgId: string | undefined;
        if (newContactOrg.trim()) {
          const org = organisations.find(o => o.name === newContactOrg.trim());
          if (org) {
            orgId = org.id;
          }
        }
        
        await handleAssignDocument(docId, result.id, orgId);
        
        // Reset form
        setNewContactName("");
        setNewContactEmail("");
        setNewContactOrg("");
        setShowAddContactModal(false);
        setAddingContactForDoc(null);
        setAddingContactForMessage(null);
      } else {
        alert('Failed to create contact. Contact may already exist.');
      }
    } catch (err: any) {
      console.error('Error creating contact:', err);
      alert('Failed to create contact: ' + (err.message || 'Unknown error'));
    } finally {
      setAddingContactForDoc(null);
    }
  };

  const parseEmailAddress = (address: string): { name?: string; email: string } => {
    // Match "Name <email@example.com>" or just "email@example.com"
    const withNameMatch = address.match(/^(.+?)\s*<(.+?)>$/);
    if (withNameMatch) {
      return { name: withNameMatch[1].trim(), email: withNameMatch[2].trim() };
    }
    // Just email address
    return { email: address.trim() };
  };

  const extractCompanyFromDomain = (email: string): string => {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return '';
    
    // Skip common email providers - these are NOT company names
    const emailProviders = ['gmail', 'hotmail', 'outlook', 'yahoo', 'icloud', 'protonmail', 'aol', 'mail', 'yandex', 'zoho'];
    if (emailProviders.some(provider => domain.includes(provider))) {
      return ''; // Don't use email provider as company name
    }
    
    // Remove common TLDs (.com, .pl, .org, etc.) and get company name
    const parts = domain.split('.');
    if (parts.length >= 2) {
      // Take the part before TLD (e.g., "middlebridge" from "middlebridge.pl")
      const company = parts[parts.length - 2];
      // Capitalize first letter and handle common patterns
      return company
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    // Fallback: just take first part
    const company = parts[0];
    return company.charAt(0).toUpperCase() + company.slice(1);
  };

  const extractNameFromEmail = (email: string): string => {
    const localPart = email.split('@')[0];
    if (!localPart) return '';
    
    // Handle patterns like: joanna.koszulska, joanna_koszulska, joanna-koszulska
    const separators = ['.', '_', '-'];
    for (const sep of separators) {
      if (localPart.includes(sep)) {
        const parts = localPart.split(sep);
        if (parts.length >= 2) {
          // Capitalize first letter of each part
          return parts
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
        }
      }
    }
    
    // If no separator, just capitalize first letter
    return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
  };

  const openAddContactModal = (docId: string, message: GmailMessage) => {
    const fromParsed = parseEmailAddress(message.from);
    const email = fromParsed.email;
    
    // Use name from "From" field if available, otherwise extract from email
    const name = fromParsed.name || extractNameFromEmail(email);
    const org = extractCompanyFromDomain(email);
    
    setAddingContactForDoc(docId);
    setAddingContactForMessage(message);
    setNewContactName(name);
    setNewContactEmail(email);
    setNewContactOrg(org);
    setShowAddContactModal(true);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString || dateString.trim() === '') {
      return '';
    }
    
    try {
      const date = parseISO(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // Try parsing as regular date string
        const fallbackDate = new Date(dateString);
        if (isNaN(fallbackDate.getTime())) {
          return dateString;
        }
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - fallbackDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) {
          return format(fallbackDate, "HH:mm");
        } else if (diffInDays < 7) {
          return format(fallbackDate, "EEE");
        } else if (diffInDays < 365) {
          return format(fallbackDate, "MMM d");
        } else {
          return format(fallbackDate, "MMM d, yyyy");
        }
      }
      
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) {
        return format(date, "HH:mm");
      } else if (diffInDays < 7) {
        return format(date, "EEE");
      } else if (diffInDays < 365) {
        return format(date, "MMM d");
      } else {
        return format(date, "MMM d, yyyy");
      }
    } catch {
      return dateString;
    }
  };

  if (checkingConnection) {
    return (
      <div className="p-6">
        <div className="text-neutral-400 text-sm">Checking Gmail connection...</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">E-mails</h2>
          <p className="text-sm text-neutral-400 mb-4">
            Connect your Gmail account to view your emails.
          </p>
          <button
            onClick={handleConnectGmail}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Connect Gmail
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">E-mails</h2>
          <div className="flex gap-2">
            {selectedMessage && selectedMessage.hasDocuments && (
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                title="Toggle documents sidebar"
              >
                📄 Documents ({documents.length})
              </button>
            )}
            <button
              onClick={() => fetchMessages()}
              disabled={loading}
              className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("with-attachments")}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              filter === "with-attachments"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            With Attachments
          </button>
          <button
            onClick={() => setFilter("without-attachments")}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              filter === "without-attachments"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            Without Attachments
          </button>
          <button
            onClick={() => setFilter("with-documents")}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              filter === "with-documents"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            With Documents
          </button>
          <button
            onClick={() => setFilter("without-documents")}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              filter === "without-documents"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            Without Documents
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              filter === "unread"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setFilter("read")}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              filter === "read"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            Read
          </button>
        </div>
        
        {/* Search and Sort */}
        <div className="space-y-3">
          {/* Gmail Query Search */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  fetchMessages();
                }
              }}
              placeholder="Gmail search (e.g., 'in:inbox', 'from:example@email.com', 'subject:invoice')"
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <button
              onClick={() => fetchMessages()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              Search
            </button>
          </div>

          {/* Content Search and Sort */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={contentSearch}
              onChange={(e) => setContentSearch(e.target.value)}
              placeholder="Wyszukaj po treści, temacie, nadawcy..."
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "none" | "contact" | "email" | "date")}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="date">Sortuj po dacie</option>
              <option value="contact">Sortuj po kontakcie</option>
              <option value="email">Sortuj po e-mailu</option>
              <option value="none">Bez sortowania</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="p-4 m-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading && messages.length === 0 ? (
          <div className="p-6 text-center text-neutral-400 text-sm">Loading emails...</div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-6 text-center text-neutral-400 text-sm">
            {messages.length === 0 ? "No emails found" : `No emails match the "${filter}" filter`}
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {filteredMessages.map((message) => {
              const fromParsed = parseEmailAddress(message.from);
              const isUnread = !message.isRead;
              const messageDocuments = documents.filter(doc => doc.source_gmail_message_id === message.id);
              
              // Create a map for fast lookup of saved documents by attachment_id and filename
              // Also normalize filenames for better matching (remove spaces, special chars, etc.)
              const normalizeFilename = (name: string): string => {
                return name.toLowerCase()
                  .replace(/\s+/g, '') // Remove all spaces
                  .replace(/[()]/g, '') // Remove parentheses
                  .replace(/[_-]/g, '') // Remove underscores and dashes
                  .replace(/\.[^.]*$/, ''); // Remove extension
              };
              
              const savedDocsMap = new Map<string, Document>();
              const normalizedNamesMap = new Map<string, Document>();
              
              documents.forEach(doc => {
                if (doc.source_gmail_attachment_id) {
                  savedDocsMap.set(doc.source_gmail_attachment_id, doc);
                }
                if (doc.name) {
                  const lowerName = doc.name.toLowerCase();
                  savedDocsMap.set(lowerName, doc);
                  // Also add normalized version for fuzzy matching
                  const normalized = normalizeFilename(doc.name);
                  if (normalized) {
                    normalizedNamesMap.set(normalized, doc);
                  }
                }
              });
              
              return (
                <div
                  key={message.id}
                  className={`p-4 hover:bg-neutral-900/50 transition-colors ${
                    isUnread ? "bg-neutral-900/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-white text-sm font-medium">
                      {fromParsed.name?.[0]?.toUpperCase() || fromParsed.email[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm ${isUnread ? "font-semibold text-white" : "text-neutral-300"}`}>
                          {fromParsed.name || fromParsed.email}
                        </span>
                        {message.hasAttachments && (
                          <span className="text-xs text-blue-400 font-medium">
                            ATTACHMENTS: {message.attachmentCount}
                          </span>
                        )}
                        {message.hasDocuments && (
                          <span className="text-xs text-green-400 font-medium">
                            IN DATABASE: {messageDocuments.length}
                          </span>
                        )}
                        <span className="text-xs text-neutral-500 ml-auto">
                          {formatDate(message.date)}
                        </span>
                        <button
                          onClick={(e) => handleDeleteMessage(message.id, e)}
                          disabled={deletingMessageId === message.id}
                          className="ml-2 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                          title="Delete email"
                        >
                          {deletingMessageId === message.id ? "..." : "Delete"}
                        </button>
                      </div>
                      <div className={`text-sm mb-2 ${isUnread ? "font-medium text-white" : "text-neutral-400"}`}>
                        {message.subject}
                      </div>
                      <div className="text-xs text-neutral-500 line-clamp-2 mb-3">
                        {message.snippet}
                      </div>
                      
                      {/* Attachments - visible directly in list */}
                      {message.hasAttachments && message.attachments && (
                        <div className="mt-3 p-3 bg-blue-900/20 border border-blue-600/50 rounded">
                          <div className="text-xs text-blue-400 font-bold mb-2">ATTACHMENTS ({message.attachmentCount}):</div>
                          <div className="space-y-2">
                            {message.attachments.map((attachment) => {
                              // Check if attachment is saved - use map for fast lookup
                              const normalizeFilename = (name: string): string => {
                                return name.toLowerCase()
                                  .replace(/\s+/g, '') // Remove all spaces
                                  .replace(/[()]/g, '') // Remove parentheses
                                  .replace(/[_-]/g, '') // Remove underscores and dashes
                                  .replace(/\.[^.]*$/, ''); // Remove extension
                              };
                              
                              const attachmentNormalized = normalizeFilename(attachment.filename);
                              const savedDoc = savedDocsMap.get(attachment.id) || 
                                             savedDocsMap.get(attachment.filename.toLowerCase()) ||
                                             normalizedNamesMap.get(attachmentNormalized) ||
                                             documents.find(doc => {
                                               if (!doc.name) return false;
                                               const docNormalized = normalizeFilename(doc.name);
                                               return docNormalized === attachmentNormalized ||
                                                      doc.name.toLowerCase() === attachment.filename.toLowerCase();
                                             });
                              const isSaved = !!savedDoc;
                              
                              return (
                                <div key={attachment.id} className={`p-2 rounded border ${
                                  isSaved 
                                    ? 'bg-green-900/30 border-green-600' 
                                    : 'bg-neutral-800 border-blue-600/30'
                                }`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-bold text-white">
                                        {attachment.filename}
                                      </div>
                                      <div className="text-xs text-neutral-400">
                                        {attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : ''} • {attachment.mimeType.split('/').pop()}
                                        {isSaved && <span className="text-green-400 font-bold ml-2">✓ IN DATABASE</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-2 flex-wrap">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadAttachment(message.id, attachment.id, attachment.filename, e);
                                      }}
                                      disabled={downloadingAttachmentId === attachment.id}
                                      className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                                    >
                                      {downloadingAttachmentId === attachment.id ? 'Downloading...' : 'Download'}
                                    </button>
                                    {!isSaved && (
                                      <>
                                        <button
                                          onClick={(e) => handleSaveAttachment(message.id, attachment.id, attachment.filename, attachment.mimeType, e)}
                                          disabled={savingAttachmentId === attachment.id}
                                          className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-bold transition-colors disabled:opacity-50"
                                        >
                                          {savingAttachmentId === attachment.id ? 'Adding...' : '+ ADD TO DATABASE'}
                                        </button>
                                        {attachment.mimeType?.toLowerCase().includes('pdf') && (
                                          <>
                                            <button
                                              onClick={(e) => handleOpenInvoiceModal(message.id, attachment.id, attachment.filename, attachment.mimeType, 'cost', e)}
                                              disabled={savingInvoice}
                                              className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                                            >
                                              Cost
                                            </button>
                                            <button
                                              onClick={(e) => handleOpenInvoiceModal(message.id, attachment.id, attachment.filename, attachment.mimeType, 'revenue', e)}
                                              disabled={savingInvoice}
                                              className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                                            >
                                              Rev
                                            </button>
                                            <button
                                              onClick={(e) => handleOpenInvoiceModal(message.id, attachment.id, attachment.filename, attachment.mimeType, 'CIT', e)}
                                              disabled={savingInvoice}
                                              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                                            >
                                              CIT
                                            </button>
                                            <button
                                              onClick={(e) => handleOpenInvoiceModal(message.id, attachment.id, attachment.filename, attachment.mimeType, 'VAT', e)}
                                              disabled={savingInvoice}
                                              className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                                            >
                                              VAT
                                            </button>
                                          </>
                                        )}
                                      </>
                                    )}
                                    {isSaved && savedDoc && (
                                      <div className="flex gap-2 items-center">
                                        <span className="px-3 py-1.5 text-xs bg-green-600/30 text-green-400 border border-green-600 rounded font-medium">
                                          ✓ IN DATABASE
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Navigate to documents view and highlight this document
                                            window.location.href = `/documents?highlight=${savedDoc.id}`;
                                          }}
                                          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                                          title="Edit document"
                                        >
                                          EDIT
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Documents in database - visible directly in list */}
                      {message.hasDocuments && messageDocuments.length > 0 && (
                        <div className="mt-3 p-3 bg-green-900/20 border border-green-600/50 rounded">
                          <div className="text-xs text-green-400 font-bold mb-2">DOCUMENTS IN DATABASE ({messageDocuments.length}):</div>
                          <div className="space-y-2">
                            {messageDocuments.map((doc) => {
                              const contact = doc.contact_id ? contacts.find(c => c.id === doc.contact_id) : null;
                              const org = doc.organisation_id ? organisations.find(o => o.id === doc.organisation_id) : null;
                              
                              return (
                                <div key={doc.id} className="p-2 bg-neutral-800 rounded border border-green-600/30">
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-bold text-green-400 hover:text-green-300 hover:underline block mb-1"
                                  >
                                    {doc.name}
                                  </a>
                                  <div className="text-xs text-neutral-400 mb-2">
                                    {doc.file_type?.split('/').pop()}
                                  </div>
                                  <div className="flex gap-2">
                                    <select
                                      value={doc.contact_id || ''}
                                      onChange={(e) => {
                                        if (e.target.value === 'ADD_NEW') {
                                          // Find the message for this document
                                          const message = messages.find(msg => msg.id === doc.source_gmail_message_id);
                                          if (message) {
                                            openAddContactModal(doc.id, message);
                                          } else {
                                            // Fallback if message not found
                                            setAddingContactForDoc(doc.id);
                                            setAddingContactForMessage(null);
                                            setNewContactName("");
                                            setNewContactEmail("");
                                            setNewContactOrg("");
                                            setShowAddContactModal(true);
                                          }
                                        } else {
                                          handleAssignDocument(doc.id, e.target.value || undefined, doc.organisation_id);
                                        }
                                      }}
                                      disabled={assigningDocId === doc.id}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex-1 bg-neutral-900 border border-green-600/30 rounded px-2 py-1 text-xs text-white"
                                    >
                                      <option value="">Contact...</option>
                                      {contacts.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                      <option value="ADD_NEW" className="bg-green-600">+ Add New Contact</option>
                                    </select>
                                    <select
                                      value={doc.organisation_id || ''}
                                      onChange={(e) => handleAssignDocument(doc.id, doc.contact_id, e.target.value || undefined)}
                                      disabled={assigningDocId === doc.id}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex-1 bg-neutral-900 border border-green-600/30 rounded px-2 py-1 text-xs text-white"
                                    >
                                      <option value="">Organisation...</option>
                                      {organisations.map(o => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {(contact || org) && (
                                    <div className="mt-2 text-xs text-green-300">
                                      {contact && <span>Contact: {contact.name} </span>}
                                      {org && <span>Org: {org.name}</span>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More / Load All */}
        {nextPageToken && (
          <div className="p-4 text-center flex gap-2 justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load More"}
            </button>
            <button
              onClick={handleLoadAll}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              {loading ? "Loading All..." : "Load All"}
            </button>
          </div>
        )}
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedMessage(null)}
        >
          <div
            className="bg-neutral-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{selectedMessage.subject}</h3>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-neutral-400 hover:text-white"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-2 text-sm mb-4">
                <div>
                  <span className="text-neutral-400">From: </span>
                  <span className="text-white">{selectedMessage.from}</span>
                </div>
                {selectedMessage.to && (
                  <div>
                    <span className="text-neutral-400">To: </span>
                    <span className="text-white">{selectedMessage.to}</span>
                  </div>
                )}
                {selectedMessage.cc && (
                  <div>
                    <span className="text-neutral-400">Cc: </span>
                    <span className="text-white">{selectedMessage.cc}</span>
                  </div>
                )}
                <div>
                  <span className="text-neutral-400">Date: </span>
                  <span className="text-white">
                    {(() => {
                      try {
                        const date = parseISO(selectedMessage.date);
                        if (isNaN(date.getTime())) {
                          return selectedMessage.date;
                        }
                        return format(date, "PPpp");
                      } catch {
                        return selectedMessage.date;
                      }
                    })()}
                  </span>
                </div>
                {selectedMessage.hasAttachments && selectedMessage.attachments && (() => {
                  // Create a map for fast lookup of saved documents by attachment_id and filename
                  // Also normalize filenames for better matching
                  const normalizeFilename = (name: string): string => {
                    return name.toLowerCase()
                      .replace(/\s+/g, '') // Remove all spaces
                      .replace(/[()]/g, '') // Remove parentheses
                      .replace(/[_-]/g, '') // Remove underscores and dashes
                      .replace(/\.[^.]*$/, ''); // Remove extension
                  };
                  
                  const savedDocsMap = new Map<string, Document>();
                  const normalizedNamesMap = new Map<string, Document>();
                  
                  documents.forEach(doc => {
                    if (doc.source_gmail_attachment_id) {
                      savedDocsMap.set(doc.source_gmail_attachment_id, doc);
                    }
                    if (doc.name) {
                      const lowerName = doc.name.toLowerCase();
                      savedDocsMap.set(lowerName, doc);
                      // Also add normalized version for fuzzy matching
                      const normalized = normalizeFilename(doc.name);
                      if (normalized) {
                        normalizedNamesMap.set(normalized, doc);
                      }
                    }
                  });
                  
                  return (
                    <div className="mt-4 p-4 bg-blue-900/20 border-2 border-blue-600/50 rounded-lg">
                      <div className="mb-3">
                        <span className="text-blue-400 font-bold text-base">ATTACHMENTS ({selectedMessage.attachmentCount}):</span>
                      </div>
                      <div className="space-y-3">
                        {selectedMessage.attachments.map((attachment) => {
                          // Check if this attachment is already saved as document
                          const normalizeFilename = (name: string): string => {
                            return name.toLowerCase()
                              .replace(/\s+/g, '') // Remove all spaces
                              .replace(/[()]/g, '') // Remove parentheses
                              .replace(/[_-]/g, '') // Remove underscores and dashes
                              .replace(/\.[^.]*$/, ''); // Remove extension
                          };
                          
                          const attachmentNormalized = normalizeFilename(attachment.filename);
                          const savedDoc = savedDocsMap.get(attachment.id) || 
                                         savedDocsMap.get(attachment.filename.toLowerCase()) ||
                                         normalizedNamesMap.get(attachmentNormalized) ||
                                         documents.find(doc => {
                                           if (!doc.name) return false;
                                           const docNormalized = normalizeFilename(doc.name);
                                           return docNormalized === attachmentNormalized ||
                                                  doc.name.toLowerCase() === attachment.filename.toLowerCase();
                                         });
                          const isSaved = !!savedDoc;
                        
                        return (
                          <div key={attachment.id} className={`p-4 rounded border-2 ${
                            isSaved 
                              ? 'bg-green-900/30 border-green-600' 
                              : 'bg-neutral-800 border-blue-600/50'
                          }`}>
                            <div className="mb-3">
                              <div className="text-base font-bold text-white mb-1">
                                {attachment.filename}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-neutral-300">
                                {attachment.size && (
                                  <span>Size: {(attachment.size / 1024).toFixed(1)} KB</span>
                                )}
                                <span>Type: {attachment.mimeType.split('/').pop()}</span>
                                {isSaved && (
                                  <span className="text-green-400 font-bold">✓ ALREADY IN DATABASE</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => handleDownloadAttachment(selectedMessage.id, attachment.id, attachment.filename, e)}
                                disabled={downloadingAttachmentId === attachment.id}
                                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {downloadingAttachmentId === attachment.id ? 'Downloading...' : 'Download File'}
                              </button>
                              {!isSaved && (
                                <button
                                  onClick={(e) => handleSaveAttachment(selectedMessage.id, attachment.id, attachment.filename, attachment.mimeType, e)}
                                  disabled={savingAttachmentId === attachment.id}
                                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingAttachmentId === attachment.id ? 'Adding...' : '+ ADD TO DATABASE'}
                                </button>
                              )}
                              {isSaved && savedDoc && (
                                <div className="flex gap-2 items-center">
                                  <span className="px-4 py-2 text-sm bg-green-600/30 text-green-400 border border-green-600 rounded font-medium">
                                    ✓ IN DATABASE
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Navigate to documents view and highlight this document
                                      window.location.href = `/documents?highlight=${savedDoc.id}`;
                                    }}
                                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                                    title="Edit document"
                                  >
                                    EDIT
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })()}
                {selectedMessage.hasDocuments && documents.length > 0 && (
                  <div className="mt-4 p-4 bg-green-900/30 border-2 border-green-600 rounded-lg">
                    <div className="mb-3">
                      <span className="text-green-400 font-bold text-lg">IMPORTED DOCUMENTS IN DATABASE ({documents.length}):</span>
                    </div>
                    <div className="space-y-3">
                      {documents.map((doc) => {
                        const contact = doc.contact_id ? contacts.find(c => c.id === doc.contact_id) : null;
                        const org = doc.organisation_id ? organisations.find(o => o.id === doc.organisation_id) : null;
                        
                        return (
                          <div key={doc.id} className="p-4 bg-neutral-800 rounded border-2 border-green-600/50">
                            <div className="mb-3">
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-base font-bold text-green-400 hover:text-green-300 hover:underline block mb-1"
                                title={doc.name}
                              >
                                {doc.name}
                              </a>
                              {doc.file_type && (
                                <div className="text-sm text-neutral-300">
                                  File Type: {doc.file_type.split('/').pop()}
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-4 space-y-3">
                              <div>
                                <label className="text-sm text-green-300 block mb-2 font-bold">ASSIGN TO CONTACT:</label>
                                <select
                                  value={doc.contact_id || ''}
                                  onChange={(e) => handleAssignDocument(doc.id, e.target.value || undefined, doc.organisation_id)}
                                  disabled={assigningDocId === doc.id}
                                  className="w-full bg-neutral-900 border-2 border-green-600/50 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                  <option value="">-- Select Contact --</option>
                                  {contacts.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-sm text-green-300 block mb-2 font-bold">ASSIGN TO ORGANISATION:</label>
                                <select
                                  value={doc.organisation_id || ''}
                                  onChange={(e) => handleAssignDocument(doc.id, doc.contact_id, e.target.value || undefined)}
                                  disabled={assigningDocId === doc.id}
                                  className="w-full bg-neutral-900 border-2 border-green-600/50 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                  <option value="">-- Select Organisation --</option>
                                  {organisations.map(o => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {(contact || org) && (
                              <div className="mt-3 pt-3 border-t-2 border-green-600/30">
                                {contact && (
                                  <div className="text-sm text-green-300 mb-1">
                                    ✓ ASSIGNED TO CONTACT: <span className="text-green-400 font-bold">{contact.name}</span>
                                  </div>
                                )}
                                {org && (
                                  <div className="text-sm text-green-300">
                                    ✓ ASSIGNED TO ORGANISATION: <span className="text-green-400 font-bold">{org.name}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedMessage) {
                      handleDeleteMessage(selectedMessage.id, e);
                      setSelectedMessage(null);
                    }
                  }}
                  disabled={deletingMessageId === selectedMessage.id}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors disabled:opacity-50"
                >
                  {deletingMessageId === selectedMessage.id ? "Deleting..." : "Delete Email"}
                </button>
              </div>
              
              <div className="border-t border-neutral-800 pt-4">
                <div className="text-neutral-300 whitespace-pre-wrap">
                  {selectedMessage.snippet}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documents Sidebar */}
      {showSidebar && selectedMessage && (
        <div 
          className="fixed right-0 top-0 bottom-0 w-96 bg-neutral-900 border-l border-neutral-800 z-[60] overflow-y-auto shadow-2xl"
          style={{ marginTop: '0px' }}
        >
          <div className="p-4 border-b border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-white">Documents</h3>
              <button
                onClick={() => setShowSidebar(false)}
                className="text-neutral-400 hover:text-white"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              {selectedMessage.subject}
            </p>
          </div>

          <div className="p-4">
            {loadingDocuments ? (
              <div className="text-center text-neutral-400 text-sm py-8">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="text-center text-neutral-400 text-sm py-8">
                No documents imported yet
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const contact = doc.contact_id ? contacts.find(c => c.id === doc.contact_id) : null;
                  const org = doc.organisation_id ? organisations.find(o => o.id === doc.organisation_id) : null;
                  
                  return (
                    <div key={doc.id} className="p-3 bg-neutral-800/50 rounded border border-neutral-700/50">
                      <div className="flex items-start justify-between mb-2">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 hover:underline flex-1 min-w-0"
                          title={doc.name}
                        >
                          {doc.name}
                        </a>
                      </div>
                      
                      {doc.file_type && (
                        <div className="text-xs text-neutral-500 mb-2">
                          {doc.file_type.split('/').pop()}
                        </div>
                      )}

                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-neutral-400 block mb-1">Assign to Contact:</label>
                          <select
                            value={doc.contact_id || ''}
                            onChange={(e) => handleAssignDocument(doc.id, e.target.value || undefined, doc.organisation_id)}
                            disabled={assigningDocId === doc.id}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
                          >
                            <option value="">-- None --</option>
                            {contacts.map(c => (
                              <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs text-neutral-400 block mb-1">Assign to Organisation:</label>
                          <select
                            value={doc.organisation_id || ''}
                            onChange={(e) => handleAssignDocument(doc.id, doc.contact_id, e.target.value || undefined)}
                            disabled={assigningDocId === doc.id}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
                          >
                            <option value="">-- None --</option>
                            {organisations.map(o => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {contact && (
                        <div className="mt-2 text-xs text-neutral-400">
                          Contact: <span className="text-neutral-300">{contact.name}</span>
                        </div>
                      )}
                      {org && (
                        <div className="mt-1 text-xs text-neutral-400">
                          Organisation: <span className="text-neutral-300">{org.name}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-[100] animate-[slideIn_0.3s_ease-out]">
          <div className="bg-green-600/95 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-xl border border-green-500/50 flex items-center gap-2 min-w-[300px]">
            <svg className="w-5 h-5 text-green-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-neutral-900 rounded-lg max-w-md w-full border border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add New Contact</h3>
              <button
                onClick={() => {
                  setShowAddContactModal(false);
                  setNewContactName("");
                  setNewContactEmail("");
                  setNewContactOrg("");
                  setAddingContactForDoc(null);
                  setAddingContactForMessage(null);
                }}
                className="text-neutral-400 hover:text-white"
              >
                ×
              </button>
            </div>
            
            {addingContactForMessage && (
              <div className="mb-4 p-3 bg-blue-900/20 border border-blue-600/50 rounded text-xs text-blue-300">
                <div className="font-medium mb-1">Data extracted from email:</div>
                <div>From: {addingContactForMessage.from}</div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Contact name"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newContactName.trim()) {
                      handleAddContact(addingContactForDoc || '');
                    }
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Email</label>
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                />
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Organisation (from email domain)</label>
                <input
                  type="text"
                  value={newContactOrg}
                  onChange={(e) => setNewContactOrg(e.target.value)}
                  placeholder="Organisation name"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowAddContactModal(false);
                    setNewContactName("");
                    setNewContactEmail("");
                    setNewContactOrg("");
                    setAddingContactForDoc(null);
                    setAddingContactForMessage(null);
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => addingContactForDoc && handleAddContact(addingContactForDoc)}
                  disabled={!newContactName.trim() || addingContactForDoc === null}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingContactForDoc ? 'Add Contact' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice/Tax Modal */}
      {showInvoiceModal && invoiceModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {invoiceModalData.type === 'cost' ? 'Cost Invoice' :
                 invoiceModalData.type === 'revenue' ? 'Revenue Invoice' :
                 invoiceModalData.type === 'CIT' ? 'CIT Tax' :
                 'VAT Tax'}
              </h3>
              <button
                onClick={() => {
                  setShowInvoiceModal(false);
                  setInvoiceModalData(null);
                }}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="text-sm text-neutral-400 mb-4">
                File: {invoiceModalData.filename}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Currency *</label>
                  <select
                    value={invoiceCurrency}
                    onChange={(e) => setInvoiceCurrency(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                  >
                    <option value="PLN">PLN</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="SAR">SAR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Month *</label>
                  <select
                    value={invoiceMonth}
                    onChange={(e) => setInvoiceMonth(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select month</option>
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Year *</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={invoiceYear}
                    onChange={(e) => setInvoiceYear(e.target.value)}
                    placeholder="YYYY"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                </div>
              </div>
              
              <button
                onClick={handleSaveInvoice}
                disabled={savingInvoice || !invoiceAmount || !invoiceCurrency || !invoiceMonth || !invoiceYear}
                className="w-full px-4 py-2 bg-white text-black rounded text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingInvoice ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

