"use client";

import { useState, useEffect } from "react";
import { useViewMode } from "../hooks/useViewMode";
import ViewModeToggle from "./ViewModeToggle";
import { useOrganisations, useCategories, type Organisation } from "../hooks/useSharedLists";
import * as contactsDb from "../../lib/db/contacts";
import * as documentsDb from "../../lib/db/documents";
import type { Document } from "../../lib/db/documents";

export default function OrganisationsView() {
  const {
    organisations,
    addOrganisation,
    deleteOrganisation,
    updateOrganisationCategories,
    updateOrganisation,
  } = useOrganisations();
  const { categories } = useCategories();
  const [newOrgName, setNewOrgName] = useState("");
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [addingContactToOrg, setAddingContactToOrg] = useState<string | null>(null);
  const [orgDocuments, setOrgDocuments] = useState<Record<string, Document[]>>({});
  
  // View mode
  const [viewMode, setViewMode] = useViewMode("organisations");

  useEffect(() => {
    if (organisations.length > 0) {
      loadDocuments();
    }
  }, [organisations]);

  useEffect(() => {
    // Listen for document updates
    const handleDocumentUpdate = () => {
      loadDocuments();
    };
    window.addEventListener('documents-updated', handleDocumentUpdate);
    return () => {
      window.removeEventListener('documents-updated', handleDocumentUpdate);
    };
  }, [organisations]);

  const loadDocuments = async () => {
    try {
      const allDocuments = await documentsDb.getDocuments();
      const documentsByOrg: Record<string, Document[]> = {};
      
      organisations.forEach((org) => {
        documentsByOrg[org.id] = allDocuments.filter((doc) => doc.organisation_id === org.id);
      });
      
      setOrgDocuments(documentsByOrg);
    } catch (error) {
      console.error("Error loading documents:", error);
    }
  };

  const handleAdd = () => {
    if (newOrgName.trim()) {
      addOrganisation(newOrgName.trim());
      setNewOrgName("");
      // Notify graph to update
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  const handleDelete = (orgId: string) => {
    deleteOrganisation(orgId);
    // Notify graph to update
    window.dispatchEvent(new Event('graph-data-updated'));
  };

  const handleCategoryToggle = (orgId: string, category: string) => {
    const org = organisations.find((o) => o.id === orgId);
    if (org) {
      const updatedCategories = org.categories.includes(category)
        ? org.categories.filter((c) => c !== category)
        : [...org.categories, category];
      updateOrganisationCategories(orgId, updatedCategories);
      // Notify graph to update
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  const handleEdit = (org: Organisation) => {
    setEditingOrgId(org.id);
    setEditOrgName(org.name);
  };

  const handleCancelEdit = () => {
    setEditingOrgId(null);
    setEditOrgName("");
  };

  const handleSaveEdit = async () => {
    if (!editingOrgId || !editOrgName.trim()) {
      alert("Please enter an organization name");
      return;
    }

    const success = await updateOrganisation(editingOrgId, { name: editOrgName.trim() });
    if (success) {
      handleCancelEdit();
      // Notify graph to update
      window.dispatchEvent(new Event('graph-data-updated'));
    } else {
      alert("Failed to update organization. The name may already exist.");
    }
  };

  const handleAddContactToOrg = async (orgId: string) => {
    const org = organisations.find((o) => o.id === orgId);
    if (!org || !newContactName.trim()) return;

    // Check if contact already exists in this organization
    const existingContacts = await contactsDb.getContacts();
    const duplicate = existingContacts.find(
      (c) => c.name.toLowerCase() === newContactName.trim().toLowerCase() && 
             c.organization === org.name
    );

    if (duplicate) {
      alert(`Contact "${newContactName.trim()}" already exists in "${org.name}"`);
      return;
    }

    const newContact = {
      name: newContactName.trim(),
      email: newContactEmail.trim() || undefined,
      organization: org.name, // Automatically assign to this organization
      notes: undefined,
      categories: [],
      status: "mid" as const,
      tasks: [],
    };

    const result = await contactsDb.createContact(newContact);
    if (result) {
      // Reset form
      setNewContactName("");
      setNewContactEmail("");
      setAddingContactToOrg(null);
      // Notify graph and contacts list to update
      window.dispatchEvent(new Event('graph-data-updated'));
      window.dispatchEvent(new Event('contacts-updated'));
    } else {
      alert(`Failed to add contact. "${newContactName.trim()}" may already exist in "${org.name}"`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Organisations</h3>
        <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleAdd();
              }
            }}
            placeholder="Organization name..."
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={!newOrgName.trim()}
            className="px-3 py-1.5 bg-white text-black rounded text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {organisations.length === 0 ? (
        <div className="text-center py-8 text-neutral-400 text-sm">
          No organisations yet. Add one above to get started.
        </div>
      ) : (
        <>
          {viewMode === "compact" && (
            <div className="space-y-1">
              {organisations.map((org) => {
                const isExpanded = expandedOrg === org.id;
                const docCount = orgDocuments[org.id]?.length || 0;
                
                return (
                  <div
                    key={org.id}
                    className="group border border-neutral-800 rounded px-2 py-1.5 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
                  >
                    {editingOrgId === org.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editOrgName}
                          onChange={(e) => setEditOrgName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && editOrgName.trim()) {
                              handleSaveEdit();
                            }
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
                          autoFocus
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
                            disabled={!editOrgName.trim()}
                            className="px-2 py-1 text-xs bg-white text-black rounded disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white flex-1">{org.name}</span>
                          {docCount > 0 && (
                            <span className="text-[10px] text-neutral-500">{docCount} docs</span>
                          )}
                          {org.categories.length > 0 && (
                            <span className="text-[10px] text-neutral-500">{org.categories.length} cats</span>
                          )}
                          <button
                            onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                            className="opacity-0 group-hover:opacity-100 text-xs text-neutral-400 hover:text-white transition-opacity"
                            title={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                          <button
                            onClick={() => handleEdit(org)}
                            className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 bg-blue-900/20 text-blue-400 rounded hover:bg-blue-900/40 transition-opacity"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDelete(org.id)}
                            className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40 transition-opacity"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-neutral-800 space-y-2">
                            {org.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {org.categories.map((category) => (
                                  <span
                                    key={category}
                                    className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] rounded"
                                  >
                                    {category}
                                  </span>
                                ))}
                              </div>
                            )}
                            {orgDocuments[org.id] && orgDocuments[org.id].length > 0 && (
                              <div>
                                <div className="text-[10px] font-medium text-neutral-400 mb-1">
                                  Documents ({orgDocuments[org.id].length})
                                </div>
                                <div className="space-y-0.5">
                                  {orgDocuments[org.id].slice(0, 2).map((doc) => (
                                    <a
                                      key={doc.id}
                                      href={doc.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-xs text-blue-400 hover:text-blue-300 truncate"
                                      title={doc.name}
                                    >
                                      📄 {doc.name}
                                    </a>
                                  ))}
                                  {orgDocuments[org.id].length > 2 && (
                                    <div className="text-[10px] text-neutral-500">
                                      +{orgDocuments[org.id].length - 2} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === "list" && (
            <div className="space-y-1">
              {organisations.map((org) => {
                const isExpanded = expandedOrg === org.id;
                const docCount = orgDocuments[org.id]?.length || 0;
                
                return (
                  <div
                    key={org.id}
                    className="group border border-neutral-800 rounded px-2.5 py-2 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
                  >
                    {editingOrgId === org.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editOrgName}
                          onChange={(e) => setEditOrgName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && editOrgName.trim()) {
                              handleSaveEdit();
                            }
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
                          autoFocus
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
                            disabled={!editOrgName.trim()}
                            className="px-2 py-1 text-xs bg-white text-black rounded disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white flex-1">{org.name}</span>
                          {docCount > 0 && (
                            <span className="text-xs text-neutral-400">{docCount} documents</span>
                          )}
                          {org.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {org.categories.slice(0, 2).map((category) => (
                                <span
                                  key={category}
                                  className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] rounded"
                                >
                                  {category}
                                </span>
                              ))}
                              {org.categories.length > 2 && (
                                <span className="text-[10px] text-neutral-500">+{org.categories.length - 2}</span>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                            className="opacity-0 group-hover:opacity-100 text-xs text-neutral-400 hover:text-white transition-opacity"
                            title={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                          <button
                            onClick={() => handleEdit(org)}
                            className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 bg-blue-900/20 text-blue-400 rounded hover:bg-blue-900/40 transition-opacity"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDelete(org.id)}
                            className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40 transition-opacity"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-neutral-800 space-y-2">
                            {orgDocuments[org.id] && orgDocuments[org.id].length > 0 && (
                              <div>
                                <div className="text-[10px] font-medium text-neutral-400 mb-1">
                                  Documents ({orgDocuments[org.id].length})
                                </div>
                                <div className="space-y-0.5">
                                  {orgDocuments[org.id].slice(0, 3).map((doc) => (
                                    <a
                                      key={doc.id}
                                      href={doc.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-xs text-blue-400 hover:text-blue-300 truncate"
                                      title={doc.name}
                                    >
                                      📄 {doc.name}
                                    </a>
                                  ))}
                                  {orgDocuments[org.id].length > 3 && (
                                    <div className="text-[10px] text-neutral-500">
                                      +{orgDocuments[org.id].length - 3} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === "grid" && (
            <div className="grid grid-cols-2 gap-2">
              {organisations.map((org) => {
                const docCount = orgDocuments[org.id]?.length || 0;
                
                return (
                  <div
                    key={org.id}
                    className="group border border-neutral-800 rounded p-2 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
                  >
                    {editingOrgId === org.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editOrgName}
                          onChange={(e) => setEditOrgName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && editOrgName.trim()) {
                              handleSaveEdit();
                            }
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                          autoFocus
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
                            disabled={!editOrgName.trim()}
                            className="px-1.5 py-0.5 text-[10px] bg-white text-black rounded disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-white truncate">
                              {org.name}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              {docCount > 0 && (
                                <span className="text-[10px] text-neutral-500">{docCount} docs</span>
                              )}
                              {org.categories.length > 0 && (
                                <span className="text-[10px] text-neutral-500">{org.categories.length} cats</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(org)}
                              className="text-[10px] px-1 py-0.5 bg-blue-900/20 text-blue-400 rounded hover:bg-blue-900/40"
                              title="Edit"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDelete(org.id)}
                              className="text-[10px] px-1 py-0.5 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40"
                              title="Delete"
                            >
                              ×
                            </button>
                          </div>
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

