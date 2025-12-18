"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { getAvatarUrl } from "../../lib/avatar-utils";
import { useContactFiles } from "../../hooks/useContactFiles";
import * as documentsDb from "../../lib/db/documents";

// Utility function for conditional class names
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  organization?: string;
  organizations?: string[];
  notes?: string;
  notes_updated_at?: string;
  website?: string;
  location?: string;
  nationality?: string;
  categories: string[];
  status: 'low' | 'mid' | 'prio' | 'high prio';
  contact_status?: 'ongoing' | 'freezed';
  role?: string;
  sector?: string;
  projects?: string[];
  tasks: Array<{
    id: string;
    text: string;
    completed: boolean;
    status?: 'ongoing' | 'done' | 'failed';
    priority?: 'low' | 'mid' | 'prio' | 'high prio';
    dueDate?: string;
    notes?: string;
    assignees?: string[];
    created_at?: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

interface ContactRowProps {
  contact: Contact;
  onAddOrg: (id: string) => void;
  onEditOrganization?: (id: string, event?: React.MouseEvent) => void;
  onAddSector: (id: string) => void;
  onAddTask: (id: string) => void;
  onAddTaskInline?: (id: string) => void;
  onAddProject: (id: string) => void;
  onAddProjectInline?: (id: string) => void;
  onAddWebsite?: (id: string) => void;
  onDelete: (id: string) => void;
  onEditName?: (id: string, event?: React.MouseEvent) => void;
  onEditLocation?: (id: string, event?: React.MouseEvent) => void;
  onEditNationality?: (id: string, event?: React.MouseEvent) => void;
  onEditRole?: (id: string, event?: React.MouseEvent) => void;
  onEditStatus?: (id: string, event?: React.MouseEvent) => void;
  onEditContactStatus?: (id: string, event?: React.MouseEvent) => void;
  onEditCategory?: (id: string, category: string) => void;
  onEditProject?: (id: string, projectId: string, event?: React.MouseEvent) => void;
  onAddCategory?: (id: string, event?: React.MouseEvent) => void;
  onEditSector?: (id: string, event?: React.MouseEvent) => void;
  onEditEmail?: (id: string, event?: React.MouseEvent) => void;
  onEditWebsite?: (id: string, event?: React.MouseEvent) => void;
  onEditAvatar?: (id: string, event?: React.MouseEvent) => void;
  docsCount?: number;
  documents?: Array<{
    id: string;
    name: string;
    file_url: string;
    file_type?: string;
    notes?: string;
    edit_url?: string;
  }>;
  onAddDocument?: (contactId: string) => void;
  onDeleteDocument?: (documentId: string) => void;
  onAddNote?: (contactId: string) => void;
  onEditNote?: (contactId: string, event?: React.MouseEvent) => void;
  // Dropdown data and handlers
  openDropdown?: string;
  countries?: string[];
  nationalities?: string[];
  roles?: string[];
  sectors?: string[];
  categories?: string[];
  projects?: Array<{ id: string; name: string }>;
  onUpdateField?: (contactId: string, field: string, value: any) => void;
  onToggleDropdown?: (contactId: string, dropdown: string | undefined) => void;
  onToggleCategory?: (contactId: string, category: string) => void;
  onToggleProject?: (contactId: string, projectId: string) => void;
  onToggleOrganization?: (contactId: string, orgName: string) => void;
  onAddOrganization?: (contactId: string, orgName: string) => void;
  organisations?: Array<{ id: string; name: string }>;
  onAddNewRole?: (contactId: string) => void;
  onAddRoleToList?: (roleName: string) => Promise<void>;
  addingRoleForContact?: string | null;
  newRoleNameInline?: string;
  setNewRoleNameInline?: (value: string) => void;
  editData?: {
    name?: string;
    email?: string;
    location?: string;
    nationality?: string;
    role?: string;
    sector?: string;
    website?: string;
    websiteInput?: string;
    avatar?: string;
    avatarInput?: string;
    notes?: string;
    status?: 'low' | 'mid' | 'prio' | 'high prio';
    contact_status?: 'ongoing' | 'freezed';
    categories?: string[];
    projects?: string[];
    taskText?: string;
    projectText?: string;
    organizations?: string[];
  };
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getPriorityLabel(status: 'low' | 'mid' | 'prio' | 'high prio'): string {
  switch (status) {
    case 'high prio': return 'High';
    case 'prio': return 'Prio';
    case 'mid': return 'Mid';
    case 'low': return 'Low';
    default: return 'Mid';
  }
}

function getCategoryColor(category: string): string {
  const categoryColors: Record<string, string> = {
    "Client": "bg-blue-600/30 text-blue-400 border-blue-600/50",
    "Government": "bg-purple-600/30 text-purple-400 border-purple-600/50",
    "Investor": "bg-green-600/30 text-green-400 border-green-600/50",
    "MB Team": "bg-orange-600/30 text-orange-400 border-orange-600/50",
    "Partner": "bg-cyan-600/30 text-cyan-400 border-cyan-600/50",
    "Prospect": "bg-yellow-600/30 text-yellow-400 border-yellow-600/50",
  };
  return categoryColors[category] || "bg-neutral-800 text-neutral-300 border-neutral-700";
}

// Name input component with guaranteed focus
function NameInputWithFocus({ 
  contact, 
  editData, 
  onUpdateField, 
  onToggleDropdown 
}: { 
  contact: any; 
  editData: any; 
  onUpdateField: (id: string, field: string, value: string) => void; 
  onToggleDropdown: (id: string, dropdown: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    // Focus input immediately when component mounts
    if (inputRef.current) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        inputRef.current?.focus();
        // Select all text if it's a new contact
        if (contact.id.startsWith("new-")) {
          inputRef.current?.select();
        }
      }, 0);
    }
  }, [contact.id]);
  
  return (
    <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64">
      <input
        ref={inputRef}
        type="text"
        value={editData.name !== undefined ? editData.name : (contact.name || "")}
        onChange={(e) => {
          console.log('📝 Name input onChange:', contact.id, e.target.value);
          onUpdateField(contact.id, "name", e.target.value);
        }}
        onBlur={(e) => {
          console.log('📝 Name input onBlur:', contact.id, 'isNew:', contact.id.startsWith("new-"));
          // Don't close if clicking on the dropdown itself
          const relatedTarget = e.relatedTarget as HTMLElement;
          if (relatedTarget && relatedTarget.closest('.absolute.z-50')) {
            console.log('📝 Ignoring blur - clicked on dropdown');
            return;
          }
          
          const newName = editData.name !== undefined ? editData.name : (contact.name || "");
          console.log('📝 onBlur - newName:', newName, 'contact.name:', contact.name);
          
          if (newName.trim() !== (contact.name || "") && newName.trim() !== '') {
            console.log('📝 Name changed, updating field...');
            onUpdateField(contact.id, "name", newName.trim());
            // If this is a new contact (starts with "new-"), create it after state update
            if (contact.id.startsWith("new-") && newName.trim()) {
              console.log('📝 This is a new contact, will dispatch event in 100ms');
              // Wait a bit for state to update, then dispatch event
              setTimeout(() => {
                console.log('📝 Dispatching create-contact event for:', contact.id, 'with name:', newName.trim());
                const event = new CustomEvent('create-contact', { 
                  detail: { 
                    contactId: contact.id,
                    name: newName.trim()
                  } 
                });
                window.dispatchEvent(event);
                console.log('📝 Event dispatched, checking if listener exists...');
              }, 100);
              onToggleDropdown(contact.id, "name");
            }
          } else {
            console.log('📝 Name not changed or empty, resetting');
            onUpdateField(contact.id, "name", contact.name || "");
          }
          // Close dropdown for existing contacts or if name is empty
          if (!contact.id.startsWith("new-") || !newName.trim()) {
            onToggleDropdown(contact.id, "name");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            console.log('📝 Enter key pressed for contact:', contact.id, 'isNew:', contact.id.startsWith("new-"));
            const newName = editData.name !== undefined ? editData.name : (contact.name || "");
            console.log('📝 Enter - newName:', newName);
            
            if (newName.trim() !== (contact.name || "") && newName.trim() !== '') {
              console.log('📝 Name is valid, updating field...');
              onUpdateField(contact.id, "name", newName.trim());
              // If this is a new contact, create it after state update
              if (contact.id.startsWith("new-")) {
                console.log('📝 This is a new contact, will dispatch event in 100ms');
                // Wait a bit for state to update, then dispatch event
                setTimeout(() => {
                  console.log('📝 Dispatching create-contact event (Enter key) for:', contact.id, 'with name:', newName.trim());
                  const event = new CustomEvent('create-contact', { 
                    detail: { 
                      contactId: contact.id,
                      name: newName.trim()
                    } 
                  });
                  window.dispatchEvent(event);
                  console.log('📝 Event dispatched (Enter)');
                }, 100);
                onToggleDropdown(contact.id, "name");
              } else {
                onToggleDropdown(contact.id, "name");
              }
            } else {
              console.log('📝 Name invalid or empty');
              onUpdateField(contact.id, "name", contact.name || "");
              onToggleDropdown(contact.id, "name");
            }
          } else if (e.key === 'Escape') {
            onUpdateField(contact.id, "name", contact.name || "");
            onToggleDropdown(contact.id, "name");
          }
        }}
        className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter name"
      />
    </div>
  );
}

