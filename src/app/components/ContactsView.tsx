"use client";

import { useState, useEffect } from "react";
import { useCategories, useOrganisations } from "../hooks/useSharedLists";
import { useViewMode } from "../hooks/useViewMode";
import ViewModeToggle from "./ViewModeToggle";
import * as contactsDb from "../../lib/db/contacts";
import * as documentsDb from "../../lib/db/documents";
import type { Contact as ContactType } from "../../lib/db/contacts";
import type { Document } from "../../lib/db/documents";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";

type TaskPriority = "low" | "mid" | "prio" | "high prio";
type ContactStatus = "low" | "mid" | "prio" | "high prio";

interface Task {
  id: string;
  text: string;
  completed: boolean;
  status?: 'ongoing' | 'done' | 'failed';
  priority?: TaskPriority;
  dueDate?: string;
  notes?: string;
  assignees?: string[]; // Array of contact IDs
  doc_url?: string; // Link to Google Docs or other document
  created_at?: string;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  organization?: string;
  notes?: string;
  categories: string[];
  status: ContactStatus;
  tasks: Task[];
}

export default function ContactsView() {
  const { categories, addCategory } = useCategories();
  const { organisations, addOrganisation } = useOrganisations();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    avatar: "",
    organization: "",
    notes: "",
    selectedCategories: [] as string[],
    status: "mid" as ContactStatus,
  });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newOrganisationName, setNewOrganisationName] = useState("");
  const [showAddOrganisation, setShowAddOrganisation] = useState(false);
  const [taskInputs, setTaskInputs] = useState<Record<string, { text: string; status: 'ongoing' | 'done' | 'failed'; priority: TaskPriority; dueDate: string; notes: string; assignees: string[]; doc_url: string }>>({});
  const [expandedTaskForm, setExpandedTaskForm] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ contactId: string; taskId: string } | null>(null);
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [contactDocuments, setContactDocuments] = useState<Record<string, Document[]>>({});
  const [expandedDocumentForm, setExpandedDocumentForm] = useState<string | null>(null);
  const [documentInputs, setDocumentInputs] = useState<Record<string, { name: string; file_url: string; file_type: string; notes: string }>>({});
  
  // Filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedOrganisations, setSelectedOrganisations] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ContactStatus[]>([]);
  
  // View mode
  const [viewMode, setViewMode] = useViewMode("contacts");
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  // Load contacts from Supabase on mount
  useEffect(() => {
    loadContacts();

    // Listen for contact updates from other components
    const handleContactUpdate = () => {
      loadContacts();
    };
    window.addEventListener('contacts-updated', handleContactUpdate);

    // Also refresh periodically
    const refreshInterval = setInterval(() => {
      loadContacts();
    }, 3000);

    return () => {
      window.removeEventListener('contacts-updated', handleContactUpdate);
      clearInterval(refreshInterval);
    };
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await contactsDb.getContacts();
      setContacts(data);
      
      // Load documents for all contacts
      const documentsMap: Record<string, Document[]> = {};
      for (const contact of data) {
        const docs = await documentsDb.getDocumentsByContact(contact.id);
        documentsMap[contact.id] = docs;
      }
      setContactDocuments(documentsMap);
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setFormData({
      ...formData,
      selectedCategories: formData.selectedCategories.includes(category)
        ? formData.selectedCategories.filter((c) => c !== category)
        : [...formData.selectedCategories, category],
    });
  };

  const handleAdd = async () => {
    if (formData.name.trim()) {
      // Check if contact already exists in this organization
      const existingContacts = await contactsDb.getContacts();
      const duplicate = existingContacts.find(
        (c) => c.id !== editingContact && // Exclude current contact if editing
               c.name.toLowerCase() === formData.name.trim().toLowerCase() && 
               (formData.organization ? c.organization === formData.organization : !c.organization)
      );

      if (duplicate) {
        const orgText = formData.organization || "without organization";
        alert(`Contact "${formData.name.trim()}" already exists ${orgText}`);
        return;
      }

      if (editingContact) {
        // Update existing contact
        const contact = contacts.find(c => c.id === editingContact);
        if (contact) {
          const updatedContact = {
            name: formData.name,
            email: formData.email || undefined,
            avatar: formData.avatar || undefined,
            organization: formData.organization || undefined,
            notes: formData.notes || undefined,
            categories: formData.selectedCategories,
            status: formData.status,
            tasks: contact.tasks, // Keep existing tasks
          };
          
          const result = await contactsDb.updateContact(editingContact, updatedContact);
          if (result) {
            await loadContacts();
            window.dispatchEvent(new Event('graph-data-updated'));
            window.dispatchEvent(new Event('contacts-updated'));
            setFormData({
              name: "",
              email: "",
              avatar: "",
              organization: "",
              notes: "",
              selectedCategories: [],
              status: "mid",
            });
            setIsAdding(false);
            setEditingContact(null);
          } else {
            alert(`Failed to update contact.`);
          }
        }
      } else {
        // Create new contact
        const newContact = {
          name: formData.name,
          email: formData.email || undefined,
          avatar: formData.avatar || undefined,
          organization: formData.organization || undefined,
          notes: formData.notes || undefined,
          categories: formData.selectedCategories,
          status: formData.status,
          tasks: [],
        };
        
        const result = await contactsDb.createContact(newContact);
        if (result) {
          await loadContacts();
          // Notify graph to update
          window.dispatchEvent(new Event('graph-data-updated'));
          setFormData({
            name: "",
            email: "",
            avatar: "",
            organization: "",
            notes: "",
            selectedCategories: [],
            status: "mid",
          });
          setIsAdding(false);
        } else {
          const orgText = formData.organization || "without organization";
          alert(`Failed to add contact. "${formData.name.trim()}" may already exist ${orgText}`);
        }
      }
    }
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      email: "",
      avatar: "",
      organization: "",
      notes: "",
      selectedCategories: [],
      status: "mid",
    });
    setNewCategoryName("");
    setShowAddCategory(false);
    setNewOrganisationName("");
    setShowAddOrganisation(false);
    setIsAdding(false);
    setEditingContact(null);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact.id);
    setIsAdding(true);
    setFormData({
      name: contact.name,
      email: contact.email || "",
      avatar: contact.avatar || "",
      organization: contact.organization || "",
      notes: contact.notes || "",
      selectedCategories: contact.categories || [],
      status: contact.status,
    });
  };

  const handleDelete = async (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    if (confirm(`Are you sure you want to delete "${contact.name}"? This action cannot be undone.`)) {
      const success = await contactsDb.deleteContact(contactId);
      if (success) {
        await loadContacts();
        window.dispatchEvent(new Event('graph-data-updated'));
        window.dispatchEvent(new Event('contacts-updated'));
      } else {
        alert('Failed to delete contact.');
      }
    }
  };

  const handleAddNewCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim());
      setFormData({
        ...formData,
        selectedCategories: [...formData.selectedCategories, newCategoryName.trim()],
      });
      setNewCategoryName("");
      setShowAddCategory(false);
    }
  };

  const handleAddNewOrganisation = async () => {
    if (newOrganisationName.trim()) {
      await addOrganisation(newOrganisationName.trim());
      setFormData({
        ...formData,
        organization: newOrganisationName.trim(),
      });
      setNewOrganisationName("");
      setShowAddOrganisation(false);
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  const handleAddTask = async (contactId: string) => {
    const taskData = taskInputs[contactId];
    const taskText = taskData?.text?.trim();
    if (taskText) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        const newTask: Task = {
          id: Date.now().toString(),
          text: taskText,
          completed: false,
          status: (taskData?.status || "ongoing") as 'ongoing' | 'done' | 'failed',
          priority: (taskData?.priority || "mid") as TaskPriority,
          dueDate: taskData?.dueDate || undefined,
          notes: taskData?.notes || undefined,
          assignees: taskData?.assignees || [],
          doc_url: taskData?.doc_url || undefined,
          created_at: new Date().toISOString(),
        };
        const updatedTasks = [...contact.tasks, newTask];
        await contactsDb.updateContact(contactId, { tasks: updatedTasks });
        await loadContacts();
        window.dispatchEvent(new Event('graph-data-updated'));
        setTaskInputs({ ...taskInputs, [contactId]: { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" } });
        setExpandedTaskForm(null);
      }
    }
  };

  const handleEditTask = (contactId: string, task: Task) => {
    setEditingTask({ contactId, taskId: task.id });
    setTaskInputs({
      ...taskInputs,
      [contactId]: {
        text: task.text,
        status: task.status || "ongoing",
        priority: task.priority || "mid",
        dueDate: task.dueDate || "",
        notes: task.notes || "",
        assignees: task.assignees || [],
        doc_url: task.doc_url || "",
      },
    });
    setExpandedTaskForm(contactId);
  };

  const handleUpdateTask = async (contactId: string, taskId: string) => {
    const taskData = taskInputs[contactId];
    const taskText = taskData?.text?.trim();
    if (taskText) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        const updatedTasks = contact.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                text: taskText,
                status: taskData.status || "ongoing",
                priority: taskData.priority,
                dueDate: taskData.dueDate || undefined,
                notes: taskData.notes || undefined,
                assignees: taskData.assignees || [],
                doc_url: taskData.doc_url || undefined,
              }
            : task
        );
        await contactsDb.updateContact(contactId, { tasks: updatedTasks });
        await loadContacts();
        window.dispatchEvent(new Event('graph-data-updated'));
        setTaskInputs({ ...taskInputs, [contactId]: { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" } });
        setExpandedTaskForm(null);
        setEditingTask(null);
      }
    }
  };

  const handleCancelEdit = (contactId: string) => {
    setTaskInputs({ ...taskInputs, [contactId]: { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [] as string[], doc_url: "" } });
    setExpandedTaskForm(null);
    setEditingTask(null);
  };

  const handleAssigneeToggle = (contactId: string, assigneeId: string) => {
    const current = taskInputs[contactId] || { text: "", status: "ongoing" as const, priority: "mid" as TaskPriority, dueDate: "", notes: "", assignees: [], doc_url: "" };
    const assignees = current.assignees || [];
    const updatedAssignees = assignees.includes(assigneeId)
      ? assignees.filter((id) => id !== assigneeId)
      : [...assignees, assigneeId];
    
    setTaskInputs({
      ...taskInputs,
      [contactId]: {
        ...current,
        assignees: updatedAssignees,
      },
    });
  };

  const handleToggleTask = async (contactId: string, taskId: string) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      const updatedTasks = contact.tasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      );
      await contactsDb.updateContact(contactId, { tasks: updatedTasks });
      await loadContacts();
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  const handleDeleteTask = async (contactId: string, taskId: string) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      const updatedTasks = contact.tasks.filter((task) => task.id !== taskId);
      await contactsDb.updateContact(contactId, { tasks: updatedTasks });
      await loadContacts();
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  // Filter contacts based on selected filters
  const filteredContacts = contacts.filter((contact) => {
    // Filter by categories
    if (selectedCategories.length > 0) {
      const hasSelectedCategory = selectedCategories.some((cat) =>
        contact.categories.includes(cat)
      );
      if (!hasSelectedCategory) return false;
    }

    // Filter by organisations
    if (selectedOrganisations.length > 0) {
      if (!contact.organization || !selectedOrganisations.includes(contact.organization)) {
        return false;
      }
    }

    // Filter by status
    if (selectedStatuses.length > 0) {
      if (!selectedStatuses.includes(contact.status)) {
        return false;
      }
    }

    return true;
  });

  const toggleCategoryFilter = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const toggleOrganisationFilter = (orgName: string) => {
    setSelectedOrganisations((prev) =>
      prev.includes(orgName) ? prev.filter((o) => o !== orgName) : [...prev, orgName]
    );
  };

  const toggleStatusFilter = (status: ContactStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedOrganisations([]);
    setSelectedStatuses([]);
  };

  const hasActiveFilters = selectedCategories.length > 0 || selectedOrganisations.length > 0 || selectedStatuses.length > 0;

  // Helper function to format time remaining until deadline
  const getTimeRemaining = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `${diffDays} days left`;
    }
  };

  // Helper function to get status badge styles
  const getStatusStyles = (status?: 'ongoing' | 'done' | 'failed') => {
    switch (status) {
      case 'done':
        return 'bg-green-900/30 text-green-400';
      case 'failed':
        return 'bg-red-900/30 text-red-400';
      case 'ongoing':
        return 'bg-blue-900/30 text-blue-400';
      default:
        return 'bg-neutral-700 text-neutral-400';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Contacts</h3>
        <div className="flex items-center gap-2">
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          <button
            onClick={() => {
              setIsAdding(true);
              setEditingContact(null);
              setFormData({ name: "", email: "", avatar: "", organization: "", notes: "", selectedCategories: [], status: "mid" });
            }}
            className="px-3 py-1.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-100 transition-colors"
          >
            + Add Contact
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900 space-y-3">
          {editingContact && (
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Contact ID</label>
              <input
                type="text"
                value={editingContact}
                disabled
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-500 font-mono cursor-not-allowed"
                readOnly
              />
              <div className="text-[10px] text-neutral-500 mt-1">
                This ID is generated by Supabase and cannot be changed
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contact name"
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              autoFocus={!editingContact}
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Avatar URL</label>
            <input
              type="url"
              value={formData.avatar}
              onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              placeholder="https://example.com/avatar.jpg"
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            />
            {formData.avatar && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={formData.avatar}
                  alt="Avatar preview"
                  className="w-12 h-12 rounded-full object-cover border border-neutral-700"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-xs text-neutral-500">Preview</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Organization</label>
            {showAddOrganisation ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOrganisationName}
                  onChange={(e) => setNewOrganisationName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddNewOrganisation();
                    }
                  }}
                  placeholder="New organization name..."
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  autoFocus
                />
                <button
                  onClick={handleAddNewOrganisation}
                  disabled={!newOrganisationName.trim()}
                  className="px-3 py-2 bg-neutral-700 text-white rounded text-sm hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddOrganisation(false);
                    setNewOrganisationName("");
                  }}
                  className="px-3 py-2 border border-neutral-700 rounded text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={formData.organization}
                  onChange={(e) => {
                    if (e.target.value === "__add_new__") {
                      setShowAddOrganisation(true);
                    } else {
                      setFormData({ ...formData, organization: e.target.value });
                    }
                  }}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
                >
                  <option value="">Select organization...</option>
                  {organisations.map((org) => (
                    <option key={org.id} value={org.name}>
                      {org.name}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add new organization</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-2">Categories</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {categories.map((category) => (
                <label
                  key={category}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.selectedCategories.includes(category)}
                    onChange={() => handleCategoryToggle(category)}
                    className="rounded"
                  />
                  <span className="text-sm text-neutral-300">{category}</span>
                </label>
              ))}
            </div>
            {showAddCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddNewCategory();
                    }
                  }}
                  placeholder="New category name..."
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                  autoFocus
                />
                <button
                  onClick={handleAddNewCategory}
                  disabled={!newCategoryName.trim()}
                  className="px-2 py-1 bg-neutral-700 text-white rounded text-xs hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewCategoryName("");
                  }}
                  className="px-2 py-1 border border-neutral-700 rounded text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCategory(true)}
                className="text-xs text-neutral-400 hover:text-white underline"
              >
                + Add new category
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as ContactStatus })
              }
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
            >
              <option value="low">Low</option>
              <option value="mid">Mid</option>
              <option value="prio">Priority</option>
              <option value="high prio">High Priority</option>
            </select>
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
              onClick={handleCancel}
              className="px-3 py-1.5 border border-neutral-700 rounded text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!formData.name.trim()}
              className="px-3 py-1.5 bg-white text-black rounded text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {editingContact ? "Update Contact" : "Add Contact"}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Filters</h4>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-neutral-400 hover:text-white underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Category filters */}
        {categories.length > 0 && (
          <div>
            <label className="block text-xs text-neutral-400 mb-2">Categories</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => toggleCategoryFilter(category)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedCategories.includes(category)
                      ? "bg-white text-black"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Organisation filters */}
        {organisations.length > 0 && (
          <div>
            <label className="block text-xs text-neutral-400 mb-2">Organisations</label>
            <div className="flex flex-wrap gap-2">
              {organisations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => toggleOrganisationFilter(org.name)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedOrganisations.includes(org.name)
                      ? "bg-white text-black"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {org.name}
                </button>
              ))}
              {/* Option to filter by "No organization" */}
              <button
                onClick={() => toggleOrganisationFilter("No organization")}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  selectedOrganisations.includes("No organization")
                    ? "bg-white text-black"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                No organization
              </button>
            </div>
          </div>
        )}

        {/* Status filters */}
        <div>
          <label className="block text-xs text-neutral-400 mb-2">Status</label>
          <div className="flex flex-wrap gap-2">
            {(["low", "mid", "prio", "high prio"] as ContactStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => toggleStatusFilter(status)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  selectedStatuses.includes(status)
                    ? "bg-white text-black"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                {status === "high prio"
                  ? "High Priority"
                  : status === "prio"
                  ? "Priority"
                  : status === "mid"
                  ? "Mid"
                  : "Low"}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="text-xs text-neutral-400 pt-2 border-t border-neutral-800">
            Showing {filteredContacts.length} of {contacts.length} contacts
          </div>
        )}
      </div>

      {contacts.length === 0 && !isAdding ? (
        <div className="text-center py-8 text-neutral-400 text-sm">
          No contacts yet. Click "Add Contact" to get started.
        </div>
      ) : filteredContacts.length === 0 && hasActiveFilters ? (
        <div className="text-center py-8 text-neutral-400 text-sm">
          No contacts match the selected filters.{" "}
          <button onClick={clearFilters} className="underline hover:text-white">
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {viewMode === "compact" && (
            <div className="space-y-1">
              {filteredContacts.map((contact) => {
                const prioTasks = contact.tasks.filter(t => !t.completed && (t.priority === "prio" || t.priority === "high prio")).length;
                const midTasks = contact.tasks.filter(t => !t.completed && t.priority === "mid").length;
                const lowTasks = contact.tasks.filter(t => !t.completed && (!t.priority || t.priority === "low")).length;
                const totalTasks = contact.tasks.filter(t => !t.completed).length;
                const isExpanded = expandedContact === contact.id;
                
                return (
                  <div
                    key={contact.id}
                    data-contact-id={contact.id}
                    className="group border border-neutral-800 rounded px-2 py-1.5 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {contact.avatar && (
                        <img
                          src={contact.avatar}
                          alt={contact.name}
                          className="w-6 h-6 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">
                            {contact.name}
                          </span>
                          {contact.organization && (
                            <span className="text-xs text-neutral-500 truncate">
                              {contact.organization}
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 text-[10px] rounded font-medium flex-shrink-0 ${
                              contact.status === "high prio"
                                ? "bg-red-900/30 text-red-400"
                                : contact.status === "prio"
                                ? "bg-orange-900/30 text-orange-400"
                                : contact.status === "mid"
                                ? "bg-yellow-900/30 text-yellow-400"
                                : "bg-neutral-800 text-neutral-400"
                            }`}
                          >
                            {contact.status === "high prio" ? "H" : contact.status === "prio" ? "P" : contact.status === "mid" ? "M" : "L"}
                          </span>
                        </div>
                        {contact.email && (
                          <div className="text-[10px] text-neutral-500 truncate">{contact.email}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {totalTasks > 0 && (
                          <div className="flex items-center gap-1">
                            {prioTasks > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500" title={`${prioTasks} priority tasks`}></span>}
                            {midTasks > 0 && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" title={`${midTasks} mid tasks`}></span>}
                            {lowTasks > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" title={`${lowTasks} low tasks`}></span>}
                            <span className="text-[10px] text-neutral-500">{totalTasks}</span>
                          </div>
                        )}
                        <button
                          onClick={() => setExpandedContact(isExpanded ? null : contact.id)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-neutral-400 hover:text-white transition-opacity"
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                        <button
                          onClick={() => handleEdit(contact)}
                          className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-opacity"
                          title="Edit contact"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-opacity"
                          title="Delete contact"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-neutral-800 space-y-2">
                        <div className="text-[10px] text-neutral-500 font-mono" title={`Full ID: ${contact.id}`}>
                          ID: {contact.id.substring(0, 8)}...
                        </div>
                        {contact.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {contact.categories.map((category, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] rounded"
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                        )}
                        {contact.notes && (
                          <div className="text-xs text-neutral-500">{contact.notes}</div>
                        )}
                        {/* Tasks, Documents - same as before but compact */}
                        {(() => {
                          const ownTasks = contact.tasks || [];
                          const assignedTasks: Array<{ task: Task; ownerContact: Contact }> = [];
                          
                          contacts.forEach((otherContact) => {
                            if (otherContact.id !== contact.id && otherContact.tasks) {
                              otherContact.tasks.forEach((task) => {
                                if (task.assignees && task.assignees.includes(contact.id)) {
                                  assignedTasks.push({ task, ownerContact: otherContact });
                                }
                              });
                            }
                          });
                          
                          const allTasks = [
                            ...ownTasks.map(task => ({ task, ownerContact: contact, isOwn: true })),
                            ...assignedTasks.map(({ task, ownerContact }) => ({ task, ownerContact, isOwn: false }))
                          ];
                          
                          return allTasks.length > 0 ? (
                            <div className="mt-2 pt-2 border-t border-neutral-800">
                              <div className="text-[10px] font-medium text-neutral-400 mb-1">
                                Tasks {assignedTasks.length > 0 && (
                                  <span className="text-neutral-500">
                                    ({ownTasks.length}/{assignedTasks.length})
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1">
                                {allTasks.slice(0, 3).map(({ task, ownerContact, isOwn }) => (
                                  <div
                                    key={`${ownerContact.id}-${task.id}`}
                                    className="flex items-center gap-1.5 text-xs bg-neutral-800/30 rounded px-1.5 py-1"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={task.completed}
                                      onChange={() => handleToggleTask(ownerContact.id, task.id)}
                                      className="rounded w-3 h-3"
                                      disabled={!isOwn}
                                    />
                                    <span className={`flex-1 truncate ${task.completed ? 'line-through text-neutral-500' : 'text-neutral-300'}`}>
                                      {task.text}
                                    </span>
                                    {task.priority && (
                                      <span className={`px-1 py-0.5 text-[9px] rounded flex-shrink-0 ${
                                        task.priority === "high prio" ? "bg-red-900/30 text-red-400" :
                                        task.priority === "prio" ? "bg-orange-900/30 text-orange-400" :
                                        task.priority === "mid" ? "bg-yellow-900/30 text-yellow-400" :
                                        "bg-neutral-700 text-neutral-400"
                                      }`}>
                                        {task.priority === "high prio" ? "H" : task.priority === "prio" ? "P" : task.priority === "mid" ? "M" : "L"}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {allTasks.length > 3 && (
                                  <div className="text-[10px] text-neutral-500 text-center">
                                    +{allTasks.length - 3} more tasks
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null;
                        })()}
                        {contactDocuments[contact.id] && contactDocuments[contact.id].length > 0 && (
                          <div className="mt-2 pt-2 border-t border-neutral-800">
                            <div className="text-[10px] font-medium text-neutral-400 mb-1">
                              Documents ({contactDocuments[contact.id].length})
                            </div>
                            <div className="space-y-0.5">
                              {contactDocuments[contact.id].slice(0, 2).map((doc) => (
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
                              {contactDocuments[contact.id].length > 2 && (
                                <div className="text-[10px] text-neutral-500">
                                  +{contactDocuments[contact.id].length - 2} more
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
            <div className="space-y-1">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  data-contact-id={contact.id}
                  className="group border border-neutral-800 rounded px-2.5 py-2 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {contact.avatar && (
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="w-8 h-8 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">
                          {contact.name}
                        </span>
                        {contact.organization && (
                          <span className="text-xs text-neutral-400">
                            {contact.organization}
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                            contact.status === "high prio"
                              ? "bg-red-900/30 text-red-400"
                              : contact.status === "prio"
                              ? "bg-orange-900/30 text-orange-400"
                              : contact.status === "mid"
                              ? "bg-yellow-900/30 text-yellow-400"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {contact.status === "high prio" ? "High" : contact.status === "prio" ? "Prio" : contact.status === "mid" ? "Mid" : "Low"}
                        </span>
                        {contact.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {contact.categories.slice(0, 2).map((category, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] rounded"
                              >
                                {category}
                              </span>
                            ))}
                            {contact.categories.length > 2 && (
                              <span className="text-[10px] text-neutral-500">+{contact.categories.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                      {contact.email && (
                        <div className="text-xs text-neutral-500 mt-0.5">{contact.email}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(() => {
                        const totalTasks = contact.tasks.filter(t => !t.completed).length;
                        return totalTasks > 0 && (
                          <span className="text-xs text-neutral-400">{totalTasks} tasks</span>
                        );
                      })()}
                      <button
                        onClick={() => handleEdit(contact)}
                        className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-opacity"
                        title="Edit contact"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-opacity"
                        title="Delete contact"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {viewMode === "grid" && (
            <div className="grid grid-cols-2 gap-2">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  data-contact-id={contact.id}
                  className="group border border-neutral-800 rounded p-2 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    {contact.avatar && (
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="w-8 h-8 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-white truncate">
                        {contact.name}
                      </div>
                      {contact.organization && (
                        <div className="text-xs text-neutral-400 truncate">
                          {contact.organization}
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                            contact.status === "high prio"
                              ? "bg-red-900/30 text-red-400"
                              : contact.status === "prio"
                              ? "bg-orange-900/30 text-orange-400"
                              : contact.status === "mid"
                              ? "bg-yellow-900/30 text-yellow-400"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {contact.status === "high prio" ? "H" : contact.status === "prio" ? "P" : contact.status === "mid" ? "M" : "L"}
                        </span>
                        {(() => {
                          const totalTasks = contact.tasks.filter(t => !t.completed).length;
                          return totalTasks > 0 && (
                            <span className="text-[10px] text-neutral-500">{totalTasks} tasks</span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(contact)}
                        className="text-xs px-1 py-0.5 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="text-xs px-1 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

