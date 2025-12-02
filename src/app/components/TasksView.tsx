"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as contactsDb from "../../lib/db/contacts";
import * as organisationsDb from "../../lib/db/organisations";
import type { Contact } from "../../lib/db/contacts";
import type { Organisation } from "../../lib/db/organisations";
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
  const [loading, setLoading] = useState(true);
  
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
  
  // Task editing states
  const [editingTask, setEditingTask] = useState<{ contactId: string; taskId: string } | null>(null);
  const [taskInputs, setTaskInputs] = useState<Record<string, { 
    text: string; 
    status: 'ongoing' | 'done' | 'failed'; 
    priority: "low" | "mid" | "prio" | "high prio"; 
    dueDate: string; 
    notes: string; 
    assignees: string[]; 
    doc_url: string;
  }>>({});

  useEffect(() => {
    loadTasks();
    checkCalendarConnection();
    
    // Listen for task updates
    const handleTaskUpdate = () => {
      loadTasks();
    };
    window.addEventListener('graph-data-updated', handleTaskUpdate);
    
    return () => {
      window.removeEventListener('graph-data-updated', handleTaskUpdate);
    };
  }, []);

  const checkCalendarConnection = async () => {
    try {
      const connected = await googleCalendar.isSignedIn();
      setIsCalendarConnected(connected);
    } catch {
      setIsCalendarConnected(false);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const [contactsData, organisationsData] = await Promise.all([
        contactsDb.getContacts(),
        organisationsDb.getOrganisations(),
      ]);
      setContacts(contactsData);
      setOrganisations(organisationsData);
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
      setLoading(false);
    }
  };

  const handleToggleTask = async (contactId: string, taskId: string) => {
    const contact = await contactsDb.getContacts().then(contacts => 
      contacts.find(c => c.id === contactId)
    );
    if (contact) {
      const updatedTasks = contact.tasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      );
      await contactsDb.updateContact(contactId, { tasks: updatedTasks });
      await loadTasks();
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask({ contactId: task.contactId, taskId: task.id });
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
      await loadTasks();
      window.dispatchEvent(new Event('graph-data-updated'));
      setEditingTask(null);
      setTaskInputs({ ...taskInputs, [taskKey]: { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" } });
    }
  };

  const handleCancelEdit = (contactId: string, taskId: string) => {
    setEditingTask(null);
    const taskKey = `${contactId}-${taskId}`;
    setTaskInputs({ ...taskInputs, [taskKey]: { text: "", status: "ongoing", priority: "mid", dueDate: "", notes: "", assignees: [], doc_url: "" } });
  };

  const handleDeleteTask = async (contactId: string, taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) {
      return;
    }

    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      const task = contact.tasks.find((t) => t.id === taskId);
      
      // Delete from calendar if exists
      if (task && (task as any).calendar_event_id && isCalendarConnected) {
        try {
          await googleCalendar.deleteCalendarEvent((task as any).calendar_event_id);
        } catch (error) {
          console.error("Error deleting calendar event:", error);
        }
      }

      const updatedTasks = contact.tasks.filter((task) => task.id !== taskId);
      await contactsDb.updateContact(contactId, { tasks: updatedTasks });
      await loadTasks();
      window.dispatchEvent(new Event('graph-data-updated'));
    }
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
        await contactsDb.updateContact(task.contactId, { tasks: updatedTasks });
        await loadTasks();
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
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
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
        return 'bg-green-900/30 text-green-400';
      case 'failed':
        return 'bg-red-900/30 text-red-400';
      case 'ongoing':
        return 'bg-blue-900/30 text-blue-400';
      default:
        return 'bg-neutral-700 text-neutral-400';
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
    <div className="mt-2 space-y-2">
      {/* Google Calendar Integration */}
      <div className="border border-neutral-800 rounded p-2 bg-neutral-900">
        <GoogleCalendarIntegration onSync={checkCalendarConnection} />
      </div>

      {/* Filters and View Options */}
      <div className="space-y-2">
        {/* View Mode Toggle */}
        <div className="flex gap-1 p-0.5 bg-neutral-800 rounded">
          <button
            onClick={() => setViewMode('all')}
            className={`flex-1 px-1.5 py-0.5 text-[10px] rounded transition-colors ${
              viewMode === 'all'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setViewMode('assigned')}
            className={`flex-1 px-1.5 py-0.5 text-[10px] rounded transition-colors ${
              viewMode === 'assigned'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Assigned
          </button>
        </div>

        {/* Filters */}
        <div className="border border-neutral-800 rounded p-1.5 bg-neutral-900 space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[9px] uppercase tracking-wide text-neutral-400 font-semibold">Filters</h4>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-[9px] text-neutral-400 hover:text-white underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status filters */}
          <div>
            <label className="block text-[9px] text-neutral-400 mb-0.5">Status</label>
            <div className="flex flex-wrap gap-1">
              {(['ongoing', 'done', 'failed'] as const).map((status) => (
                <label
                  key={status}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => toggleStatusFilter(status)}
                    className="rounded w-2.5 h-2.5"
                  />
                  <span className="text-[9px] text-neutral-300">
                    {status === 'done' ? 'Done' : status === 'failed' ? 'Failed' : 'Ongoing'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Priority filters */}
          <div>
            <label className="block text-[9px] text-neutral-400 mb-0.5">Priority</label>
            <div className="flex flex-wrap gap-1">
              {(['low', 'mid', 'prio', 'high prio'] as const).map((priority) => (
                <label
                  key={priority}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPriorities.includes(priority)}
                    onChange={() => togglePriorityFilter(priority)}
                    className="rounded w-2.5 h-2.5"
                  />
                  <span className="text-[9px] text-neutral-300">
                    {priority === 'high prio' ? 'High' : priority === 'prio' ? 'Prio' : priority === 'mid' ? 'Mid' : 'Low'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Contact filters with search */}
          {uniqueContacts.length > 0 && (
            <div>
              <label className="block text-[9px] text-neutral-400 mb-0.5">Contacts ({uniqueContacts.length})</label>
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full mb-1 px-1.5 py-0.5 text-[9px] bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              />
              <div className="max-h-16 overflow-y-auto border border-neutral-700 rounded p-1 bg-neutral-800 space-y-0.5">
                {filteredContactsForFilter.slice(0, 10).map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-1 cursor-pointer hover:bg-neutral-700 px-0.5 py-0.5 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contact.id)}
                      onChange={() => toggleContactFilter(contact.id)}
                      className="rounded w-2.5 h-2.5"
                    />
                    <span className="text-[9px] text-neutral-300 flex-1 truncate">
                      {contact.name}
                      {contact.organization && (
                        <span className="text-neutral-500"> ({contact.organization})</span>
                      )}
                    </span>
                  </label>
                ))}
                {filteredContactsForFilter.length > 10 && (
                  <div className="text-[8px] text-neutral-500 px-0.5 py-0.5">
                    +{filteredContactsForFilter.length - 10} more (use search to find)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Organisation filters with search */}
          {uniqueOrganisations.length > 0 && (
            <div>
              <label className="block text-[9px] text-neutral-400 mb-0.5">Organisations ({uniqueOrganisations.length})</label>
              <input
                type="text"
                value={organisationSearch}
                onChange={(e) => setOrganisationSearch(e.target.value)}
                placeholder="Search organisations..."
                className="w-full mb-1 px-1.5 py-0.5 text-[9px] bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              />
              <div className="max-h-16 overflow-y-auto border border-neutral-700 rounded p-1 bg-neutral-800 space-y-0.5">
                {filteredOrganisationsForFilter.slice(0, 10).map((org) => (
                  <label
                    key={org}
                    className="flex items-center gap-1 cursor-pointer hover:bg-neutral-700 px-0.5 py-0.5 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOrganisations.includes(org)}
                      onChange={() => toggleOrganisationFilter(org)}
                      className="rounded w-2.5 h-2.5"
                    />
                    <span className="text-[9px] text-neutral-300 truncate">{org}</span>
                  </label>
                ))}
                {filteredOrganisationsForFilter.length > 10 && (
                  <div className="text-[8px] text-neutral-500 px-0.5 py-0.5">
                    +{filteredOrganisationsForFilter.length - 10} more (use search to find)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Show completed toggle */}
          <div className="flex items-center justify-between pt-0.5 border-t border-neutral-800">
            <label className="text-[9px] text-neutral-400">Show completed</label>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`w-7 h-3.5 rounded-full transition-colors ${
                showCompleted ? 'bg-blue-500' : 'bg-neutral-700'
              }`}
            >
              <span
                className={`block w-2.5 h-2.5 rounded-full bg-white transition-transform ${
                  showCompleted ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {hasActiveFilters && (
            <div className="text-[9px] text-neutral-500 pt-0.5 border-t border-neutral-800">
              {filteredTasks.length} of {tasks.length}
            </div>
          )}
        </div>
      </div>

      {incompleteTasks.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 mb-3 font-semibold">
            Active ({incompleteTasks.length})
          </h3>
          <div className="space-y-3">
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
                    <div key={orgName} className="space-y-2">
                      <div className="flex items-center gap-2 px-2 py-1 bg-neutral-800/40 border-l-2 border-blue-500/50 rounded">
                        <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">
                          {orgName}
                        </span>
                        <span className="text-[9px] text-neutral-500">
                          ({orgTasks.length})
                        </span>
                      </div>
                      <div className="space-y-2 pl-2 border-l-2 border-neutral-700/30">
                        {orgTasks.map((task) => {
                          const isEditing = editingTask?.contactId === task.contactId && editingTask?.taskId === task.id;
                          const taskKey = `${task.contactId}-${task.id}`;
                          return (
                            <div key={taskKey}>
                              <div
                                className="group relative bg-neutral-800/60 border border-neutral-700/50 rounded-lg p-3 hover:bg-neutral-800 hover:border-neutral-600 transition-all duration-200 cursor-pointer"
                                onClick={() => !isEditing && handleToggleTask(task.contactId, task.id)}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 mt-0.5">
                                    <input
                                      type="checkbox"
                                      checked={task.completed}
                                      onChange={() => handleToggleTask(task.contactId, task.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-white focus:ring-2 focus:ring-neutral-500 cursor-pointer"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                      <p className={`text-sm font-medium leading-snug flex-1 ${
                                        task.status === 'done' ? 'text-neutral-500 line-through' : 
                                        task.status === 'failed' ? 'text-red-400' : 
                                        'text-neutral-100'
                                      }`}>
                                        {task.text}
                                      </p>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span
                                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getStatusStyles(task.status)}`}
                                        >
                                          {task.status === 'done' ? 'Done' : task.status === 'failed' ? 'Failed' : task.status === 'ongoing' ? 'Ongoing' : '—'}
                                        </span>
                                        {task.priority && (
                                          <span
                                            className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getPriorityColor(
                                              task.priority
                                            )}`}
                                          >
                                            {getPriorityLabel(task.priority)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-neutral-500">
                                      {task.created_at && (
                                        <>
                                          <span>Added: {format(new Date(task.created_at), "MMM d, yyyy")}</span>
                                          <span className="text-[10px] text-neutral-600">•</span>
                                        </>
                                      )}
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px]">👤</span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`?dimension=Relationships+%26+Network&segment=Contacts`);
                                            setTimeout(() => {
                                              const element = document.querySelector(`[data-contact-id="${task.contactId}"]`);
                                              if (element) {
                                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                (element as HTMLElement).classList.add('ring-2', 'ring-blue-500');
                                                setTimeout(() => {
                                                  (element as HTMLElement).classList.remove('ring-2', 'ring-blue-500');
                                                }, 2000);
                                              }
                                            }, 100);
                                          }}
                                          className="text-neutral-400 hover:text-blue-400 hover:underline transition-colors"
                                        >
                                          {task.contactName}
                                        </button>
                                      </div>
                                      {task.dueDate && (
                                        <>
                                          <span className="text-[10px] text-neutral-600">•</span>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px]">📅</span>
                                            <span className={isPast(new Date(task.dueDate)) && task.status !== 'done' ? 'text-red-400' : ''}>
                                              {getTimeRemaining(task.dueDate)} ({format(new Date(task.dueDate), "MMM d, yyyy")})
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    {task.doc_url && task.doc_url.trim() && (
                                      <div className="mt-1.5">
                                        <a
                                          href={task.doc_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-xs text-green-400 hover:text-green-300 inline-flex items-center gap-1 underline"
                                          title={task.doc_url}
                                        >
                                          {isGoogleDocsUrl(task.doc_url) ? "📄 Open Google Docs" : "🔗 Open Document"}
                                        </a>
                                      </div>
                                    )}
                                    {task.notes && (
                                      <div className="text-xs text-neutral-500 mt-1.5 italic">
                                        {task.notes}
                                      </div>
                                    )}
                                    {task.assignees && task.assignees.length > 0 && (
                                      <div className="text-xs text-neutral-500 mt-1.5">
                                        <span className="text-neutral-400">Assigned to: </span>
                                        {task.assignees.map((assigneeId, idx) => {
                                          const assignee = contacts.find(c => c.id === assigneeId);
                                          if (!assignee) return null;
                                          const org = assignee.organization || "No organization";
                                          return (
                                            <span key={assigneeId}>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  router.push(`?dimension=Relationships+%26+Network&segment=Contacts`);
                                                  setTimeout(() => {
                                                    const element = document.querySelector(`[data-contact-id="${assigneeId}"]`);
                                                    if (element) {
                                                      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                      (element as HTMLElement).classList.add('ring-2', 'ring-blue-500');
                                                      setTimeout(() => {
                                                        (element as HTMLElement).classList.remove('ring-2', 'ring-blue-500');
                                                      }, 2000);
                                                    }
                                                  }, 100);
                                                }}
                                                className="text-neutral-400 hover:text-blue-400 hover:underline transition-colors"
                                              >
                                                {assignee.name}
                                              </button>
                                              <span className="text-neutral-500"> ({org})</span>
                                              {idx < task.assignees!.length - 1 ? ", " : ""}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {/* Edit and Delete buttons */}
                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-700/50">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditTask(task);
                                        }}
                                        className="text-xs px-2 py-1 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 transition-colors"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTask(task.contactId, task.id);
                                        }}
                                        className="text-xs px-2 py-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {/* Edit form */}
                              {isEditing && (
                                <div className="mt-2 p-3 bg-neutral-900 border border-neutral-700 rounded-lg" onClick={(e) => e.stopPropagation()}>
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
                  ))}
                  {noOrgTasks.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-2 py-1 bg-neutral-800/40 border-l-2 border-neutral-600/50 rounded">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                          No Organization
                        </span>
                        <span className="text-[9px] text-neutral-500">
                          ({noOrgTasks.length})
                        </span>
                      </div>
                      <div className="space-y-2 pl-2 border-l-2 border-neutral-700/30">
                        {noOrgTasks.map((task) => {
                          const isEditing = editingTask?.contactId === task.contactId && editingTask?.taskId === task.id;
                          const taskKey = `${task.contactId}-${task.id}`;
                          return (
                            <div key={taskKey}>
                              <div
                                className="group relative bg-neutral-800/60 border border-neutral-700/50 rounded-lg p-3 hover:bg-neutral-800 hover:border-neutral-600 transition-all duration-200 cursor-pointer"
                                onClick={() => !isEditing && handleToggleTask(task.contactId, task.id)}
                              >
                                <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5">
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={() => handleToggleTask(task.contactId, task.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-white focus:ring-2 focus:ring-neutral-500 cursor-pointer"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <p className={`text-sm font-medium leading-snug flex-1 ${
                                    task.status === 'done' ? 'text-neutral-500 line-through' : 
                                    task.status === 'failed' ? 'text-red-400' : 
                                    'text-neutral-100'
                                  }`}>
                                    {task.text}
                                  </p>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span
                                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getStatusStyles(task.status)}`}
                                    >
                                      {task.status === 'done' ? 'Done' : task.status === 'failed' ? 'Failed' : task.status === 'ongoing' ? 'Ongoing' : '—'}
                                    </span>
                                    {task.priority && (
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getPriorityColor(
                                          task.priority
                                        )}`}
                                      >
                                        {getPriorityLabel(task.priority)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap text-[11px] text-neutral-500">
                                  {task.created_at && (
                                    <>
                                      <span>Added: {format(new Date(task.created_at), "MMM d, yyyy")}</span>
                                      <span className="text-[10px] text-neutral-600">•</span>
                                    </>
                                  )}
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px]">👤</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`?dimension=Relationships+%26+Network&segment=Contacts`);
                                        setTimeout(() => {
                                          const element = document.querySelector(`[data-contact-id="${task.contactId}"]`);
                                          if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            (element as HTMLElement).classList.add('ring-2', 'ring-blue-500');
                                            setTimeout(() => {
                                              (element as HTMLElement).classList.remove('ring-2', 'ring-blue-500');
                                            }, 2000);
                                          }
                                        }, 100);
                                      }}
                                      className="text-neutral-400 hover:text-blue-400 hover:underline transition-colors"
                                    >
                                      {task.contactName}
                                    </button>
                                  </div>
                                  {task.dueDate && (
                                    <>
                                      <span className="text-[10px] text-neutral-600">•</span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px]">📅</span>
                                        <span className={isPast(new Date(task.dueDate)) && task.status !== 'done' ? 'text-red-400' : ''}>
                                          {getTimeRemaining(task.dueDate)} ({format(new Date(task.dueDate), "MMM d, yyyy")})
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                                {task.doc_url && task.doc_url.trim() && (
                                  <div className="mt-1.5">
                                    <a
                                      href={task.doc_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs text-green-400 hover:text-green-300 inline-flex items-center gap-1 underline"
                                      title={task.doc_url}
                                    >
                                      {isGoogleDocsUrl(task.doc_url) ? "📄 Open Google Docs" : "🔗 Open Document"}
                                    </a>
                                  </div>
                                )}
                                {task.notes && (
                                  <div className="text-xs text-neutral-500 mt-1.5 italic">
                                    {task.notes}
                                  </div>
                                )}
                                {task.assignees && task.assignees.length > 0 && (
                                  <div className="text-xs text-neutral-500 mt-1.5">
                                    <span className="text-neutral-400">Assigned to: </span>
                                    {task.assignees.map((assigneeId, idx) => {
                                      const assignee = contacts.find(c => c.id === assigneeId);
                                      if (!assignee) return null;
                                      const org = assignee.organization || "No organization";
                                      return (
                                        <span key={assigneeId}>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              router.push(`?dimension=Relationships+%26+Network&segment=Contacts`);
                                              setTimeout(() => {
                                                const element = document.querySelector(`[data-contact-id="${assigneeId}"]`);
                                                if (element) {
                                                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                  (element as HTMLElement).classList.add('ring-2', 'ring-blue-500');
                                                  setTimeout(() => {
                                                    (element as HTMLElement).classList.remove('ring-2', 'ring-blue-500');
                                                  }, 2000);
                                                }
                                              }, 100);
                                            }}
                                            className="text-neutral-400 hover:text-blue-400 hover:underline transition-colors"
                                          >
                                            {assignee.name}
                                          </button>
                                          <span className="text-neutral-500"> ({org})</span>
                                          {idx < task.assignees!.length - 1 ? ", " : ""}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* Edit and Delete buttons */}
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-700/50">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditTask(task);
                                    }}
                                    className="text-xs px-2 py-1 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTask(task.contactId, task.id);
                                    }}
                                    className="text-xs px-2 py-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                            </div>
                            {/* Edit form */}
                            {isEditing && (
                              <div className="mt-2 p-3 bg-neutral-900 border border-neutral-700 rounded-lg" onClick={(e) => e.stopPropagation()}>
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
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 mb-3 font-semibold">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <div
                key={`${task.contactId}-${task.id}`}
                className="group relative bg-neutral-800/30 border border-neutral-700/30 rounded-lg p-3 opacity-70 hover:opacity-90 hover:bg-neutral-800/40 transition-all duration-200 cursor-pointer"
                onClick={() => handleToggleTask(task.contactId, task.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.contactId, task.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-white focus:ring-2 focus:ring-neutral-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm text-neutral-500 line-through leading-snug flex-1">
                        {task.text}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-neutral-600">👤</span>
                        <span className="text-[11px] text-neutral-600">
                          {task.contactName}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-700">•</span>
                      <span className="text-[11px] text-neutral-600">
                        {task.contactOrganization || "No org"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organizations Summary */}
      {tasks.length > 0 && (
        <div className="mt-6 pt-4 border-t border-neutral-800">
          <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 mb-3 font-semibold">
            Organizations
          </h3>
          <div className="flex flex-wrap gap-2">
            {(() => {
              // Get unique organizations from tasks
              const orgSet = new Set<string>();
              tasks.forEach(task => {
                if (task.contactOrganization) {
                  orgSet.add(task.contactOrganization);
                }
                if (task.assignees) {
                  task.assignees.forEach(assigneeId => {
                    const assignee = contacts.find(c => c.id === assigneeId);
                    if (assignee?.organization) {
                      orgSet.add(assignee.organization);
                    }
                  });
                }
              });
              
              const orgList = Array.from(orgSet).sort();
              
              return orgList.map(orgName => {
                const org = organisations.find(o => o.name === orgName);
                const taskCount = tasks.filter(t => 
                  t.contactOrganization === orgName || 
                  (t.assignees && t.assignees.some(aid => {
                    const assignee = contacts.find(c => c.id === aid);
                    return assignee?.organization === orgName;
                  }))
                ).length;
                
                return (
                  <button
                    key={orgName}
                    onClick={() => {
                      router.push(`?dimension=Relationships+%26+Network&segment=Organisations`);
                    }}
                    className="px-2 py-1 text-xs bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 hover:text-white transition-colors"
                  >
                    {orgName} ({taskCount})
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
