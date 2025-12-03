"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as contactsDb from "../../lib/db/contacts";
import * as organisationsDb from "../../lib/db/organisations";
import * as documentsDb from "../../lib/db/documents";
import * as projectsDb from "../../lib/db/projects";
import type { Contact } from "../../lib/db/contacts";
import type { Organisation } from "../../lib/db/organisations";
import type { Document } from "../../lib/db/documents";
import type { Project } from "../../lib/db/projects";
import { format, formatDistanceToNow, isPast } from "date-fns";
import GoogleCalendarIntegration from "./GoogleCalendarIntegration";
import * as googleCalendar from "../../lib/google-calendar";
import { isGoogleDocsUrl } from "../../lib/storage";

interface Task {
  id: string;
  text: string;
  completed: boolean;
  status?: 'ongoing' | 'done' | 'failed';
  priority?: "low" | "mid" | "prio" | "high prio";
  dueDate?: string;
  notes?: string;
  assignees?: string[]; // Array of contact IDs
  doc_url?: string; // Link to Google Docs or other document
  contactId: string;
  contactName: string;
  contactOrganization?: string;
  created_at?: string;
}

export default function TasksView() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDocumentForTask, setAddingDocumentForTask] = useState<{ contactId: string; taskId: string } | null>(null);
  const [documentFormData, setDocumentFormData] = useState({
    name: "",
    file_url: "",
    file_type: "",
    notes: "",
    google_docs_url: "",
  });
  
  // Filter states
  const [selectedStatuses, setSelectedStatuses] = useState<('ongoing' | 'done' | 'failed')[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<("low" | "mid" | "prio" | "high prio")[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedOrganisations, setSelectedOrganisations] = useState<string[]>([]);
  const [showCompleted, setShowCompleted] = useState(true);
  const [viewMode, setViewMode] = useState<'all' | 'my' | 'assigned'>('all');
  const [contactSearch, setContactSearch] = useState("");
  const [organisationSearch, setOrganisationSearch] = useState("");
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [syncingToCalendar, setSyncingToCalendar] = useState(false);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Task editing states
  const [editingTask, setEditingTask] = useState<{ contactId: string; taskId: string } | null>(null);
  const [expandedTask, setExpandedTask] = useState<{ contactId: string; taskId: string } | null>(null);
  const [taskInputs, setTaskInputs] = useState<Record<string, { 
    text: string; 
    status: 'ongoing' | 'done' | 'failed'; 
    priority: "low" | "mid" | "prio" | "high prio"; 
    dueDate: string; 
    notes: string; 
    assignees: string[]; 
    doc_url: string;
  }>>({});
  // Inline editing state
  const [editingField, setEditingField] = useState<{ contactId: string; taskId: string; field: 'text' | 'dueDate' } | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<string>("");

  useEffect(() => {
    loadTasks();
    checkCalendarConnection();
    
    // Listen for task updates - but don't reload immediately to avoid flickering
    // Only reload if really needed (e.g., from other components)
    const handleTaskUpdate = () => {
      // Use a debounce to avoid too many reloads
      // Only reload if we're not currently editing anything
      if (!editingField && !editingTask) {
        // Reload without showing loading indicator to avoid flickering
        loadTasks(false);
      }
    };
    window.addEventListener('graph-data-updated', handleTaskUpdate);
    
    return () => {
      window.removeEventListener('graph-data-updated', handleTaskUpdate);
    };
  }, [editingField, editingTask]);

  const checkCalendarConnection = async () => {
    try {
      const connected = await googleCalendar.isSignedIn();
      setIsCalendarConnected(connected);
    } catch {
      setIsCalendarConnected(false);
    }
  };

  const loadTasks = async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [contactsData, organisationsData, documentsData, projectsData] = await Promise.all([
        contactsDb.getContacts(),
        organisationsDb.getOrganisations(),
        documentsDb.getDocuments(),
        projectsDb.getProjects(),
      ]);
      setContacts(contactsData);
      setOrganisations(organisationsData);
      setDocuments(documentsData);
      setProjects(projectsData);
      const allTasks: Task[] = [];
      
      contactsData.forEach((contact) => {
        if (contact.tasks && Array.isArray(contact.tasks)) {
          contact.tasks.forEach((task) => {
            allTasks.push({
              ...task,
              contactId: contact.id,
              contactName: contact.name,
              contactOrganization: contact.organization,
              created_at: task.created_at,
            });
          });
        }
      });

      // Sort by priority: high prio > prio > mid > low, then by completed
      allTasks.sort((a, b) => {
        const priorityOrder = { "high prio": 0, "prio": 1, "mid": 2, "low": 3 };
        const aPriority = priorityOrder[a.priority || "low"];
        const bPriority = priorityOrder[b.priority || "low"];
        if (aPriority !== bPriority) return aPriority - bPriority;
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return 0;
      });

      setTasks(allTasks);
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleToggleTask = async (contactId: string, taskId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    const task = contact.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newCompleted = !task.completed;
    
    // Optimistic update - update local state immediately
    const updatedTasks = contact.tasks.map((t) =>
      t.id === taskId ? { ...t, completed: newCompleted } : t
    );
    
    const updatedContacts = contacts.map((c) =>
      c.id === contactId ? { ...c, tasks: updatedTasks } : c
    );
    setContacts(updatedContacts);
    
    // Update tasks state immediately
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.contactId === contactId && t.id === taskId
          ? { ...t, completed: newCompleted }
          : t
      )
    );
    
    // Save to database in background
    contactsDb.updateContact(contactId, { tasks: updatedTasks }).catch((error) => {
      console.error("Error toggling task:", error);
      loadTasks();
    });
    
    window.dispatchEvent(new Event('graph-data-updated'));
  };

  const handleEditTask = (task: Task) => {
    setEditingTask({ contactId: task.contactId, taskId: task.id });
    setExpandedTask(null); // Close details when editing
    const taskKey = `${task.contactId}-${task.id}`;
    setTaskInputs({
      ...taskInputs,
      [taskKey]: {
        text: task.text || "",
        status: task.status || "ongoing",
        priority: task.priority || "mid",
        dueDate: task.dueDate || "",
        notes: task.notes || "",
        assignees: task.assignees || [],
        doc_url: (task.doc_url && task.doc_url.trim()) ? task.doc_url.trim() : "",
      },
    });
  };

  const handleUpdateTask = async (contactId: string, taskId: string) => {
    const taskKey = `${contactId}-${taskId}`;
    const taskData = taskInputs[taskKey];
    const taskText = taskData?.text?.trim();
    
    if (!taskText) {
      alert("Please enter task text");
      return;
    }

    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      const updatedTask = {
        text: taskText,
        status: taskData.status || "ongoing",
        priority: taskData.priority,
        dueDate: taskData.dueDate || undefined,
        notes: taskData.notes || undefined,
        assignees: taskData.assignees || [],
        doc_url: taskData.doc_url || undefined,
      };
      
      const updatedTasks = contact.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updatedTask } : task
      );
      
      // Optimistic update - update local state immediately
      const updatedContacts = contacts.map((c) =>
        c.id === contactId ? { ...c, tasks: updatedTasks } : c
      );
      setContacts(updatedContacts);
      
      // Update tasks state immediately
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.contactId === contactId && task.id === taskId
            ? {
                ...task,
                ...updatedTask,
              }
            : task
        )
      );
      
      setEditingTask(null);
      setTaskInputs({ ...taskInputs, [taskKey]: { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" } });
      
      // Save to database in background
      contactsDb.updateContact(contactId, { tasks: updatedTasks }).catch((error) => {
        console.error("Error updating task:", error);
        loadTasks();
      });
      
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  const handleCancelEdit = (contactId: string, taskId: string) => {
    setEditingTask(null);
    const taskKey = `${contactId}-${taskId}`;
    setTaskInputs({ ...taskInputs, [taskKey]: { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" } });
  };

  // Inline editing functions
  const handleStartInlineEdit = (contactId: string, taskId: string, field: 'text' | 'dueDate', currentValue: string) => {
    setEditingField({ contactId, taskId, field });
    setInlineEditValue(currentValue || "");
  };

  const handleSaveInlineEdit = async (contactId: string, taskId: string, field: 'text' | 'dueDate') => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const newValue = field === 'text' ? inlineEditValue.trim() : (inlineEditValue || undefined);
    
    // Optimistic update - update local state immediately
    const updatedTasks = contact.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            [field]: newValue,
          }
        : task
    );
    
    // Update contacts state immediately
    const updatedContacts = contacts.map((c) =>
      c.id === contactId
        ? { ...c, tasks: updatedTasks }
        : c
    );
    setContacts(updatedContacts);
    
    // Update tasks state immediately
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.contactId === contactId && task.id === taskId
          ? {
              ...task,
              [field]: newValue,
            }
          : task
      )
    );
    
    setEditingField(null);
    setInlineEditValue("");
    
    // Save to database in background (no await to avoid blocking)
    contactsDb.updateContact(contactId, { tasks: updatedTasks }).catch((error) => {
      console.error("Error updating task:", error);
      // On error, reload to sync with server
      loadTasks();
    });
    
    // Notify graph update in background
    window.dispatchEvent(new Event('graph-data-updated'));
  };

  const handleCancelInlineEdit = () => {
    setEditingField(null);
    setInlineEditValue("");
  };

  const handleAddDocumentToTask = async (contactId: string, taskId: string) => {
    if (!documentFormData.name.trim() || !documentFormData.file_url.trim()) {
      alert("Please enter document name and file URL");
      return;
    }

    try {
      new URL(documentFormData.file_url);
    } catch {
      alert("Please enter a valid file URL");
      return;
    }

    const taskIdString = `${contactId}-${taskId}`;
    const contact = contacts.find(c => c.id === contactId);
    
    const newDocument = {
      name: documentFormData.name,
      file_url: documentFormData.file_url,
      file_type: documentFormData.file_type || undefined,
      contact_id: contactId,
      organisation_id: contact?.organization ? organisations.find(o => o.name === contact.organization)?.id : undefined,
      notes: documentFormData.notes || undefined,
      google_docs_url: documentFormData.google_docs_url || undefined,
      project_id: undefined,
      task_id: taskIdString,
    };

    const result = await documentsDb.createDocument(newDocument);
    if (result) {
      // Reload documents only, not all tasks (to avoid flickering)
      const documentsData = await documentsDb.getDocuments();
      setDocuments(documentsData);
      setAddingDocumentForTask(null);
      setDocumentFormData({ name: "", file_url: "", file_type: "", notes: "", google_docs_url: "" });
      window.dispatchEvent(new Event('documents-updated'));
    } else {
      alert("Failed to create document. Please try again.");
    }
  };

  const handleDeleteTask = async (contactId: string, taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) {
      return;
    }

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    
    const task = contact.tasks.find((t) => t.id === taskId);
    
    // Optimistic update - remove from local state immediately
    const updatedTasks = contact.tasks.filter((t) => t.id !== taskId);
    const updatedContacts = contacts.map((c) =>
      c.id === contactId ? { ...c, tasks: updatedTasks } : c
    );
    setContacts(updatedContacts);
    
    // Remove from tasks state immediately
    setTasks((prevTasks) => prevTasks.filter((t) => !(t.contactId === contactId && t.id === taskId)));
    
    // Delete from calendar if exists (in background)
    if (task && (task as any).calendar_event_id && isCalendarConnected) {
      googleCalendar.deleteCalendarEvent((task as any).calendar_event_id).catch((error) => {
        console.error("Error deleting calendar event:", error);
      });
    }

    // Save to database in background
    contactsDb.updateContact(contactId, { tasks: updatedTasks }).catch((error) => {
      console.error("Error deleting task:", error);
      loadTasks();
    });
    
    window.dispatchEvent(new Event('graph-data-updated'));
  };

  const handleSyncTaskToCalendar = async (task: Task) => {
    if (!isCalendarConnected) {
      alert("Please connect to Google Calendar first");
      return;
    }

    if (!task.dueDate) {
      alert("Task must have a due date to sync with calendar");
      return;
    }

    try {
      setSyncingToCalendar(true);
      const contact = contacts.find((c) => c.id === task.contactId);
      if (!contact) return;

      const taskToSync: googleCalendar.TaskToEvent = {
        taskId: task.id,
        contactId: task.contactId,
        text: task.text,
        dueDate: task.dueDate,
        notes: task.notes,
        assignees: task.assignees,
        contactName: task.contactName,
        contactEmail: contact.email,
      };

      const existingEventId = (task as any).calendar_event_id;
      const event = await googleCalendar.syncTaskToCalendar(taskToSync, existingEventId);

      if (event && event.id) {
        // Update task with calendar event ID
        const updatedTasks = contact.tasks.map((t) =>
          t.id === task.id
            ? { ...t, calendar_event_id: event.id }
            : t
        );
        
        // Optimistic update
        const updatedContacts = contacts.map((c) =>
          c.id === task.contactId ? { ...c, tasks: updatedTasks } : c
        );
        setContacts(updatedContacts);
        
        setTasks((prevTasks) =>
          prevTasks.map((t) =>
            t.contactId === task.contactId && t.id === task.id
              ? { ...t, calendar_event_id: event.id } as Task
              : t
          )
        );
        
        // Save to database in background
        contactsDb.updateContact(task.contactId, { tasks: updatedTasks }).catch((error) => {
          console.error("Error updating task with calendar event:", error);
          loadTasks();
        });
        
        alert("Task synced to Google Calendar!");
      } else {
        alert("Failed to sync task to calendar");
      }
    } catch (error) {
      console.error("Error syncing task to calendar:", error);
      alert("Failed to sync task to calendar. Please check your connection.");
    } finally {
      setSyncingToCalendar(false);
    }
  };

  if (loading) {
    return <div className="text-neutral-400 text-xs">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-neutral-400 text-xs mt-4">
        No tasks yet. Add tasks to contacts to see them here.
      </div>
    );
  }

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Filter by status
    if (selectedStatuses.length > 0) {
      const taskStatus = task.status || 'ongoing';
      if (!selectedStatuses.includes(taskStatus)) return false;
    }
    
    // Filter by priority
    if (selectedPriorities.length > 0) {
      const taskPriority = task.priority || 'low';
      if (!selectedPriorities.includes(taskPriority)) return false;
    }
    
    // Filter by contact
    if (selectedContacts.length > 0) {
      if (!selectedContacts.includes(task.contactId)) return false;
    }
    
    // Filter by organisation
    if (selectedOrganisations.length > 0) {
      const org = task.contactOrganization || "No organization";
      if (!selectedOrganisations.includes(org)) return false;
    }
    
    // Filter by view mode
    if (viewMode === 'my') {
      // Only show tasks where user is the owner (we'll use contactId as owner for now)
      // This could be enhanced with actual user authentication
      return true; // For now, show all
    } else if (viewMode === 'assigned') {
      // Only show tasks where user is assigned
      return task.assignees && task.assignees.length > 0;
    }
    
    return true;
  });

  const incompleteTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = showCompleted ? filteredTasks.filter((t) => t.completed) : [];

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high prio":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "prio":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "mid":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "low":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-neutral-700/50 text-neutral-400 border-neutral-600/30";
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case "high prio":
        return "High";
      case "prio":
        return "Prio";
      case "mid":
        return "Mid";
      case "low":
        return "Low";
      default:
        return "";
    }
  };

  const getStatusStyles = (status?: 'ongoing' | 'done' | 'failed') => {
    switch (status) {
      case 'done':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'ongoing':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      default:
        return 'bg-neutral-700/50 text-neutral-400 border border-neutral-600/30';
    }
  };

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

  const toggleStatusFilter = (status: 'ongoing' | 'done' | 'failed') => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const togglePriorityFilter = (priority: "low" | "mid" | "prio" | "high prio") => {
    setSelectedPriorities((prev) =>
      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]
    );
  };

  const toggleContactFilter = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId) ? prev.filter((c) => c !== contactId) : [...prev, contactId]
    );
  };

  const toggleOrganisationFilter = (orgName: string) => {
    setSelectedOrganisations((prev) =>
      prev.includes(orgName) ? prev.filter((o) => o !== orgName) : [...prev, orgName]
    );
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedContacts([]);
    setSelectedOrganisations([]);
  };

  const hasActiveFilters = selectedStatuses.length > 0 || selectedPriorities.length > 0 || 
                          selectedContacts.length > 0 || selectedOrganisations.length > 0;

  // Get unique contacts and organisations for filters
  // Include both task owners and assignees
  const allContactIds = new Set<string>();
  tasks.forEach(task => {
    allContactIds.add(task.contactId);
    if (task.assignees) {
      task.assignees.forEach(id => allContactIds.add(id));
    }
  });
  const uniqueContacts = Array.from(allContactIds)
    .map(id => contacts.find(c => c.id === id))
    .filter(Boolean) as Contact[];
  
  // Get all unique organisations from contacts (both owners and assignees)
  const allOrgNames = new Set<string>();
  tasks.forEach(task => {
    if (task.contactOrganization) {
      allOrgNames.add(task.contactOrganization);
    }
    if (task.assignees) {
      task.assignees.forEach(assigneeId => {
        const assignee = contacts.find(c => c.id === assigneeId);
        if (assignee?.organization) {
          allOrgNames.add(assignee.organization);
        }
      });
    }
  });
  const uniqueOrganisations = Array.from(allOrgNames).sort();

  // Filter contacts and organisations by search
  const filteredContactsForFilter = uniqueContacts.filter(contact => {
    if (!contactSearch.trim()) return true;
    const search = contactSearch.toLowerCase();
    return contact.name.toLowerCase().includes(search) || 
           (contact.organization && contact.organization.toLowerCase().includes(search));
  });

  const filteredOrganisationsForFilter = uniqueOrganisations.filter(org => {
    if (!organisationSearch.trim()) return true;
    return org.toLowerCase().includes(organisationSearch.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      {/* Main Content */}
      <div className="flex-1 space-y-3 overflow-y-auto min-h-0">
        {/* Header with View Mode and Filters Toggle */}
        <div className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-neutral-950/95 backdrop-blur-sm pb-2 border-b border-neutral-800">
          <div className="flex gap-1 flex-1">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 text-xs rounded transition-colors font-medium ${
                viewMode === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setViewMode('assigned')}
              className={`px-3 py-1 text-xs rounded transition-colors font-medium ${
                viewMode === 'assigned'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
              }`}
            >
              Assigned
            </button>
          </div>
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filtersExpanded 
                ? 'bg-neutral-800 text-neutral-300' 
                : hasActiveFilters
                  ? 'bg-blue-600/30 text-blue-400'
                  : 'bg-neutral-800 text-neutral-500'
            }`}
            title="Toggle filters"
          >
            {filtersExpanded ? '▼' : '▶'} Filters{hasActiveFilters ? ` (${selectedStatuses.length + selectedPriorities.length + selectedContacts.length + selectedOrganisations.length})` : ''}
          </button>
        </div>

        {/* Collapsible Filters */}
        {filtersExpanded && (
          <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-900/50 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h4 className="text-xs uppercase tracking-wide text-neutral-400 font-semibold">Filters</h4>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-neutral-400 hover:text-white underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Status and Priority filters */}
            <div className="grid grid-cols-2 gap-3">
              {/* Status filters */}
              <div className="space-y-2">
                <label className="block text-xs text-neutral-400 font-medium">Status</label>
                <div className="flex flex-wrap gap-2">
                  {(['ongoing', 'done', 'failed'] as const).map((status) => (
                    <label
                      key={status}
                      className="flex items-center gap-1.5 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(status)}
                        onChange={() => toggleStatusFilter(status)}
                        className="rounded w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                      />
                      <span className="text-xs text-neutral-400 group-hover:text-neutral-300">
                        {status === 'done' ? 'Done' : status === 'failed' ? 'Fail' : 'On'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority filters */}
              <div className="space-y-2">
                <label className="block text-xs text-neutral-400 font-medium">Priority</label>
                <div className="flex flex-wrap gap-2">
                  {(['low', 'mid', 'prio', 'high prio'] as const).map((priority) => (
                    <label
                      key={priority}
                      className="flex items-center gap-1.5 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPriorities.includes(priority)}
                        onChange={() => togglePriorityFilter(priority)}
                        className="rounded w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                      />
                      <span className="text-xs text-neutral-400 group-hover:text-neutral-300">
                        {priority === 'high prio' ? 'High' : priority === 'prio' ? 'Prio' : priority.charAt(0).toUpperCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact filters with search */}
            {uniqueContacts.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs text-neutral-400 font-medium">Contacts ({uniqueContacts.length})</label>
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full px-2 py-1.5 text-xs bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                />
                <div className="max-h-32 overflow-y-auto border border-neutral-700 rounded p-2 bg-neutral-800 space-y-1">
                  {filteredContactsForFilter.slice(0, 8).map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-neutral-700 px-2 py-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.id)}
                        onChange={() => toggleContactFilter(contact.id)}
                        className="rounded w-3.5 h-3.5 accent-blue-600"
                      />
                      <span className="text-xs text-neutral-300 flex-1 truncate">
                        {contact.name}
                        {contact.organization && (
                          <span className="text-neutral-500"> • {contact.organization}</span>
                        )}
                      </span>
                    </label>
                  ))}
                  {filteredContactsForFilter.length > 8 && (
                    <div className="text-xs text-neutral-600 px-2 py-1">
                      +{filteredContactsForFilter.length - 8} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Organisation filters with search */}
            {uniqueOrganisations.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs text-neutral-400 font-medium">Organizations ({uniqueOrganisations.length})</label>
                <input
                  type="text"
                  value={organisationSearch}
                  onChange={(e) => setOrganisationSearch(e.target.value)}
                  placeholder="Search organizations..."
                  className="w-full px-2 py-1.5 text-xs bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                />
                <div className="max-h-32 overflow-y-auto border border-neutral-700 rounded p-2 bg-neutral-800 space-y-1">
                  {filteredOrganisationsForFilter.slice(0, 8).map((org) => (
                    <label
                      key={org}
                      className="flex items-center gap-2 cursor-pointer hover:bg-neutral-700 px-2 py-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedOrganisations.includes(org)}
                        onChange={() => toggleOrganisationFilter(org)}
                        className="rounded w-3.5 h-3.5 accent-blue-600"
                      />
                      <span className="text-xs text-neutral-300 truncate">{org}</span>
                    </label>
                  ))}
                  {filteredOrganisationsForFilter.length > 8 && (
                    <div className="text-xs text-neutral-600 px-2 py-1">
                      +{filteredOrganisationsForFilter.length - 8} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom row with completed toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showCompleted"
                  checked={showCompleted}
                  onChange={() => setShowCompleted(!showCompleted)}
                  className="rounded w-4 h-4 accent-blue-600 cursor-pointer"
                />
                <label htmlFor="showCompleted" className="text-sm text-white cursor-pointer font-medium">Show Completed</label>
              </div>
              {hasActiveFilters && (
                <div className="text-xs text-blue-400 font-medium">
                  {filteredTasks.length} / {tasks.length} tasks
                </div>
              )}
            </div>
          </div>
        )}

      {incompleteTasks.length > 0 && (
        <div className="mt-2">
          <h3 className="text-sm uppercase tracking-wider text-neutral-400 mb-3 font-semibold border-b border-neutral-800 pb-2">
            Active ({incompleteTasks.length})
          </h3>
          <div className="space-y-2">
            {(() => {
              // Group tasks by organization (excluding Middle Bridge)
              const tasksByOrg = new Map<string, Task[]>();
              const noOrgTasks: Task[] = [];
              const MIDDLE_BRIDGE = "Middle Bridge";
              
              incompleteTasks.forEach((task) => {
                // First, try to get organization from assignees (excluding Middle Bridge)
                let org: string | null = null;
                
                if (task.assignees && task.assignees.length > 0) {
                  // Find first assignee with organization that's not Middle Bridge
                  for (const assigneeId of task.assignees) {
                    const assignee = contacts.find(c => c.id === assigneeId);
                    if (assignee?.organization && assignee.organization !== MIDDLE_BRIDGE) {
                      org = assignee.organization;
                      break;
                    }
                  }
                }
                
                // If no valid org from assignees, try owner's organization (but exclude Middle Bridge)
                if (!org) {
                  const ownerOrg = task.contactOrganization;
                  if (ownerOrg && ownerOrg !== MIDDLE_BRIDGE) {
                    org = ownerOrg;
                  }
                }
                
                if (!org) {
                  noOrgTasks.push(task);
                } else {
                  if (!tasksByOrg.has(org)) {
                    tasksByOrg.set(org, []);
                  }
                  tasksByOrg.get(org)!.push(task);
                }
              });
              
              const orgs = Array.from(tasksByOrg.entries()).sort((a, b) => a[0].localeCompare(b[0]));
              
              return (
                <>
                  {orgs.map(([orgName, orgTasks]) => (
                    <div key={orgName} className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900/60 border-l-4 border-blue-500 rounded">
                        <span className="text-sm font-semibold text-white uppercase tracking-wide">
                          {orgName}
                        </span>
                        <span className="text-xs text-neutral-400 font-medium">
                          ({orgTasks.length})
                        </span>
                      </div>
                      <div className="space-y-2 pl-4 ml-2 border-l-2 border-neutral-800/50">
                        {orgTasks.map((task) => {
                          const isEditing = editingTask?.contactId === task.contactId && editingTask?.taskId === task.id;
                          const isExpanded = expandedTask?.contactId === task.contactId && expandedTask?.taskId === task.id;
                          const taskKey = `${task.contactId}-${task.id}`;
                          
                          // Get assignee names for display
                          const assigneeNames = task.assignees 
                            ? task.assignees
                                .map(id => contacts.find(c => c.id === id)?.name)
                                .filter(Boolean)
                            : [];
                          const assigneeCount = task.assignees?.length || 0;
                          const taskId = `${task.contactId}-${task.id}`;
                          const linkedDocsCount = documents.filter(doc => doc.task_id === taskId).length;
                          
                          return (
                            <div key={taskKey} className="space-y-2">
                              <div
                                className={`group relative bg-gradient-to-br from-neutral-900/60 to-neutral-900/40 border rounded-xl p-4 transition-all duration-200 cursor-pointer ${
                                  isExpanded 
                                    ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' 
                                    : 'border-neutral-800/60 hover:border-neutral-700/80 hover:shadow-md'
                                }`}
                                onClick={() => {
                                  if (!isEditing) {
                                    setExpandedTask(isExpanded ? null : { contactId: task.contactId, taskId: task.id });
                                  }
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 mt-1">
                                    <input
                                      type="checkbox"
                                      checked={task.completed}
                                      onChange={() => handleToggleTask(task.contactId, task.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                      {editingField?.contactId === task.contactId && editingField?.taskId === task.id && editingField?.field === 'text' ? (
                                        <input
                                          type="text"
                                          value={inlineEditValue}
                                          onChange={(e) => setInlineEditValue(e.target.value)}
                                          onBlur={() => {
                                            if (inlineEditValue.trim()) {
                                              handleSaveInlineEdit(task.contactId, task.id, 'text');
                                            } else {
                                              handleCancelInlineEdit();
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              if (inlineEditValue.trim()) {
                                                handleSaveInlineEdit(task.contactId, task.id, 'text');
                                              }
                                            } else if (e.key === 'Escape') {
                                              handleCancelInlineEdit();
                                            }
                                          }}
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                          className={`text-base font-semibold leading-snug flex-1 bg-neutral-800 border border-blue-500/50 rounded px-2 py-1 ${
                                            task.status === 'done' ? 'text-neutral-500' : 
                                            task.status === 'failed' ? 'text-red-400' : 
                                            'text-white'
                                          }`}
                                        />
                                      ) : (
                                        <p 
                                          className={`text-base font-semibold leading-snug flex-1 cursor-text hover:bg-neutral-800/50 rounded px-1 py-0.5 transition-colors ${
                                            task.status === 'done' ? 'text-neutral-500 line-through' : 
                                            task.status === 'failed' ? 'text-red-400' : 
                                            'text-white'
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartInlineEdit(task.contactId, task.id, 'text', task.text);
                                          }}
                                        >
                                          {task.text}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {task.priority && (
                                          <span
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${getPriorityColor(
                                              task.priority
                                            )}`}
                                          >
                                            {getPriorityLabel(task.priority)}
                                          </span>
                                        )}
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${getStatusStyles(task.status)}`}>
                                          {task.status === 'done' ? 'Done' : task.status === 'failed' ? 'Failed' : 'Ongoing'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap text-sm text-neutral-400">
                                      {task.created_at && (
                                        <span className="flex items-center gap-1">
                                          <span>➕</span>
                                          <span className="text-neutral-500">{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
                                        </span>
                                      )}
                                      {editingField?.contactId === task.contactId && editingField?.taskId === task.id && editingField?.field === 'dueDate' ? (
                                        <>
                                          {task.created_at && <span className="text-neutral-600">•</span>}
                                          <input
                                            type="date"
                                            value={inlineEditValue}
                                            onChange={(e) => setInlineEditValue(e.target.value)}
                                            onBlur={() => {
                                              handleSaveInlineEdit(task.contactId, task.id, 'dueDate');
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSaveInlineEdit(task.contactId, task.id, 'dueDate');
                                              } else if (e.key === 'Escape') {
                                                handleCancelInlineEdit();
                                              }
                                            }}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-neutral-800 border border-blue-500/50 rounded px-2 py-1 text-sm text-white"
                                          />
                                        </>
                                      ) : task.dueDate ? (
                                        <>
                                          {task.created_at && <span className="text-neutral-600">•</span>}
                                          <span 
                                            className={`flex items-center gap-1 cursor-pointer hover:bg-neutral-800/50 rounded px-1 py-0.5 transition-colors ${isPast(new Date(task.dueDate)) && task.status !== 'done' ? 'text-red-400 font-medium' : 'text-neutral-300'}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartInlineEdit(task.contactId, task.id, 'dueDate', task.dueDate || "");
                                            }}
                                          >
                                            <span>📅</span>
                                            <span>{getTimeRemaining(task.dueDate)}</span>
                                            {!isPast(new Date(task.dueDate)) && task.status !== 'done' && (
                                              <span className="text-xs">({format(new Date(task.dueDate), 'MMM d')})</span>
                                            )}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          {task.created_at && <span className="text-neutral-600">•</span>}
                                          <span 
                                            className="flex items-center gap-1 text-neutral-600 italic cursor-pointer hover:bg-neutral-800/50 rounded px-1 py-0.5 transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartInlineEdit(task.contactId, task.id, 'dueDate', "");
                                            }}
                                          >
                                            <span>📅</span>
                                            <span>No deadline</span>
                                          </span>
                                        </>
                                      )}
                                      {assigneeNames.length > 0 && (
                                        <>
                                          {(task.created_at || task.dueDate !== undefined) && <span className="text-neutral-600">•</span>}
                                          <span className="flex items-center gap-1">
                                            <span>👤</span>
                                            <span className="font-medium">{assigneeNames[0]}</span>
                                            {assigneeCount > 1 && (
                                              <span className="text-neutral-500">+{assigneeCount - 1}</span>
                                            )}
                                          </span>
                                        </>
                                      )}
                                      {task.contactName && (
                                        <>
                                          {(task.created_at || task.dueDate !== undefined || assigneeNames.length > 0) && <span className="text-neutral-600">•</span>}
                                          <span className="text-neutral-500">{task.contactName}</span>
                                        </>
                                      )}
                                      {linkedDocsCount > 0 && (
                                        <>
                                          {(task.created_at || task.dueDate !== undefined || assigneeNames.length > 0 || task.contactName) && <span className="text-neutral-600">•</span>}
                                          <span className="flex items-center gap-1 text-blue-400">
                                            <span>📎</span>
                                            <span>{linkedDocsCount} {linkedDocsCount === 1 ? 'document' : 'documents'}</span>
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {task.doc_url && task.doc_url.trim() && (
                                      <div className="mt-2">
                                        <a
                                          href={task.doc_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-xs text-green-400 hover:text-green-300 inline-flex items-center gap-1.5 underline"
                                          title={task.doc_url}
                                        >
                                          <span>📄</span>
                                          <span>Open Document</span>
                                        </a>
                                      </div>
                                    )}
                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-800/50">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTask(task.contactId, task.id);
                                        }}
                                        className="text-xs px-3 py-1.5 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors font-medium"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Expanded Details */}
                              {isExpanded && !isEditing && (
                                <div className="mt-3 p-4 bg-neutral-900/60 border border-neutral-800/60 rounded-lg space-y-4">
                                  {/* Document File Location */}
                                  {task.doc_url && task.doc_url.trim() && (
                                    <div>
                                      <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold block mb-2">Document File</label>
                                      <div className="bg-neutral-800/50 p-3 rounded">
                                        <div className="flex items-start gap-2">
                                          <span className="text-lg">📄</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-neutral-400 mb-1">File Location:</p>
                                            <a
                                              href={task.doc_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-sm text-green-400 hover:text-green-300 inline-flex items-center gap-2 underline break-all"
                                            >
                                              <span>🔗</span>
                                              <span className="break-all">{task.doc_url}</span>
                                            </a>
                                            {isGoogleDocsUrl(task.doc_url) && (
                                              <div className="mt-2">
                                                <a
                                                  href={task.doc_url.replace('/export?format=pdf', '').replace('/preview', '')}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 underline"
                                                >
                                                  <span>📝</span>
                                                  <span>Open in Google Docs</span>
                                                </a>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Linked Documents */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold">
                                        Linked Documents
                                      </label>
                                      {addingDocumentForTask?.contactId === task.contactId && addingDocumentForTask?.taskId === task.id ? (
                                        <button
                                          onClick={() => {
                                            setAddingDocumentForTask(null);
                                            setDocumentFormData({ name: "", file_url: "", file_type: "", notes: "", google_docs_url: "" });
                                          }}
                                          className="text-xs text-neutral-400 hover:text-white"
                                        >
                                          Cancel
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => setAddingDocumentForTask({ contactId: task.contactId, taskId: task.id })}
                                          className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                          + Add Document
                                        </button>
                                      )}
                                    </div>
                                    
                                    {addingDocumentForTask?.contactId === task.contactId && addingDocumentForTask?.taskId === task.id && (
                                      <div className="mb-3 p-3 bg-neutral-800/50 rounded space-y-2">
                                        <input
                                          type="text"
                                          value={documentFormData.name}
                                          onChange={(e) => setDocumentFormData({ ...documentFormData, name: e.target.value })}
                                          placeholder="Document name *"
                                          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                                        />
                                        <input
                                          type="url"
                                          value={documentFormData.file_url}
                                          onChange={(e) => setDocumentFormData({ ...documentFormData, file_url: e.target.value })}
                                          placeholder="File URL *"
                                          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                                        />
                                        <input
                                          type="text"
                                          value={documentFormData.file_type}
                                          onChange={(e) => setDocumentFormData({ ...documentFormData, file_type: e.target.value })}
                                          placeholder="File type (pdf, docx, etc.)"
                                          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                                        />
                                        {documentFormData.file_type?.toLowerCase().includes('pdf') && (
                                          <input
                                            type="url"
                                            value={documentFormData.google_docs_url}
                                            onChange={(e) => setDocumentFormData({ ...documentFormData, google_docs_url: e.target.value })}
                                            placeholder="Google Docs URL (optional)"
                                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                                          />
                                        )}
                                        <textarea
                                          value={documentFormData.notes}
                                          onChange={(e) => setDocumentFormData({ ...documentFormData, notes: e.target.value })}
                                          placeholder="Notes (optional)"
                                          rows={2}
                                          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500 resize-none"
                                        />
                                        <button
                                          onClick={() => handleAddDocumentToTask(task.contactId, task.id)}
                                          disabled={!documentFormData.name.trim() || !documentFormData.file_url.trim()}
                                          className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Add Document
                                        </button>
                                      </div>
                                    )}
                                    
                                    {(() => {
                                      const taskId = `${task.contactId}-${task.id}`;
                                      const linkedDocs = documents.filter(doc => doc.task_id === taskId);
                                      
                                      if (linkedDocs.length === 0 && !addingDocumentForTask) {
                                        return (
                                          <p className="text-xs text-neutral-500 italic">No documents linked yet</p>
                                        );
                                      }
                                      
                                      return (
                                        <div className="space-y-2">
                                          {linkedDocs.map((doc) => (
                                            <div key={doc.id} className="bg-neutral-800/50 p-3 rounded">
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                  <span className="text-lg">📄</span>
                                                  <div className="flex-1 min-w-0">
                                                    <a
                                                      href={`/?dimension=Relationships&segment=Documents`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/?dimension=Relationships&segment=Documents`);
                                                      }}
                                                      className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-2 underline break-words"
                                                    >
                                                      {doc.name}
                                                    </a>
                                                    {doc.google_docs_url && (
                                                      <div className="mt-2">
                                                        <a
                                                          href={doc.google_docs_url}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-xs text-green-400 hover:text-green-300 inline-flex items-center gap-1 underline break-all"
                                                          onClick={(e) => e.stopPropagation()}
                                                        >
                                                          <span>📝</span>
                                                          <span>Open in Google Docs</span>
                                                        </a>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                                <button
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (confirm("Delete this document?")) {
                                                      await documentsDb.deleteDocument(doc.id);
                                                      await loadTasks();
                                                      window.dispatchEvent(new Event('documents-updated'));
                                                    }
                                                  }}
                                                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 flex-shrink-0"
                                                >
                                                  ×
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  
                                  {/* Task Metadata */}
                                  {task.created_at && (
                                    <div className="pt-2 border-t border-neutral-800">
                                      <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold block mb-1">Created</label>
                                      <p className="text-sm text-neutral-400">
                                        {format(new Date(task.created_at), 'PPP')}
                                      </p>
                                      <p className="text-xs text-neutral-500">
                                        {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Notes */}
                                  {task.notes && task.notes.trim() && (
                                    <div>
                                      <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold block mb-2">Notes</label>
                                      <p className="text-sm text-neutral-300 whitespace-pre-wrap bg-neutral-800/50 p-3 rounded">{task.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Edit form */}
                              {isEditing && (
                                <div className="mt-1 p-2 bg-neutral-900 border border-neutral-700 rounded" onClick={(e) => e.stopPropagation()}>
                                  <div className="space-y-1">
                                    <input
                                      type="text"
                                      value={taskInputs[taskKey]?.text || ""}
                                      onChange={(e) => setTaskInputs({
                                        ...taskInputs,
                                        [taskKey]: {
                                          ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                          text: e.target.value,
                                        },
                                      })}
                                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-xs text-white"
                                      placeholder="Task text"
                                    />
                                    <div className="grid grid-cols-2 gap-1">
                                      <select
                                        value={taskInputs[taskKey]?.status || "ongoing"}
                                        onChange={(e) => setTaskInputs({
                                          ...taskInputs,
                                          [taskKey]: {
                                            ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                            status: e.target.value as 'ongoing' | 'done' | 'failed',
                                          },
                                        })}
                                        className="bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[10px] text-white"
                                      >
                                        <option value="ongoing">Ongoing</option>
                                        <option value="done">Done</option>
                                        <option value="failed">Failed</option>
                                      </select>
                                      <select
                                        value={taskInputs[taskKey]?.priority || "mid"}
                                        onChange={(e) => setTaskInputs({
                                          ...taskInputs,
                                          [taskKey]: {
                                            ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                            priority: e.target.value as "low" | "mid" | "prio" | "high prio",
                                          },
                                        })}
                                        className="bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[10px] text-white"
                                      >
                                        <option value="low">Low</option>
                                        <option value="mid">Mid</option>
                                        <option value="prio">Prio</option>
                                        <option value="high prio">High</option>
                                      </select>
                                    </div>
                                    <input
                                      type="date"
                                      value={taskInputs[taskKey]?.dueDate || ""}
                                      onChange={(e) => setTaskInputs({
                                        ...taskInputs,
                                        [taskKey]: {
                                          ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                          dueDate: e.target.value,
                                        },
                                      })}
                                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[10px] text-white"
                                    />
                                    <textarea
                                      value={taskInputs[taskKey]?.notes || ""}
                                      onChange={(e) => setTaskInputs({
                                        ...taskInputs,
                                        [taskKey]: {
                                          ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                          notes: e.target.value,
                                        },
                                      })}
                                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[10px] text-white"
                                      placeholder="Notes"
                                      rows={2}
                                    />
                                    <input
                                      type="url"
                                      value={taskInputs[taskKey]?.doc_url || ""}
                                      onChange={(e) => setTaskInputs({
                                        ...taskInputs,
                                        [taskKey]: {
                                          ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                          doc_url: e.target.value,
                                        },
                                      })}
                                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[10px] text-white"
                                      placeholder="Doc URL"
                                    />
                                    <div className="flex gap-1 pt-0.5">
                                      <button
                                        onClick={() => handleUpdateTask(task.contactId, task.id)}
                                        className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-[10px]"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => handleCancelEdit(task.contactId, task.id)}
                                        className="flex-1 px-2 py-1 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 text-[10px]"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {noOrgTasks.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900/60 border-l-4 border-neutral-600 rounded">
                        <span className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
                          No Organization
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">
                          ({noOrgTasks.length})
                        </span>
                      </div>
                      <div className="space-y-2 pl-4 ml-2 border-l-2 border-neutral-800/50">
                        {noOrgTasks.map((task) => {
                          const isEditing = editingTask?.contactId === task.contactId && editingTask?.taskId === task.id;
                          const isExpanded = expandedTask?.contactId === task.contactId && expandedTask?.taskId === task.id;
                          const taskKey = `${task.contactId}-${task.id}`;
                          
                          // Get assignee names for display
                          const assigneeNames = task.assignees 
                            ? task.assignees
                                .map(id => contacts.find(c => c.id === id)?.name)
                                .filter(Boolean)
                            : [];
                          const assigneeCount = task.assignees?.length || 0;
                          const taskId = `${task.contactId}-${task.id}`;
                          const linkedDocsCount = documents.filter(doc => doc.task_id === taskId).length;
                          
                          return (
                            <div key={taskKey} className="space-y-2">
                              <div
                                className={`group relative bg-gradient-to-br from-neutral-900/60 to-neutral-900/40 border rounded-xl p-4 transition-all duration-200 cursor-pointer ${
                                  isExpanded 
                                    ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' 
                                    : 'border-neutral-800/60 hover:border-neutral-700/80 hover:shadow-md'
                                }`}
                                onClick={() => {
                                  if (!isEditing) {
                                    setExpandedTask(isExpanded ? null : { contactId: task.contactId, taskId: task.id });
                                  }
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 mt-1">
                                    <input
                                      type="checkbox"
                                      checked={task.completed}
                                      onChange={() => handleToggleTask(task.contactId, task.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                      {editingField?.contactId === task.contactId && editingField?.taskId === task.id && editingField?.field === 'text' ? (
                                        <input
                                          type="text"
                                          value={inlineEditValue}
                                          onChange={(e) => setInlineEditValue(e.target.value)}
                                          onBlur={() => {
                                            if (inlineEditValue.trim()) {
                                              handleSaveInlineEdit(task.contactId, task.id, 'text');
                                            } else {
                                              handleCancelInlineEdit();
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              if (inlineEditValue.trim()) {
                                                handleSaveInlineEdit(task.contactId, task.id, 'text');
                                              }
                                            } else if (e.key === 'Escape') {
                                              handleCancelInlineEdit();
                                            }
                                          }}
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                          className={`text-base font-semibold leading-snug flex-1 bg-neutral-800 border border-blue-500/50 rounded px-2 py-1 ${
                                            task.status === 'done' ? 'text-neutral-500' : 
                                            task.status === 'failed' ? 'text-red-400' : 
                                            'text-white'
                                          }`}
                                        />
                                      ) : (
                                        <p 
                                          className={`text-base font-semibold leading-snug flex-1 cursor-text hover:bg-neutral-800/50 rounded px-1 py-0.5 transition-colors ${
                                            task.status === 'done' ? 'text-neutral-500 line-through' : 
                                            task.status === 'failed' ? 'text-red-400' : 
                                            'text-white'
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartInlineEdit(task.contactId, task.id, 'text', task.text);
                                          }}
                                        >
                                          {task.text}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {task.priority && (
                                          <span
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${getPriorityColor(
                                              task.priority
                                            )}`}
                                          >
                                            {getPriorityLabel(task.priority)}
                                          </span>
                                        )}
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${getStatusStyles(task.status)}`}>
                                          {task.status === 'done' ? 'Done' : task.status === 'failed' ? 'Failed' : 'Ongoing'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap text-sm text-neutral-400">
                                      {task.created_at && (
                                        <span className="flex items-center gap-1">
                                          <span>➕</span>
                                          <span className="text-neutral-500">{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
                                        </span>
                                      )}
                                      {editingField?.contactId === task.contactId && editingField?.taskId === task.id && editingField?.field === 'dueDate' ? (
                                        <>
                                          {task.created_at && <span className="text-neutral-600">•</span>}
                                          <input
                                            type="date"
                                            value={inlineEditValue}
                                            onChange={(e) => setInlineEditValue(e.target.value)}
                                            onBlur={() => {
                                              handleSaveInlineEdit(task.contactId, task.id, 'dueDate');
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSaveInlineEdit(task.contactId, task.id, 'dueDate');
                                              } else if (e.key === 'Escape') {
                                                handleCancelInlineEdit();
                                              }
                                            }}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-neutral-800 border border-blue-500/50 rounded px-2 py-1 text-sm text-white"
                                          />
                                        </>
                                      ) : task.dueDate ? (
                                        <>
                                          {task.created_at && <span className="text-neutral-600">•</span>}
                                          <span 
                                            className={`flex items-center gap-1 cursor-pointer hover:bg-neutral-800/50 rounded px-1 py-0.5 transition-colors ${isPast(new Date(task.dueDate)) && task.status !== 'done' ? 'text-red-400 font-medium' : 'text-neutral-300'}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartInlineEdit(task.contactId, task.id, 'dueDate', task.dueDate || "");
                                            }}
                                          >
                                            <span>📅</span>
                                            <span>{getTimeRemaining(task.dueDate)}</span>
                                            {!isPast(new Date(task.dueDate)) && task.status !== 'done' && (
                                              <span className="text-xs">({format(new Date(task.dueDate), 'MMM d')})</span>
                                            )}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          {task.created_at && <span className="text-neutral-600">•</span>}
                                          <span 
                                            className="flex items-center gap-1 text-neutral-600 italic cursor-pointer hover:bg-neutral-800/50 rounded px-1 py-0.5 transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartInlineEdit(task.contactId, task.id, 'dueDate', "");
                                            }}
                                          >
                                            <span>📅</span>
                                            <span>No deadline</span>
                                          </span>
                                        </>
                                      )}
                                      {assigneeNames.length > 0 && (
                                        <>
                                          {(task.created_at || task.dueDate !== undefined) && <span className="text-neutral-600">•</span>}
                                          <span className="flex items-center gap-1">
                                            <span>👤</span>
                                            <span className="font-medium">{assigneeNames[0]}</span>
                                            {assigneeCount > 1 && (
                                              <span className="text-neutral-500">+{assigneeCount - 1}</span>
                                            )}
                                          </span>
                                        </>
                                      )}
                                      {task.contactName && (
                                        <>
                                          {(task.created_at || task.dueDate !== undefined || assigneeNames.length > 0) && <span className="text-neutral-600">•</span>}
                                          <span className="text-neutral-500">{task.contactName}</span>
                                        </>
                                      )}
                                      {linkedDocsCount > 0 && (
                                        <>
                                          {(task.created_at || task.dueDate !== undefined || assigneeNames.length > 0 || task.contactName) && <span className="text-neutral-600">•</span>}
                                          <span className="flex items-center gap-1 text-blue-400">
                                            <span>📎</span>
                                            <span>{linkedDocsCount} {linkedDocsCount === 1 ? 'document' : 'documents'}</span>
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {task.doc_url && task.doc_url.trim() && (
                                      <div className="mt-2">
                                        <a
                                          href={task.doc_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-xs text-green-400 hover:text-green-300 inline-flex items-center gap-1.5 underline"
                                          title={task.doc_url}
                                        >
                                          <span>📄</span>
                                          <span>Open Document</span>
                                        </a>
                                      </div>
                                    )}
                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-800/50">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTask(task.contactId, task.id);
                                        }}
                                        className="text-xs px-3 py-1.5 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors font-medium"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Expanded Details */}
                              {isExpanded && !isEditing && (
                                <div className="mt-3 p-4 bg-neutral-900/60 border border-neutral-800/60 rounded-lg space-y-4">
                                  {/* Document File Location */}
                                  {task.doc_url && task.doc_url.trim() && (
                                    <div>
                                      <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold block mb-2">Document File</label>
                                      <div className="bg-neutral-800/50 p-3 rounded">
                                        <div className="flex items-start gap-2">
                                          <span className="text-lg">📄</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-neutral-400 mb-1">File Location:</p>
                                            <a
                                              href={task.doc_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-sm text-green-400 hover:text-green-300 inline-flex items-center gap-2 underline break-all"
                                            >
                                              <span>🔗</span>
                                              <span className="break-all">{task.doc_url}</span>
                                            </a>
                                            {isGoogleDocsUrl(task.doc_url) && (
                                              <div className="mt-2">
                                                <a
                                                  href={task.doc_url.replace('/export?format=pdf', '').replace('/preview', '')}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 underline"
                                                >
                                                  <span>📝</span>
                                                  <span>Open in Google Docs</span>
                                                </a>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Linked Documents */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold">
                                        Linked Documents
                                      </label>
                                      {addingDocumentForTask?.contactId === task.contactId && addingDocumentForTask?.taskId === task.id ? (
                                        <button
                                          onClick={() => {
                                            setAddingDocumentForTask(null);
                                            setDocumentFormData({ name: "", file_url: "", file_type: "", notes: "", google_docs_url: "" });
                                          }}
                                          className="text-xs text-neutral-400 hover:text-white"
                                        >
                                          Cancel
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => setAddingDocumentForTask({ contactId: task.contactId, taskId: task.id })}
                                          className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                          + Add Document
                                        </button>
                                      )}
                                    </div>
                                    
                                    {addingDocumentForTask?.contactId === task.contactId && addingDocumentForTask?.taskId === task.id && (
                                      <div className="mb-3 p-3 bg-neutral-800/50 rounded space-y-2">
                                        <input
                                          type="text"
                                          value={documentFormData.name}
                                          onChange={(e) => setDocumentFormData({ ...documentFormData, name: e.target.value })}
                                          placeholder="Document name *"
                                          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                                        />
                                        <input
                                          type="url"
                                          value={documentFormData.file_url}
                                          onChange={(e) => setDocumentFormData({ ...documentFormData, file_url: e.target.value })}
                                          placeholder="File URL *"
                                          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                                        />
                                        <input
                                          type="text"
                                          value={documentFormData.file_type}
                                          onChange={(e) => setDocumentFormData({ ...documentFormData, file_type: e.target.value })}
                                          placeholder="File type (pdf, docx, etc.)"
                                          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                                        />
                                        {documentFormData.file_type?.toLowerCase().includes('pdf') && (
                                          <input
                                            type="url"
                                            value={documentFormData.google_docs_url}
                                            onChange={(e) => setDocumentFormData({ ...documentFormData, google_docs_url: e.target.value })}
                                            placeholder="Google Docs URL (optional)"
                                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                                          />
                                        )}
                                        <textarea
                                          value={documentFormData.notes}
                                          onChange={(e) => setDocumentFormData({ ...documentFormData, notes: e.target.value })}
                                          placeholder="Notes (optional)"
                                          rows={2}
                                          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500 resize-none"
                                        />
                                        <button
                                          onClick={() => handleAddDocumentToTask(task.contactId, task.id)}
                                          disabled={!documentFormData.name.trim() || !documentFormData.file_url.trim()}
                                          className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Add Document
                                        </button>
                                      </div>
                                    )}
                                    
                                    {(() => {
                                      const taskId = `${task.contactId}-${task.id}`;
                                      const linkedDocs = documents.filter(doc => doc.task_id === taskId);
                                      
                                      if (linkedDocs.length === 0 && !addingDocumentForTask) {
                                        return (
                                          <p className="text-xs text-neutral-500 italic">No documents linked yet</p>
                                        );
                                      }
                                      
                                      return (
                                        <div className="space-y-2">
                                          {linkedDocs.map((doc) => (
                                            <div key={doc.id} className="bg-neutral-800/50 p-3 rounded">
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                  <span className="text-lg">📄</span>
                                                  <div className="flex-1 min-w-0">
                                                    <a
                                                      href={`/?dimension=Relationships&segment=Documents`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/?dimension=Relationships&segment=Documents`);
                                                      }}
                                                      className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-2 underline break-words"
                                                    >
                                                      {doc.name}
                                                    </a>
                                                    {doc.google_docs_url && (
                                                      <div className="mt-2">
                                                        <a
                                                          href={doc.google_docs_url}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-xs text-green-400 hover:text-green-300 inline-flex items-center gap-1 underline break-all"
                                                          onClick={(e) => e.stopPropagation()}
                                                        >
                                                          <span>📝</span>
                                                          <span>Open in Google Docs</span>
                                                        </a>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                                <button
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (confirm("Delete this document?")) {
                                                      await documentsDb.deleteDocument(doc.id);
                                                      await loadTasks();
                                                      window.dispatchEvent(new Event('documents-updated'));
                                                    }
                                                  }}
                                                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 flex-shrink-0"
                                                >
                                                  ×
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  
                                  {/* Task Metadata */}
                                  {task.created_at && (
                                    <div className="pt-2 border-t border-neutral-800">
                                      <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold block mb-1">Created</label>
                                      <p className="text-sm text-neutral-400">
                                        {format(new Date(task.created_at), 'PPP')}
                                      </p>
                                      <p className="text-xs text-neutral-500">
                                        {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Notes */}
                                  {task.notes && task.notes.trim() && (
                                    <div>
                                      <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold block mb-2">Notes</label>
                                      <p className="text-sm text-neutral-300 whitespace-pre-wrap bg-neutral-800/50 p-3 rounded">{task.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Edit form */}
                              {isEditing && (
                                <div className="mt-1 p-2 bg-neutral-900 border border-neutral-700 rounded" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={taskInputs[taskKey]?.text || ""}
                                    onChange={(e) => setTaskInputs({
                                      ...taskInputs,
                                      [taskKey]: {
                                        ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                        text: e.target.value,
                                      },
                                    })}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
                                    placeholder="Task text"
                                  />
                                  <div className="flex gap-2">
                                    <select
                                      value={taskInputs[taskKey]?.status || "ongoing"}
                                      onChange={(e) => setTaskInputs({
                                        ...taskInputs,
                                        [taskKey]: {
                                          ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                          status: e.target.value as 'ongoing' | 'done' | 'failed',
                                        },
                                      })}
                                      className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
                                    >
                                      <option value="ongoing">Ongoing</option>
                                      <option value="done">Done</option>
                                      <option value="failed">Failed</option>
                                    </select>
                                    <select
                                      value={taskInputs[taskKey]?.priority || "mid"}
                                      onChange={(e) => setTaskInputs({
                                        ...taskInputs,
                                        [taskKey]: {
                                          ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                          priority: e.target.value as "low" | "mid" | "prio" | "high prio",
                                        },
                                      })}
                                      className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
                                    >
                                      <option value="low">Low</option>
                                      <option value="mid">Mid</option>
                                      <option value="prio">Prio</option>
                                      <option value="high prio">High Prio</option>
                                    </select>
                                  </div>
                                  <input
                                    type="date"
                                    value={taskInputs[taskKey]?.dueDate || ""}
                                    onChange={(e) => setTaskInputs({
                                      ...taskInputs,
                                      [taskKey]: {
                                        ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                        dueDate: e.target.value,
                                      },
                                    })}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
                                  />
                                  <textarea
                                    value={taskInputs[taskKey]?.notes || ""}
                                    onChange={(e) => setTaskInputs({
                                      ...taskInputs,
                                      [taskKey]: {
                                        ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                        notes: e.target.value,
                                      },
                                    })}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
                                    placeholder="Notes"
                                    rows={2}
                                  />
                                  <div>
                                    <input
                                      type="url"
                                      value={taskInputs[taskKey]?.doc_url || ""}
                                      onChange={(e) => setTaskInputs({
                                        ...taskInputs,
                                        [taskKey]: {
                                          ...(taskInputs[taskKey] || { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" }),
                                          doc_url: e.target.value,
                                        },
                                      })}
                                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
                                      placeholder="Google Docs URL"
                                    />
                                    {taskInputs[taskKey]?.doc_url && taskInputs[taskKey]?.doc_url.trim() && (
                                      <div className="mt-1 text-[10px] text-neutral-500">
                                        Link: <a href={taskInputs[taskKey]?.doc_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{taskInputs[taskKey]?.doc_url}</a>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleUpdateTask(task.contactId, task.id)}
                                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => handleCancelEdit(task.contactId, task.id)}
                                      className="flex-1 px-3 py-1.5 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 text-xs"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-800">
          <h3 className="text-sm uppercase tracking-wider text-neutral-400 mb-3 font-semibold border-b border-neutral-800 pb-2">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <div
                key={`${task.contactId}-${task.id}`}
                className="group relative bg-gradient-to-br from-neutral-900/40 to-neutral-900/20 border border-neutral-800/40 rounded-xl p-4 opacity-60 hover:opacity-80 hover:bg-neutral-900/50 transition-all duration-150 cursor-pointer"
                onClick={() => handleToggleTask(task.contactId, task.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.contactId, task.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base text-neutral-500 line-through leading-snug font-semibold">
                      {task.text}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-neutral-600">
                      <span>👤</span>
                      <span>{task.contactName}</span>
                      {task.contactOrganization && (
                        <>
                          <span>•</span>
                          <span>{task.contactOrganization}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Google Calendar at the bottom */}
      <div className="mt-2 pt-2 border-t border-neutral-800">
        <GoogleCalendarIntegration 
          onSync={checkCalendarConnection} 
          collapsed={isCalendarCollapsed}
          onToggleCollapse={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
        />
      </div>
    </div>
  );
}
