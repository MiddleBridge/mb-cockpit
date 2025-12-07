"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCategories, useOrganisations, useRoles } from "../hooks/useSharedLists";
import * as contactsDb from "../../lib/db/contacts";
import * as documentsDb from "../../lib/db/documents";
import * as projectsDb from "../../lib/db/projects";
import type { Contact as ContactType } from "../../lib/db/contacts";
import type { Document } from "../../lib/db/documents";
import type { Project } from "../../lib/db/projects";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import ContactRow from "./ContactRow";

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
  organization?: string; // Legacy field
  organizations?: string[]; // New field for multiple organizations
  notes?: string;
  notes_updated_at?: string;
  website?: string;
  location?: string;
  nationality?: string;
  categories: string[];
  status: ContactStatus;
  contact_status?: 'ongoing' | 'freezed';
  role?: string;
  sector?: string;
  projects?: string[]; // Array of project IDs
  tasks: Task[];
}

export default function ContactsView() {
  const router = useRouter();
  const { categories, addCategory } = useCategories();
  const { organisations, addOrganisation } = useOrganisations();
  const { roles, addRole } = useRoles();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
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
    role: "",
  });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newOrganisationName, setNewOrganisationName] = useState("");
  const [showAddOrganisation, setShowAddOrganisation] = useState(false);
  const [pendingOrganisationName, setPendingOrganisationName] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [showAddRole, setShowAddRole] = useState(false);
  const [addingRoleForContact, setAddingRoleForContact] = useState<string | null>(null);
  const [newRoleNameInline, setNewRoleNameInline] = useState("");
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, string | undefined>>({}); // { contactId: 'location' | 'nationality' | 'role' | 'status' | 'organization' }
  const [addingOrgForContact, setAddingOrgForContact] = useState<string | null>(null);
  const [newOrgNameInline, setNewOrgNameInline] = useState("");
  const [newContactId, setNewContactId] = useState<string | null>(null);
  const [taskInputs, setTaskInputs] = useState<Record<string, { text: string; status: 'ongoing' | 'done' | 'failed'; priority: TaskPriority; dueDate: string; notes: string; assignees: string[]; doc_url: string }>>({});
  const [expandedTaskForm, setExpandedTaskForm] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ contactId: string; taskId: string } | null>(null);
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [contactDocuments, setContactDocuments] = useState<Record<string, Document[]>>({});
  const [expandedDocumentForm, setExpandedDocumentForm] = useState<string | null>(null);
  const [documentInputs, setDocumentInputs] = useState<Record<string, { name: string; file_url: string; file_type: string; notes: string }>>({});
  
  // Inline editing state for each contact
  const [inlineEditData, setInlineEditData] = useState<Record<string, {
    name?: string;
    website?: string;
    websiteInput?: string; // Temporary input value before Enter is pressed
    avatar?: string;
    avatarInput?: string; // Temporary input value before Enter is pressed
    organization?: string; // Legacy field
    organizations?: string[]; // New field for multiple organizations
    location?: string;
    nationality?: string;
    notes?: string;
    categories: string[];
    status: ContactStatus;
    contact_status?: 'ongoing' | 'freezed';
    role?: string;
    sector?: string;
    projects?: string[]; // Array of project IDs
    taskText?: string;
    projectText?: string;
  }>>({});
  
  // List of countries for location and nationality
  const countries = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Austria",
    "Bangladesh", "Belgium", "Brazil", "Bulgaria",
    "Canada", "Chile", "China", "Colombia", "Croatia", "Czech Republic",
    "Denmark",
    "Egypt", "Estonia",
    "Finland", "France",
    "Germany", "Greece",
    "Hungary",
    "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
    "Japan", "Jordan",
    "Kazakhstan", "Kenya", "Kuwait",
    "Latvia", "Lebanon", "Lithuania",
    "Malaysia", "Mexico", "Morocco",
    "Netherlands", "New Zealand", "Nigeria", "Norway",
    "Pakistan", "Philippines", "Poland", "Portugal",
    "Qatar",
    "Romania", "Russia", "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain", "Sweden", "Switzerland",
    "Thailand", "Turkey",
    "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
    "Vietnam",
    "Yemen"
  ].sort();

  // List of sectors
  const sectors = [
    "Technology",
    "Healthcare",
    "Finance",
    "Education",
    "Energy",
    "Manufacturing",
    "Retail",
    "Real Estate",
    "Transportation",
    "Media & Entertainment",
    "Government",
    "Non-profit",
    "Agriculture",
    "Construction",
    "Telecommunications",
    "Hospitality",
    "Legal",
    "Consulting",
    "Pharmaceuticals",
    "Biotechnology",
    "Aerospace",
    "Automotive",
    "Food & Beverage",
    "Fashion",
    "Sports",
    "Other"
  ].sort();

  // Map country to nationality
  const getNationalityFromCountry = (country: string): string => {
    const nationalityMap: Record<string, string> = {
      "Afghanistan": "Afghan",
      "Albania": "Albanian",
      "Algeria": "Algerian",
      "Argentina": "Argentinian",
      "Australia": "Australian",
      "Austria": "Austrian",
      "Bangladesh": "Bangladeshi",
      "Belgium": "Belgian",
      "Brazil": "Brazilian",
      "Bulgaria": "Bulgarian",
      "Canada": "Canadian",
      "Chile": "Chilean",
      "China": "Chinese",
      "Colombia": "Colombian",
      "Croatia": "Croatian",
      "Czech Republic": "Czech",
      "Denmark": "Danish",
      "Egypt": "Egyptian",
      "Estonia": "Estonian",
      "Finland": "Finnish",
      "France": "French",
      "Germany": "German",
      "Greece": "Greek",
      "Hungary": "Hungarian",
      "India": "Indian",
      "Indonesia": "Indonesian",
      "Iran": "Iranian",
      "Iraq": "Iraqi",
      "Ireland": "Irish",
      "Israel": "Israeli",
      "Italy": "Italian",
      "Japan": "Japanese",
      "Jordan": "Jordanian",
      "Kazakhstan": "Kazakhstani",
      "Kenya": "Kenyan",
      "Kuwait": "Kuwaiti",
      "Latvia": "Latvian",
      "Lebanon": "Lebanese",
      "Lithuania": "Lithuanian",
      "Malaysia": "Malaysian",
      "Mexico": "Mexican",
      "Morocco": "Moroccan",
      "Netherlands": "Dutch",
      "New Zealand": "New Zealander",
      "Nigeria": "Nigerian",
      "Norway": "Norwegian",
      "Pakistan": "Pakistani",
      "Philippines": "Filipino",
      "Poland": "Polish",
      "Portugal": "Portuguese",
      "Qatar": "Qatari",
      "Romania": "Romanian",
      "Russia": "Russian",
      "Saudi Arabia": "Saudi",
      "Singapore": "Singaporean",
      "South Africa": "South African",
      "South Korea": "South Korean",
      "Spain": "Spanish",
      "Sweden": "Swedish",
      "Switzerland": "Swiss",
      "Thailand": "Thai",
      "Turkey": "Turkish",
      "Ukraine": "Ukrainian",
      "United Arab Emirates": "Emirati",
      "United Kingdom": "British",
      "United States": "American",
      "Vietnam": "Vietnamese",
      "Yemen": "Yemeni",
    };
    return nationalityMap[country] || country;
  };

  // List of nationalities for dropdown
  const nationalities = countries.map(country => getNationalityFromCountry(country)).sort();
  
  // Filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedOrganisations, setSelectedOrganisations] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ContactStatus[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedNationalities, setSelectedNationalities] = useState<string[]>([]);
  
  // View mode
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking inside a dropdown (check for absolute positioned elements)
      if (target.closest('.absolute.z-50')) {
        return;
      }
      if (!target.closest('.dropdown-container')) {
        setOpenDropdowns({});
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const loadProjects = async () => {
    try {
      const data = await projectsDb.getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Auto-select newly added organization when it appears in the list
  useEffect(() => {
    if (pendingOrganisationName && organisations.some((o) => o.name === pendingOrganisationName)) {
      setFormData((prev) => ({
        ...prev,
        organization: pendingOrganisationName,
      }));
      setPendingOrganisationName(null);
    }
  }, [organisations, pendingOrganisationName]);

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
              role: "",
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
            role: "",
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
      role: "",
    });
    setNewCategoryName("");
    setShowAddCategory(false);
    setNewOrganisationName("");
    setShowAddOrganisation(false);
    setNewRoleName("");
    setShowAddRole(false);
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
      role: contact.role || "",
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
      const orgName = newOrganisationName.trim();
      setPendingOrganisationName(orgName);
      await addOrganisation(orgName);
      setNewOrganisationName("");
      setShowAddOrganisation(false);
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  const handleAddNewRoleInForm = async () => {
    if (newRoleName.trim()) {
      await addRole(newRoleName.trim());
      setFormData({
        ...formData,
        role: newRoleName.trim(),
      });
      setNewRoleName("");
      setShowAddRole(false);
    }
  };

  const handleAddNewRoleInline = async (contactId: string) => {
    if (newRoleNameInline.trim()) {
      const roleName = newRoleNameInline.trim();
      await addRole(roleName);
      setInlineEditData(prev => ({
        ...prev,
        [contactId]: { ...prev[contactId], role: roleName }
      }));
      updateInlineField(contactId, "role", roleName);
      setNewRoleNameInline("");
      setAddingRoleForContact(null);
    }
  };

  const handleAddNewOrgInline = async (contactId: string) => {
    if (newOrgNameInline.trim()) {
      const orgName = newOrgNameInline.trim();
      setPendingOrganisationName(orgName);
      await addOrganisation(orgName);
      setInlineEditData(prev => ({
        ...prev,
        [contactId]: { ...prev[contactId], organization: orgName }
      }));
      if (contactId.startsWith("new-")) {
        // Don't update database for new contacts yet
      } else {
        updateInlineField(contactId, "organization", orgName);
      }
      setNewOrgNameInline("");
      setAddingOrgForContact(null);
      setOpenDropdowns(prev => ({ ...prev, [contactId]: undefined }));
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  const handleCreateContactInline = async (tempId: string) => {
    const editData = inlineEditData[tempId];
    if (!editData || !editData.name || !editData.name.trim()) {
      return;
    }

    const name = editData.name.trim();

    // Check for duplicates
    const existingContacts = await contactsDb.getContacts();
    const duplicate = existingContacts.find(
      (c) => c.name.toLowerCase() === name.toLowerCase() && 
             (editData.organization ? c.organization === editData.organization : !c.organization)
    );

    if (duplicate) {
      const orgText = editData.organization || "without organization";
      alert(`Contact "${name}" already exists ${orgText}`);
      return;
    }

    const newContact = {
      name: name,
      email: undefined,
      avatar: undefined,
      organization: editData.organization || undefined,
      notes: undefined,
      categories: editData.categories || [],
      status: editData.status || "mid",
      contact_status: editData.contact_status || "ongoing",
      role: editData.role || undefined,
      sector: editData.sector || undefined,
      website: editData.website || undefined,
      location: editData.location || undefined,
      nationality: editData.nationality || undefined,
      tasks: [],
    };

    const result = await contactsDb.createContact(newContact);
    if (result) {
      await loadContacts();
      window.dispatchEvent(new Event('graph-data-updated'));
      window.dispatchEvent(new Event('contacts-updated'));
      setNewContactId(null);
      setInlineEditData(prev => {
        const newData = { ...prev };
        delete newData[tempId];
        return newData;
      });
    } else {
      alert(`Failed to add contact. "${name}" may already exist.`);
    }
  };

  const toggleDropdown = (contactId: string, dropdown: string | undefined) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [contactId]: prev[contactId] === dropdown ? undefined : dropdown
    }));
  };

  // Get color for category
  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      "Client": "bg-blue-600/30 text-blue-400 border-blue-600/50",
      "Government": "bg-purple-600/30 text-purple-400 border-purple-600/50",
      "Investor": "bg-green-600/30 text-green-400 border-green-600/50",
      "MB Team": "bg-orange-600/30 text-orange-400 border-orange-600/50",
      "Partner": "bg-cyan-600/30 text-cyan-400 border-cyan-600/50",
      "Prospect": "bg-yellow-600/30 text-yellow-400 border-yellow-600/50",
    };
    return categoryColors[category] || "bg-neutral-800 text-neutral-300 border-neutral-700";
  };

  // Get color for status
  const getStatusColor = (status: ContactStatus) => {
    const statusColors: Record<ContactStatus, string> = {
      "low": "bg-neutral-700/50 text-neutral-400 border-neutral-600",
      "mid": "bg-yellow-600/30 text-yellow-400 border-yellow-600/50",
      "prio": "bg-orange-600/30 text-orange-400 border-orange-600/50",
      "high prio": "bg-red-600/30 text-red-400 border-red-600/50",
    };
    return statusColors[status] || "bg-neutral-800 text-neutral-300 border-neutral-700";
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

  const handleAddDocument = (contactId: string) => {
    setExpandedDocumentForm(contactId);
    setDocumentInputs({
      ...documentInputs,
      [contactId]: { name: "", file_url: "", file_type: "", notes: "" }
    });
  };

  const handleSaveDocument = async (contactId: string) => {
    const docData = documentInputs[contactId];
    if (!docData || !docData.name.trim() || !docData.file_url.trim()) {
      alert("Please provide document name and file URL");
      return;
    }

    const newDocument = {
      name: docData.name.trim(),
      file_url: docData.file_url.trim(),
      file_type: docData.file_type.trim() || undefined,
      contact_id: contactId,
      notes: docData.notes.trim() || undefined,
    };

    const result = await documentsDb.createDocument(newDocument);
    if (result) {
      await loadContacts();
      setExpandedDocumentForm(null);
      setDocumentInputs({
        ...documentInputs,
        [contactId]: { name: "", file_url: "", file_type: "", notes: "" }
      });
    } else {
      alert("Failed to create document");
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    const success = await documentsDb.deleteDocument(documentId);
    if (success) {
      await loadContacts();
    } else {
      alert("Failed to delete document");
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
      const hasNoOrg = selectedOrganisations.includes("No organization");
      const contactHasOrg = !!contact.organization;
      
      if (contactHasOrg && contact.organization && !selectedOrganisations.includes(contact.organization)) {
        // Contact has org, but it's not in selected orgs
        return false;
      }
      
      if (!contactHasOrg && !hasNoOrg) {
        // Contact has no org, but "No organization" is not selected
        return false;
      }
    }

    // Filter by status
    if (selectedStatuses.length > 0) {
      if (!selectedStatuses.includes(contact.status)) {
        return false;
      }
    }

    // Filter by role
    if (selectedRoles.length > 0) {
      if (!contact.role || !selectedRoles.includes(contact.role)) {
        return false;
      }
    }

    // Filter by location
    if (selectedLocations.length > 0) {
      if (!contact.location || !selectedLocations.includes(contact.location)) {
        return false;
      }
    }

    // Filter by nationality
    if (selectedNationalities.length > 0) {
      if (!contact.nationality || !selectedNationalities.includes(contact.nationality)) {
        return false;
      }
    }

    return true;
  });

  // Group contacts by organization (a contact can appear in multiple groups)
  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const contactOrgs = contact.organizations || (contact.organization ? [contact.organization] : []);
    
    if (contactOrgs.length === 0) {
      // Contact with no organizations
      const orgKey = "No organization";
      if (!acc[orgKey]) {
        acc[orgKey] = [];
      }
      acc[orgKey].push(contact);
    } else {
      // Add contact to each organization group
      contactOrgs.forEach(org => {
        if (!acc[org]) {
          acc[org] = [];
        }
        acc[org].push(contact);
      });
    }
    
    return acc;
  }, {} as Record<string, Contact[]>);

  // Sort organizations: "No organization" last, others alphabetically
  const sortedOrgKeys = Object.keys(groupedContacts).sort((a, b) => {
    if (a === "No organization") return 1;
    if (b === "No organization") return -1;
    return a.localeCompare(b);
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

  const toggleRoleFilter = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleLocationFilter = (location: string) => {
    setSelectedLocations((prev) =>
      prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]
    );
  };

  const toggleNationalityFilter = (nationality: string) => {
    setSelectedNationalities((prev) =>
      prev.includes(nationality) ? prev.filter((n) => n !== nationality) : [...prev, nationality]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedOrganisations([]);
    setSelectedStatuses([]);
    setSelectedRoles([]);
    setSelectedLocations([]);
    setSelectedNationalities([]);
  };

  const hasActiveFilters = selectedCategories.length > 0 || selectedOrganisations.length > 0 || selectedStatuses.length > 0 || selectedRoles.length > 0 || selectedLocations.length > 0 || selectedNationalities.length > 0;

  // Calculate counts for filters
  const getCategoryCount = (category: string) => {
    return contacts.filter(contact => contact.categories.includes(category)).length;
  };

  const getOrganisationCount = (orgName: string) => {
    if (orgName === "No organization") {
      return contacts.filter(contact => !contact.organization).length;
    }
    return contacts.filter(contact => contact.organization === orgName).length;
  };

  const getStatusCount = (status: ContactStatus) => {
    return contacts.filter(contact => contact.status === status).length;
  };

  const getRoleCount = (role: string) => {
    return contacts.filter(contact => contact.role === role).length;
  };

  const getLocationCount = (location: string) => {
    return contacts.filter(contact => contact.location === location).length;
  };

  const getNationalityCount = (nationality: string) => {
    return contacts.filter(contact => contact.nationality === nationality).length;
  };

  // Get unique values from contacts for dynamic filters
  const allRoles = Array.from(new Set(contacts.map(c => c.role).filter(Boolean) as string[])).sort();
  const allLocations = Array.from(new Set(contacts.map(c => c.location).filter(Boolean) as string[])).sort();
  const allNationalities = Array.from(new Set(contacts.map(c => c.nationality).filter(Boolean) as string[])).sort();

  // Initialize inline edit data for a contact
  const getInlineEditData = (contact: Contact) => {
    if (!inlineEditData[contact.id]) {
      return {
        name: contact.name,
        website: contact.website || "",
        websiteInput: undefined,
        avatar: contact.avatar || "",
        avatarInput: undefined,
        notes: contact.notes || "",
        organization: contact.organization || "",
        location: contact.location || "",
        nationality: contact.nationality || "",
        categories: contact.categories || [],
        status: contact.status || "mid",
        contact_status: contact.contact_status || 'ongoing',
        role: contact.role || "",
        sector: contact.sector || "",
        projects: contact.projects || [],
        taskText: undefined,
        projectText: undefined,
      };
    }
    return {
      ...inlineEditData[contact.id],
      name: inlineEditData[contact.id].name !== undefined ? inlineEditData[contact.id].name : contact.name,
      location: contact.location || "",
      nationality: contact.nationality || "",
      role: contact.role || "",
      sector: contact.sector || "",
      website: contact.website || "",
      websiteInput: inlineEditData[contact.id].websiteInput,
      avatar: inlineEditData[contact.id].avatar !== undefined ? inlineEditData[contact.id].avatar : (contact.avatar || ""),
      avatarInput: inlineEditData[contact.id].avatarInput,
      notes: inlineEditData[contact.id].notes !== undefined ? inlineEditData[contact.id].notes : (contact.notes || ""),
      status: contact.status || "mid",
      contact_status: contact.contact_status || 'ongoing',
      categories: contact.categories || [],
      projects: contact.projects || [],
      taskText: inlineEditData[contact.id].taskText, // Explicitly include taskText from inlineEditData
      projectText: inlineEditData[contact.id].projectText, // Explicitly include projectText from inlineEditData
    };
  };

  // Initialize and sync inline edit data when contacts load
  useEffect(() => {
    const newData: Record<string, any> = {};
    contacts.forEach(contact => {
      const existing = inlineEditData[contact.id];
      if (!existing) {
        // Initialize new contact
        newData[contact.id] = {
          website: contact.website || "",
          avatar: contact.avatar || "",
          notes: contact.notes || "",
          organization: contact.organization || "",
          location: contact.location || "",
          nationality: contact.nationality || "",
          categories: contact.categories || [],
          status: contact.status || "mid",
          role: contact.role || "",
          taskText: undefined,
          projectText: undefined,
        };
      } else {
        // Sync existing data with contact (but keep taskText and input states only if they're explicitly set)
        newData[contact.id] = {
          website: contact.website || "",
          avatar: existing.avatar !== undefined ? existing.avatar : (contact.avatar || ""),
          notes: contact.notes || "",
          organization: contact.organization || "",
          location: contact.location || "",
          nationality: contact.nationality || "",
          categories: contact.categories || [],
          status: contact.status || "mid",
          role: contact.role || "",
          taskText: existing.taskText !== undefined ? existing.taskText : undefined, // Keep current task input only if explicitly set
          projectText: existing.projectText !== undefined ? existing.projectText : undefined, // Keep current project input only if explicitly set
          avatarInput: existing.avatarInput, // Keep current avatar input
          websiteInput: existing.websiteInput, // Keep current website input
        };
      }
    });
    if (Object.keys(newData).length > 0) {
      setInlineEditData(prev => ({ ...prev, ...newData }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts]);

  // Update inline field
  const updateInlineField = async (contactId: string, field: string, value: any) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    // Handle avatarInput separately - just update state, don't save to database
    if (field === "avatarInput") {
      setInlineEditData(prev => ({
        ...prev,
        [contactId]: {
          ...prev[contactId],
          avatarInput: value
        }
      }));
      return;
    }

    const updates: any = {};
    if (field === "website") {
      updates.website = value || undefined;
    } else if (field === "status") {
      updates.status = value;
    } else if (field === "role") {
      updates.role = value || undefined;
    } else if (field === "categories") {
      updates.categories = value;
    } else if (field === "location") {
      updates.location = value || undefined;
    } else if (field === "nationality") {
      updates.nationality = value || undefined;
    } else if (field === "organization") {
      updates.organization = value || undefined;
    } else if (field === "organizations") {
      updates.organizations = value || [];
    } else if (field === "name") {
      updates.name = value || undefined;
    } else if (field === "contact_status") {
      updates.contact_status = value || undefined;
    } else if (field === "sector") {
      updates.sector = value || undefined;
    } else if (field === "projects") {
      updates.projects = value || [];
    } else if (field === "avatar") {
      updates.avatar = value || undefined;
    } else if (field === "notes") {
      updates.notes = value || undefined;
    }

    const result = await contactsDb.updateContact(contactId, updates);
    if (result) {
      await loadContacts();
      window.dispatchEvent(new Event('graph-data-updated'));
    }
  };

  // Handlers for editing each field - all use dropdowns
  const handleEditName = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "name");
  };

  const handleEditLocation = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "location");
  };

  const handleEditNationality = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "nationality");
  };

  const handleEditRole = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "role");
  };

  const handleEditOrganization = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "organization");
  };

  const handleAddOrganization = async (contactId: string, orgName: string) => {
    const orgNameTrimmed = orgName.trim();
    if (!orgNameTrimmed) return;
    
    setPendingOrganisationName(orgNameTrimmed);
    await addOrganisation(orgNameTrimmed);
    
    // Wait a bit for the organisations list to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Add organization to contact
    const editData = inlineEditData[contactId] || getInlineEditData(contacts.find(c => c.id === contactId)!);
    const currentOrgs = editData.organizations || [];
    if (!currentOrgs.includes(orgNameTrimmed)) {
      const newOrgs = [...currentOrgs, orgNameTrimmed];
      setInlineEditData(prev => ({
        ...prev,
        [contactId]: { ...editData, organizations: newOrgs }
      }));
      if (!contactId.startsWith("new-")) {
        await updateInlineField(contactId, "organizations", newOrgs);
      }
    }
    
    window.dispatchEvent(new Event('graph-data-updated'));
  };

  const handleEditStatus = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "status");
  };

  const handleEditContactStatus = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "contact_status");
  };

  const handleEditCategory = (contactId: string, category: string) => {
    toggleInlineCategory(contactId, category);
  };

  const handleEditProject = (contactId: string, projectId: string, event?: React.MouseEvent) => {
    if (projectId) {
      toggleInlineProject(contactId, projectId);
    } else {
      toggleDropdown(contactId, "project");
    }
  };

  const handleAddCategory = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "category");
  };

  const handleEditSector = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "sector");
  };

  const handleEditWebsite = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "website");
  };

  const handleEditAvatar = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "avatar");
  };

  const handleEditNote = (contactId: string, event?: React.MouseEvent) => {
    toggleDropdown(contactId, "notes");
  };

  const handleAddNote = (contactId: string) => {
    toggleDropdown(contactId, "notes");
  };

  // Toggle category in inline edit
  const toggleInlineOrganization = (contactId: string, orgName: string) => {
    const editData = inlineEditData[contactId] || getInlineEditData(contacts.find(c => c.id === contactId)!);
    const currentOrgs = editData.organizations || [];
    const newOrgs = currentOrgs.includes(orgName)
      ? currentOrgs.filter(org => org !== orgName)
      : [...currentOrgs, orgName];
    
    setInlineEditData(prev => ({
      ...prev,
      [contactId]: { ...editData, organizations: newOrgs }
    }));
    updateInlineField(contactId, "organizations", newOrgs);
  };

  const toggleInlineProject = (contactId: string, projectId: string) => {
    const editData = inlineEditData[contactId] || getInlineEditData(contacts.find(c => c.id === contactId)!);
    const currentProjects = editData.projects || [];
    const newProjects = currentProjects.includes(projectId)
      ? currentProjects.filter(pid => pid !== projectId)
      : [...currentProjects, projectId];
    
    setInlineEditData(prev => ({
      ...prev,
      [contactId]: { ...editData, projects: newProjects }
    }));
    updateInlineField(contactId, "projects", newProjects);
  };

  const toggleInlineCategory = (contactId: string, category: string) => {
    const current = getInlineEditData(contacts.find(c => c.id === contactId)!);
    const newCategories = current.categories.includes(category)
      ? current.categories.filter(c => c !== category)
      : [...current.categories, category];
    
    setInlineEditData(prev => ({
      ...prev,
      [contactId]: { ...current, categories: newCategories }
    }));
    
    updateInlineField(contactId, "categories", newCategories);
  };

  // Add task inline
  const handleAddTaskInline = async (contactId: string) => {
    const editData = inlineEditData[contactId];
    if (!editData || !editData.taskText?.trim()) return;

    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    const newTask: Task = {
      id: Date.now().toString(),
      text: editData.taskText.trim(),
      completed: false,
      status: "ongoing",
      priority: "mid",
      created_at: new Date().toISOString(),
    };

    const updatedTasks = [...contact.tasks, newTask];
    await contactsDb.updateContact(contactId, { tasks: updatedTasks });
    await loadContacts();
    window.dispatchEvent(new Event('graph-data-updated'));
    
    setInlineEditData(prev => ({
      ...prev,
      [contactId]: { ...prev[contactId], taskText: undefined }
    }));
  };

  // Create new internal project and add to contact
  const handleCreateInternalProject = async (contactId: string, projectName?: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    // Get contact's organization if available
    const contactOrg = contact.organizations?.[0] || contact.organization;
    const org = organisations.find(o => o.name === contactOrg);
    
    // Use provided name or default
    const name = projectName?.trim() || `Project for ${contact.name}`;
    
    // Create a new internal project
    const newProject = await projectsDb.createProject({
      name: name,
      title: name,
      description: `Internal project for contact ${contact.name}`,
      status: "ongoing",
      project_type: "internal",
      organisation_ids: org?.id ? [org.id] : [],
      categories: [],
    });

    if (!newProject) {
      alert("Failed to create project");
      return;
    }

    // Add project to contact
    const editData = inlineEditData[contactId] || getInlineEditData(contact);
    const currentProjects = editData.projects || [];
    const newProjects = [...currentProjects, newProject.id];
    
    setInlineEditData(prev => ({
      ...prev,
      [contactId]: { ...editData, projects: newProjects, projectText: undefined }
    }));
    updateInlineField(contactId, "projects", newProjects);
    
    // Reload projects to include the new one
    await loadProjects();
    window.dispatchEvent(new Event('projects-updated'));
  };

  // Add project inline from form
  const handleAddProjectInline = async (contactId: string) => {
    const editData = inlineEditData[contactId];
    if (!editData || !editData.projectText?.trim()) return;

    await handleCreateInternalProject(contactId, editData.projectText);
  };

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
    <div className="space-y-4 max-w-[1400px]">

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
            <label className="block text-xs text-neutral-400 mb-1">Role</label>
            {showAddRole ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddNewRoleInForm();
                    }
                  }}
                  placeholder="New role name..."
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  autoFocus
                />
                <button
                  onClick={handleAddNewRoleInForm}
                  disabled={!newRoleName.trim()}
                  className="px-3 py-2 bg-neutral-700 text-white rounded text-sm hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddRole(false);
                    setNewRoleName("");
                  }}
                  className="px-3 py-2 border border-neutral-700 rounded text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={formData.role}
                onChange={(e) => {
                  if (e.target.value === "__add_new__") {
                    setShowAddRole(true);
                  } else {
                    setFormData({ ...formData, role: e.target.value });
                  }
                }}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
              >
                <option value="">Select role...</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
                <option value="__add_new__">+ Add new role</option>
              </select>
            )}
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

      {/* Header bar with Add Contact button and Filters */}
      <div className="border-b border-neutral-800 bg-neutral-950">
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto py-1.5 px-2 scrollbar-hide">
          {/* Add Contact button */}
          <button
            onClick={() => {
              const tempId = `new-${Date.now()}`;
              setNewContactId(tempId);
              setInlineEditData(prev => ({
                ...prev,
                [tempId]: {
                  name: "",
                  organization: "",
                  location: "",
                  nationality: "",
                  role: "",
                  status: "mid" as ContactStatus,
                  contact_status: "ongoing" as 'ongoing' | 'freezed',
                  sector: "",
                  website: "",
                  notes: "",
                  categories: [],
                  taskText: "",
                }
              }));
            }}
            className="flex-shrink-0 px-2.5 py-1.5 h-7 bg-white text-black rounded text-xs font-medium hover:bg-neutral-100 transition-colors flex items-center"
          >
            + Add Contact
          </button>
          
          {/* Separator */}
          <div className="flex-shrink-0 w-px h-5 bg-neutral-800"></div>
          
          {/* Filters */}
          <span className="flex-shrink-0 text-[10px] text-neutral-500">Filters:</span>
          
          {/* Category filters */}
          {categories.map((category) => {
            const count = getCategoryCount(category);
            return (
              <button
                key={category}
                onClick={() => toggleCategoryFilter(category)}
                className={`px-1.5 py-0.5 h-7 text-[10px] rounded transition-colors whitespace-nowrap flex items-center ${
                  selectedCategories.includes(category)
                    ? "bg-white text-black font-medium"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"
                }`}
              >
                {category} ({count})
              </button>
            );
          })}

          {/* Organisation filters */}
          {organisations.map((org) => {
            const count = getOrganisationCount(org.name);
            return (
              <button
                key={org.id}
                onClick={() => toggleOrganisationFilter(org.name)}
                className={`px-1.5 py-0.5 h-7 text-[10px] rounded transition-colors whitespace-nowrap flex items-center ${
                  selectedOrganisations.includes(org.name)
                    ? "bg-white text-black font-medium"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"
                }`}
              >
                {org.name} ({count})
              </button>
            );
          })}
          {(() => {
            const noOrgCount = getOrganisationCount("No organization");
            return (
              <button
                onClick={() => toggleOrganisationFilter("No organization")}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors whitespace-nowrap ${
                  selectedOrganisations.includes("No organization")
                    ? "bg-white text-black font-medium"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"
                }`}
              >
                No org ({noOrgCount})
              </button>
            );
          })()}

          {/* Status filters */}
          {(["low", "mid", "prio", "high prio"] as ContactStatus[]).map((status) => {
            const count = getStatusCount(status);
            return (
              <button
                key={status}
                onClick={() => toggleStatusFilter(status)}
                className={`px-1.5 py-0.5 h-7 text-[10px] rounded transition-colors whitespace-nowrap flex items-center ${
                  selectedStatuses.includes(status)
                    ? "bg-white text-black font-medium"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"
                }`}
              >
                {status === "high prio"
                  ? "High"
                  : status === "prio"
                  ? "Prio"
                  : status === "mid"
                  ? "Mid"
                  : "Low"} ({count})
              </button>
            );
          })}

          {/* Role filters */}
          {allRoles.map((role) => {
            const count = getRoleCount(role);
            return (
              <button
                key={role}
                onClick={() => toggleRoleFilter(role)}
                className={`px-1.5 py-0.5 h-7 text-[10px] rounded transition-colors whitespace-nowrap flex items-center ${
                  selectedRoles.includes(role)
                    ? "bg-white text-black font-medium"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"
                }`}
              >
                {role} ({count})
              </button>
            );
          })}

          {/* Location filters */}
          {allLocations.map((location) => {
            const count = getLocationCount(location);
            return (
              <button
                key={location}
                onClick={() => toggleLocationFilter(location)}
                className={`px-1.5 py-0.5 h-7 text-[10px] rounded transition-colors whitespace-nowrap flex items-center ${
                  selectedLocations.includes(location)
                    ? "bg-white text-black font-medium"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"
                }`}
              >
                {location} ({count})
              </button>
            );
          })}

          {/* Nationality filters */}
          {allNationalities.map((nationality) => {
            const count = getNationalityCount(nationality);
            return (
              <button
                key={nationality}
                onClick={() => toggleNationalityFilter(nationality)}
                className={`px-1.5 py-0.5 h-7 text-[10px] rounded transition-colors whitespace-nowrap flex items-center ${
                  selectedNationalities.includes(nationality)
                    ? "bg-white text-black font-medium"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"
                }`}
              >
                {nationality} ({count})
              </button>
            );
          })}

          {hasActiveFilters && (
            <>
              <div className="flex-shrink-0 w-px h-5 bg-neutral-800"></div>
              <button
                onClick={clearFilters}
                className="flex-shrink-0 px-1.5 py-0.5 h-7 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors flex items-center"
              >
                Clear
              </button>
            </>
          )}
        </div>
        {hasActiveFilters && (
          <div className="text-[10px] text-neutral-500 px-2 pb-1.5">
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
          {/* New contact inline form */}
          {newContactId && inlineEditData[newContactId] && (
            <div className="mb-4">
              <ContactRow
                contact={{
                  id: newContactId,
                  name: inlineEditData[newContactId].name || "",
                  categories: inlineEditData[newContactId].categories || [],
                  status: inlineEditData[newContactId].status || "mid",
                  contact_status: inlineEditData[newContactId].contact_status || "ongoing",
                  organization: inlineEditData[newContactId].organization,
                  role: inlineEditData[newContactId].role,
                  sector: inlineEditData[newContactId].sector,
                  location: inlineEditData[newContactId].location,
                  nationality: inlineEditData[newContactId].nationality,
                  website: inlineEditData[newContactId].website,
                  notes: inlineEditData[newContactId].notes,
                  tasks: [],
                }}
                onAddOrg={(id) => {
                  setAddingOrgForContact(id);
                  setNewOrgNameInline("");
                }}
                onEditOrganization={handleEditOrganization}
                onAddSector={(id) => {
                  toggleDropdown(id, "sector");
                }}
                onAddTask={() => {}}
                onAddTaskInline={() => {}}
                onAddProject={() => {}}
                onAddProjectInline={() => {}}
                onAddWebsite={(id) => {
                  const editData = inlineEditData[id] || {};
                  setInlineEditData(prev => ({
                    ...prev,
                    [id]: { ...editData, websiteInput: "" }
                  }));
                }}
                onDelete={() => {
                  setNewContactId(null);
                  setInlineEditData(prev => {
                    const newData = { ...prev };
                    delete newData[newContactId];
                    return newData;
                  });
                }}
                onEditName={(id) => {
                  toggleDropdown(id, "name");
                }}
                onEditLocation={handleEditLocation}
                onEditNationality={handleEditNationality}
                onEditRole={handleEditRole}
                onEditStatus={handleEditStatus}
                onEditContactStatus={handleEditContactStatus}
                onEditCategory={handleEditCategory}
                onEditProject={handleEditProject}
                onAddCategory={handleAddCategory}
                onEditSector={handleEditSector}
                onEditWebsite={handleEditWebsite}
                onAddNote={handleAddNote}
                onEditNote={handleEditNote}
                docsCount={0}
                openDropdown={openDropdowns[newContactId]}
                countries={countries}
                nationalities={nationalities}
                roles={roles}
                sectors={sectors}
                categories={categories}
                projects={projects.filter(p => p.project_type === 'internal').map(p => ({ id: p.id, name: p.name || p.title || 'Unnamed Project' }))}
                onUpdateField={(id, field, value) => {
                  if (field === "name" && value && value.trim()) {
                    handleCreateContactInline(id);
                  } else {
                    setInlineEditData(prev => ({
                      ...prev,
                      [id]: { ...prev[id], [field]: value }
                    }));
                  }
                }}
                onToggleDropdown={toggleDropdown}
                onToggleCategory={toggleInlineCategory}
                onToggleProject={toggleInlineProject}
                onToggleOrganization={toggleInlineOrganization}
                organisations={organisations.map(o => ({ id: o.id, name: o.name }))}
                onAddNewRole={handleAddNewRoleInline}
                addingRoleForContact={addingRoleForContact}
                newRoleNameInline={newRoleNameInline}
                setNewRoleNameInline={setNewRoleNameInline}
                editData={inlineEditData[newContactId]}
              />
            </div>
          )}
          
          <div className="space-y-6">
              {sortedOrgKeys.map((orgKey) => (
                <div key={orgKey} className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-neutral-300">
                      {orgKey}
                    </h4>
                    <span className="text-xs text-neutral-500">
                      ({groupedContacts[orgKey].length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {groupedContacts[orgKey].map((contact) => {
                      const contactDocs = contactDocuments[contact.id] || [];
                      const editData = getInlineEditData(contact);
                      const isExpanded = expandedContact === contact.id;
                      const openDropdown = openDropdowns[contact.id];
                      
                      return (
                        <div key={contact.id} className="relative">
                          <ContactRow
                            contact={contact}
                            onAddOrg={(id) => {
                              setAddingOrgForContact(id);
                              setNewOrgNameInline("");
                            }}
                            onEditOrganization={handleEditOrganization}
                            onAddSector={(id) => {
                              toggleDropdown(id, "sector");
                            }}
                            onAddTask={(id) => {
                              const editData = getInlineEditData(contacts.find(c => c.id === id)!);
                              setInlineEditData(prev => ({
                                ...prev,
                                [id]: { ...editData, taskText: "" }
                              }));
                            }}
                            onAddTaskInline={handleAddTaskInline}
                            onAddProject={(id) => {
                              const editData = getInlineEditData(contacts.find(c => c.id === id)!);
                              setInlineEditData(prev => ({
                                ...prev,
                                [id]: { ...editData, projectText: "" }
                              }));
                            }}
                            onAddProjectInline={handleAddProjectInline}
                            onAddWebsite={(id) => {
                              const editData = getInlineEditData(contacts.find(c => c.id === id)!);
                              setInlineEditData(prev => ({
                                ...prev,
                                [id]: { ...editData, websiteInput: "" }
                              }));
                            }}
                            onDelete={handleDelete}
                            onEditName={handleEditName}
                            onEditLocation={handleEditLocation}
                            onEditNationality={handleEditNationality}
                            onEditRole={handleEditRole}
                            onEditStatus={handleEditStatus}
                            onEditContactStatus={handleEditContactStatus}
                            onEditCategory={handleEditCategory}
                            onEditProject={handleEditProject}
                            onAddCategory={handleAddCategory}
                            onEditSector={handleEditSector}
                            onEditWebsite={handleEditWebsite}
                            onEditAvatar={handleEditAvatar}
                            onAddNote={handleAddNote}
                            onEditNote={handleEditNote}
                            docsCount={contactDocs.length}
                            documents={contactDocs}
                            onAddDocument={handleAddDocument}
                            onDeleteDocument={handleDeleteDocument}
                            openDropdown={openDropdown}
                            countries={countries}
                            nationalities={nationalities}
                            roles={roles}
                            sectors={sectors}
                            categories={categories}
                            projects={projects.filter(p => p.project_type === 'internal').map(p => ({ id: p.id, name: p.name || p.title || 'Unnamed Project' }))}
                            onUpdateField={updateInlineField}
                            onToggleDropdown={toggleDropdown}
                            onToggleCategory={toggleInlineCategory}
                            onToggleProject={toggleInlineProject}
                            onToggleOrganization={toggleInlineOrganization}
                            onAddOrganization={handleAddOrganization}
                            organisations={organisations.map(o => ({ id: o.id, name: o.name }))}
                            onAddNewRole={handleAddNewRoleInline}
                            onAddRoleToList={async (roleName: string) => {
                              await addRole(roleName);
                            }}
                            addingRoleForContact={addingRoleForContact}
                            newRoleNameInline={newRoleNameInline}
                            setNewRoleNameInline={setNewRoleNameInline}
                            editData={editData}
                          />
                          
                          {/* Compact inline editing forms - only show specific field when clicked */}
                          {addingOrgForContact === contact.id && (
                            <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg">
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={newOrgNameInline}
                                  onChange={(e) => setNewOrgNameInline(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleAddNewOrgInline(contact.id);
                                    } else if (e.key === 'Escape') {
                                      setAddingOrgForContact(null);
                                      setNewOrgNameInline("");
                                    }
                                  }}
                                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                                  placeholder="Organization name"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleAddNewOrgInline(contact.id)}
                                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => {
                                    setAddingOrgForContact(null);
                                    setNewOrgNameInline("");
                                  }}
                                  className="px-2 py-1 bg-neutral-700 text-white text-xs rounded hover:bg-neutral-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {editData.websiteInput !== undefined && (
                            <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64">
                              <input
                                type="url"
                                value={editData.websiteInput || ""}
                                onChange={(e) => {
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [contact.id]: { ...prev[contact.id], websiteInput: e.target.value }
                                  }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const value = editData.websiteInput?.trim() || undefined;
                                    setInlineEditData(prev => ({
                                      ...prev,
                                      [contact.id]: { ...prev[contact.id], website: value, websiteInput: undefined }
                                    }));
                                    updateInlineField(contact.id, "website", value);
                                  } else if (e.key === 'Escape') {
                                    setInlineEditData(prev => ({
                                      ...prev,
                                      [contact.id]: { ...prev[contact.id], websiteInput: undefined }
                                    }));
                                  }
                                }}
                                onBlur={() => {
                                  const value = editData.websiteInput?.trim() || undefined;
                                  setInlineEditData(prev => ({
                                    ...prev,
                                    [contact.id]: { ...prev[contact.id], website: value, websiteInput: undefined }
                                  }));
                                  updateInlineField(contact.id, "website", value);
                                }}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                                placeholder="https://example.com"
                                autoFocus
                              />
                            </div>
                          )}

                          {expandedDocumentForm === contact.id && (
                            <div className="absolute top-full left-0 z-50 mt-1 p-3 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-80">
                              <div className="space-y-2">
                                <div>
                                  <label className="block text-[10px] text-neutral-400 mb-1">Document Name *</label>
                                  <input
                                    type="text"
                                    value={documentInputs[contact.id]?.name || ""}
                                    onChange={(e) => {
                                      setDocumentInputs(prev => ({
                                        ...prev,
                                        [contact.id]: { ...prev[contact.id] || { name: "", file_url: "", file_type: "", notes: "" }, name: e.target.value }
                                      }));
                                    }}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                                    placeholder="Document name"
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-neutral-400 mb-1">File URL *</label>
                                  <input
                                    type="url"
                                    value={documentInputs[contact.id]?.file_url || ""}
                                    onChange={(e) => {
                                      setDocumentInputs(prev => ({
                                        ...prev,
                                        [contact.id]: { ...prev[contact.id] || { name: "", file_url: "", file_type: "", notes: "" }, file_url: e.target.value }
                                      }));
                                    }}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                                    placeholder="https://..."
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-neutral-400 mb-1">File Type (optional)</label>
                                  <input
                                    type="text"
                                    value={documentInputs[contact.id]?.file_type || ""}
                                    onChange={(e) => {
                                      setDocumentInputs(prev => ({
                                        ...prev,
                                        [contact.id]: { ...prev[contact.id] || { name: "", file_url: "", file_type: "", notes: "" }, file_type: e.target.value }
                                      }));
                                    }}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                                    placeholder="PDF, DOCX, etc."
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-neutral-400 mb-1">Notes (optional)</label>
                                  <textarea
                                    value={documentInputs[contact.id]?.notes || ""}
                                    onChange={(e) => {
                                      setDocumentInputs(prev => ({
                                        ...prev,
                                        [contact.id]: { ...prev[contact.id] || { name: "", file_url: "", file_type: "", notes: "" }, notes: e.target.value }
                                      }));
                                    }}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white resize-none"
                                    rows={2}
                                    placeholder="Additional notes..."
                                  />
                                </div>
                                <div className="flex gap-2 justify-end pt-1">
                                  <button
                                    onClick={() => {
                                      setExpandedDocumentForm(null);
                                      setDocumentInputs(prev => {
                                        const newInputs = { ...prev };
                                        delete newInputs[contact.id];
                                        return newInputs;
                                      });
                                    }}
                                    className="px-2 py-1 bg-neutral-700 text-white text-xs rounded hover:bg-neutral-600"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveDocument(contact.id)}
                                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                  >
                                    Add Document
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
            </div>
        </>
      )}
    </div>
  );
}
