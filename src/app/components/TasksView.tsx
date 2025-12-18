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
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, addDays, startOfWeek, addWeeks, isBefore, isAfter } from "date-fns";
import GoogleCalendarIntegration from "./GoogleCalendarIntegration";
import * as googleCalendar from "../../lib/google-calendar";
import { isGoogleDocsUrl } from "../../lib/storage";

interface SubTask {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  created_at?: string;
  completed_at?: string;
}

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
  completed_at?: string; // Date when task was completed
  subtasks?: SubTask[]; // Array of subtasks
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
  const [subtaskInputs, setSubtaskInputs] = useState<Record<string, string>>({}); // taskKey -> subtask text
  // Inline editing state
  const [editingField, setEditingField] = useState<{ contactId: string; taskId: string; field: 'text' | 'dueDate' } | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<string>("");
  
  // Add task modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskFormData, setNewTaskFormData] = useState({
    contactId: "",
    text: "",
    status: "ongoing" as 'ongoing' | 'done' | 'failed',
    priority: "mid" as "low" | "mid" | "prio" | "high prio",
    dueDate: "",
    notes: "",
    assignees: [] as string[],
    doc_url: "",
  });
  const [contactSearchForModal, setContactSearchForModal] = useState("");
  const [quickTaskInput, setQuickTaskInput] = useState("");

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
      
      // Debug: sprawdź taski w kontaktach
      const contactsWithTasks = contactsData.filter(c => c.tasks && Array.isArray(c.tasks) && c.tasks.length > 0);
      
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
              status: task.status as 'ongoing' | 'done' | 'failed' | undefined,
              contactId: contact.id,
              contactName: contact.name,
              contactOrganization: contact.organization,
              created_at: task.created_at,
              completed_at: task.completed_at,
              subtasks: task.subtasks || [],
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
      t.id === taskId 
        ? { 
            ...t, 
            completed: newCompleted,
            completed_at: newCompleted ? new Date().toISOString() : undefined
          } 
        : t
    );
    
    const updatedContacts = contacts.map((c) =>
      c.id === contactId ? { ...c, tasks: updatedTasks } : c
    );
    setContacts(updatedContacts);
    
    // Update tasks state immediately
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.contactId === contactId && t.id === taskId
          ? { 
              ...t, 
              completed: newCompleted,
              completed_at: newCompleted ? new Date().toISOString() : undefined
            }
          : t
      )
    );
    
    // Save to database in background
    // Don't dispatch graph-data-updated event here - it causes loadTasks() to reload stale data
    // Optimistic update already handles the UI update
    contactsDb.updateContact(contactId, { tasks: updatedTasks }).catch((error) => {
      console.error("Error toggling task:", error);
      // On error, reload to get correct state
      loadTasks();
    });
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
      const originalTask = contact.tasks.find((t) => t.id === taskId);
      const oldAssignees = originalTask?.assignees || [];
      const newAssignees = taskData.assignees || [];
      
      const updatedTask = {
        text: taskText,
        status: taskData.status || "ongoing",
        priority: taskData.priority,
        dueDate: taskData.dueDate || undefined,
        notes: taskData.notes || undefined,
        assignees: newAssignees,
        doc_url: taskData.doc_url || undefined,
      };
      
      const updatedTasks = contact.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updatedTask } : task
      );
      
      // Update owner contact
      const updatedContacts = contacts.map((c) =>
        c.id === contactId ? { ...c, tasks: updatedTasks } : c
      );
      
      // Add task to assignees' tasks, remove from unassigned contacts
      const assigneesToAdd = newAssignees.filter(id => !oldAssignees.includes(id));
      const assigneesToRemove = oldAssignees.filter(id => !newAssignees.includes(id));
      
      // Add task to new assignees
      for (const assigneeId of assigneesToAdd) {
        const assignee = contacts.find((c) => c.id === assigneeId);
        if (assignee) {
          // Check if task already exists in assignee's tasks to prevent duplicates
          const existingTask = assignee.tasks?.find((t) => t.id === taskId);
          if (existingTask) {
            // Task already exists, update it instead of adding duplicate
            const assigneeTasks = (assignee.tasks || []).map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    ...updatedTask,
                    completed: originalTask?.completed || t.completed,
                    created_at: originalTask?.created_at || t.created_at,
                    status: updatedTask.status,
                  }
                : t
            );
            const assigneeIndex = updatedContacts.findIndex((c) => c.id === assigneeId);
            if (assigneeIndex !== -1) {
              updatedContacts[assigneeIndex] = { ...updatedContacts[assigneeIndex], tasks: assigneeTasks };
            }
            // Save to database
            contactsDb.updateContact(assigneeId, { tasks: assigneeTasks }).catch((error) => {
              console.error("Error updating task for assignee:", error);
            });
          } else {
            // Task doesn't exist, add it
            const assigneeTask = {
              ...updatedTask,
              id: taskId, // Keep same ID so it's the same task
              completed: originalTask?.completed || false,
              created_at: originalTask?.created_at || new Date().toISOString(),
              status: updatedTask.status,
            };
            const assigneeTasks = [...(assignee.tasks || []), assigneeTask];
            const assigneeIndex = updatedContacts.findIndex((c) => c.id === assigneeId);
            if (assigneeIndex !== -1) {
              updatedContacts[assigneeIndex] = { ...updatedContacts[assigneeIndex], tasks: assigneeTasks };
            }
            // Save to database
            contactsDb.updateContact(assigneeId, { tasks: assigneeTasks }).catch((error) => {
              console.error("Error adding task to assignee:", error);
            });
          }
        }
      }
      
      // Remove task from unassigned contacts
      for (const assigneeId of assigneesToRemove) {
        const assignee = contacts.find((c) => c.id === assigneeId);
        if (assignee) {
          const assigneeTasks = (assignee.tasks || []).filter((t) => t.id !== taskId);
          const assigneeIndex = updatedContacts.findIndex((c) => c.id === assigneeId);
          if (assigneeIndex !== -1) {
            updatedContacts[assigneeIndex] = { ...updatedContacts[assigneeIndex], tasks: assigneeTasks };
          }
          // Save to database
          contactsDb.updateContact(assigneeId, { tasks: assigneeTasks }).catch((error) => {
            console.error("Error removing task from assignee:", error);
          });
        }
      }
      
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
      
      // Save owner contact to database
      contactsDb.updateContact(contactId, { tasks: updatedTasks }).catch((error) => {
        console.error("Error updating task:", error);
        loadTasks();
      });
      
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  const handleAddSubtask = async (contactId: string, taskId: string) => {
    const taskKey = `${contactId}-${taskId}`;
    const subtaskText = subtaskInputs[taskKey]?.trim();
    
    if (!subtaskText) return;
    
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    
    const task = contact.tasks.find((t) => t.id === taskId);
    if (!task) return;
    
    const newSubtask: SubTask = {
      id: Date.now().toString(),
      text: subtaskText,
      completed: false,
      created_at: new Date().toISOString(),
    };
    
    const updatedSubtasks = [...(task.subtasks || []), newSubtask];
    const updatedTasks = contact.tasks.map((t) =>
      t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t
    );
    
    const updatedContacts = contacts.map((c) =>
      c.id === contactId ? { ...c, tasks: updatedTasks } : c
    );
    setContacts(updatedContacts);
    
    // Update tasks state
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.contactId === contactId && t.id === taskId
          ? { ...t, subtasks: updatedSubtasks }
          : t
      )
    );
    
    // Clear input
    setSubtaskInputs({ ...subtaskInputs, [taskKey]: "" });
    
    // Save to database
    await contactsDb.updateContact(contactId, { tasks: updatedTasks });
    window.dispatchEvent(new Event('graph-data-updated'));
  };

  const handleToggleSubtask = async (contactId: string, taskId: string, subtaskId: string) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    
    const task = contact.tasks.find((t) => t.id === taskId);
    if (!task || !task.subtasks) return;
    
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId
        ? {
            ...st,
            completed: !st.completed,
            completed_at: !st.completed ? new Date().toISOString() : undefined,
          }
        : st
    );
    
    const updatedTasks = contact.tasks.map((t) =>
      t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t
    );
    
    const updatedContacts = contacts.map((c) =>
      c.id === contactId ? { ...c, tasks: updatedTasks } : c
    );
    setContacts(updatedContacts);
    
    // Update tasks state
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.contactId === contactId && t.id === taskId
          ? { ...t, subtasks: updatedSubtasks }
          : t
      )
    );
    
    // Save to database
    await contactsDb.updateContact(contactId, { tasks: updatedTasks });
    window.dispatchEvent(new Event('graph-data-updated'));
  };

  const handleDeleteSubtask = async (contactId: string, taskId: string, subtaskId: string) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    
    const task = contact.tasks.find((t) => t.id === taskId);
    if (!task || !task.subtasks) return;
    
    const updatedSubtasks = task.subtasks.filter((st) => st.id !== subtaskId);
    const updatedTasks = contact.tasks.map((t) =>
      t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t
    );
    
    const updatedContacts = contacts.map((c) =>
      c.id === contactId ? { ...c, tasks: updatedTasks } : c
    );
    setContacts(updatedContacts);
    
    // Update tasks state
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.contactId === contactId && t.id === taskId
          ? { ...t, subtasks: updatedSubtasks }
          : t
      )
    );
    
    // Save to database
    await contactsDb.updateContact(contactId, { tasks: updatedTasks });
    window.dispatchEvent(new Event('graph-data-updated'));
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

  const handleQuickAddTask = async () => {
    if (!quickTaskInput.trim()) return;

    // Don't assign to any contact - create a "virtual" contact or use first available
    // For now, use first contact but we can change this later
    const defaultContact = contacts[0];

    if (!defaultContact) {
      alert("No contacts available. Please add a contact first.");
      setQuickTaskInput("");
      return;
    }

    const newTask: Task = {
      id: Date.now().toString(),
      text: quickTaskInput.trim(),
      completed: false,
      status: "ongoing",
      priority: "mid",
      created_at: new Date().toISOString(),
      contactId: defaultContact.id,
      contactName: defaultContact.name,
    };

    const updatedTasks = [...(defaultContact.tasks || []), newTask];
    await contactsDb.updateContact(defaultContact.id, { tasks: updatedTasks });
    setQuickTaskInput("");
    await loadTasks();
    window.dispatchEvent(new Event('graph-data-updated'));
  };

  const handleSetTaskDeadline = async (contactId: string, taskId: string, days: number) => {
    const today = new Date();
    const deadline = addDays(today, days);
    const deadlineStr = format(deadline, 'yyyy-MM-dd');

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const task = contact.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedTask = { ...task, dueDate: deadlineStr };
    const updatedTasks = contact.tasks.map((t) =>
      t.id === taskId ? updatedTask : t
    );

    // Optimistic update
    const updatedContacts = contacts.map((c) =>
      c.id === contactId ? { ...c, tasks: updatedTasks } : c
    );
    setContacts(updatedContacts);

    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.contactId === contactId && task.id === taskId
          ? { ...task, dueDate: deadlineStr }
          : task
      )
    );

    await contactsDb.updateContact(contactId, { tasks: updatedTasks });
    window.dispatchEvent(new Event('graph-data-updated'));
  };

  const handleAddNewTask = async () => {
    if (!newTaskFormData.contactId || !newTaskFormData.text.trim()) {
      alert("Please select a contact and enter task text");
      return;
    }

    const contact = contacts.find((c) => c.id === newTaskFormData.contactId);
    if (!contact) {
      alert("Contact not found");
      return;
    }

    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskFormData.text.trim(),
      completed: false,
      status: newTaskFormData.status,
      priority: newTaskFormData.priority,
      dueDate: newTaskFormData.dueDate || undefined,
      notes: newTaskFormData.notes || undefined,
      contactId: contact.id,
      contactName: contact.name,
      assignees: newTaskFormData.assignees || [],
      doc_url: newTaskFormData.doc_url || undefined,
      created_at: new Date().toISOString(),
    };

    const updatedTasks = [...(contact.tasks || []), newTask];
    await contactsDb.updateContact(newTaskFormData.contactId, { tasks: updatedTasks });
    await loadTasks();
    window.dispatchEvent(new Event('graph-data-updated'));
    
    // Reset form and close modal
    setNewTaskFormData({
      contactId: "",
      text: "",
      status: "ongoing",
      priority: "mid",
      dueDate: "",
      notes: "",
      assignees: [],
      doc_url: "",
    });
    setShowAddTaskModal(false);
    setContactSearchForModal("");
  };

  const handleToggleAssignee = (assigneeId: string) => {
    const assignees = newTaskFormData.assignees || [];
    const updatedAssignees = assignees.includes(assigneeId)
      ? assignees.filter((id) => id !== assigneeId)
      : [...assignees, assigneeId];
    setNewTaskFormData({ ...newTaskFormData, assignees: updatedAssignees });
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
    
    return true;
  });

  const incompleteTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = showCompleted ? filteredTasks.filter((t) => t.completed) : [];

  // Categorize tasks by due date
  const categorizeTask = (task: Task): 'today' | 'tomorrow' | 'nextWeek' | 'later' | 'noDate' => {
    if (!task.dueDate) return 'noDate';
    
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isToday(dueDate)) return 'today';
    if (isTomorrow(dueDate)) return 'tomorrow';
    
    const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
    if (isBefore(dueDate, nextWeekStart) && isAfter(dueDate, addDays(today, 1))) {
      return 'nextWeek';
    }
    
    if (isAfter(dueDate, addDays(today, 1))) {
      if (isBefore(dueDate, nextWeekStart)) {
        return 'nextWeek';
      }
      return 'later';
    }
    
    return 'noDate';
  };

  const tasksByCategory = {
    today: incompleteTasks.filter(t => categorizeTask(t) === 'today'),
    tomorrow: incompleteTasks.filter(t => categorizeTask(t) === 'tomorrow'),
    nextWeek: incompleteTasks.filter(t => categorizeTask(t) === 'nextWeek'),
    later: incompleteTasks.filter(t => categorizeTask(t) === 'later'),
    noDate: incompleteTasks.filter(t => categorizeTask(t) === 'noDate'),
  };

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
        {/* Header with Quick Add and Filters */}
        <div className="flex items-center gap-2 sticky top-0 z-10 bg-transparent pb-2 border-b border-neutral-800">
          <input
            type="text"
            value={quickTaskInput}
            onChange={(e) => setQuickTaskInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleQuickAddTask();
              }
            }}
            placeholder="Add task... (press Enter)"
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
            <button
              onClick={() => setShowAddTaskModal(true)}
              className="px-3 py-1.5 text-xs rounded transition-colors font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center gap-1.5"
            title="Add new task with details"
            >
              <span>+</span>
              <span>Add Task</span>
            </button>
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
        <div className="mt-2 space-y-3">
          <h3 className="text-sm uppercase tracking-wider text-neutral-400 mb-2 font-semibold border-b border-neutral-800 pb-1">
            Active ({incompleteTasks.length})
          </h3>
          
            {(() => {
            const categoryLabels = {
              today: 'Today',
              tomorrow: 'Tomorrow',
              nextWeek: 'Next Week',
              later: 'Later',
              noDate: 'No Date',
            };

            const categoryOrder: Array<keyof typeof tasksByCategory> = ['today', 'tomorrow', 'nextWeek', 'later', 'noDate'];
              
            // Helper function to render a single task card
            const renderTaskCard = (task: Task) => {
              const isEditing = editingTask?.contactId === task.contactId && editingTask?.taskId === task.id;
              const isExpanded = expandedTask?.contactId === task.contactId && expandedTask?.taskId === task.id;
              const taskKey = `${task.contactId}-${task.id}`;
              
              const assigneeNames = task.assignees 
                ? task.assignees
                    .map(id => contacts.find(c => c.id === id)?.name)
                    .filter(Boolean)
                : [];
              const assigneeCount = task.assignees?.length || 0;
              const taskId = `${task.contactId}-${task.id}`;
              const linkedDocsCount = documents.filter(doc => doc.task_id === taskId).length;
              
              return (
                <div key={taskKey} className="space-y-1">
                  <div
                    className={`group relative bg-gradient-to-br from-neutral-900/60 to-neutral-900/40 border rounded-lg p-2.5 transition-all duration-200 cursor-pointer ${
                      isExpanded 
                        ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' 
                        : 'border-neutral-800/60 hover:border-neutral-700/80 hover:shadow-md'
                    }`}
                    onClick={(e) => {
                      // Don't expand if clicking on interactive elements
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('input, button')) {
                        return;
                      }
                      if (!isEditing) {
                        setExpandedTask(isExpanded ? null : { contactId: task.contactId, taskId: task.id });
                      }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggleTask(task.contactId, task.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
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
                              className={`text-sm font-semibold leading-snug flex-1 bg-neutral-800 border border-blue-500/50 rounded px-2 py-1 ${
                                task.status === 'done' ? 'text-neutral-500' : 
                                task.status === 'failed' ? 'text-red-400' : 
                                'text-white'
                              }`}
                            />
                          ) : (
                            <p 
                              className={`text-sm font-semibold leading-snug flex-1 cursor-text hover:bg-neutral-800/50 rounded px-1 py-0.5 transition-colors ${
                                task.status === 'done' ? 'text-neutral-500 line-through' : 
                                task.status === 'failed' ? 'text-red-400' : 
                                'text-white'
                              }`}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleStartInlineEdit(task.contactId, task.id, 'text', task.text);
                              }}
                            >
                              {task.text}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {task.priority && (
                              <span
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getPriorityColor(
                                  task.priority
                                )}`}
                              >
                                {getPriorityLabel(task.priority)}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getStatusStyles(task.status)}`}>
                              {task.status === 'done' ? 'Done' : task.status === 'failed' ? 'Failed' : 'Open'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-neutral-400">
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
                                className="bg-neutral-800 border border-blue-500/50 rounded px-2 py-1 text-xs text-white"
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
                                  <span className="text-[10px]">({format(new Date(task.dueDate), 'MMM d')})</span>
                                )}
                              </span>
                            </>
                          ) : (
                            <>
                              {task.created_at && <span className="text-neutral-600">•</span>}
                              <span className="flex items-center gap-1 text-neutral-600">
                                <span>📅</span>
                                <span className="italic">No deadline</span>
                                <div className="flex items-center gap-1 ml-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetTaskDeadline(task.contactId, task.id, 0);
                                    }}
                                    className="px-1.5 py-0.5 text-[10px] bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded border border-blue-600/30 transition-colors"
                                  >
                                    Today
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetTaskDeadline(task.contactId, task.id, 1);
                                    }}
                                    className="px-1.5 py-0.5 text-[10px] bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded border border-green-600/30 transition-colors"
                                  >
                                    Tomorrow
                                  </button>
                                </div>
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
                          {linkedDocsCount > 0 && (
                            <>
                              {(task.created_at || task.dueDate !== undefined || assigneeNames.length > 0) && <span className="text-neutral-600">•</span>}
                              <span className="flex items-center gap-1 text-blue-400">
                                <span>📎</span>
                                <span>{linkedDocsCount} doc{linkedDocsCount !== 1 ? 's' : ''}</span>
                              </span>
                            </>
                          )}
                        </div>
                        
                        {/* Subtasks section - ALWAYS VISIBLE */}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-neutral-800/30">
                            <div className="space-y-1.5">
                              {task.subtasks.map((subtask) => (
                                <div
                                  key={subtask.id}
                                  className="flex items-start gap-2 p-1.5 bg-neutral-800/20 rounded border border-neutral-800/40"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={subtask.completed}
                                    onChange={() => handleToggleSubtask(task.contactId, task.id, subtask.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all mt-0.5 flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={`text-xs ${
                                        subtask.completed
                                          ? 'text-neutral-500 line-through'
                                          : 'text-neutral-300'
                                      }`}
                                    >
                                      {subtask.text}
                                    </p>
                                    {subtask.dueDate && (
                                      <p className="text-[10px] text-neutral-500 mt-0.5">
                                        📅 {format(new Date(subtask.dueDate), 'dd.MM.yyyy')}
                                      </p>
                                    )}
                                  </div>
                                  {isExpanded && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSubtask(task.contactId, task.id, subtask.id);
                                      }}
                                      className="text-red-400 hover:text-red-300 text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
                                      title="Usuń subtask"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Dates section - always visible at the bottom */}
                        <div className="mt-2 pt-2 border-t border-neutral-800/30 flex items-center gap-3 text-xs text-neutral-500">
                          {task.created_at && (
                            <span className="flex items-center gap-1">
                              <span>➕</span>
                              <span>Dodano: {format(new Date(task.created_at), 'dd.MM.yyyy HH:mm')}</span>
                            </span>
                          )}
                          {task.completed && task.completed_at && (
                            <>
                              {task.created_at && <span className="text-neutral-700">•</span>}
                              <span className="flex items-center gap-1 text-green-400">
                                <span>✅</span>
                                <span>Wykonano: {format(new Date(task.completed_at), 'dd.MM.yyyy HH:mm')}</span>
                              </span>
                            </>
                          )}
                        </div>
                        
                        {isExpanded && !isEditing && (
                          <>
                            {/* Add subtask input - only visible when expanded */}
                            <div className="mt-3 pt-3 border-t border-neutral-800/50">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                                  Dodaj subtask
                                </h4>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={subtaskInputs[taskKey] || ""}
                                  onChange={(e) => {
                                    setSubtaskInputs({
                                      ...subtaskInputs,
                                      [taskKey]: e.target.value,
                                    });
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddSubtask(task.contactId, task.id);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Add subtask... (Enter to add)"
                                  className="flex-1 px-2 py-1.5 text-xs bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddSubtask(task.contactId, task.id);
                                  }}
                                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            
                            {/* Edit/Delete buttons */}
                            <div className="mt-2 pt-2 border-t border-neutral-800/50 flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTask(task);
                                }}
                                className="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 transition-colors"
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
                          </>
                        )}
                        {isEditing && (
                          <div className="mt-3 pt-3 border-t border-neutral-800/50 space-y-3">
                            <div>
                              <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                                Task Text *
                              </label>
                              <input
                                type="text"
                                value={taskInputs[taskKey]?.text || ""}
                                onChange={(e) => {
                                  setTaskInputs({
                                    ...taskInputs,
                                    [taskKey]: {
                                      ...taskInputs[taskKey],
                                      text: e.target.value,
                                    },
                                  });
                                }}
                                className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                                placeholder="Enter task description..."
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                                  Status
                                </label>
                                <select
                                  value={taskInputs[taskKey]?.status || "ongoing"}
                                  onChange={(e) => {
                                    setTaskInputs({
                                      ...taskInputs,
                                      [taskKey]: {
                                        ...taskInputs[taskKey],
                                        status: e.target.value as "ongoing" | "done" | "failed",
                                      },
                                    });
                                  }}
                                  className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                                >
                                  <option value="open">Open</option>
                                  <option value="done">Done</option>
                                  <option value="failed">Failed</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                                  Priority
                                </label>
                                <select
                                  value={taskInputs[taskKey]?.priority || "mid"}
                                  onChange={(e) => {
                                    setTaskInputs({
                                      ...taskInputs,
                                      [taskKey]: {
                                        ...taskInputs[taskKey],
                                        priority: e.target.value as "low" | "mid" | "prio" | "high prio",
                                      },
                                    });
                                  }}
                                  className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                                >
                                  <option value="low">Low</option>
                                  <option value="mid">Mid</option>
                                  <option value="prio">Prio</option>
                                  <option value="high prio">High Prio</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                                Due Date
                              </label>
                              <input
                                type="date"
                                value={taskInputs[taskKey]?.dueDate || ""}
                                onChange={(e) => {
                                  setTaskInputs({
                                    ...taskInputs,
                                    [taskKey]: {
                                      ...taskInputs[taskKey],
                                      dueDate: e.target.value,
                                    },
                                  });
                                }}
                                className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                              />
                            </div>

                            <div>
                              <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                                Assignees
                              </label>
                              <div className="max-h-32 overflow-y-auto border border-neutral-700 rounded p-2 bg-neutral-800 space-y-1">
                                {contacts.map((contact) => (
                                  <label
                                    key={contact.id}
                                    className="flex items-center gap-2 cursor-pointer hover:bg-neutral-700 px-2 py-1 rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={taskInputs[taskKey]?.assignees?.includes(contact.id) || false}
                                      onChange={() => {
                                        const currentAssignees = taskInputs[taskKey]?.assignees || [];
                                        const updatedAssignees = currentAssignees.includes(contact.id)
                                          ? currentAssignees.filter((id) => id !== contact.id)
                                          : [...currentAssignees, contact.id];
                                        setTaskInputs({
                                          ...taskInputs,
                                          [taskKey]: {
                                            ...taskInputs[taskKey],
                                            assignees: updatedAssignees,
                                          },
                                        });
                                      }}
                                      className="rounded w-4 h-4 accent-blue-600"
                                    />
                                    <span className="text-sm text-neutral-300">
                                      {contact.name}
                                      {contact.organization && (
                                        <span className="text-neutral-500">
                                          {" "}
                                          • {contact.organization}
                                        </span>
                                      )}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                                Notes
                              </label>
                              <textarea
                                value={taskInputs[taskKey]?.notes || ""}
                                onChange={(e) => {
                                  setTaskInputs({
                                    ...taskInputs,
                                    [taskKey]: {
                                      ...taskInputs[taskKey],
                                      notes: e.target.value,
                                    },
                                  });
                                }}
                                rows={3}
                                className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 resize-none"
                                placeholder="Additional notes..."
                              />
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateTask(task.contactId, task.id);
                                }}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit(task.contactId, task.id);
                                }}
                                className="flex-1 px-4 py-2 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 transition-colors text-sm font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            };
              
              return (
                <>
                {categoryOrder.map((category) => {
                  const categoryTasks = tasksByCategory[category];
                  if (categoryTasks.length === 0) return null;
                  
                  return (
                    <div key={category} className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 px-2 py-1 bg-neutral-900/60 border-l-4 border-blue-500 rounded">
                        <span className="text-xs font-semibold text-white uppercase tracking-wide">
                          {categoryLabels[category]}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          ({categoryTasks.length})
                        </span>
                      </div>
                      <div className="space-y-1 pl-3 ml-1 border-l-2 border-neutral-800/50">
                        {categoryTasks.map((task) => renderTaskCard(task))}
                      </div>
                    </div>
                  );
                })}
              </>
            );
            })()}
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
                className="group relative bg-gradient-to-br from-neutral-900/40 to-neutral-900/20 border border-neutral-800/40 rounded-xl p-4 opacity-60 hover:opacity-80 hover:bg-neutral-900/50 transition-all duration-150"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.contactId, task.id)}
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
                    {/* Dates section for completed tasks */}
                    <div className="mt-2 pt-2 border-t border-neutral-800/30 flex items-center gap-3 text-xs text-neutral-500">
                      {task.created_at && (
                        <span className="flex items-center gap-1">
                          <span>➕</span>
                          <span>Dodano: {format(new Date(task.created_at), 'dd.MM.yyyy HH:mm')}</span>
                        </span>
                      )}
                      {task.completed && task.completed_at && (
                        <>
                          {task.created_at && <span className="text-neutral-700">•</span>}
                          <span className="flex items-center gap-1 text-green-400">
                            <span>✅</span>
                            <span>Wykonano: {format(new Date(task.completed_at), 'dd.MM.yyyy HH:mm')}</span>
                          </span>
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

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddTaskModal(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add New Task</h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="text-neutral-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Contact Selection */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                  Contact *
                </label>
                <input
                  type="text"
                  value={contactSearchForModal}
                  onChange={(e) => setContactSearchForModal(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                />
                <div className="mt-2 max-h-40 overflow-y-auto border border-neutral-700 rounded p-2 bg-neutral-800 space-y-1">
                  {contacts
                    .filter((contact) => {
                      if (!contactSearchForModal.trim()) return true;
                      const search = contactSearchForModal.toLowerCase();
                      return (
                        contact.name.toLowerCase().includes(search) ||
                        (contact.organization &&
                          contact.organization.toLowerCase().includes(search))
                      );
                    })
                    .slice(0, 10)
                    .map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => {
                          setNewTaskFormData({
                            ...newTaskFormData,
                            contactId: contact.id,
                          });
                          setContactSearchForModal(contact.name);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          newTaskFormData.contactId === contact.id
                            ? "bg-blue-600 text-white"
                            : "bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700"
                        }`}
                      >
                        <div className="font-medium">{contact.name}</div>
                        {contact.organization && (
                          <div className="text-xs opacity-75">
                            {contact.organization}
                          </div>
                        )}
                      </button>
                    ))}
                </div>
                {newTaskFormData.contactId && (
                  <div className="mt-2 text-xs text-blue-400">
                    Selected:{" "}
                    {contacts.find((c) => c.id === newTaskFormData.contactId)
                      ?.name || ""}
                  </div>
                )}
              </div>

              {/* Task Text */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                  Task Text *
                </label>
                <input
                  type="text"
                  value={newTaskFormData.text}
                  onChange={(e) =>
                    setNewTaskFormData({
                      ...newTaskFormData,
                      text: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                  placeholder="Enter task description..."
                />
              </div>

              {/* Status and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                    Status
                  </label>
                  <select
                    value={newTaskFormData.status}
                    onChange={(e) =>
                      setNewTaskFormData({
                        ...newTaskFormData,
                        status: e.target.value as "ongoing" | "done" | "failed",
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                  >
                    <option value="open">Open</option>
                    <option value="done">Done</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                    Priority
                  </label>
                  <select
                    value={newTaskFormData.priority}
                    onChange={(e) =>
                      setNewTaskFormData({
                        ...newTaskFormData,
                        priority: e.target.value as
                          | "low"
                          | "mid"
                          | "prio"
                          | "high prio",
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                  >
                    <option value="low">Low</option>
                    <option value="mid">Mid</option>
                    <option value="prio">Prio</option>
                    <option value="high prio">High Prio</option>
                  </select>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                  Due Date
                </label>
                <input
                  type="date"
                  value={newTaskFormData.dueDate}
                  onChange={(e) =>
                    setNewTaskFormData({
                      ...newTaskFormData,
                      dueDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                />
              </div>

              {/* Assignees */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                  Assignees
                </label>
                <div className="max-h-32 overflow-y-auto border border-neutral-700 rounded p-2 bg-neutral-800 space-y-1">
                  {contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-neutral-700 px-2 py-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={newTaskFormData.assignees.includes(contact.id)}
                        onChange={() => handleToggleAssignee(contact.id)}
                        className="rounded w-4 h-4 accent-blue-600"
                      />
                      <span className="text-sm text-neutral-300">
                        {contact.name}
                        {contact.organization && (
                          <span className="text-neutral-500">
                            {" "}
                            • {contact.organization}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                  Notes
                </label>
                <textarea
                  value={newTaskFormData.notes}
                  onChange={(e) =>
                    setNewTaskFormData({
                      ...newTaskFormData,
                      notes: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 resize-none"
                  placeholder="Additional notes..."
                />
              </div>

              {/* Document URL */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                  Document URL
                </label>
                <input
                  type="url"
                  value={newTaskFormData.doc_url}
                  onChange={(e) =>
                    setNewTaskFormData({
                      ...newTaskFormData,
                      doc_url: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                  placeholder="Google Docs URL or other document link"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddNewTask}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  Add Task
                </button>
                <button
                  onClick={() => {
                    setShowAddTaskModal(false);
                    setNewTaskFormData({
                      contactId: "",
                      text: "",
                      status: "ongoing",
                      priority: "mid",
                      dueDate: "",
                      notes: "",
                      assignees: [],
                      doc_url: "",
                    });
                    setContactSearchForModal("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
