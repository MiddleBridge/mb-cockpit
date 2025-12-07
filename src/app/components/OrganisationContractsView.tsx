"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import * as contractsDb from "../../lib/db/organisation-contracts";
import * as documentsDb from "../../lib/db/documents";
import * as lawNotesDb from "../../lib/db/law_notes";
import * as organisationsDb from "../../lib/db/organisations";
import * as storage from "../../lib/storage";
import { supabase } from "../../lib/supabase";
import type {
  OrganisationDocument,
  OrganisationContractComment,
  OrganisationContractTerm,
} from "../../lib/db/organisation-contracts";
import type { Document } from "../../lib/db/documents";
import type { ContractAnalysisResult, ContractComment, ContractTermEntry } from "../../types/contractAnalysis";
import TopSummaryBar from "./contract-analysis/TopSummaryBar";
import ActionStepsPanel from "./contract-analysis/ActionStepsPanel";
import AnalysisTabs from "./contract-analysis/AnalysisTabs";
import TermDetailModal from "./contract-analysis/TermDetailModal";
import { exportAnalysisToPdf } from "./contract-analysis/exportToPdf";
import SeverityBadge from "./contract-analysis/SeverityBadge";
import DecisionBadge from "./contract-analysis/DecisionBadge";
import SeverityDot from "./contract-analysis/SeverityDot";

interface OrganisationContractsViewProps {
  organisationId: string;
}

