"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { getAvatarUrl } from "../../lib/avatar-utils";

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
  const organizations = contact.organizations || (contact.organization ? [contact.organization] : []);
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
    return (
      <div ref={categoryDropdownRef} className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-48">
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                onToggleCategory(contact.id, category);
                onToggleDropdown(contact.id, "category");
              }}
              className={`px-2 py-1 text-xs rounded text-left ${
                editData.categories?.includes(category)
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
                className="font-semibold text-white hover:text-blue-400 hover:underline cursor-pointer text-sm"
                title="Click to edit name"
              >
                {contact.name}
              </button>
              {openDropdown === 'name' && onUpdateField && onToggleDropdown && (
                <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs shadow-lg w-64">
                  <input
                    type="text"
                    value={editData.name !== undefined ? editData.name : contact.name}
                    onChange={(e) => {
                      onUpdateField(contact.id, "name", e.target.value);
                    }}
                    onBlur={() => {
                      const newName = editData.name !== undefined ? editData.name : contact.name;
                      if (newName.trim() !== contact.name && newName.trim() !== '') {
                        onUpdateField(contact.id, "name", newName.trim());
                      } else {
                        onUpdateField(contact.id, "name", contact.name);
                      }
                      onToggleDropdown(contact.id, "name");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const newName = editData.name !== undefined ? editData.name : contact.name;
                        if (newName.trim() !== contact.name && newName.trim() !== '') {
                          onUpdateField(contact.id, "name", newName.trim());
                        } else {
                          onUpdateField(contact.id, "name", contact.name);
                        }
                        onToggleDropdown(contact.id, "name");
                      } else if (e.key === 'Escape') {
                        onUpdateField(contact.id, "name", contact.name);
                        onToggleDropdown(contact.id, "name");
                      }
                    }}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                    autoFocus
                  />
                </div>
              )}
            </div>
          ) : (
            <span className="font-semibold text-white text-sm">{contact.name}</span>
          )}
        </div>

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
          <button
            onClick={() => onAddOrg(contact.id)}
            className="px-2 py-0.5 text-[10px] bg-neutral-800 text-neutral-400 rounded hover:bg-neutral-700 border border-neutral-700"
          >
            + Org
          </button>
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
    </div>
  );
}
