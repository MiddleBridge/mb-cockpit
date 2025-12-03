"use client";

import { useState, useEffect } from "react";
import { useViewMode } from "../hooks/useViewMode";
import ViewModeToggle from "./ViewModeToggle";
import { useOrganisations, useCategories, type Organisation } from "../hooks/useSharedLists";
import * as contactsDb from "../../lib/db/contacts";
import * as documentsDb from "../../lib/db/documents";
import type { Document } from "../../lib/db/documents";
import { getAvatarUrl } from "../../lib/avatar-utils";

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
  const [editOrgStatus, setEditOrgStatus] = useState<'ongoing' | 'freezed' | 'lost' | 'active_but_ceased'>('ongoing');
  const [editOrgPriority, setEditOrgPriority] = useState<'low' | 'mid' | 'prio' | 'high prio'>('mid');
  const [editOrgCategories, setEditOrgCategories] = useState<string[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [addingContactToOrg, setAddingContactToOrg] = useState<string | null>(null);
  const [orgDocuments, setOrgDocuments] = useState<Record<string, Document[]>>({});
  const [orgContacts, setOrgContacts] = useState<Record<string, contactsDb.Contact[]>>({});
  
  // View mode
  const [viewMode, setViewMode] = useViewMode("organisations");

  useEffect(() => {
    if (organisations.length > 0) {
      loadDocuments();
      loadContacts();
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

  useEffect(() => {
    // Listen for contact updates
    const handleContactUpdate = () => {
      loadContacts();
    };
    window.addEventListener('contacts-updated', handleContactUpdate);
    return () => {
      window.removeEventListener('contacts-updated', handleContactUpdate);
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

  const loadContacts = async () => {
    try {
      const allContacts = await contactsDb.getContacts();
      const contactsByOrg: Record<string, contactsDb.Contact[]> = {};
      
      organisations.forEach((org) => {
        contactsByOrg[org.id] = allContacts.filter((contact) => contact.organization === org.name);
      });
      
      setOrgContacts(contactsByOrg);
    } catch (error) {
      console.error("Error loading contacts:", error);
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
    setEditOrgStatus(org.status ?? "ongoing");
    setEditOrgPriority(org.priority);
    setEditOrgCategories(org.categories);
  };

  const handleCancelEdit = () => {
    setEditingOrgId(null);
    setEditOrgName("");
    setEditOrgStatus('ongoing');
    setEditOrgPriority('mid');
    setEditOrgCategories([]);
  };

  const handleSaveEdit = async () => {
    if (!editingOrgId || !editOrgName.trim()) {
      alert("Please enter an organization name");
      return;
    }

    const success = await updateOrganisation(editingOrgId, { 
      name: editOrgName.trim(),
      status: editOrgStatus,
      priority: editOrgPriority,
      categories: editOrgCategories,
    });
    if (success) {
      handleCancelEdit();
      // Notify graph to update
      window.dispatchEvent(new Event('graph-data-updated'));
    } else {
      alert("Failed to update organization. The name may already exist.");
    }
  };

  const getStatusColor = (status?: string | null) => {
    if (!status) return 'bg-neutral-700/50 text-neutral-400 border border-neutral-600';
    switch (status) {
      case 'ongoing': return 'bg-green-900/30 text-green-400';
      case 'freezed': return 'bg-blue-900/30 text-blue-400';
      case 'lost': return 'bg-red-900/30 text-red-400';
      case 'active_but_ceased': return 'bg-yellow-900/30 text-yellow-400';
      default: return 'bg-neutral-700/50 text-neutral-400 border border-neutral-600';
    }
  };

  const formatStatus = (status?: string | null) => {
    if (!status) return '+ Status';
    if (status === 'active_but_ceased') return 'active but ceased';
    return status;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high prio': return 'bg-red-900/30 text-red-400';
      case 'prio': return 'bg-orange-900/30 text-orange-400';
      case 'mid': return 'bg-yellow-900/30 text-yellow-400';
      case 'low': return 'bg-neutral-700 text-neutral-400';
      default: return 'bg-neutral-700 text-neutral-400';
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
      // Reload contacts for this organization
      await loadContacts();
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
                const contactCount = orgContacts[org.id]?.length || 0;
                
                return (
                  <div
                    key={org.id}
                    data-organisation-id={org.id}
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
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-neutral-400 mb-0.5">Status</label>
                            <select
                              value={editOrgStatus}
                              onChange={(e) => setEditOrgStatus(e.target.value as typeof editOrgStatus)}
                              className="w-full bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-[10px] text-white"
                            >
                              <option value="ongoing">Ongoing</option>
                              <option value="freezed">Freezed</option>
                              <option value="lost">Lost</option>
                              <option value="active_but_ceased">Active but ceased</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-neutral-400 mb-0.5">Priority</label>
                            <select
                              value={editOrgPriority}
                              onChange={(e) => setEditOrgPriority(e.target.value as typeof editOrgPriority)}
                              className="w-full bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-[10px] text-white"
                            >
                              <option value="low">Low</option>
                              <option value="mid">Mid</option>
                              <option value="prio">Prio</option>
                              <option value="high prio">High Prio</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-400 mb-1">Categories</label>
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                            {categories.map((category) => (
                              <label
                                key={category}
                                className="flex items-center gap-1 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={editOrgCategories.includes(category)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditOrgCategories([...editOrgCategories, category]);
                                    } else {
                                      setEditOrgCategories(editOrgCategories.filter(c => c !== category));
                                    }
                                  }}
                                  className="rounded w-2 h-2 accent-blue-600"
                                />
                                <span className="text-[10px] text-neutral-300">{category}</span>
                              </label>
                            ))}
                          </div>
                        </div>
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
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-white">{org.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(org.status)}`}>
                                {formatStatus(org.status)}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getPriorityColor(org.priority)}`}>
                                {org.priority}
                              </span>
                            </div>
                            {org.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
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
                          </div>
                          {docCount > 0 && (
                            <span className="text-[10px] text-neutral-500">{docCount} docs</span>
                          )}
                          {contactCount > 0 && (
                            <span className="text-[10px] text-neutral-500">{contactCount} contacts</span>
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
                            {orgContacts[org.id] && orgContacts[org.id].length > 0 && (
                              <div>
                                <div className="text-[10px] font-medium text-neutral-400 mb-1">
                                  Contacts ({orgContacts[org.id].length})
                                </div>
                                <div className="space-y-0.5">
                                  {orgContacts[org.id].slice(0, 3).map((contact) => (
                                    <div
                                      key={contact.id}
                                      className="flex items-center gap-1.5 text-xs text-neutral-300"
                                    >
                                      {contact.avatar ? (
                                        <img
                                          src={getAvatarUrl(contact.avatar)}
                                          alt={contact.name}
                                          className="w-4 h-4 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full bg-neutral-700 flex-shrink-0 flex items-center justify-center text-[8px] text-neutral-400">
                                          {contact.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="truncate">{contact.name}</span>
                                      {contact.email && (
                                        <span className="text-[10px] text-neutral-500 truncate">• {contact.email}</span>
                                      )}
                                    </div>
                                  ))}
                                  {orgContacts[org.id].length > 3 && (
                                    <div className="text-[10px] text-neutral-500">
                                      +{orgContacts[org.id].length - 3} more
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
                const contactCount = orgContacts[org.id]?.length || 0;
                
                return (
                  <div
                    key={org.id}
                    data-organisation-id={org.id}
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
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-neutral-400 mb-0.5">Status</label>
                            <select
                              value={editOrgStatus}
                              onChange={(e) => setEditOrgStatus(e.target.value as typeof editOrgStatus)}
                              className="w-full bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-[10px] text-white"
                            >
                              <option value="ongoing">Ongoing</option>
                              <option value="freezed">Freezed</option>
                              <option value="lost">Lost</option>
                              <option value="active_but_ceased">Active but ceased</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-neutral-400 mb-0.5">Priority</label>
                            <select
                              value={editOrgPriority}
                              onChange={(e) => setEditOrgPriority(e.target.value as typeof editOrgPriority)}
                              className="w-full bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-[10px] text-white"
                            >
                              <option value="low">Low</option>
                              <option value="mid">Mid</option>
                              <option value="prio">Prio</option>
                              <option value="high prio">High Prio</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-400 mb-1">Categories</label>
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                            {categories.map((category) => (
                              <label
                                key={category}
                                className="flex items-center gap-1 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={editOrgCategories.includes(category)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditOrgCategories([...editOrgCategories, category]);
                                    } else {
                                      setEditOrgCategories(editOrgCategories.filter(c => c !== category));
                                    }
                                  }}
                                  className="rounded w-2 h-2 accent-blue-600"
                                />
                                <span className="text-[10px] text-neutral-300">{category}</span>
                              </label>
                            ))}
                          </div>
                        </div>
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
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-white">{org.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(org.status)}`}>
                                {formatStatus(org.status)}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getPriorityColor(org.priority)}`}>
                                {org.priority}
                              </span>
                            </div>
                            {org.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {org.categories.slice(0, 3).map((category) => (
                                  <span
                                    key={category}
                                    className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] rounded"
                                  >
                                    {category}
                                  </span>
                                ))}
                                {org.categories.length > 3 && (
                                  <span className="text-[10px] text-neutral-500">+{org.categories.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                          {docCount > 0 && (
                            <span className="text-xs text-neutral-400">{docCount} documents</span>
                          )}
                          {contactCount > 0 && (
                            <span className="text-xs text-neutral-400">{contactCount} contacts</span>
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
                            {orgContacts[org.id] && orgContacts[org.id].length > 0 && (
                              <div>
                                <div className="text-[10px] font-medium text-neutral-400 mb-1">
                                  Contacts ({orgContacts[org.id].length})
                                </div>
                                <div className="space-y-0.5">
                                  {orgContacts[org.id].slice(0, 3).map((contact) => (
                                    <div
                                      key={contact.id}
                                      className="flex items-center gap-1.5 text-xs text-neutral-300"
                                    >
                                      {contact.avatar ? (
                                        <img
                                          src={getAvatarUrl(contact.avatar)}
                                          alt={contact.name}
                                          className="w-4 h-4 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full bg-neutral-700 flex-shrink-0 flex items-center justify-center text-[8px] text-neutral-400">
                                          {contact.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="truncate">{contact.name}</span>
                                      {contact.email && (
                                        <span className="text-[10px] text-neutral-500 truncate">• {contact.email}</span>
                                      )}
                                    </div>
                                  ))}
                                  {orgContacts[org.id].length > 3 && (
                                    <div className="text-[10px] text-neutral-500">
                                      +{orgContacts[org.id].length - 3} more
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
                const isExpanded = expandedOrg === org.id;
                const docCount = orgDocuments[org.id]?.length || 0;
                const contactCount = orgContacts[org.id]?.length || 0;
                
                return (
                  <div
                    key={org.id}
                    data-organisation-id={org.id}
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
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="block text-[9px] text-neutral-400 mb-0.5">Status</label>
                            <select
                              value={editOrgStatus}
                              onChange={(e) => setEditOrgStatus(e.target.value as typeof editOrgStatus)}
                              className="w-full bg-neutral-800 border border-neutral-700 rounded px-1 py-0.5 text-[9px] text-white"
                            >
                              <option value="ongoing">Ongoing</option>
                              <option value="freezed">Freezed</option>
                              <option value="lost">Lost</option>
                              <option value="active_but_ceased">Active but ceased</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] text-neutral-400 mb-0.5">Priority</label>
                            <select
                              value={editOrgPriority}
                              onChange={(e) => setEditOrgPriority(e.target.value as typeof editOrgPriority)}
                              className="w-full bg-neutral-800 border border-neutral-700 rounded px-1 py-0.5 text-[9px] text-white"
                            >
                              <option value="low">Low</option>
                              <option value="mid">Mid</option>
                              <option value="prio">Prio</option>
                              <option value="high prio">High Prio</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">Categories</label>
                          <div className="flex flex-wrap gap-0.5 max-h-16 overflow-y-auto">
                            {categories.map((category) => (
                              <label
                                key={category}
                                className="flex items-center gap-0.5 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={editOrgCategories.includes(category)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditOrgCategories([...editOrgCategories, category]);
                                    } else {
                                      setEditOrgCategories(editOrgCategories.filter(c => c !== category));
                                    }
                                  }}
                                  className="rounded w-1.5 h-1.5 accent-blue-600"
                                />
                                <span className="text-[9px] text-neutral-300">{category}</span>
                              </label>
                            ))}
                          </div>
                        </div>
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
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${getStatusColor(org.status)}`}>
                                {formatStatus(org.status)}
                              </span>
                              <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${getPriorityColor(org.priority)}`}>
                                {org.priority}
                              </span>
                            </div>
                            {org.categories.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-1">
                                {org.categories.slice(0, 2).map((category) => (
                                  <span
                                    key={category}
                                    className="px-1 py-0.5 bg-neutral-800 text-neutral-300 text-[9px] rounded"
                                  >
                                    {category}
                                  </span>
                                ))}
                                {org.categories.length > 2 && (
                                  <span className="text-[9px] text-neutral-500">+{org.categories.length - 2}</span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-1 mt-1">
                              {docCount > 0 && (
                                <span className="text-[10px] text-neutral-500">{docCount} docs</span>
                              )}
                              {contactCount > 0 && (
                                <span className="text-[10px] text-neutral-500">{contactCount} contacts</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                              className="text-[10px] text-neutral-400 hover:text-white transition-opacity"
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
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
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-neutral-800 space-y-2">
                            {orgDocuments[org.id] && orgDocuments[org.id].length > 0 && (
                              <div>
                                <div className="text-[9px] font-medium text-neutral-400 mb-1">
                                  Documents ({orgDocuments[org.id].length})
                                </div>
                                <div className="space-y-0.5">
                                  {orgDocuments[org.id].slice(0, 2).map((doc) => (
                                    <a
                                      key={doc.id}
                                      href={doc.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-[10px] text-blue-400 hover:text-blue-300 truncate"
                                      title={doc.name}
                                    >
                                      📄 {doc.name}
                                    </a>
                                  ))}
                                  {orgDocuments[org.id].length > 2 && (
                                    <div className="text-[9px] text-neutral-500">
                                      +{orgDocuments[org.id].length - 2} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {orgContacts[org.id] && orgContacts[org.id].length > 0 && (
                              <div>
                                <div className="text-[9px] font-medium text-neutral-400 mb-1">
                                  Contacts ({orgContacts[org.id].length})
                                </div>
                                <div className="space-y-0.5">
                                  {orgContacts[org.id].slice(0, 3).map((contact) => (
                                    <div
                                      key={contact.id}
                                      className="flex items-center gap-1 text-[10px] text-neutral-300"
                                    >
                                      {contact.avatar ? (
                                        <img
                                          src={contact.avatar}
                                          alt={contact.name}
                                          className="w-3 h-3 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-3 h-3 rounded-full bg-neutral-700 flex-shrink-0 flex items-center justify-center text-[7px] text-neutral-400">
                                          {contact.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="truncate">{contact.name}</span>
                                    </div>
                                  ))}
                                  {orgContacts[org.id].length > 3 && (
                                    <div className="text-[9px] text-neutral-500">
                                      +{orgContacts[org.id].length - 3} more
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
        </>
      )}
    </div>
  );
}