export default function ContactRow({
  contact,
  onAddOrg,
  onEditOrganization,
  onAddSector,
  onAddTask,
  onAddTaskInline,
  onAddProject,
  onAddProjectInline,
  onAddWebsite,
  onDelete,
  onEditName,
  onEditLocation,
  onEditNationality,
  onEditRole,
  onEditStatus,
  onEditContactStatus,
  onEditCategory,
  onEditProject,
  onAddCategory,
  onEditSector,
  onEditEmail,
  onEditWebsite,
  onEditAvatar,
  docsCount = 0,
  documents = [],
  onAddDocument,
  onDeleteDocument,
  onAddNote,
  onEditNote,
  openDropdown,
  countries = [],
  nationalities = [],
  roles = [],
  sectors = [],
  categories = [],
  projects = [],
  onUpdateField,
  onToggleDropdown,
  onToggleCategory,
  onToggleProject,
  onToggleOrganization,
  onAddOrganization,
  organisations = [],
  onAddNewRole,
  onAddRoleToList,
  addingRoleForContact,
  newRoleNameInline = "",
  setNewRoleNameInline,
  editData = {},
}: ContactRowProps) {
  // Get organizations from editData first (for inline editing), then from contact
  const organizations = editData?.organizations || contact.organizations || (contact.organization ? [contact.organization] : []);
  const tasksCount = contact.tasks?.filter(t => !t.completed).length || 0;
  const projectsCount = contact.projects?.length || 0;
  const priorityLabel = getPriorityLabel(contact.status);
  const hasNoDocs = docsCount === 0;
  const showDocsDropdown = openDropdown === 'documents';
  const showNotesDropdown = openDropdown === 'notes';
  const hasNotes = !!contact.notes && contact.notes.trim().length > 0;
  
  // State for combobox inputs
  const [sectorInput, setSectorInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [nationalityInput, setNationalityInput] = useState("");
  const [organizationInput, setOrganizationInput] = useState("");
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [localAvatarInput, setLocalAvatarInput] = useState<string>("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Helper function to render combobox for location
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (openDropdown === 'location' && locationInputRef.current) {
      locationInputRef.current.focus();
      setLocationInput(editData.location || "");
    } else if (openDropdown !== 'location') {
      setLocationInput("");
    }
  }, [openDropdown, editData.location]);

  useEffect(() => {
    if (openDropdown === 'avatar' && avatarInputRef.current) {
      avatarInputRef.current.focus();
      // Initialize local state with current avatar value when opening dropdown
      const currentAvatar = editData.avatar !== undefined ? editData.avatar : contact.avatar || "";
      if (editData.avatarInput !== undefined) {
        setLocalAvatarInput(editData.avatarInput);
      } else {
        setLocalAvatarInput(currentAvatar);
        if (onUpdateField) {
          onUpdateField(contact.id, "avatarInput", currentAvatar);
        }
      }
    } else if (openDropdown !== 'avatar') {
      // Clear local state when dropdown closes
      setLocalAvatarInput("");
    }
  }, [openDropdown, contact.id, contact.avatar, editData.avatar, editData.avatarInput, onUpdateField]);

  // Reset avatar error when avatar changes
  useEffect(() => {
    setAvatarError(false);
  }, [contact.avatar]);
  
  const filteredLocations = countries.filter(country => 
    country.toLowerCase().includes(locationInput.toLowerCase())
  );
  
  const renderLocationDropdown = () => {
    if (openDropdown !== 'location' || !onUpdateField || !onToggleDropdown) return null;
    return (
      <div ref={locationDropdownRef} className="absolute top-full left-0 z-50 mt-1 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64">
        <div className="p-2">
          <input
            ref={locationInputRef}
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && locationInput.trim()) {
                onUpdateField(contact.id, "location", locationInput.trim());
                onToggleDropdown(contact.id, "location");
              } else if (e.key === 'Escape') {
                setLocationInput(editData.location || "");
                onToggleDropdown(contact.id, "location");
              }
            }}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white mb-2"
            placeholder="Type country name..."
          />
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => {
                onUpdateField(contact.id, "location", undefined);
                onToggleDropdown(contact.id, "location");
              }}
              className={`px-2 py-1 text-xs rounded text-left ${
                !editData.location
                  ? 'bg-green-600/50 text-green-300'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              None
            </button>
            {filteredLocations.length > 0 ? (
              filteredLocations.map((country) => (
                <button
                  key={country}
                  onClick={() => {
                    onUpdateField(contact.id, "location", country);
                    onToggleDropdown(contact.id, "location");
                  }}
                  className={`px-2 py-1 text-xs rounded text-left ${
                    editData.location === country
                      ? 'bg-green-600/50 text-green-300'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {country}
                </button>
              ))
            ) : locationInput.trim() ? (
              <button
                onClick={() => {
                  onUpdateField(contact.id, "location", locationInput.trim());
                  onToggleDropdown(contact.id, "location");
                }}
                className="px-2 py-1 text-xs rounded text-left bg-green-600/50 text-green-300 hover:bg-green-600/70"
              >
                Create "{locationInput.trim()}"
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render combobox for nationality
  const nationalityDropdownRef = useRef<HTMLDivElement>(null);
  const nationalityInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (openDropdown === 'nationality' && nationalityInputRef.current) {
      nationalityInputRef.current.focus();
      setNationalityInput(editData.nationality || "");
    } else if (openDropdown !== 'nationality') {
      setNationalityInput("");
    }
  }, [openDropdown, editData.nationality]);
  
  const filteredNationalities = nationalities.filter(nationality => 
    nationality.toLowerCase().includes(nationalityInput.toLowerCase())
  );
  
  const renderNationalityDropdown = () => {
    if (openDropdown !== 'nationality' || !onUpdateField || !onToggleDropdown) return null;
    return (
      <div ref={nationalityDropdownRef} className="absolute top-full left-0 z-50 mt-1 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64">
        <div className="p-2">
          <input
            ref={nationalityInputRef}
            type="text"
            value={nationalityInput}
            onChange={(e) => setNationalityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nationalityInput.trim()) {
                onUpdateField(contact.id, "nationality", nationalityInput.trim());
                onToggleDropdown(contact.id, "nationality");
              } else if (e.key === 'Escape') {
                setNationalityInput(editData.nationality || "");
                onToggleDropdown(contact.id, "nationality");
              }
            }}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white mb-2"
            placeholder="Type nationality..."
          />
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => {
                onUpdateField(contact.id, "nationality", undefined);
                onToggleDropdown(contact.id, "nationality");
              }}
              className={`px-2 py-1 text-xs rounded text-left ${
                !editData.nationality
                  ? 'bg-cyan-600/50 text-cyan-300'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              None
            </button>
            {filteredNationalities.length > 0 ? (
              filteredNationalities.map((nationality) => (
                <button
                  key={nationality}
                  onClick={() => {
                    onUpdateField(contact.id, "nationality", nationality);
                    onToggleDropdown(contact.id, "nationality");
                  }}
                  className={`px-2 py-1 text-xs rounded text-left ${
                    editData.nationality === nationality
                      ? 'bg-cyan-600/50 text-cyan-300'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {nationality}
                </button>
              ))
            ) : nationalityInput.trim() ? (
              <button
                onClick={() => {
                  onUpdateField(contact.id, "nationality", nationalityInput.trim());
                  onToggleDropdown(contact.id, "nationality");
                }}
                className="px-2 py-1 text-xs rounded text-left bg-green-600/50 text-green-300 hover:bg-green-600/70"
              >
                Create "{nationalityInput.trim()}"
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render combobox for role
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const roleInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (openDropdown === 'role' && roleInputRef.current) {
      roleInputRef.current.focus();
      setRoleInput(editData.role || "");
    } else if (openDropdown !== 'role') {
      setRoleInput("");
    }
  }, [openDropdown, editData.role]);
  
  const filteredRoles = roles.filter(role => 
    role.toLowerCase().includes(roleInput.toLowerCase())
  );
  
  const renderRoleDropdown = () => {
    if (openDropdown !== 'role' || !onUpdateField || !onToggleDropdown) return null;
    return (
      <div ref={roleDropdownRef} className="absolute top-full left-0 z-50 mt-1 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64">
        <div className="p-2">
          <input
            ref={roleInputRef}
            type="text"
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && roleInput.trim()) {
                const newRole = roleInput.trim();
                if (onAddRoleToList) {
                  await onAddRoleToList(newRole);
                }
                onUpdateField(contact.id, "role", newRole);
                onToggleDropdown(contact.id, "role");
              } else if (e.key === 'Escape') {
                setRoleInput(editData.role || "");
                onToggleDropdown(contact.id, "role");
              }
            }}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white mb-2"
            placeholder="Type role name (e.g. CEO)..."
          />
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => {
                onUpdateField(contact.id, "role", undefined);
                onToggleDropdown(contact.id, "role");
              }}
              className={`px-2 py-1 text-xs rounded text-left ${
                !editData.role
                  ? 'bg-purple-600/50 text-purple-300'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              None
            </button>
            {filteredRoles.length > 0 ? (
              filteredRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    onUpdateField(contact.id, "role", role);
                    onToggleDropdown(contact.id, "role");
                  }}
                  className={`px-2 py-1 text-xs rounded text-left ${
                    editData.role === role
                      ? 'bg-purple-600/50 text-purple-300'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {role}
                </button>
              ))
            ) : roleInput.trim() ? (
              <button
                onClick={async () => {
                  const newRole = roleInput.trim();
                  if (onAddRoleToList) {
                    await onAddRoleToList(newRole);
                  }
                  onUpdateField(contact.id, "role", newRole);
                  onToggleDropdown(contact.id, "role");
                }}
                className="px-2 py-1 text-xs rounded text-left bg-green-600/50 text-green-300 hover:bg-green-600/70"
              >
                Create "{roleInput.trim()}"
              </button>
            ) : (
              <div className="px-2 py-1 text-xs text-neutral-500">No roles found</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render combobox for sector
  const sectorDropdownRef = useRef<HTMLDivElement>(null);
  const sectorInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (openDropdown === 'sector' && sectorInputRef.current) {
      sectorInputRef.current.focus();
      setSectorInput(editData.sector || "");
    } else if (openDropdown !== 'sector') {
      setSectorInput("");
    }
  }, [openDropdown, editData.sector]);
  
  const filteredSectors = sectors.filter(sector => 
    sector.toLowerCase().includes(sectorInput.toLowerCase())
  );
  
  const renderSectorDropdown = () => {
    if (openDropdown !== 'sector' || !onUpdateField || !onToggleDropdown) return null;
    return (
      <div ref={sectorDropdownRef} className="absolute top-full left-0 z-50 mt-1 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64">
        <div className="p-2">
          <input
            ref={sectorInputRef}
            type="text"
            value={sectorInput}
            onChange={(e) => setSectorInput(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && sectorInput.trim()) {
                const newSector = sectorInput.trim();
                // Note: Sectors are currently hardcoded, but we can still save the value
                onUpdateField(contact.id, "sector", newSector);
                onToggleDropdown(contact.id, "sector");
              } else if (e.key === 'Escape') {
                setSectorInput(editData.sector || "");
                onToggleDropdown(contact.id, "sector");
              }
            }}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white mb-2"
            placeholder="Type sector name (e.g. Real Estate)..."
          />
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => {
                onUpdateField(contact.id, "sector", undefined);
                onToggleDropdown(contact.id, "sector");
              }}
              className={`px-2 py-1 text-xs rounded text-left ${
                !editData.sector
                  ? 'bg-blue-600/50 text-blue-300'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              None
            </button>
            {filteredSectors.length > 0 ? (
              filteredSectors.map((sector) => (
                <button
                  key={sector}
                  onClick={() => {
                    onUpdateField(contact.id, "sector", sector);
                    onToggleDropdown(contact.id, "sector");
                  }}
                  className={`px-2 py-1 text-xs rounded text-left ${
                    editData.sector === sector
                      ? 'bg-blue-600/50 text-blue-300'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {sector}
                </button>
              ))
            ) : sectorInput.trim() ? (
              <button
                onClick={async () => {
                  const newSector = sectorInput.trim();
                  // Note: Sectors are currently hardcoded, but we can still save the value
                  onUpdateField(contact.id, "sector", newSector);
                  onToggleDropdown(contact.id, "sector");
                }}
                className="px-2 py-1 text-xs rounded text-left bg-green-600/50 text-green-300 hover:bg-green-600/70"
              >
                Create "{sectorInput.trim()}"
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render dropdown for status (priority)
  const renderStatusDropdown = () => {
    if (openDropdown !== 'status' || !onUpdateField || !onToggleDropdown) return null;
    return (
      <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-32">
        <div className="flex flex-col gap-1">
          {(["low", "mid", "prio", "high prio"] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                onUpdateField(contact.id, "status", status);
                onToggleDropdown(contact.id, "status");
              }}
              className={`px-2 py-1 text-xs rounded text-left ${
                editData.status === status
                  ? status === "high prio" 
                    ? 'bg-red-600/50 text-red-300'
                    : status === "prio"
                    ? 'bg-orange-600/50 text-orange-300'
                    : status === "mid"
                    ? 'bg-yellow-600/50 text-yellow-300'
                    : 'bg-neutral-700/50 text-neutral-300'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {status === "high prio" ? "High" : status === "prio" ? "Prio" : status === "mid" ? "Mid" : "Low"}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Helper function to render dropdown for contact_status
  const renderContactStatusDropdown = () => {
    if (openDropdown !== 'contact_status' || !onUpdateField || !onToggleDropdown) return null;
    return (
      <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-32">
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          <button
            onClick={() => {
              onUpdateField(contact.id, "contact_status", "ongoing");
              onToggleDropdown(contact.id, "contact_status");
            }}
            className={`px-2 py-1 text-xs rounded text-left ${
              editData.contact_status === 'ongoing'
                ? 'bg-green-600/50 text-green-300'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            Ongoing
          </button>
          <button
            onClick={() => {
              onUpdateField(contact.id, "contact_status", "freezed");
              onToggleDropdown(contact.id, "contact_status");
            }}
            className={`px-2 py-1 text-xs rounded text-left ${
              editData.contact_status === 'freezed'
                ? 'bg-green-600/50 text-green-300'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            Freezed
          </button>
        </div>
      </div>
    );
  };

  // Helper function to render dropdown for website
  const renderWebsiteInput = () => {
    if (openDropdown !== 'website' || !onUpdateField || !onToggleDropdown) return null;
    return (
      <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64">
        <input
          type="text"
          value={editData.website !== undefined ? editData.website : contact.website || ""}
          onChange={(e) => {
            onUpdateField(contact.id, "website", e.target.value);
          }}
          onBlur={() => {
            onToggleDropdown(contact.id, "website");
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onToggleDropdown(contact.id, "website");
            } else if (e.key === 'Escape') {
              onToggleDropdown(contact.id, "website");
            }
          }}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
          placeholder="Website URL"
          autoFocus
        />
      </div>
    );
  };

  // Helper function to render input for notes
  const renderNotesInput = () => {
    if (openDropdown !== 'notes' || !onUpdateField || !onToggleDropdown) return null;
    const notesValue = editData.notes !== undefined ? editData.notes : contact.notes || "";
    const notesDate = contact.notes_updated_at;
    
    return (
      <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-80">
        <textarea
          value={notesValue}
          onChange={(e) => {
            onUpdateField(contact.id, "notes", e.target.value);
          }}
          onBlur={() => {
            onToggleDropdown(contact.id, "notes");
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onToggleDropdown(contact.id, "notes");
            }
          }}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white resize-none"
          placeholder="Add notes..."
          rows={4}
          autoFocus
        />
        {notesDate && (
          <div className="mt-2 text-[9px] text-neutral-500">
            Updated: {format(new Date(notesDate), 'PPp')}
          </div>
        )}
      </div>
    );
  };

  // Helper function to render input for avatar
  const renderAvatarInput = () => {
    if (openDropdown !== 'avatar' || !onUpdateField || !onToggleDropdown) return null;
    const currentAvatar = editData.avatar !== undefined ? editData.avatar : contact.avatar || "";
    // Use local state if available, otherwise fall back to editData or current avatar
    const avatarInputValue = localAvatarInput || (editData.avatarInput !== undefined ? editData.avatarInput : currentAvatar);
    
    return (
      <div 
        className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <input
            ref={avatarInputRef}
            type="url"
            value={avatarInputValue || ""}
            onChange={(e) => {
              const newValue = e.target.value;
              setLocalAvatarInput(newValue);
              onUpdateField(contact.id, "avatarInput", newValue);
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && !isSavingAvatar) {
                e.preventDefault();
                e.stopPropagation();
                setIsSavingAvatar(true);
                let value = (editData.avatarInput !== undefined ? editData.avatarInput : currentAvatar)?.trim() || undefined;
                // Validate URL
                if (value) {
                  try {
                    new URL(value);
                  } catch (urlError) {
                    alert('Invalid URL format. Please check the avatar URL.');
                    setIsSavingAvatar(false);
                    return;
                  }
                }
                await onUpdateField(contact.id, "avatar", value);
                onUpdateField(contact.id, "avatarInput", undefined);
                setLocalAvatarInput("");
                onToggleDropdown(contact.id, undefined);
                setIsSavingAvatar(false);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onUpdateField(contact.id, "avatarInput", undefined);
                onToggleDropdown(contact.id, undefined);
              }
            }}
            onBlur={(e) => {
              // Don't close if clicking on the dropdown itself or if saving
              if (isSavingAvatar) return;
              const relatedTarget = e.relatedTarget as HTMLElement;
              // Don't close if clicking on buttons in the dropdown
              if (relatedTarget && (relatedTarget.closest('button') || e.currentTarget.closest('.absolute.z-50')?.contains(relatedTarget))) {
                return;
              }
              // Small delay to allow button clicks to register
              setTimeout(() => {
                if (!isSavingAvatar) {
                  // Just close dropdown, don't save automatically - user must click Save or press Enter
                  onUpdateField(contact.id, "avatarInput", undefined);
                  onToggleDropdown(contact.id, undefined);
                }
              }, 200);
            }}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
            placeholder="Avatar URL (https://...)"
            autoFocus
          />
          {avatarInputValue && (
            <div className="flex items-center gap-2">
              <img
                key={avatarInputValue} // Force reload when URL changes
                src={getAvatarUrl(avatarInputValue)}
                alt="Preview"
                className="w-8 h-8 rounded-full object-cover border border-neutral-700"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="text-[9px] text-neutral-500">Preview</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsSavingAvatar(true);
                let value = (editData.avatarInput !== undefined ? editData.avatarInput : currentAvatar)?.trim() || undefined;
                // Validate URL
                if (value) {
                  try {
                    new URL(value);
                  } catch (urlError) {
                    alert('Invalid URL format. Please check the avatar URL.');
                    setIsSavingAvatar(false);
                    return;
                  }
                }
                await onUpdateField(contact.id, "avatar", value);
                onUpdateField(contact.id, "avatarInput", undefined);
                setLocalAvatarInput("");
                onToggleDropdown(contact.id, undefined);
                setIsSavingAvatar(false);
              }}
              className="flex-1 px-2 py-1 text-[9px] bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50"
            >
              Save
            </button>
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsSavingAvatar(true);
                await onUpdateField(contact.id, "avatar", undefined);
                onUpdateField(contact.id, "avatarInput", undefined);
                onToggleDropdown(contact.id, undefined);
                setIsSavingAvatar(false);
              }}
              className="flex-1 px-2 py-1 text-[9px] bg-red-600/30 text-red-400 rounded hover:bg-red-600/50"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render dropdown for organizations
  const organizationDropdownRef = useRef<HTMLDivElement>(null);
  const organizationInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (openDropdown === 'organization' && organizationInputRef.current) {
      organizationInputRef.current.focus();
      setOrganizationInput("");
    } else if (openDropdown !== 'organization') {
      setOrganizationInput("");
    }
  }, [openDropdown]);
  
  const filteredOrganisations = organisations.filter(org => 
    org.name.toLowerCase().includes(organizationInput.toLowerCase())
  );
  
  const renderOrganizationDropdown = () => {
    if (openDropdown !== 'organization' || !onToggleOrganization || !onToggleDropdown) return null;
    const currentOrgs = editData?.organizations || organizations;
    return (
      <div ref={organizationDropdownRef} className="absolute top-full left-0 z-50 mt-1 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64">
        <div className="p-2">
          <input
            ref={organizationInputRef}
            type="text"
            value={organizationInput}
            onChange={(e) => setOrganizationInput(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && organizationInput.trim()) {
                if (onAddOrganization) {
                  await onAddOrganization(contact.id, organizationInput.trim());
                }
                setOrganizationInput("");
              } else if (e.key === 'Escape') {
                setOrganizationInput("");
                onToggleDropdown(contact.id, "organization");
              }
            }}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white mb-2"
            placeholder="Type organization name..."
          />
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {filteredOrganisations.length > 0 ? (
              filteredOrganisations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    onToggleOrganization(contact.id, org.name);
                    onToggleDropdown(contact.id, "organization");
                  }}
                  className={`px-2 py-1 text-xs rounded text-left ${
                    currentOrgs.includes(org.name)
                      ? 'bg-green-600/50 text-green-300'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {org.name}
                </button>
              ))
            ) : organizationInput.trim() ? (
              <button
                onClick={() => {
                  if (onAddOrganization) {
                    onAddOrganization(contact.id, organizationInput.trim());
                  }
                  setOrganizationInput("");
                }}
                className="px-2 py-1 text-xs rounded text-left bg-green-600/50 text-green-300 hover:bg-green-600/70"
              >
                Create "{organizationInput.trim()}"
              </button>
            ) : (
              <div className="px-2 py-1 text-xs text-neutral-500">No organizations found</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render dropdown for projects
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (openDropdown !== 'project') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        const letter = e.key.toLowerCase();
        const container = projectDropdownRef.current?.querySelector('.flex.flex-col.gap-1');
        if (!container) return;
        
        const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
        const targetButton = buttons.find(btn => {
          const text = btn.textContent?.trim().toLowerCase() || '';
          return text.startsWith(letter);
        });
        
        if (targetButton) {
          targetButton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          e.preventDefault();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openDropdown]);
  
  const renderProjectDropdown = () => {
    if (openDropdown !== 'project' || !onToggleProject || !onToggleDropdown) return null;
    return (
      <div ref={projectDropdownRef} className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-48">
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => {
                onToggleProject(contact.id, project.id);
                onToggleDropdown(contact.id, "project");
              }}
              className={`px-2 py-1 text-xs rounded text-left ${
                editData.projects?.includes(project.id)
                  ? 'bg-green-600/50 text-green-300'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {project.name}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Helper function to render dropdown for category
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (openDropdown !== 'category') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        const letter = e.key.toLowerCase();
        const container = categoryDropdownRef.current?.querySelector('.flex.flex-col.gap-1');
        if (!container) return;
        
        const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
        const targetButton = buttons.find(btn => {
          const text = btn.textContent?.trim().toLowerCase() || '';
          return text.startsWith(letter);
        });
        
        if (targetButton) {
          targetButton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          e.preventDefault();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openDropdown]);
  
  const renderCategoryDropdown = () => {
    if (openDropdown !== 'category' || !onToggleCategory || !onToggleDropdown) return null;
    const currentCategories = editData.categories || contact.categories || [];
    return (
      <div ref={categoryDropdownRef} className="absolute top-full right-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-48">
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                onToggleCategory(contact.id, category);
                onToggleDropdown(contact.id, "category");
              }}
              className={`px-2 py-1 text-xs rounded text-left ${
                currentCategories.includes(category)
                  ? 'bg-orange-600/50 text-orange-300'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderDocumentsDropdown = () => {
    if (!showDocsDropdown || !onToggleDropdown) return null;
    return (
      <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-80 max-h-96 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {documents.length === 0 ? (
            <div className="px-2 py-2 text-neutral-400 text-xs text-center">
              No documents yet
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 bg-neutral-800 rounded hover:bg-neutral-700 group"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="text-white hover:text-blue-400 hover:underline truncate block"
                    title={doc.name}
                  >
                    {doc.name}
                  </a>
                  {doc.file_type && (
                    <div className="text-[9px] text-neutral-500 mt-0.5">
                      {doc.file_type}
                    </div>
                  )}
                  {doc.notes && (
                    <div className="text-[9px] text-neutral-500 mt-0.5 truncate">
                      {doc.notes}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {doc.edit_url && (
                    <a
                      href={doc.edit_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="px-1.5 py-0.5 text-[9px] bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50"
                      title="Edit document"
                    >
                      Edit
                    </a>
                  )}
                  {onDeleteDocument && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete document "${doc.name}"?`)) {
                          onDeleteDocument(doc.id);
                        }
                      }}
                      className="px-1.5 py-0.5 text-[9px] bg-red-600/30 text-red-400 rounded hover:bg-red-600/50 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete document"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          {onAddDocument && (
            <button
              onClick={() => {
                onAddDocument(contact.id);
                onToggleDropdown(contact.id, "documents");
              }}
              className="mt-1 px-2 py-1.5 text-xs bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50 text-left"
            >
              + Add Document
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="group border border-neutral-800 rounded-lg px-3 py-2.5 bg-neutral-900/30 hover:bg-neutral-900/50 transition-all text-xs">
      {/* Header Row: Avatar, Name, Priority, Status, Delete */}
      <div className="flex items-center gap-2.5 mb-2">
        {/* Avatar */}
        {onEditAvatar ? (
          <div className="relative inline-block">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditAvatar(contact.id, e);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              className="flex-shrink-0"
              title="Click to edit avatar"
            >
              {contact.avatar && contact.avatar.trim() && !avatarError ? (
                <img
                  src={getAvatarUrl(contact.avatar)}
                  alt={contact.name}
                  className="h-6 w-6 rounded-full object-cover border border-neutral-700 hover:border-blue-500 transition-colors cursor-pointer"
                  onError={(e) => {
                    console.error('Avatar image failed to load:', contact.avatar);
                    setAvatarError(true);
                  }}
                  onLoad={() => {
                    setAvatarError(false);
                  }}
                  loading="lazy"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-green-600 flex items-center justify-center text-[10px] font-semibold border border-neutral-700 hover:border-blue-500 transition-colors cursor-pointer">
                  {initialsFrom(contact.name)}
                </div>
              )}
            </button>
            {renderAvatarInput()}
          </div>
        ) : (
          <>
            {contact.avatar && contact.avatar.trim() && !avatarError ? (
              <img
                src={getAvatarUrl(contact.avatar)}
                alt={contact.name}
                className="h-6 w-6 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                onError={(e) => {
                  console.error('Avatar image failed to load:', contact.avatar);
                  setAvatarError(true);
                }}
                onLoad={() => {
                  setAvatarError(false);
                }}
                loading="lazy"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-green-600 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                {initialsFrom(contact.name)}
              </div>
            )}
          </>
        )}

        {/* Name - clickable to edit */}
        <div className="flex-1 min-w-0">
          {onEditName ? (
            <div className="relative inline-block">
              <button
                onClick={(e) => onEditName(contact.id, e)}
                className={`font-semibold hover:text-blue-400 hover:underline cursor-pointer text-sm ${
                  contact.name ? "text-white" : "text-neutral-500"
                }`}
                title="Click to edit name"
              >
                {contact.name || "Click to add name"}
              </button>
              {openDropdown === 'name' && onUpdateField && onToggleDropdown && (
                <NameInputWithFocus
                  contact={contact}
                  editData={editData}
                  onUpdateField={onUpdateField}
                  onToggleDropdown={onToggleDropdown}
                />
              )}
            </div>
          ) : (
            <span className="font-semibold text-white text-sm">{contact.name}</span>
          )}
        </div>

        {/* Email - clickable to edit */}
        {contact.email || onEditEmail ? (
          <div className="mb-1.5">
            {onEditEmail ? (
              <div className="relative inline-block">
                <button
                  onClick={(e) => onEditEmail(contact.id, e)}
                  className="text-[10px] text-neutral-400 hover:text-blue-400 hover:underline cursor-pointer"
                  title="Click to edit email"
                >
                  {contact.email || '+ Add email'}
                </button>
                {openDropdown === 'email' && onUpdateField && onToggleDropdown && (
                  <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64">
                    <input
                      type="email"
                      value={editData.email !== undefined ? editData.email : contact.email || ''}
                      onChange={(e) => {
                        onUpdateField(contact.id, "email", e.target.value);
                      }}
                      onBlur={() => {
                        const newEmail = editData.email !== undefined ? editData.email : contact.email || '';
                        if (newEmail.trim() !== (contact.email || '') && newEmail.trim() !== '') {
                          onUpdateField(contact.id, "email", newEmail.trim());
                        } else {
                          onUpdateField(contact.id, "email", contact.email || '');
                        }
                        onToggleDropdown(contact.id, undefined);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newEmail = editData.email !== undefined ? editData.email : contact.email || '';
                          if (newEmail.trim() !== (contact.email || '') && newEmail.trim() !== '') {
                            onUpdateField(contact.id, "email", newEmail.trim());
                          } else {
                            onUpdateField(contact.id, "email", contact.email || '');
                          }
                          onToggleDropdown(contact.id, undefined);
                        } else if (e.key === 'Escape') {
                          onUpdateField(contact.id, "email", contact.email || '');
                          onToggleDropdown(contact.id, undefined);
                        }
                      }}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                      placeholder="email@example.com"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-neutral-400">{contact.email}</span>
            )}
          </div>
        ) : null}

        {/* Priority and Status - grouped together */}
        <div className="flex items-center gap-1.5">
          {/* Priority */}
          {onEditStatus ? (
            <div className="relative inline-block">
              <button
                onClick={(e) => onEditStatus(contact.id, e)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer",
                  contact.status === "high prio" && "bg-red-600/30 text-red-400 border border-red-600/50 hover:bg-red-600/50",
                  contact.status === "prio" && "bg-orange-600/30 text-orange-400 border border-orange-600/50 hover:bg-orange-600/50",
                  contact.status === "mid" && "bg-yellow-600/30 text-yellow-400 border border-yellow-600/50 hover:bg-yellow-600/50",
                  contact.status === "low" && "bg-neutral-700/50 text-neutral-400 border border-neutral-600 hover:bg-neutral-600"
                )}
                title="Click to edit priority"
              >
                {priorityLabel}
              </button>
              {renderStatusDropdown()}
            </div>
          ) : (
            <span
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium",
                contact.status === "high prio" && "bg-red-600/30 text-red-400 border border-red-600/50",
                contact.status === "prio" && "bg-orange-600/30 text-orange-400 border border-orange-600/50",
                contact.status === "mid" && "bg-yellow-600/30 text-yellow-400 border border-yellow-600/50",
                contact.status === "low" && "bg-neutral-700/50 text-neutral-400 border border-neutral-600"
              )}
            >
              {priorityLabel}
            </span>
          )}

          {/* Contact Status (ongoing/freezed) */}
          {contact.contact_status ? (
            onEditContactStatus ? (
              <div className="relative inline-block">
                <button
                  onClick={(e) => onEditContactStatus(contact.id, e)}
                  className="px-2 py-0.5 rounded text-[10px] bg-green-600/30 text-green-400 border border-green-600/50 hover:bg-green-600/50 cursor-pointer font-medium"
                  title="Click to edit status"
                >
                  {contact.contact_status === 'freezed' ? 'Freezed' : 'Ongoing'}
                </button>
                {renderContactStatusDropdown()}
              </div>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] bg-green-600/30 text-green-400 border border-green-600/50 font-medium">
                {contact.contact_status === 'freezed' ? 'Freezed' : 'Ongoing'}
              </span>
            )
          ) : onEditContactStatus ? (
            <div className="relative inline-block">
              <button
                onClick={(e) => onEditContactStatus(contact.id, e)}
                className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 font-medium"
                title="Click to add status"
              >
                + Status
              </button>
              {renderContactStatusDropdown()}
            </div>
          ) : null}

          {/* Delete button */}
          <button
            onClick={() => onDelete(contact.id)}
            className="px-2 py-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded transition-colors font-medium"
            title="Delete contact"
          >
            ×
          </button>
        </div>
      </div>

      {/* Metadata Row: Organization, Role, Sector, Location, Nationality, Website */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {/* Organization */}
        {organizations.length > 0 ? (
          onEditOrganization ? (
            <div className="relative inline-block">
              <button
                onClick={(e) => onEditOrganization(contact.id, e)}
                className="px-2 py-0.5 rounded text-[10px] bg-neutral-700/50 text-neutral-300 border border-neutral-600 hover:bg-neutral-600 cursor-pointer font-medium"
                title="Click to edit organization"
              >
                {organizations[0]}
              </button>
              {renderOrganizationDropdown()}
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-700/50 text-neutral-300 font-medium">
              {organizations[0]}
            </span>
          )
        ) : (
          <div className="relative inline-block">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onAddOrg) {
                  onAddOrg(contact.id);
                }
              }}
              className="px-2 py-0.5 text-[10px] bg-neutral-800 text-neutral-400 rounded hover:bg-neutral-700 border border-neutral-700"
            >
              + Org
            </button>
            {openDropdown === 'organization' && renderOrganizationDropdown()}
          </div>
        )}

        {/* Role */}
        {contact.role ? (
          onEditRole ? (
            <div className="relative inline-block">
              <button
                onClick={(e) => onEditRole(contact.id, e)}
                className="px-2 py-0.5 rounded text-[10px] bg-purple-600/30 text-purple-400 border border-purple-600/50 hover:bg-purple-600/50 cursor-pointer font-medium"
                title="Click to edit role"
              >
                {contact.role}
              </button>
              {renderRoleDropdown()}
              {addingRoleForContact === contact.id && setNewRoleNameInline && (
                <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-48">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newRoleNameInline}
                      onChange={(e) => setNewRoleNameInline(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && onAddNewRole) {
                          onAddNewRole(contact.id);
                        } else if (e.key === 'Escape') {
                          setNewRoleNameInline("");
                          if (onToggleDropdown) {
                            onToggleDropdown(contact.id, "role");
                          }
                        }
                      }}
                      className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                      placeholder="Role name"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (onAddNewRole) {
                          onAddNewRole(contact.id);
                        }
                      }}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setNewRoleNameInline("");
                        if (onToggleDropdown) {
                          onToggleDropdown(contact.id, "role");
                        }
                      }}
                      className="px-2 py-1 bg-neutral-700 text-white text-xs rounded hover:bg-neutral-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] bg-purple-600/30 text-purple-400 border border-purple-600/50 font-medium">
              {contact.role}
            </span>
          )
        ) : onEditRole ? (
          <div className="relative inline-block">
            <button
              onClick={(e) => onEditRole(contact.id, e)}
              className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 font-medium"
              title="Click to add role"
            >
              + Role
            </button>
            {renderRoleDropdown()}
          </div>
        ) : null}

        {/* Sector */}
        {contact.sector ? (
          onEditSector ? (
            <div className="relative inline-block">
              <button
                onClick={(e) => onEditSector(contact.id, e)}
                className="px-2 py-0.5 rounded text-[10px] bg-blue-600/30 text-blue-400 border border-blue-600/50 hover:bg-blue-600/50 cursor-pointer font-medium"
                title="Click to edit sector"
              >
                {contact.sector}
              </button>
              {renderSectorDropdown()}
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] bg-blue-600/30 text-blue-400 border border-blue-600/50 font-medium">
              {contact.sector}
            </span>
          )
        ) : onEditSector ? (
          <div className="relative inline-block">
            <button
              onClick={(e) => onEditSector(contact.id, e)}
              className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 font-medium"
              title="Click to add sector"
            >
              + Sector
            </button>
            {renderSectorDropdown()}
          </div>
        ) : onAddSector ? (
          <button
            onClick={() => onAddSector(contact.id)}
            className="px-2 py-0.5 text-[10px] bg-neutral-800 text-neutral-400 rounded hover:bg-neutral-700 border border-neutral-700"
          >
            + Sector
          </button>
        ) : null}

        {/* Location */}
        {contact.location ? (
          onEditLocation ? (
            <div className="relative inline-block">
              <button
                onClick={(e) => onEditLocation(contact.id, e)}
                className="px-2 py-0.5 rounded text-[10px] bg-green-600/30 text-green-400 border border-green-600/50 hover:bg-green-600/50 cursor-pointer font-medium"
                title="Click to edit location"
              >
                {contact.location}
              </button>
              {renderLocationDropdown()}
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] bg-green-600/30 text-green-400 border border-green-600/50 font-medium">
              {contact.location}
            </span>
          )
        ) : onEditLocation ? (
          <div className="relative inline-block">
            <button
              onClick={(e) => onEditLocation(contact.id, e)}
              className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 font-medium"
              title="Click to add location"
            >
              + Location
            </button>
            {renderLocationDropdown()}
          </div>
        ) : null}

        {/* Nationality */}
        {contact.nationality ? (
          onEditNationality ? (
            <div className="relative inline-block">
              <button
                onClick={(e) => onEditNationality(contact.id, e)}
                className="px-2 py-0.5 rounded text-[10px] bg-cyan-600/30 text-cyan-400 border border-cyan-600/50 hover:bg-cyan-600/50 cursor-pointer font-medium"
                title="Click to edit nationality"
              >
                {contact.nationality}
              </button>
              {renderNationalityDropdown()}
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-600/30 text-cyan-400 border border-cyan-600/50 font-medium">
              {contact.nationality}
            </span>
          )
        ) : onEditNationality ? (
          <div className="relative inline-block">
            <button
              onClick={(e) => onEditNationality(contact.id, e)}
              className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 font-medium"
              title="Click to add nationality"
            >
              + Nationality
            </button>
            {renderNationalityDropdown()}
          </div>
        ) : null}

        {/* Website */}
        {contact.website ? (
          onEditWebsite ? (
            <div className="relative inline-block">
              <a
                href={contact.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  onEditWebsite(contact.id, e);
                }}
                className="px-2 py-0.5 rounded text-[10px] bg-neutral-700/50 text-neutral-300 border border-neutral-600 hover:bg-neutral-600 cursor-pointer font-medium inline-flex items-center gap-1"
                title={`${contact.website} - Click to edit`}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </a>
              {renderWebsiteInput()}
            </div>
          ) : (
            <a
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-0.5 rounded text-[10px] bg-neutral-700/50 text-neutral-300 border border-neutral-600 hover:bg-neutral-600 font-medium inline-flex items-center gap-1"
              title={contact.website}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </a>
          )
        ) : onEditWebsite ? (
          <div className="relative inline-block">
            <button
              onClick={(e) => onEditWebsite(contact.id, e)}
              className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 font-medium"
              title="Click to add website"
            >
              + Website
            </button>
            {renderWebsiteInput()}
          </div>
        ) : onAddWebsite ? (
          <button
            onClick={() => onAddWebsite(contact.id)}
            className="px-2 py-0.5 text-[10px] bg-neutral-800 text-neutral-400 rounded hover:bg-neutral-700 border border-neutral-700"
            title="Add website"
          >
            + Website
          </button>
        ) : null}

        {/* Categories */}
        <div className="relative inline-block">
          {editData.categories && editData.categories.length > 0 ? (
            editData.categories.map((category) => (
              onAddCategory ? (
                <button
                  key={category}
                  onClick={(e) => onAddCategory(contact.id, e)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] border font-medium cursor-pointer mr-1.5",
                    getCategoryColor(category)
                  )}
                  title="Click to edit categories"
                >
                  {category}
                </button>
              ) : (
                <span
                  key={category}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] border font-medium mr-1.5",
                    getCategoryColor(category)
                  )}
                >
                  {category}
                </span>
              )
            ))
          ) : contact.categories && contact.categories.length > 0 ? (
            contact.categories.map((category) => (
              onAddCategory ? (
                <button
                  key={category}
                  onClick={(e) => onAddCategory(contact.id, e)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] border font-medium cursor-pointer mr-1.5",
                    getCategoryColor(category)
                  )}
                  title="Click to edit categories"
                >
                  {category}
                </button>
              ) : (
                <span
                  key={category}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] border font-medium mr-1.5",
                    getCategoryColor(category)
                  )}
                >
                  {category}
                </span>
              )
            ))
          ) : onAddCategory ? (
            <button
              onClick={(e) => onAddCategory(contact.id, e)}
              className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 font-medium"
              title="Click to add category"
            >
              + Category
            </button>
          ) : null}
          {renderCategoryDropdown()}
        </div>
      </div>

      {/* Tasks and Projects Row - Inline tags */}
      {(contact.tasks && contact.tasks.length > 0) || (contact.projects && contact.projects.length > 0) ? (
        <div className="flex items-center gap-1.5 flex-wrap mb-2 pt-1.5 border-t border-neutral-800/50">
          {/* Tasks */}
          {contact.tasks && contact.tasks.length > 0 && contact.tasks.map((task) => (
            <span
              key={task.id}
              className="px-2 py-0.5 rounded text-[10px] bg-blue-600/30 text-blue-400 border border-blue-600/50 font-medium"
            >
              {task.text}
            </span>
          ))}
          
          {/* Projects */}
          {contact.projects && contact.projects.length > 0 && projects && projects.map((project) => {
            if (contact.projects?.includes(project.id)) {
              return (
                <span
                  key={project.id}
                  className="px-2 py-0.5 rounded text-[10px] bg-purple-600/30 text-purple-400 border border-purple-600/50 font-medium"
                >
                  {project.name || 'Unnamed Project'}
                </span>
              );
            }
            return null;
          })}
        </div>
      ) : null}

      {/* Actions Row: Add Tasks, Projects, Docs */}
      <div className="flex items-center gap-3 pt-1.5 border-t border-neutral-800/50">
        {/* Tasks */}
        <button
          onClick={() => onAddTask(contact.id)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-colors"
        >
          <span className="text-neutral-400 font-medium">Tasks</span>
          {tasksCount > 0 ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-600/30 text-blue-400 border border-blue-600/50 font-semibold">
              {tasksCount}
            </span>
          ) : (
            <span className="text-neutral-500">Add</span>
          )}
        </button>

        {/* Projects */}
        {onEditProject && projectsCount > 0 && editData.projectText === undefined ? (
          <div className="relative inline-block">
            <button
              onClick={(e) => onEditProject(contact.id, '', e)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-colors"
            >
              <span className="text-neutral-400 font-medium">Projects</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-600/30 text-blue-400 border border-blue-600/50 font-semibold">
                {projectsCount}
              </span>
            </button>
            {renderProjectDropdown()}
          </div>
        ) : (
          <button
            onClick={() => onAddProject(contact.id)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-colors"
          >
            <span className="text-neutral-400 font-medium">Projects</span>
            {projectsCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-600/30 text-blue-400 border border-blue-600/50 font-semibold">
                {projectsCount}
              </span>
            ) : (
              <span className="text-neutral-500">Add</span>
            )}
          </button>
        )}

        {/* Docs */}
        {onToggleDropdown ? (
          <div className="relative inline-block">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleDropdown(contact.id, showDocsDropdown ? undefined : "documents");
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-colors"
            >
              <span className="text-neutral-400 font-medium">Docs</span>
              {hasNoDocs ? (
                <span className="text-neutral-500 text-[9px]">None</span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-600/30 text-green-400 border border-green-600/50 font-semibold">
                  {docsCount}
                </span>
              )}
            </button>
            {renderDocumentsDropdown()}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-neutral-800/50 border border-neutral-700/50">
            <span className="text-neutral-400 font-medium">Docs</span>
            {hasNoDocs ? (
              <span className="text-neutral-500 text-[9px]">None</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-600/30 text-green-400 border border-green-600/50 font-semibold">
                {docsCount}
              </span>
            )}
          </div>
        )}

        {/* Notes */}
        {onEditNote ? (
          <div className="relative inline-block">
            <button
              onClick={(e) => onEditNote(contact.id, e)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-colors"
              title={contact.notes_updated_at ? `Updated: ${format(new Date(contact.notes_updated_at), 'PPp')}` : undefined}
            >
              <span className="text-neutral-400 font-medium">Notes</span>
              {hasNotes ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-yellow-600/30 text-yellow-400 border border-yellow-600/50 font-semibold">
                  ✓
                </span>
              ) : (
                <span className="text-neutral-500">Add</span>
              )}
            </button>
            {renderNotesInput()}
          </div>
        ) : onAddNote ? (
          <button
            onClick={() => onAddNote(contact.id)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-colors"
            title={contact.notes_updated_at ? `Updated: ${format(new Date(contact.notes_updated_at), 'PPp')}` : undefined}
          >
            <span className="text-neutral-400 font-medium">Notes</span>
            {hasNotes ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-yellow-600/30 text-yellow-400 border border-yellow-600/50 font-semibold">
                ✓
              </span>
            ) : (
              <span className="text-neutral-500">Add</span>
            )}
          </button>
        ) : null}
      </div>

      {/* Task Input Form - Integrated in card */}
      {editData.taskText !== undefined && onAddTaskInline && onUpdateField && (
        <div className="mt-2 pt-2 border-t border-neutral-800/50">
          <div className="flex gap-2">
            <input
              type="text"
              value={editData.taskText || ""}
              onChange={(e) => {
                onUpdateField(contact.id, "taskText", e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editData.taskText?.trim()) {
                  onAddTaskInline(contact.id);
                } else if (e.key === 'Escape') {
                  onUpdateField(contact.id, "taskText", undefined);
                }
              }}
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neutral-600"
              placeholder="Task text"
              autoFocus
            />
            <button
              onClick={() => onAddTaskInline(contact.id)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => {
                onUpdateField(contact.id, "taskText", undefined);
              }}
              className="px-3 py-1.5 bg-neutral-700 text-white text-xs rounded hover:bg-neutral-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project Input Form - Integrated in card */}
      {editData.projectText !== undefined && onAddProjectInline && onUpdateField && (
        <div className="mt-2 pt-2 border-t border-neutral-800/50">
          <div className="flex gap-2">
            <input
              type="text"
              value={editData.projectText || ""}
              onChange={(e) => {
                onUpdateField(contact.id, "projectText", e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editData.projectText?.trim()) {
                  onAddProjectInline(contact.id);
                } else if (e.key === 'Escape') {
                  onUpdateField(contact.id, "projectText", undefined);
                }
              }}
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neutral-600"
              placeholder="Project name"
              autoFocus
            />
            <button
              onClick={() => onAddProjectInline(contact.id)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => {
                onUpdateField(contact.id, "projectText", undefined);
              }}
              className="px-3 py-1.5 bg-neutral-700 text-white text-xs rounded hover:bg-neutral-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Files from Email Section */}
      {contact.email && (
        <EmailFilesSection contactEmail={contact.email} contactId={contact.id} />
      )}
    </div>
  );
}

// Component for a single email file row with actions
function EmailFileRow({ 
  file, 
  userEmail, 
  contactId,
  onSaveSuccess,
  isInDatabase = false
}: { 
  file: any; 
  userEmail: string | null; 
  contactId: string;
  onSaveSuccess?: () => void;
  isInDatabase?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'cost' | 'revenue' | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState('PLN');
  const [invoiceMonth, setInvoiceMonth] = useState('');
  const [invoiceYear, setInvoiceYear] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxType, setTaxType] = useState<'CIT' | 'VAT' | null>(null);
  const [taxAmount, setTaxAmount] = useState('');
  const [taxCurrency, setTaxCurrency] = useState('PLN');
  const [taxMonth, setTaxMonth] = useState('');
  const [taxYear, setTaxYear] = useState('');
  const [savingTax, setSavingTax] = useState(false);

  const handleDownload = async () => {
    if (!userEmail || !file.attachmentId) return;
    setDownloading(true);
    try {
      const url = `/api/gmail/download-attachment?messageId=${encodeURIComponent(file.emailMessageId)}&attachmentId=${encodeURIComponent(file.attachmentId)}&userEmail=${encodeURIComponent(userEmail)}`;
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        alert('Failed to download file');
      }
    } catch (err) {
      console.error('Error downloading:', err);
      alert('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!userEmail || !file.attachmentId) return;
    setSaving(true);
    try {
      const response = await fetch('/api/gmail/save-attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: file.emailMessageId,
          attachmentId: file.attachmentId,
          userEmail: userEmail,
          contactId: contactId,
          fileName: file.fileName,
          mimeType: file.mimeType,
        }),
      });
      if (response.ok) {
        if (onSaveSuccess) {
          onSaveSuccess();
        }
        window.dispatchEvent(new Event('documents-updated'));
      } else {
        const error = await response.json();
        alert('Failed to save: ' + (error.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error saving:', err);
      alert('Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenInvoiceModal = (type: 'cost' | 'revenue') => {
    setInvoiceType(type);
    setInvoiceAmount('');
    setInvoiceCurrency('PLN');
    
    // Automatically set month and year to one month before email date
    if (file.emailDate) {
      const emailDate = new Date(file.emailDate);
      const oneMonthAgo = new Date(emailDate);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      setInvoiceMonth(String(oneMonthAgo.getMonth() + 1).padStart(2, '0'));
      setInvoiceYear(String(oneMonthAgo.getFullYear()));
    } else {
      // If no email date, use current date minus one month
      const now = new Date();
      now.setMonth(now.getMonth() - 1);
      setInvoiceMonth(String(now.getMonth() + 1).padStart(2, '0'));
      setInvoiceYear(String(now.getFullYear()));
    }
    
    setShowInvoiceModal(true);
  };

  const handleOpenTaxModal = (type: 'CIT' | 'VAT') => {
    setTaxType(type);
    setTaxAmount('');
    setTaxCurrency('PLN');
    
    // Automatically set month and year to one month before email date
    if (file.emailDate) {
      const emailDate = new Date(file.emailDate);
      const oneMonthAgo = new Date(emailDate);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      setTaxMonth(String(oneMonthAgo.getMonth() + 1).padStart(2, '0'));
      setTaxYear(String(oneMonthAgo.getFullYear()));
    } else {
      // If no email date, use current date minus one month
      const now = new Date();
      now.setMonth(now.getMonth() - 1);
      setTaxMonth(String(now.getMonth() + 1).padStart(2, '0'));
      setTaxYear(String(now.getFullYear()));
    }
    
    setShowTaxModal(true);
  };

  const handleSaveInvoice = async () => {
    if (!userEmail || !file.attachmentId || !invoiceType || !invoiceAmount || !invoiceCurrency || !invoiceMonth || !invoiceYear) {
      alert('Please fill in all invoice fields');
      return;
    }

    const amount = parseFloat(invoiceAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setSavingInvoice(true);
    try {
      // Use the selected month and year to create invoice date (first day of the month)
      const invoiceDate = `${invoiceYear}-${invoiceMonth}-01`;

      const response = await fetch('/api/gmail/save-attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: file.emailMessageId,
          attachmentId: file.attachmentId,
          userEmail: userEmail,
          contactId: contactId,
          fileName: file.fileName,
          mimeType: file.mimeType,
          invoiceType: invoiceType,
          amountOriginal: amount,
          currency: invoiceCurrency,
          invoiceDate: invoiceDate,
          invoiceYear: parseInt(invoiceYear),
          invoiceMonth: parseInt(invoiceMonth),
          emailSubject: file.emailSubject || file.fileName,
          emailDate: file.emailDate,
        }),
      });
      if (response.ok) {
        setShowInvoiceModal(false);
        setInvoiceType(null);
        setInvoiceAmount('');
        setInvoiceCurrency('PLN');
        setInvoiceMonth('');
        setInvoiceYear('');
        if (onSaveSuccess) {
          onSaveSuccess();
        }
        window.dispatchEvent(new Event('documents-updated'));
      } else {
        const error = await response.json();
        alert('Failed to save invoice: ' + (error.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      alert('Failed to save invoice');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleSaveTax = async () => {
    if (!userEmail || !file.attachmentId || !taxType || !taxAmount || !taxCurrency || !taxMonth || !taxYear) {
      alert('Please fill in all tax fields');
      return;
    }

    const amount = parseFloat(taxAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setSavingTax(true);
    try {
      // Use the selected month and year to create tax date (first day of the month)
      const taxDate = `${taxYear}-${taxMonth}-01`;

      const response = await fetch('/api/gmail/save-attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: file.emailMessageId,
          attachmentId: file.attachmentId,
          userEmail: userEmail,
          contactId: contactId,
          fileName: file.fileName,
          mimeType: file.mimeType,
          taxType: taxType,
          amountOriginal: amount,
          currency: taxCurrency,
          invoiceDate: taxDate,
          invoiceYear: parseInt(taxYear),
          invoiceMonth: parseInt(taxMonth),
          emailSubject: file.emailSubject || file.fileName,
          emailDate: file.emailDate,
        }),
      });
      if (response.ok) {
        setShowTaxModal(false);
        setTaxType(null);
        setTaxAmount('');
        setTaxCurrency('PLN');
        setTaxMonth('');
        setTaxYear('');
        if (onSaveSuccess) {
          onSaveSuccess();
        }
        window.dispatchEvent(new Event('documents-updated'));
      } else {
        const error = await response.json();
        alert('Failed to save tax: ' + (error.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error saving tax:', err);
      alert('Failed to save tax');
    } finally {
      setSavingTax(false);
    }
  };

  const isPdf = file.mimeType?.toLowerCase().includes('pdf');

  return (
    <>
      <tr className="border-b border-neutral-800/30 hover:bg-neutral-800/30">
        <td className="py-0.5 px-1.5 min-w-[250px] align-middle">
          <div className="flex gap-1 flex-nowrap items-center">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-2 py-0.5 text-[9px] bg-blue-600/30 text-blue-400 border border-blue-600/50 rounded hover:bg-blue-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
              title="See the file"
            >
              {downloading ? '...' : 'See'}
            </button>
            {isInDatabase ? (
              <span className="px-2 py-0.5 text-[9px] bg-green-600/30 text-green-400 border border-green-600/50 rounded font-medium whitespace-nowrap flex-shrink-0">
                ✓ DB
              </span>
            ) : (
              <>
                <button
                  onClick={handleSaveToDatabase}
                  disabled={saving || !file.attachmentId}
                  className="px-2 py-0.5 text-[9px] bg-green-600/30 text-green-400 border border-green-600/50 rounded hover:bg-green-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium whitespace-nowrap flex-shrink-0"
                  title="Add as Document"
                >
                  {saving ? '...' : 'Add'}
                </button>
              {isPdf && (
                <>
                  <button
                    onClick={() => handleOpenInvoiceModal('cost')}
                    disabled={savingInvoice || savingTax || !file.attachmentId}
                    className="px-2 py-0.5 text-[9px] bg-red-600/30 text-red-400 border border-red-600/50 rounded hover:bg-red-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                    title="Add as Cost Invoice"
                  >
                    Cost
                  </button>
                  <button
                    onClick={() => handleOpenInvoiceModal('revenue')}
                    disabled={savingInvoice || savingTax || !file.attachmentId}
                    className="px-2 py-0.5 text-[9px] bg-green-600/30 text-green-400 border border-green-600/50 rounded hover:bg-green-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                    title="Add as Revenue Invoice"
                  >
                    Rev
                  </button>
                  <button
                    onClick={() => handleOpenTaxModal('CIT')}
                    disabled={savingInvoice || savingTax || !file.attachmentId}
                    className="px-2 py-0.5 text-[9px] bg-purple-600/30 text-purple-400 border border-purple-600/50 rounded hover:bg-purple-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                    title="Add as CIT Tax"
                  >
                    CIT
                  </button>
                  <button
                    onClick={() => handleOpenTaxModal('VAT')}
                    disabled={savingInvoice || savingTax || !file.attachmentId}
                    className="px-2 py-0.5 text-[9px] bg-orange-600/30 text-orange-400 border border-orange-600/50 rounded hover:bg-orange-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                    title="Add as VAT Tax"
                  >
                    VAT
                  </button>
                </>
              )}
              </>
            )}
          </div>
        </td>
        <td className="py-0.5 px-1.5 text-neutral-300 text-[10px] w-[75px] align-middle">
          {file.emailDate ? format(new Date(file.emailDate), 'dd.MM.yy') : '-'}
        </td>
        <td className="py-0.5 px-1.5 w-[55px] align-middle">
          <span className={`px-1 py-0.5 rounded text-[9px] font-medium inline-block ${
            file.direction === 'sent' 
              ? 'bg-blue-600/30 text-blue-400 border border-blue-600/50' 
              : 'bg-green-600/30 text-green-400 border border-green-600/50'
          }`}>
            {file.direction === 'sent' ? 'S' : 'R'}
          </span>
        </td>
        <td className="py-0.5 px-1.5 text-neutral-400 text-[10px] min-w-[180px] truncate align-middle" title={file.emailSubject}>
          {file.emailSubject || '-'}
        </td>
        <td className="py-0.5 px-1.5 text-neutral-300 text-[10px] min-w-[220px] align-middle" title={file.fileName}>
          <div className="flex items-center gap-1.5">
            <span className="truncate">{file.fileName}</span>
            {isInDatabase && (
              <span className="text-[9px] text-green-400 font-bold flex-shrink-0" title="Already in database">
                ✓
              </span>
            )}
          </div>
        </td>
      </tr>
      {/* Invoice Modal */}
      {showInvoiceModal && invoiceType && (
        <tr>
          <td colSpan={5} className="p-4 bg-neutral-900/80 border border-neutral-800">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-white">
                  Create {invoiceType === 'cost' ? 'Cost' : 'Revenue'} Invoice
                </h4>
                <button
                  onClick={() => {
                    setShowInvoiceModal(false);
                    setInvoiceType(null);
                  }}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-1">Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-1">Currency *</label>
                    <select
                      value={invoiceCurrency}
                      onChange={(e) => setInvoiceCurrency(e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
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
                    <label className="block text-[10px] text-neutral-400 mb-1">Month *</label>
                    <select
                      value={invoiceMonth}
                      onChange={(e) => setInvoiceMonth(e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
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
                    <label className="block text-[10px] text-neutral-400 mb-1">Year *</label>
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      value={invoiceYear}
                      onChange={(e) => setInvoiceYear(e.target.value)}
                      placeholder="YYYY"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                    />
                  </div>
                </div>
                <div>
                  <button
                    onClick={handleSaveInvoice}
                    disabled={savingInvoice || !invoiceAmount || !invoiceCurrency || !invoiceMonth || !invoiceYear}
                    className="w-full px-3 py-1.5 bg-white text-black rounded text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingInvoice ? 'Saving...' : 'Create Invoice'}
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-neutral-500">
                Document name: {file.emailSubject || file.fileName}
                {file.emailDate && ` • Date: ${format(new Date(file.emailDate), 'dd.MM.yyyy')}`}
              </div>
            </div>
          </td>
        </tr>
      )}
      {/* Tax Modal */}
      {showTaxModal && taxType && (
        <tr>
          <td colSpan={5} className="p-4 bg-neutral-900/80 border border-neutral-800">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-white">
                  Create {taxType} Tax
                </h4>
                <button
                  onClick={() => {
                    setShowTaxModal(false);
                    setTaxType(null);
                  }}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-1">Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-1">Currency *</label>
                    <select
                      value={taxCurrency}
                      onChange={(e) => setTaxCurrency(e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
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
                    <label className="block text-[10px] text-neutral-400 mb-1">Month *</label>
                    <select
                      value={taxMonth}
                      onChange={(e) => setTaxMonth(e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
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
                    <label className="block text-[10px] text-neutral-400 mb-1">Year *</label>
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      value={taxYear}
                      onChange={(e) => setTaxYear(e.target.value)}
                      placeholder="YYYY"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-500"
                    />
                  </div>
                </div>
                <div>
                  <button
                    onClick={handleSaveTax}
                    disabled={savingTax || !taxAmount || !taxCurrency || !taxMonth || !taxYear}
                    className="w-full px-3 py-1.5 bg-white text-black rounded text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingTax ? 'Saving...' : 'Create Tax'}
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-neutral-500">
                Document name: {file.emailSubject || file.fileName}
                {file.emailDate && ` • Date: ${format(new Date(file.emailDate), 'dd.MM.yyyy')}`}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Component to display email files for a contact
function EmailFilesSection({ contactEmail, contactId }: { contactEmail: string; contactId: string }) {
  // Get user email from localStorage or prompt user
  // For now, we'll use a simple approach - user needs to set their email
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gmail_user_email');
    }
    return null;
  });
  const [showToast, setShowToast] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const { files, loading, error, isConnected, connectGmail, refreshConnection, fetchFiles } = useContactFiles(contactEmail, userEmail);

  // Load documents to check which files are already in database
  useEffect(() => {
    async function loadDocuments() {
      if (!contactId) return;
      setLoadingDocuments(true);
      try {
        const docs = await documentsDb.getDocumentsByContact(contactId);
        setDocuments(docs);
      } catch (err) {
        console.error('Error loading documents:', err);
        setDocuments([]);
      } finally {
        setLoadingDocuments(false);
      }
    }
    loadDocuments();
    
    // Reload when documents are updated
    const handleDocumentsUpdated = () => loadDocuments();
    window.addEventListener('documents-updated', handleDocumentsUpdated);
    return () => window.removeEventListener('documents-updated', handleDocumentsUpdated);
  }, [contactId]);

  // If no user email set, show input to set it
  if (!userEmail) {
    return (
      <div className="mt-3 pt-3 border-t border-neutral-800/50">
        <div className="text-[10px] font-medium text-neutral-400 mb-2">Files from email</div>
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">Enter your Gmail address to connect:</p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="your-email@gmail.com"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  const email = input.value.trim();
                  if (email) {
                    localStorage.setItem('gmail_user_email', email);
                    setUserEmail(email);
                  }
                }
              }}
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neutral-600"
            />
            <button
              onClick={() => {
                const input = document.querySelector('input[type="email"]') as HTMLInputElement;
                const email = input?.value.trim();
                if (email) {
                  localStorage.setItem('gmail_user_email', email);
                  setUserEmail(email);
                }
              }}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              Set
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-neutral-800/50">
        <div className="text-[10px] font-medium text-neutral-400 mb-2">Files from email</div>
        <div className="text-xs text-neutral-500">Loading files...</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="mt-3 pt-3 border-t border-neutral-800/50">
        <div className="text-[10px] font-medium text-neutral-400 mb-2">Files from email</div>
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">
            {userEmail ? `Gmail not connected for ${userEmail}.` : 'Gmail not connected. Please connect your Gmail account first.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={connectGmail}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              Connect Gmail
            </button>
            <button
              onClick={fetchFiles}
              disabled={loading}
              className="px-3 py-1.5 bg-neutral-700 text-white text-xs rounded hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    // Show friendly message for authentication errors
    const isAuthError = error.includes('not connected') || error.includes('authentication');
    return (
      <div className="mt-3 pt-3 border-t border-neutral-800/50">
        <div className="text-[10px] font-medium text-neutral-400 mb-2">Files from email</div>
        {isAuthError ? (
          <div className="space-y-2">
            <p className="text-xs text-neutral-500">{error}</p>
            <button
              onClick={connectGmail}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              Reconnect Gmail
            </button>
          </div>
        ) : (
          <div className="text-xs text-red-400">Error: {error}</div>
        )}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-neutral-800/50">
        <div className="text-[10px] font-medium text-neutral-400 mb-2">Files from email</div>
        <div className="text-xs text-neutral-500">No files found</div>
      </div>
    );
  }

  // Count files already in database
  const filesInDatabase = files.filter(file => 
    documents.some(doc => doc.source_gmail_attachment_id === file.attachmentId)
  ).length;

  return (
    <div className="mt-3 pt-3 border-t border-neutral-800/50">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-[slideIn_0.3s_ease-out]">
          <div className="bg-green-600/95 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-xl border border-green-500/50 flex items-center gap-2 min-w-[250px]">
            <svg className="w-5 h-5 text-green-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">Dodano do bazy</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-[10px] font-medium text-neutral-400 hover:text-neutral-300 transition-colors"
        >
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span>Files from email ({files.length})</span>
          {filesInDatabase > 0 && (
            <span className="text-green-400">• {filesInDatabase} in database</span>
          )}
        </button>
        <button
          onClick={fetchFiles}
          disabled={loading || !isConnected}
          className="px-2 py-1 bg-neutral-700 text-white text-[10px] rounded hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh files from Gmail"
        >
          {loading ? '⏳' : '🔄'}
        </button>
      </div>
      {isExpanded && (
        <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-800/50">
              <th className="text-left py-0.5 px-1.5 text-[10px] font-semibold text-neutral-400 min-w-[250px]">Actions</th>
              <th className="text-left py-0.5 px-1.5 text-[10px] font-semibold text-neutral-400 w-[75px]">Date</th>
              <th className="text-left py-0.5 px-1.5 text-[10px] font-semibold text-neutral-400 w-[55px]">Dir</th>
              <th className="text-left py-0.5 px-1.5 text-[10px] font-semibold text-neutral-400 min-w-[180px]">Subject</th>
              <th className="text-left py-0.5 px-1.5 text-[10px] font-semibold text-neutral-400 min-w-[220px]">File</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const isInDatabase = documents.some(doc => doc.source_gmail_attachment_id === file.attachmentId);
              return (
                <EmailFileRow 
                  key={file.id} 
                  file={file} 
                  userEmail={userEmail} 
                  contactId={contactId}
                  isInDatabase={isInDatabase}
                  onSaveSuccess={() => {
                    setShowToast(true);
                    setTimeout(() => setShowToast(false), 3000);
                    // Reload documents
                    documentsDb.getDocumentsByContact(contactId).then(docs => setDocuments(docs));
                  }}
                />
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