export default function OrganisationContractsView({
  organisationId,
}: OrganisationContractsViewProps) {
  const [documents, setDocuments] = useState<OrganisationDocument[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([]);
  const [comments, setComments] = useState<OrganisationContractComment[]>([]);
  const [terms, setTerms] = useState<OrganisationContractTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<OrganisationDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkingDocumentId, setLinkingDocumentId] = useState<string | null>(null);
  
  // AI Analysis state
  const [aiJsonInput, setAiJsonInput] = useState("");
  const [aiJsonError, setAiJsonError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ContractAnalysisResult | null>(null);
  const [selectedTermDetail, setSelectedTermDetail] = useState<ContractTermEntry | null>(null);
  const analysisSectionRef = useRef<HTMLDivElement>(null);
  const [organisationName, setOrganisationName] = useState<string>("");
  
  // Document upload form
  const [newDocumentName, setNewDocumentName] = useState("");
  const [newDocumentType, setNewDocumentType] = useState("main_contract");
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  // Comment form
  const [newCommentText, setNewCommentText] = useState("");
  const [newCommentSeverity, setNewCommentSeverity] = useState<"low" | "medium" | "high">("medium");
  const [newCommentDocumentId, setNewCommentDocumentId] = useState<string>("");
  const [showCommentForm, setShowCommentForm] = useState(false);
  
  // Term form
  const [editingTerm, setEditingTerm] = useState<OrganisationContractTerm | null>(null);
  const [termForm, setTermForm] = useState({
    term_key: "",
    term_label: "",
    term_value: "",
    start_date: "",
    end_date: "",
    renewal_type: "" as "" | "none" | "fixed" | "auto",
    renewal_date: "",
    billing_cycle: "" as "" | "monthly" | "quarterly" | "yearly",
    importance: "medium" as "low" | "medium" | "high",
    document_id: "",
  });
  const [showTermForm, setShowTermForm] = useState(false);

  useEffect(() => {
    loadContracts();
  }, [organisationId]);

  // Load saved analysis result when document changes
  useEffect(() => {
    if (selectedDocument?.ai_analysis_result) {
      try {
        const saved = selectedDocument.ai_analysis_result as ContractAnalysisResult;
        setAnalysisResult(saved);
        setAiJsonInput(JSON.stringify(saved, null, 2));
        setAiJsonError(null);
      } catch (error) {
        console.error("Error loading saved analysis:", error);
        setAnalysisResult(null);
        setAiJsonInput("");
      }
    } else {
      setAnalysisResult(null);
      setAiJsonInput("");
      setAiJsonError(null);
    }
  }, [selectedDocument?.id]);

  // Load analysis guide from Knowledge when document is selected
  useEffect(() => {
    const loadAnalysisGuideFromKnowledge = async () => {
      if (!selectedDocument || selectedDocument.analysis_guide) {
        // Don't overwrite if guide already exists
        return;
      }

      try {
        const lawNote = await lawNotesDb.getLawNoteByDocumentType(selectedDocument.type);
        if (lawNote && lawNote.content) {
          // Auto-fill analysis guide with content from Knowledge
          await handleUpdateAnalysisGuide(selectedDocument.id, lawNote.content);
        }
      } catch (error) {
        console.error("Error loading analysis guide from Knowledge:", error);
      }
    };

    if (selectedDocument?.id) {
      loadAnalysisGuideFromKnowledge();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocument?.id, selectedDocument?.type]);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const data = await contractsDb.getOrganisationContracts(organisationId);
      setDocuments(data.documents);
      setComments(data.comments);
      setTerms(data.terms);
      
      // Load organisation name
      const organisations = await organisationsDb.getOrganisations();
      const organisation = organisations.find((o) => o.id === organisationId);
      if (organisation) {
        setOrganisationName(organisation.name);
      }
      
      // Auto-select first document if available
      if (data.documents.length > 0 && !selectedDocument) {
        setSelectedDocument(data.documents[0]);
      }
      
      // Load available documents after contracts are loaded
      await loadAvailableDocuments(data.documents);
    } catch (error) {
      console.error("Error loading contracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableDocuments = async (linkedDocs: OrganisationDocument[] = documents) => {
    try {
      const orgDocs = await documentsDb.getDocumentsByOrganisation(organisationId);
      // Filter only PDFs or documents that could be contracts
      const contractDocs = orgDocs.filter(
        (doc) => 
          doc.file_type?.toLowerCase() === 'pdf' || 
          doc.file_url?.toLowerCase().endsWith('.pdf') ||
          doc.document_type?.toLowerCase().includes('contract') ||
          doc.document_type?.toLowerCase().includes('umowa')
      );
      
      // Filter out documents that are already linked (by name match)
      // This is a simple check - if a document with the same name exists in organisation_documents, skip it
      const linkedNames = new Set(linkedDocs.map(d => d.name.toLowerCase().trim()));
      const unlinkedDocs = contractDocs.filter(
        doc => !linkedNames.has(doc.name.toLowerCase().trim())
      );
      
      setAvailableDocuments(unlinkedDocs);
    } catch (error) {
      console.error("Error loading available documents:", error);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file');
      return;
    }

    setUploading(true);
    try {
      // Upload to Storage (use organisation-contracts bucket or folder)
      const uploadResult = await storage.uploadFile(file, 'organisation-contracts');
      
      if (uploadResult.error) {
        alert(`Upload failed: ${uploadResult.error}`);
        return;
      }

      // Create document record
      const document = await contractsDb.createOrganisationDocument({
        organisation_id: organisationId,
        name: newDocumentName || file.name,
        type: newDocumentType,
        storage_path: uploadResult.path,
        parsed_text: undefined,
        analysis_guide: undefined,
      });

      if (!document) {
        alert('Failed to create document record');
        return;
      }

      // Trigger PDF parsing
      try {
        const response = await fetch('/api/contracts/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: document.id,
            storagePath: uploadResult.path,
          }),
        });

        if (!response.ok) {
          console.error('PDF parsing failed, but document was saved');
        }
      } catch (parseError) {
        console.error('Error triggering PDF parse:', parseError);
      }

      // Reset form and reload
      setNewDocumentName("");
      setNewDocumentType("main_contract");
      setShowUploadForm(false);
      await loadContracts();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateAnalysisGuide = async (documentId: string, guide: string) => {
    const result = await contractsDb.updateOrganisationDocument(documentId, {
      analysis_guide: guide,
    });
    if (result) {
      await loadContracts();
      // Update selected document
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(result);
      }
    }
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;

    const result = await contractsDb.createOrganisationContractComment({
      organisation_id: organisationId,
      document_id: newCommentDocumentId || undefined,
      comment_text: newCommentText.trim(),
      severity: newCommentSeverity,
      author: undefined,
    });

    if (result) {
      setNewCommentText("");
      setNewCommentSeverity("medium");
      setNewCommentDocumentId("");
      setShowCommentForm(false);
      await loadContracts();
    }
  };

  const handleSaveTerm = async () => {
    if (!termForm.term_label.trim() || !termForm.term_value.trim()) {
      alert('Please fill in term label and value');
      return;
    }

    if (editingTerm) {
      // Update existing term
      const result = await contractsDb.updateOrganisationContractTerm(editingTerm.id, {
        term_key: termForm.term_key || editingTerm.term_key,
        term_label: termForm.term_label,
        term_value: termForm.term_value,
        start_date: termForm.start_date || undefined,
        end_date: termForm.end_date || undefined,
        renewal_type: termForm.renewal_type || undefined,
        renewal_date: termForm.renewal_date || undefined,
        billing_cycle: termForm.billing_cycle || undefined,
        importance: termForm.importance,
        document_id: termForm.document_id || undefined,
      });
      if (result) {
        await loadContracts();
        setEditingTerm(null);
        setShowTermForm(false);
        resetTermForm();
      }
    } else {
      // Create new term
      const result = await contractsDb.createOrganisationContractTerm({
        organisation_id: organisationId,
        term_key: termForm.term_key || termForm.term_label.toLowerCase().replace(/\s+/g, '_'),
        term_label: termForm.term_label,
        term_value: termForm.term_value,
        start_date: termForm.start_date || undefined,
        end_date: termForm.end_date || undefined,
        renewal_type: termForm.renewal_type || undefined,
        renewal_date: termForm.renewal_date || undefined,
        billing_cycle: termForm.billing_cycle || undefined,
        importance: termForm.importance,
        document_id: termForm.document_id || undefined,
        is_active: true,
      });
      if (result) {
        await loadContracts();
        setShowTermForm(false);
        resetTermForm();
      }
    }
  };

  const resetTermForm = () => {
    setTermForm({
      term_key: "",
      term_label: "",
      term_value: "",
      start_date: "",
      end_date: "",
      renewal_type: "",
      renewal_date: "",
      billing_cycle: "",
      importance: "medium",
      document_id: "",
    });
  };

  const handleEditTerm = (term: OrganisationContractTerm) => {
    setEditingTerm(term);
    setTermForm({
      term_key: term.term_key,
      term_label: term.term_label,
      term_value: term.term_value,
      start_date: term.start_date || "",
      end_date: term.end_date || "",
      renewal_type: term.renewal_type || "",
      renewal_date: term.renewal_date || "",
      billing_cycle: term.billing_cycle || "",
      importance: term.importance,
      document_id: term.document_id || "",
    });
    setShowTermForm(true);
  };

  const handleDeactivateTerm = async (termId: string) => {
    if (confirm('Deactivate this term?')) {
      await contractsDb.updateOrganisationContractTerm(termId, { is_active: false });
      await loadContracts();
    }
  };

  const handleLinkDocument = async (doc: Document) => {
    if (!doc.file_url) {
      alert('Document has no file URL');
      return;
    }

    setLinkingDocumentId(doc.id);
    try {
      // Extract storage path from file_url
      // file_url format: https://...supabase.co/storage/v1/object/public/bucket-name/path/to/file.pdf
      let storagePath = '';
      const urlParts = doc.file_url.split('/storage/v1/object/public/');
      if (urlParts.length >= 2) {
        // Remove bucket name (first part after /public/)
        const pathAfterBucket = urlParts[1];
        const firstSlash = pathAfterBucket.indexOf('/');
        if (firstSlash > 0) {
          storagePath = pathAfterBucket.substring(firstSlash + 1);
        } else {
          // If no slash after bucket, it's just the filename
          storagePath = pathAfterBucket;
        }
      } else {
        // If URL doesn't match expected format, try to extract from URL path
        try {
          const url = new URL(doc.file_url);
          const pathParts = url.pathname.split('/');
          // Find 'public' in path and take everything after bucket name
          const publicIndex = pathParts.indexOf('public');
          if (publicIndex >= 0 && pathParts.length > publicIndex + 2) {
            storagePath = pathParts.slice(publicIndex + 2).join('/');
          } else {
            // Fallback: use filename from URL
            storagePath = pathParts[pathParts.length - 1] || doc.name;
          }
        } catch {
          // Last resort: use document name
          storagePath = doc.name;
        }
      }

      // Determine document type from document_type or name
      let docType = "main_contract";
      if (doc.document_type) {
        const dt = doc.document_type.toLowerCase();
        if (dt.includes('annex') || dt.includes('aneks')) docType = "annex";
        else if (dt.includes('nda')) docType = "nda";
        else if (dt.includes('sow') || dt.includes('statement of work')) docType = "sow";
      }

      // Create organisation document record
      const orgDoc = await contractsDb.createOrganisationDocument({
        organisation_id: organisationId,
        name: doc.name,
        type: docType,
        storage_path: storagePath,
        parsed_text: undefined,
        analysis_guide: undefined,
      });

      if (!orgDoc) {
        alert('Failed to link document');
        return;
      }

      // Trigger PDF parsing if it's a PDF
      if (doc.file_url.toLowerCase().endsWith('.pdf') || doc.file_type?.toLowerCase() === 'pdf') {
        try {
          const response = await fetch('/api/contracts/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId: orgDoc.id,
              storagePath: storagePath,
            }),
          });

          if (!response.ok) {
            console.error('PDF parsing failed, but document was linked');
          }
        } catch (parseError) {
          console.error('Error triggering PDF parse:', parseError);
        }
      }

      // Reload contracts (which will also reload available documents)
      await loadContracts();
    } catch (error: any) {
      console.error("Error linking document:", error);
      alert(`Failed to link document: ${error.message}`);
    } finally {
      setLinkingDocumentId(null);
    }
  };

  const getDocumentUrl = (storagePath: string) => {
    const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'mb-cockpit';
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const handleParseAiJson = async () => {
    if (!aiJsonInput.trim()) {
      setAiJsonError("Paste AI JSON first");
      return;
    }

    try {
      // Try to extract JSON if it's wrapped in markdown code blocks
      let jsonString = aiJsonInput.trim();
      if (jsonString.startsWith('```')) {
        const lines = jsonString.split('\n');
        jsonString = lines.slice(1, -1).join('\n').trim();
      }
      if (jsonString.startsWith('```json')) {
        const lines = jsonString.split('\n');
        jsonString = lines.slice(1, -1).join('\n').trim();
      }

      const parsed = JSON.parse(jsonString) as ContractAnalysisResult;
      
      // Minimalna walidacja
      if (
        !parsed ||
        !Array.isArray(parsed.comments) ||
        !parsed.terms ||
        !Array.isArray(parsed.terms.current) ||
        !Array.isArray(parsed.terms.after_comments)
      ) {
        throw new Error("JSON does not match expected structure");
      }

      // Generate default summary if missing
      if (!parsed.summary) {
        const mustChangeCount = parsed.comments.filter(
          (c) => c.decision_flag === "MUST_CHANGE"
        ).length;
        const highSeverityCount = parsed.comments.filter(
          (c) => c.severity_pl === "duża"
        ).length;

        let overallRisk: "HIGH" | "MEDIUM" | "LOW" = "LOW";
        if (mustChangeCount > 3 || highSeverityCount > 5) {
          overallRisk = "HIGH";
        } else if (mustChangeCount > 0 || highSeverityCount > 0) {
          overallRisk = "MEDIUM";
        }

        const topActions = parsed.comments
          .filter((c) => c.decision_flag === "MUST_CHANGE")
          .slice(0, 5)
          .map((c) => `Fix ${c.keyword}: ${c.suggested_change_summary.substring(0, 60)}...`);

        if (topActions.length === 0) {
          topActions.push("Review all comments for potential improvements");
        }

        parsed.summary = {
          overall_risk_level: overallRisk,
          top_actions: topActions,
          recommended_strategy:
            mustChangeCount > 0
              ? "Negotiate changes before signing"
              : "Review carefully, consider minor adjustments",
        };
      }

      setAnalysisResult(parsed);
      setAiJsonError(null);

      // Save analysis result to database
      if (selectedDocument) {
        try {
          await contractsDb.updateOrganisationDocument(selectedDocument.id, {
            ai_analysis_result: parsed,
          });
          // Reload documents to get updated data
          const updatedDocs = await contractsDb.getOrganisationDocuments(organisationId);
          setDocuments(updatedDocs);
          const updatedDoc = updatedDocs.find((d) => d.id === selectedDocument.id);
          if (updatedDoc) {
            setSelectedDocument(updatedDoc);
          }
        } catch (error) {
          console.error("Error saving analysis result:", error);
          // Don't show error to user, analysis is still displayed
        }
      }
    } catch (err) {
      console.error("Failed to parse AI JSON", err);
      setAiJsonError((err as Error).message || "Invalid JSON");
      setAnalysisResult(null);
    }
  };

  const handleResetAnalysis = async () => {
    if (!selectedDocument) return;

    const confirmed = window.confirm(
      "Czy na pewno chcesz usunąć zapisaną analizę AI? To usunie wszystkie komentarze i warunki wygenerowane przez AI."
    );

    if (!confirmed) return;

    try {
      await contractsDb.updateOrganisationDocument(selectedDocument.id, {
        ai_analysis_result: null,
      });
      
      setAnalysisResult(null);
      setAiJsonInput("");
      setAiJsonError(null);

      // Reload documents
      const updatedDocs = await contractsDb.getOrganisationDocuments(organisationId);
      setDocuments(updatedDocs);
      const updatedDoc = updatedDocs.find((d) => d.id === selectedDocument.id);
      if (updatedDoc) {
        setSelectedDocument(updatedDoc);
      }
    } catch (error) {
      console.error("Error resetting analysis:", error);
      alert("Błąd podczas resetowania analizy");
    }
  };

  const handleExportToPdf = async () => {
    if (!analysisResult || !selectedDocument || !analysisSectionRef.current) {
      alert("Brak analizy do eksportu. Najpierw wklej i sparsuj JSON z AI.");
      return;
    }

    try {
      await exportAnalysisToPdf(
        analysisSectionRef.current,
        selectedDocument.name,
        organisationName
      );
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      alert("Błąd podczas eksportu do PDF");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-600/30 text-red-400 border-red-600/50';
      case 'medium': return 'bg-yellow-600/30 text-yellow-400 border-yellow-600/50';
      case 'low': return 'bg-green-600/30 text-green-400 border-green-600/50';
      case 'duża': return 'bg-red-600/30 text-red-400 border-red-600/50';
      case 'średnia': return 'bg-yellow-600/30 text-yellow-400 border-yellow-600/50';
      case 'mała': return 'bg-green-600/30 text-green-400 border-green-600/50';
      default: return 'bg-neutral-800 text-neutral-300 border-neutral-700';
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-neutral-400">Loading contracts...</div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Contracts & Terms</h3>

      {/* Available Documents from documents table */}
      {availableDocuments.length > 0 && (
        <div className="border border-blue-600/30 rounded-lg p-4 bg-blue-950/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Available Documents</h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                Documents assigned to this organisation that can be linked as contracts
              </p>
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-2 bg-neutral-800/50 rounded border border-neutral-700"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{doc.name}</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    {doc.document_type || 'Document'} • {doc.created_at && format(new Date(doc.created_at), 'dd.MM.yyyy')}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {doc.file_url && (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 text-[10px] bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </a>
                  )}
                  <button
                    onClick={() => handleLinkDocument(doc)}
                    disabled={linkingDocumentId === doc.id}
                    className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {linkingDocumentId === doc.id ? 'Linking...' : 'Link Document'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section A: Documents & Parser */}
      <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-white">Documents & Parser</h4>
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="px-3 py-1.5 bg-white text-black rounded text-xs font-medium hover:bg-neutral-100 transition-colors"
          >
            + Upload Contract
          </button>
        </div>

        {showUploadForm && (
          <div className="mb-4 p-3 bg-neutral-800 rounded border border-neutral-700">
            <div className="space-y-2">
              <input
                type="text"
                value={newDocumentName}
                onChange={(e) => setNewDocumentName(e.target.value)}
                placeholder="Document name (e.g. Main contract 2025)"
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
              />
              <select
                value={newDocumentType}
                onChange={(e) => setNewDocumentType(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
              >
                <option value="main_contract">Main Contract</option>
                <option value="annex">Annex</option>
                <option value="nda">NDA</option>
                <option value="sow">SOW</option>
              </select>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
                disabled={uploading}
                className="w-full text-sm text-neutral-300"
              />
              {uploading && <div className="text-xs text-neutral-400">Uploading and parsing...</div>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {/* Left: Documents list */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-neutral-400 mb-2">Documents</div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocument(doc)}
                  className={`p-2 rounded border cursor-pointer transition-colors ${
                    selectedDocument?.id === doc.id
                      ? 'bg-blue-900/30 border-blue-600/50'
                      : 'bg-neutral-800/50 border-neutral-700 hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{doc.name}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        {doc.type} • {format(new Date(doc.uploaded_at), 'dd.MM.yyyy')}
                      </div>
                    </div>
                    <a
                      href={getDocumentUrl(doc.storage_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-2 px-2 py-1 text-[10px] bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600"
                    >
                      Open PDF
                    </a>
                  </div>
                </div>
              ))}
              {documents.length === 0 && (
                <div className="text-xs text-neutral-500 text-center py-4">
                  No documents yet. Upload a contract to get started.
                </div>
              )}
            </div>

            {selectedDocument && (
              <div className="mt-4">
                <div className="text-xs font-medium text-neutral-400 mb-2">Parsed Text</div>
                <div className="p-3 bg-neutral-800 rounded border border-neutral-700 max-h-64 overflow-y-auto">
                  <pre className="text-[10px] text-neutral-300 whitespace-pre-wrap font-mono">
                    {selectedDocument.parsed_text || 'No parsed text available yet. Parsing in progress...'}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Middle: Analysis Guide */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-neutral-400">Analysis Guide</div>
              <div className="flex items-center gap-1">
                {selectedDocument && selectedDocument.analysis_guide && selectedDocument.parsed_text && (
                  <button
                    onClick={async () => {
                      const prompt = `=== ANALYSIS_GUIDE ===\n\n${selectedDocument.analysis_guide}\n\n=== CONTRACT_TEXT ===\n\n${selectedDocument.parsed_text}\n\nZastosuj ANALYSIS_GUIDE do CONTRACT_TEXT i zwróć wyłącznie JSON w opisanym formacie.`;
                      try {
                        await navigator.clipboard.writeText(prompt);
                        alert('Analysis prompt copied to clipboard!');
                      } catch (err) {
                        console.error('Failed to copy:', err);
                        alert('Failed to copy to clipboard');
                      }
                    }}
                    className="px-2 py-1 text-[10px] bg-green-600/30 text-green-400 rounded hover:bg-green-600/50 border border-green-600/50"
                    title="Copy analysis prompt to clipboard"
                  >
                    📋 Copy Prompt
                  </button>
                )}
                {selectedDocument && (
                  <button
                    onClick={async () => {
                      try {
                        const lawNote = await lawNotesDb.getLawNoteByDocumentType(selectedDocument.type);
                        if (lawNote && lawNote.content) {
                          await handleUpdateAnalysisGuide(selectedDocument.id, lawNote.content);
                        } else {
                          alert('No instructions found in Knowledge for this document type');
                        }
                      } catch (error) {
                        console.error("Error loading from Knowledge:", error);
                        alert('Failed to load instructions from Knowledge');
                      }
                    }}
                    className="px-2 py-1 text-[10px] bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50 border border-blue-600/50"
                    title="Load instructions from Knowledge section"
                  >
                    📚 Load from Knowledge
                  </button>
                )}
              </div>
            </div>
            {selectedDocument ? (
              <div className="space-y-2">
                <textarea
                  value={selectedDocument.analysis_guide || ""}
                  onChange={(e) => {
                    setSelectedDocument({
                      ...selectedDocument,
                      analysis_guide: e.target.value,
                    });
                  }}
                  onBlur={() => {
                    if (selectedDocument.analysis_guide !== undefined) {
                      handleUpdateAnalysisGuide(selectedDocument.id, selectedDocument.analysis_guide || "");
                    }
                  }}
                  placeholder="Enter instructions on how to analyze this contract..."
                  className="w-full h-64 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-xs text-white resize-none"
                />
                <div className="text-[10px] text-neutral-500">
                  Manual checklist for reviewing this specific contract. Instructions from Knowledge section are automatically loaded when document is selected.
                </div>
              </div>
            ) : (
              <div className="p-4 bg-neutral-800 rounded border border-neutral-700 text-xs text-neutral-500 text-center">
                Select a document to edit analysis guide
              </div>
            )}
          </div>

          {/* Right: AI Analysis JSON */}
          <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-900 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-white">AI Analysis JSON</h4>
              <div className="flex items-center gap-2">
                {analysisResult && (
                  <span className="text-[10px] text-green-400">
                    ✓ Saved
                  </span>
                )}
                {aiJsonError && (
                  <span className="text-[10px] text-red-400 truncate max-w-[160px]" title={aiJsonError}>
                    {aiJsonError}
                  </span>
                )}
              </div>
            </div>
            <textarea
              value={aiJsonInput}
              onChange={(e) => setAiJsonInput(e.target.value)}
              placeholder="Paste JSON returned by ChatGPT here"
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[11px] text-white font-mono resize-none mb-2 min-h-[200px]"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleParseAiJson}
                className="flex-1 px-2 py-1 text-[11px] bg-white text-black rounded font-medium hover:bg-neutral-100"
              >
                Parse JSON & Save
              </button>
              {analysisResult && (
                <button
                  onClick={handleResetAnalysis}
                  className="px-2 py-1 text-[11px] bg-red-900/40 text-red-200 border border-red-700/60 rounded hover:bg-red-900/60"
                  title="Reset analysis"
                >
                  Reset
                </button>
              )}
            </div>
            {analysisResult && (
              <div className="mt-2 text-[10px] text-green-400">
                ✓ Parsed: {analysisResult.comments.length} comments, {analysisResult.terms.current.length} terms
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Analysis Layout */}
      {analysisResult ? (
        <div ref={analysisSectionRef} data-export-section className="space-y-4 bg-neutral-950 p-6 rounded-lg">
          {/* Header for PDF */}
          <div className="mb-6 pb-4 border-b border-neutral-800">
            <h2 className="text-2xl font-bold text-white mb-2">Contract Analysis Report</h2>
            <div className="space-y-1 text-sm text-neutral-300">
              {organisationName && (
                <div><span className="text-neutral-400">Organisation:</span> {organisationName}</div>
              )}
              {selectedDocument && (
                <div><span className="text-neutral-400">Document:</span> {selectedDocument.name}</div>
              )}
              <div><span className="text-neutral-400">Generated:</span> {format(new Date(), 'dd.MM.yyyy')}</div>
            </div>
          </div>

          {/* Top Summary Bar with Actions */}
          <div className="flex items-center justify-between gap-4 mb-4">
            {analysisResult.summary && (
              <div className="flex-1">
                <TopSummaryBar summary={analysisResult.summary} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportToPdf}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                title="Eksportuj analizę do PDF"
              >
                📄 Export PDF
              </button>
              <button
                onClick={handleResetAnalysis}
                className="px-3 py-1.5 text-xs bg-red-900/40 text-red-200 border border-red-700/60 rounded hover:bg-red-900/60 transition-colors whitespace-nowrap"
                title="Usuń zapisaną analizę AI"
              >
                🗑️ Reset
              </button>
            </div>
          </div>

          {/* Main Analysis Area */}
          <div className="grid grid-cols-12 gap-4">
            {/* Left: Action Steps Panel */}
            <div className="col-span-12 lg:col-span-3">
              <ActionStepsPanel />
            </div>

            {/* Right: Analysis Tabs */}
            <div className="col-span-12 lg:col-span-9">
              <AnalysisTabs
                analysisResult={analysisResult}
                onTermClick={setSelectedTermDetail}
              />
            </div>
          </div>

          {/* Comparison Table - Always visible at the bottom */}
          <div className="mt-6 border border-neutral-800 rounded-lg bg-neutral-900 p-4">
            <h4 className="text-sm font-semibold text-white mb-4">
              Układ współpracy - Porównanie przed i po wprowadzeniu komentarzy
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-neutral-950 z-10">
                  <tr>
                    <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                      Keyword
                    </th>
                    <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                      What is agreed<br/>
                      <span className="text-[9px] font-normal text-neutral-500">(Przed → Po)</span>
                    </th>
                    <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                      What I must do<br/>
                      <span className="text-[9px] font-normal text-neutral-500">(Przed → Po)</span>
                    </th>
                    <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                      If not done<br/>
                      <span className="text-[9px] font-normal text-neutral-500">(Przed → Po)</span>
                    </th>
                    <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                      Powiązane komentarze
                    </th>
                    <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                      Gdzie w umowie
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Create a map of keywords to their current and after terms
                    const keywordMap = new Map<string, {
                      current?: ContractTermEntry;
                      after?: ContractTermEntry;
                      comments: ContractComment[];
                    }>();

                    // Add current terms
                    analysisResult.terms.current.forEach((term) => {
                      const entry = keywordMap.get(term.keyword) || { comments: [] };
                      entry.current = term;
                      keywordMap.set(term.keyword, entry);
                    });

                    // Add after terms
                    analysisResult.terms.after_comments.forEach((term) => {
                      const entry = keywordMap.get(term.keyword) || { comments: [] };
                      entry.after = term;
                      keywordMap.set(term.keyword, entry);
                    });

                    // Add comments
                    analysisResult.comments.forEach((comment) => {
                      const entry = keywordMap.get(comment.keyword);
                      if (entry) {
                        entry.comments.push(comment);
                      }
                    });

                    // Convert to array and sort by keyword
                    const comparisonRows = Array.from(keywordMap.entries())
                      .map(([keyword, data]) => ({ keyword, ...data }))
                      .sort((a, b) => a.keyword.localeCompare(b.keyword));

                    // Build keyword -> highest severity problem map (same as in AnalysisTabs)
                    const keywordToProblem = new Map<string, ContractComment>();
                    analysisResult.comments.forEach((c) => {
                      const existing = keywordToProblem.get(c.keyword);
                      if (!existing) {
                        keywordToProblem.set(c.keyword, c);
                      } else {
                        const severityOrder = { "duża": 3, "średnia": 2, "mała": 1 };
                        if (severityOrder[c.severity_pl] > severityOrder[existing.severity_pl]) {
                          keywordToProblem.set(c.keyword, c);
                        }
                      }
                    });

                    const getRowHighlight = (severity?: "duża" | "średnia" | "mała") => {
                      if (!severity) return "";
                      if (severity === "duża") return "bg-red-950/30";
                      if (severity === "średnia") return "bg-amber-950/20";
                      return "bg-emerald-950/10";
                    };

                    return comparisonRows.map((row) => {
                      const problem = keywordToProblem.get(row.keyword);
                      const hasChanges = row.current && row.after && (
                        row.current.what_is_agreed !== row.after.what_is_agreed ||
                        row.current.what_i_must_do !== row.after.what_i_must_do ||
                        row.current.if_not_done !== row.after.if_not_done
                      );
                      const rowClassName = `border-b border-neutral-800 hover:bg-neutral-900/50 transition-colors ${getRowHighlight(problem?.severity_pl)} ${hasChanges ? 'bg-blue-950/10' : ''}`;

                      return (
                        <tr key={row.keyword} className={rowClassName}>
                          <td className="align-top py-2 px-2 text-xs font-medium text-neutral-100">
                            <div className="flex items-center gap-1.5">
                              {problem && <SeverityDot severity={problem.severity_pl} />}
                              <span className="font-mono text-[10px]">{row.keyword}</span>
                              {hasChanges && (
                                <span className="text-[8px] px-1 py-0.5 rounded bg-blue-900/40 text-blue-200 border border-blue-700/60">
                                  ZMIENIONO
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="align-top py-2 px-2 text-[11px]">
                            <div className="space-y-1">
                              <div className="text-neutral-300">
                                <span className="text-[9px] text-neutral-500">Przed: </span>
                                {row.current?.what_is_agreed || <span className="text-neutral-600 italic">Brak</span>}
                              </div>
                              {hasChanges && (
                                <div className="text-emerald-300 border-l-2 border-emerald-600 pl-2">
                                  <span className="text-[9px] text-emerald-500">Po: </span>
                                  {row.after?.what_is_agreed}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="align-top py-2 px-2 text-[11px]">
                            <div className="space-y-1">
                              <div className="text-neutral-300">
                                <span className="text-[9px] text-neutral-500">Przed: </span>
                                {row.current?.what_i_must_do || <span className="text-neutral-600 italic">Brak</span>}
                              </div>
                              {hasChanges && (
                                <div className="text-emerald-300 border-l-2 border-emerald-600 pl-2">
                                  <span className="text-[9px] text-emerald-500">Po: </span>
                                  {row.after?.what_i_must_do}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="align-top py-2 px-2 text-[11px]">
                            <div className="space-y-1">
                              <div className="text-neutral-300">
                                <span className="text-[9px] text-neutral-500">Przed: </span>
                                {row.current?.if_not_done || <span className="text-neutral-600 italic">Brak</span>}
                              </div>
                              {hasChanges && (
                                <div className="text-emerald-300 border-l-2 border-emerald-600 pl-2">
                                  <span className="text-[9px] text-emerald-500">Po: </span>
                                  {row.after?.if_not_done}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="align-top py-2 px-2 text-[10px]">
                            {row.comments.length > 0 ? (
                              <div className="space-y-1">
                                {row.comments.map((comment, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1 mb-1 p-1 rounded bg-neutral-800/50 border border-neutral-700"
                                  >
                                    <SeverityBadge severity={comment.severity_pl} />
                                    {comment.decision_flag && (
                                      <DecisionBadge flag={comment.decision_flag} />
                                    )}
                                    <span className="text-[9px] text-neutral-400 truncate flex-1">
                                      {comment.where_in_contract && comment.where_in_contract !== 'brak' && (
                                        <span className="text-neutral-500">({comment.where_in_contract}) </span>
                                      )}
                                      {comment.risk_short || comment.suggested_change_summary.substring(0, 40)}...
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-neutral-600 italic text-[9px]">Brak komentarzy</span>
                            )}
                          </td>
                          <td className="align-top py-2 px-2 text-[10px] text-neutral-500">
                            <div className="space-y-1">
                              {row.current?.where_in_contract && (
                                <div>
                                  <span className="text-[9px] text-neutral-600">Przed: </span>
                                  {row.current.where_in_contract}
                                </div>
                              )}
                              {row.after?.where_in_contract && row.after.where_in_contract !== row.current?.where_in_contract && (
                                <div>
                                  <span className="text-[9px] text-neutral-600">Po: </span>
                                  {row.after.where_in_contract}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
              {analysisResult.terms.current.length === 0 && analysisResult.terms.after_comments.length === 0 && (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  Brak warunków do porównania
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Section B: Contract Comments (old view when no AI analysis) */}
          <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-white">Contract Comments</h4>
              <button
                onClick={() => setShowCommentForm(!showCommentForm)}
                className="px-3 py-1.5 bg-white text-black rounded text-xs font-medium hover:bg-neutral-100 transition-colors"
              >
                + Add Comment
              </button>
            </div>

            {showCommentForm && (
              <div className="mb-4 p-3 bg-neutral-800 rounded border border-neutral-700">
                <div className="space-y-2">
                  <select
                    value={newCommentDocumentId}
                    onChange={(e) => setNewCommentDocumentId(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                  >
                    <option value="">No specific document</option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Enter comment about the contract..."
                    rows={3}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-neutral-400">Severity:</label>
                    <select
                      value={newCommentSeverity}
                      onChange={(e) => setNewCommentSeverity(e.target.value as typeof newCommentSeverity)}
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <button
                      onClick={handleAddComment}
                      disabled={!newCommentText.trim()}
                      className="px-3 py-2 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowCommentForm(false);
                        setNewCommentText("");
                      }}
                      className="px-3 py-2 bg-neutral-700 text-white rounded text-xs hover:bg-neutral-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-3 bg-neutral-800 rounded border border-neutral-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${getSeverityColor(comment.severity)}`}>
                        {comment.severity}
                      </span>
                      {comment.document_id && (
                        <span className="text-[10px] text-neutral-500">
                          {documents.find((d) => d.id === comment.document_id)?.name}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm')}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-300 whitespace-pre-wrap">{comment.comment_text}</div>
                </div>
              ))}
              
              {comments.length === 0 && (
                <p className="text-[11px] text-neutral-500">
                  No comments yet. Paste AI JSON above and click "Parse JSON".
                </p>
              )}
            </div>
          </div>

          {/* Section C: Current Contract Terms (old view when no AI analysis) */}
          <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-white">Current Contract Terms</h4>
              <button
                onClick={() => {
                  setEditingTerm(null);
                  resetTermForm();
                  setShowTermForm(true);
                }}
                className="px-3 py-1.5 bg-white text-black rounded text-xs font-medium hover:bg-neutral-100 transition-colors"
              >
                + Add Term
              </button>
            </div>

            {showTermForm && (
              <div className="mb-4 p-4 bg-neutral-800 rounded border border-neutral-700">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Term Label *</label>
                    <input
                      type="text"
                      value={termForm.term_label}
                      onChange={(e) => setTermForm({ ...termForm, term_label: e.target.value })}
                      placeholder="e.g. Monthly retainer"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Term Value *</label>
                    <input
                      type="text"
                      value={termForm.term_value}
                      onChange={(e) => setTermForm({ ...termForm, term_value: e.target.value })}
                      placeholder="e.g. 4 000 PLN"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Term Key</label>
                    <input
                      type="text"
                      value={termForm.term_key}
                      onChange={(e) => setTermForm({ ...termForm, term_key: e.target.value })}
                      placeholder="Auto-generated if empty"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Importance</label>
                    <select
                      value={termForm.importance}
                      onChange={(e) => setTermForm({ ...termForm, importance: e.target.value as typeof termForm.importance })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={termForm.start_date}
                      onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={termForm.end_date}
                      onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Renewal Type</label>
                    <select
                      value={termForm.renewal_type}
                      onChange={(e) => setTermForm({ ...termForm, renewal_type: e.target.value as typeof termForm.renewal_type })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    >
                      <option value="">None</option>
                      <option value="none">None</option>
                      <option value="fixed">Fixed</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Renewal Date</label>
                    <input
                      type="date"
                      value={termForm.renewal_date}
                      onChange={(e) => setTermForm({ ...termForm, renewal_date: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Billing Cycle</label>
                    <select
                      value={termForm.billing_cycle}
                      onChange={(e) => setTermForm({ ...termForm, billing_cycle: e.target.value as typeof termForm.billing_cycle })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    >
                      <option value="">None</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Document</label>
                    <select
                      value={termForm.document_id}
                      onChange={(e) => setTermForm({ ...termForm, document_id: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                    >
                      <option value="">No specific document</option>
                      {documents.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSaveTerm}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                  >
                    {editingTerm ? 'Update' : 'Add'} Term
                  </button>
                  <button
                    onClick={() => {
                      setShowTermForm(false);
                      setEditingTerm(null);
                      resetTermForm();
                    }}
                    className="px-3 py-2 bg-neutral-700 text-white rounded text-xs hover:bg-neutral-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {terms.length === 0 ? (
              <div className="text-xs text-neutral-500 text-center py-4">
                No active terms yet. Add terms to track the actual cooperation conditions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-700">
                      <th className="text-left py-2 px-3 text-neutral-400 font-medium">Label</th>
                      <th className="text-left py-2 px-3 text-neutral-400 font-medium">Value</th>
                      <th className="text-left py-2 px-3 text-neutral-400 font-medium">Dates</th>
                      <th className="text-left py-2 px-3 text-neutral-400 font-medium">Renewal</th>
                      <th className="text-left py-2 px-3 text-neutral-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {terms.map((term) => (
                      <tr key={term.id} className="border-b border-neutral-800">
                        <td className="py-2 px-3 text-white font-medium">{term.term_label}</td>
                        <td className="py-2 px-3 text-neutral-300">{term.term_value}</td>
                        <td className="py-2 px-3 text-neutral-400 text-[10px]">
                          {term.start_date && format(new Date(term.start_date), 'dd.MM.yyyy')}
                          {term.start_date && term.end_date && ' - '}
                          {term.end_date && format(new Date(term.end_date), 'dd.MM.yyyy')}
                        </td>
                        <td className="py-2 px-3 text-neutral-400 text-[10px]">
                          {term.renewal_type && term.renewal_type !== 'none' && (
                            <>
                              {term.renewal_type === 'auto' ? 'Automatic' : 'Fixed'}
                              {term.renewal_date && `, ${format(new Date(term.renewal_date), 'dd.MM.yyyy')}`}
                            </>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditTerm(term)}
                              className="px-2 py-1 text-[10px] bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeactivateTerm(term.id)}
                              className="px-2 py-1 text-[10px] bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Term Detail Modal */}
      <TermDetailModal
        term={selectedTermDetail}
        onClose={() => setSelectedTermDetail(null)}
      />
    </div>
  );
}

