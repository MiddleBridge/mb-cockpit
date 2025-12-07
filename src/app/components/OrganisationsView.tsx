"use client";

import { useState, useEffect } from "react";
import { useViewMode } from "../hooks/useViewMode";
import ViewModeToggle from "./ViewModeToggle";
import { useOrganisations, useCategories, useLocations, useSectors, useWebsites, type Organisation } from "../hooks/useSharedLists";
import * as contactsDb from "../../lib/db/contacts";
import * as documentsDb from "../../lib/db/documents";
import * as organisationsDb from "../../lib/db/organisations";
import * as projectsDb from "../../lib/db/projects";
import type { Document } from "../../lib/db/documents";
import type { Project } from "../../lib/db/projects";
import { getAvatarUrl } from "../../lib/avatar-utils";
import OrganisationContractsView from "./OrganisationContractsView";
import Timeline from "./Timeline";

export default function OrganisationsView() {
  const {
    organisations,
    addOrganisation,
    deleteOrganisation,
    updateOrganisationCategories,
    updateOrganisation,
  } = useOrganisations();
  const { categories } = useCategories();
  const { locations: locationsFromDb, addLocation, loading: locationsLoading } = useLocations();
  const { sectors, addSector } = useSectors();
  
  // Fallback to countries list if locations table is empty or doesn't exist
  const fallbackLocations = [
    "Dubai, UAE", "Abu Dhabi, UAE", "Sharjah, UAE",
    "London, UK", "Manchester, UK", "Birmingham, UK",
    "Warsaw, Poland", "Krakow, Poland", "Wroclaw, Poland", "Gdansk, Poland",
    "Berlin, Germany", "Munich, Germany", "Frankfurt, Germany", "Hamburg, Germany",
    "Paris, France", "Lyon, France", "Marseille, France",
    "New York, USA", "Los Angeles, USA", "San Francisco, USA", "Chicago, USA", "Boston, USA",
    "Singapore", "Hong Kong", "Tokyo, Japan", "Osaka, Japan",
    "Sydney, Australia", "Melbourne, Australia",
    "Toronto, Canada", "Vancouver, Canada",
    "Amsterdam, Netherlands", "Rotterdam, Netherlands",
    "Stockholm, Sweden", "Copenhagen, Denmark", "Oslo, Norway",
    "Zurich, Switzerland", "Geneva, Switzerland",
    "Barcelona, Spain", "Madrid, Spain",
    "Milan, Italy", "Rome, Italy",
    "Vienna, Austria", "Prague, Czech Republic",
    "Brussels, Belgium", "Luxembourg",
    "Dublin, Ireland",
    "Tel Aviv, Israel", "Riyadh, Saudi Arabia", "Doha, Qatar", "Kuwait City, Kuwait",
    "Mumbai, India", "Delhi, India", "Bangalore, India",
    "Shanghai, China", "Beijing, China",
    "Seoul, South Korea",
    "Bangkok, Thailand", "Jakarta, Indonesia", "Manila, Philippines",
    "São Paulo, Brazil", "Mexico City, Mexico", "Buenos Aires, Argentina"
  ];
  
  const locations = locationsFromDb.length > 0 ? locationsFromDb : fallbackLocations;

  const [newOrgName, setNewOrgName] = useState("");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgStatus, setEditOrgStatus] = useState<
    "ongoing" | "freezed" | "lost" | "active_but_ceased"
  >("ongoing");
  const [editOrgPriority, setEditOrgPriority] = useState<
    "low" | "mid" | "prio" | "high prio"
  >("mid");
  const [editOrgCategories, setEditOrgCategories] = useState<string[]>([]);
  const [editOrgLocation, setEditOrgLocation] = useState("");
  const [editOrgWebsite, setEditOrgWebsite] = useState("");
  const [editOrgSector, setEditOrgSector] = useState("");
  const [newLocationInput, setNewLocationInput] = useState("");
  const [newSectorInput, setNewSectorInput] = useState("");
  const [addingContactToOrg, setAddingContactToOrg] = useState<string | null>(null);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [allContacts, setAllContacts] = useState<contactsDb.Contact[]>([]);

  const [orgDocuments, setOrgDocuments] = useState<Record<string, Document[]>>({});
  const [orgContacts, setOrgContacts] = useState<Record<string, contactsDb.Contact[]>>({});
  const [orgProjects, setOrgProjects] = useState<Record<string, Project[]>>({});
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [inheritingFromContacts, setInheritingFromContacts] = useState<string | null>(null);
  const [selectedOrgForContracts, setSelectedOrgForContracts] = useState<string | null>(null);

  const [viewMode, setViewMode] = useViewMode("organisations");

  // Split organisations into clients and others
  const clientOrgs = organisations.filter((o) => o.categories.includes("Client"));
  const otherOrgs = organisations.filter((o) => !o.categories.includes("Client"));

  useEffect(() => {
    if (organisations.length > 0) {
      loadDocuments();
      loadContacts();
      loadProjects();
    }
  }, [organisations]);

  useEffect(() => {
    const handleDocumentUpdate = () => {
      loadDocuments();
    };
    window.addEventListener("documents-updated", handleDocumentUpdate);
    return () => {
      window.removeEventListener("documents-updated", handleDocumentUpdate);
    };
  }, [organisations]);

  useEffect(() => {
    const handleContactUpdate = () => {
      loadContacts();
    };
    window.addEventListener("contacts-updated", handleContactUpdate);
    return () => {
      window.removeEventListener("contacts-updated", handleContactUpdate);
    };
  }, [organisations]);

  useEffect(() => {
    const handleProjectUpdate = () => {
      loadProjects();
    };
    window.addEventListener("projects-updated", handleProjectUpdate);
    return () => {
      window.removeEventListener("projects-updated", handleProjectUpdate);
    };
  }, [organisations]);

  const loadDocuments = async () => {
    try {
      const allDocuments = await documentsDb.getDocuments();
      const documentsByOrg: Record<string, Document[]> = {};

      organisations.forEach((org) => {
        documentsByOrg[org.id] = allDocuments.filter(
          (doc) => doc.organisation_id === org.id
        );
      });

      setOrgDocuments(documentsByOrg);
    } catch (error) {
      console.error("Error loading documents:", error);
    }
  };

  const loadContacts = async () => {
    try {
      const contactsData = await contactsDb.getContacts();
      setAllContacts(contactsData);
      const contactsByOrg: Record<string, contactsDb.Contact[]> = {};

      organisations.forEach((org) => {
        contactsByOrg[org.id] = contactsData.filter(
          (contact) => contact.organization === org.name || 
          (contact.organizations && contact.organizations.includes(org.name))
        );
      });

      setOrgContacts(contactsByOrg);
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const loadProjects = async () => {
    try {
      const projectsData = await projectsDb.getProjects();
      setAllProjects(projectsData);
      
      const projectsByOrg: Record<string, Project[]> = {};

      organisations.forEach((org) => {
        // Filter projects where organisation_ids array contains this org id
        projectsByOrg[org.id] = projectsData.filter(
          (project) => 
            project.organisation_ids && 
            project.organisation_ids.length > 0 &&
            project.organisation_ids.includes(org.id)
        );
      });

      setOrgProjects(projectsByOrg);
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  };

  const handleAdd = () => {
    if (newOrgName.trim()) {
      addOrganisation(newOrgName.trim());
      setNewOrgName("");
      window.dispatchEvent(new Event("graph-data-updated"));
    }
  };

  const handleDelete = (orgId: string) => {
    deleteOrganisation(orgId);
    window.dispatchEvent(new Event("graph-data-updated"));
  };

  const handleEdit = (org: Organisation) => {
    setEditingOrgId(org.id);
    setEditOrgName(org.name);
    setEditOrgStatus(org.status ?? "ongoing");
    setEditOrgPriority(org.priority);
    setEditOrgCategories(org.categories);
    setEditOrgLocation(org.location || "");
    setEditOrgWebsite(org.website || "");
    setEditOrgSector(org.sector || "");
  };

  const handleCancelEdit = () => {
    setEditingOrgId(null);
    setEditOrgName("");
    setEditOrgStatus("ongoing");
    setEditOrgPriority("mid");
    setEditOrgCategories([]);
    setEditOrgLocation("");
    setEditOrgWebsite("");
    setEditOrgSector("");
    setNewLocationInput("");
    setNewSectorInput("");
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
      location: editOrgLocation.trim() || undefined,
      website: editOrgWebsite.trim() || undefined,
      sector: editOrgSector.trim() || undefined,
    });

    if (success) {
      handleCancelEdit();
      window.dispatchEvent(new Event("graph-data-updated"));
    } else {
      alert("Failed to update organization. The name may already exist.");
    }
  };

  const getStatusColor = (status?: string | null) => {
    if (!status)
      return "bg-neutral-700/50 text-neutral-400 border border-neutral-600";
    switch (status) {
      case "ongoing":
        return "bg-green-900/30 text-green-400";
      case "freezed":
        return "bg-blue-900/30 text-blue-400";
      case "lost":
        return "bg-red-900/30 text-red-400";
      case "active_but_ceased":
        return "bg-yellow-900/30 text-yellow-400";
      default:
        return "bg-neutral-700/50 text-neutral-400 border border-neutral-600";
    }
  };

  const formatStatus = (status?: string | null) => {
    if (!status) return "+ Status";
    if (status === "active_but_ceased") return "active but ceased";
    return status;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high prio":
        return "bg-red-900/30 text-red-400";
      case "prio":
        return "bg-orange-900/30 text-orange-400";
      case "mid":
        return "bg-yellow-900/30 text-yellow-400";
      case "low":
      default:
        return "bg-neutral-700 text-neutral-400";
    }
  };

  const handleInheritFromContacts = async (
    orgId: string,
    fields: ("website" | "location" | "sector" | "categories")[]
  ) => {
    const org = organisations.find((o) => o.id === orgId);
    if (!org) return;

    setInheritingFromContacts(orgId);
    try {
      const result = await organisationsDb.inheritPropertiesFromContacts(
        orgId,
        org.name,
        fields
      );
      if (result) {
        window.dispatchEvent(new Event("graph-data-updated"));
        window.dispatchEvent(new CustomEvent("organisations-updated"));
      }
    } catch (error) {
      console.error("Error inheriting properties:", error);
      alert("Failed to inherit properties from contacts");
    } finally {
      setInheritingFromContacts(null);
    }
  };

  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      Client: "bg-blue-600/30 text-blue-400 border-blue-600/50",
      Government: "bg-purple-600/30 text-purple-400 border-purple-600/50",
      Investor: "bg-green-600/30 text-green-400 border-green-600/50",
      "MB Team": "bg-orange-600/30 text-orange-400 border-orange-600/50",
      Partner: "bg-cyan-600/30 text-cyan-400 border-cyan-600/50",
      Prospect: "bg-yellow-600/30 text-yellow-400 border-yellow-600/50",
    };
    return (
      categoryColors[category] ||
      "bg-neutral-800 text-neutral-300 border-neutral-700"
    );
  };

  type ViewVariant = "compact" | "list" | "grid";

  const toggleOrgExpanded = (orgId: string) => {
    setExpandedOrgs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orgId)) {
        newSet.delete(orgId);
      } else {
        newSet.add(orgId);
      }
      return newSet;
    });
  };

  const renderOrgCard = (
    org: Organisation,
    variant: ViewVariant,
    isClientSection: boolean
  ) => {
    const isExpanded = expandedOrgs.has(org.id);
    const docCount = orgDocuments[org.id]?.length || 0;
    const contactCount = orgContacts[org.id]?.length || 0;
    const projectCount = orgProjects[org.id]?.length || 0;

    const wrapperBase =
      variant === "grid"
        ? "group border border-neutral-800 rounded p-2 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
        : variant === "list"
        ? "group border border-neutral-800 rounded px-2.5 py-2 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
        : "group border border-neutral-800 rounded px-2 py-1.5 bg-neutral-900/50 hover:bg-neutral-900 transition-colors";

    const nameTextSize =
      variant === "grid" ? "text-sm" : "text-sm";

    const statusPillSize =
      variant === "grid" ? "text-[9px] px-1 py-0.5" : "text-[10px] px-1.5 py-0.5";

    const showMoreCategories =
      variant === "compact" ? 2 : variant === "grid" ? 2 : 3;

    return (
      <div key={org.id} data-organisation-id={org.id} className={wrapperBase}>
        {editingOrgId === org.id ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editOrgName}
              onChange={(e) => setEditOrgName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editOrgName.trim()) {
                  void handleSaveEdit();
                }
              }}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-neutral-400 mb-0.5">
                  Status
                </label>
                <select
                  value={editOrgStatus}
                  onChange={(e) =>
                    setEditOrgStatus(e.target.value as typeof editOrgStatus)
                  }
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-[10px] text-white"
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="freezed">Freezed</option>
                  <option value="lost">Lost</option>
                  <option value="active_but_ceased">Active but ceased</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-neutral-400 mb-0.5">
                  Priority
                </label>
                <select
                  value={editOrgPriority}
                  onChange={(e) =>
                    setEditOrgPriority(
                      e.target.value as typeof editOrgPriority
                    )
                  }
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
              <label className="block text-[10px] text-neutral-400 mb-1">
                Categories
              </label>
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
                          setEditOrgCategories([
                            ...editOrgCategories,
                            category,
                          ]);
                        } else {
                          setEditOrgCategories(
                            editOrgCategories.filter((c) => c !== category)
                          );
                        }
                      }}
                      className="rounded w-2 h-2 accent-blue-600"
                    />
                    <span className="text-[10px] text-neutral-300">
                      {category}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-neutral-400 mb-0.5">
                Location
              </label>
              <div className="flex gap-1">
                <select
                  value={editOrgLocation}
                  onChange={(e) => setEditOrgLocation(e.target.value)}
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[10px] text-white"
                >
                  <option value="">Select location...</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newLocationInput}
                  onChange={(e) => setNewLocationInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && newLocationInput.trim()) {
                      await addLocation(newLocationInput.trim());
                      setEditOrgLocation(newLocationInput.trim());
                      setNewLocationInput("");
                    }
                  }}
                  placeholder="Add new..."
                  className="w-24 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[10px] text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-neutral-400 mb-0.5">
                Website
              </label>
              <input
                type="url"
                value={editOrgWebsite}
                onChange={(e) => setEditOrgWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[10px] text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-400 mb-0.5">
                Sector
              </label>
              <div className="flex gap-1">
                <select
                  value={editOrgSector}
                  onChange={(e) => setEditOrgSector(e.target.value)}
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[10px] text-white"
                >
                  <option value="">Select sector...</option>
                  {sectors.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newSectorInput}
                  onChange={(e) => setNewSectorInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && newSectorInput.trim()) {
                      await addSector(newSectorInput.trim());
                      setEditOrgSector(newSectorInput.trim());
                      setNewSectorInput("");
                    }
                  }}
                  placeholder="Add new..."
                  className="w-24 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[10px] text-white"
                />
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
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${nameTextSize} text-white truncate`}>
                  {org.name}
                </div>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <span
                    className={`${statusPillSize} rounded font-medium ${getStatusColor(
                      org.status
                    )}`}
                  >
                    {formatStatus(org.status)}
                  </span>
                  <span
                    className={`${statusPillSize} rounded font-medium ${getPriorityColor(
                      org.priority
                    )}`}
                  >
                    {org.priority}
                  </span>
                </div>
                {org.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {org.categories.slice(0, showMoreCategories).map((category) => (
                      <span
                        key={category}
                        className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] rounded"
                      >
                        {category}
                      </span>
                    ))}
                    {org.categories.length > showMoreCategories && (
                      <span className="text-[10px] text-neutral-500">
                        +{org.categories.length - showMoreCategories}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-2 space-y-1">
                  {(org.location || org.website || org.sector) && (
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-400">
                      {org.location && (
                        <span className="flex items-center gap-1">
                          <span>📍</span>
                          <span>{org.location}</span>
                        </span>
                      )}
                      {org.website && (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>🌐</span>
                          <span className="truncate max-w-[150px]">{org.website.replace(/^https?:\/\//, '')}</span>
                        </a>
                      )}
                      {org.sector && (
                        <span className="flex items-center gap-1">
                          <span>🏢</span>
                          <span>{org.sector}</span>
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    {contactCount > 0 && (
                      <span>👤 {contactCount} {contactCount === 1 ? 'contact' : 'contacts'}</span>
                    )}
                    {projectCount > 0 && (
                      <span>📋 {projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
                    )}
                    {docCount > 0 && (
                      <span>📄 {docCount} {docCount === 1 ? 'doc' : 'docs'}</span>
                    )}
                  </div>
                  <div className="mt-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddingContactToOrg(org.id);
                        if (!isExpanded) {
                          toggleOrgExpanded(org.id);
                        }
                      }}
                      className="text-[9px] px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 border border-blue-600/30"
                    >
                      + Add Contact
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {isClientSection && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrgForContracts(org.id);
                    }}
                    className="text-[10px] px-1.5 py-0.5 bg-cyan-900/20 text-cyan-400 rounded hover:bg-cyan-900/40"
                    title="Contracts & Terms"
                  >
                    📄
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(org);
                  }}
                  className="text-[10px] px-1.5 py-0.5 bg-blue-900/20 text-blue-400 rounded hover:bg-blue-900/40"
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(org.id);
                  }}
                  className="text-[10px] px-1.5 py-0.5 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>

            {isExpanded && (
              <div 
                className="mt-3 pt-3 border-t border-neutral-800 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOrgExpanded(org.id);
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOrgExpanded(org.id);
                  }}
                  className="text-[10px] text-neutral-400 hover:text-white mb-2"
                >
                  ▼ Collapse
                </button>
              </div>
            )}
            {isExpanded && (
              <div className="mt-2 pt-2 border-t border-neutral-800 space-y-2">
                {/* Actions */}
                <div className="mb-2 flex gap-2 flex-wrap">
                  {isClientSection && (
                    <button
                      onClick={() => setSelectedOrgForContracts(org.id)}
                      className="px-2 py-1 text-[10px] bg-purple-900/30 text-purple-400 border border-purple-600/50 rounded hover:bg-purple-900/50 transition-colors"
                      title="View Contracts & Terms"
                    >
                      📄 Contracts & Terms
                    </button>
                  )}
                  {contactCount > 0 && (
                    <button
                      onClick={() =>
                        handleInheritFromContacts(org.id, [
                          "website",
                          "location",
                          "sector",
                          "categories",
                        ])
                      }
                      disabled={inheritingFromContacts === org.id}
                      className="px-2 py-1 text-[10px] bg-cyan-900/30 text-cyan-400 border border-cyan-600/50 rounded hover:bg-cyan-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Inherit website, location, sector, and categories from contacts"
                    >
                      {inheritingFromContacts === org.id
                        ? "Inheriting..."
                        : "📥 Inherit from contacts"}
                    </button>
                  )}
                </div>

                {/* Website / location / sector */}
                {org.website && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-400">
                      Website:
                    </span>
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-400 hover:text-blue-300 truncate"
                      title={org.website}
                    >
                      {org.website}
                    </a>
                  </div>
                )}
                {org.location && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-400">
                      Location:
                    </span>
                    <span className="text-[10px] text-neutral-300">
                      {org.location}
                    </span>
                  </div>
                )}
                {org.sector && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-400">
                      Sector:
                    </span>
                    <span className="text-[10px] text-neutral-300">
                      {org.sector}
                    </span>
                  </div>
                )}

                {/* Categories full */}
                {org.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {org.categories.map((category) => (
                      <span
                        key={category}
                        className={`px-1.5 py-0.5 text-[10px] rounded border ${getCategoryColor(
                          category
                        )}`}
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                )}

                {/* Documents */}
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

                {/* Projects */}
                {orgProjects[org.id] && orgProjects[org.id].length > 0 && (
                  <div>
                    <div className="text-[10px] font-medium text-neutral-400 mb-1">
                      Projects ({orgProjects[org.id].length})
                    </div>
                    <div className="space-y-0.5">
                      {orgProjects[org.id].slice(0, 3).map((project) => (
                        <a
                          key={project.id}
                          href="/?dimension=Relationships&segment=Projects"
                          className="block text-xs text-blue-400 hover:text-blue-300 truncate"
                          title={project.name || project.title}
                        >
                          📋 {project.name || project.title}
                        </a>
                      ))}
                      {orgProjects[org.id].length > 3 && (
                        <div className="text-[10px] text-neutral-500">
                          +{orgProjects[org.id].length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Contacts */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-medium text-neutral-400">
                      Contacts ({orgContacts[org.id]?.length || 0})
                    </div>
                    {addingContactToOrg === org.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setAddingContactToOrg(null);
                            setNewContactName("");
                            setNewContactEmail("");
                          }}
                          className="text-[9px] px-1.5 py-0.5 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingContactToOrg(org.id)}
                        className="text-[9px] px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50"
                      >
                        + Add Contact
                      </button>
                    )}
                  </div>
                  {addingContactToOrg === org.id && (
                    <div className="mb-2 p-2 bg-neutral-800/50 rounded border border-neutral-700 space-y-2">
                      <div>
                        <label className="block text-[9px] text-neutral-400 mb-0.5">
                          Contact Name
                        </label>
                        <input
                          type="text"
                          value={newContactName}
                          onChange={(e) => setNewContactName(e.target.value)}
                          placeholder="Name"
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[10px] text-white"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-neutral-400 mb-0.5">
                          Email (optional)
                        </label>
                        <input
                          type="email"
                          value={newContactEmail}
                          onChange={(e) => setNewContactEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[10px] text-white"
                        />
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={async () => {
                            if (!newContactName.trim()) {
                              alert("Please enter a contact name");
                              return;
                            }
                            try {
                              const newContact = await contactsDb.createContact({
                                name: newContactName.trim(),
                                email: newContactEmail.trim() || undefined,
                                organization: org.name,
                                categories: [],
                                status: "mid",
                                tasks: [],
                              });
                              if (newContact) {
                                setNewContactName("");
                                setNewContactEmail("");
                                setAddingContactToOrg(null);
                                // Reload contacts to update the view
                                await loadContacts();
                                window.dispatchEvent(new Event("contacts-updated"));
                                window.dispatchEvent(new Event("graph-data-updated"));
                              }
                            } catch (error) {
                              console.error("Error creating contact:", error);
                              alert("Failed to create contact");
                            }
                          }}
                          className="flex-1 px-2 py-1 text-[9px] bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Create Contact
                        </button>
                        <button
                          onClick={() => {
                            // Add existing contact to organization
                            const availableContacts = allContacts.filter(
                              (c) => 
                                c.organization !== org.name && 
                                (!c.organizations || !c.organizations.includes(org.name))
                            );
                            if (availableContacts.length === 0) {
                              alert("No available contacts to add");
                              return;
                            }
                            const contactName = prompt(
                              `Enter contact name to add:\n\nAvailable: ${availableContacts.map(c => c.name).join(", ")}`
                            );
                            if (contactName) {
                              const contact = availableContacts.find(
                                (c) => c.name.toLowerCase() === contactName.toLowerCase()
                              );
                              if (contact) {
                                const currentOrgs = contact.organizations || [];
                                if (contact.organization) {
                                  currentOrgs.push(contact.organization);
                                }
                                if (!currentOrgs.includes(org.name)) {
                                  currentOrgs.push(org.name);
                                }
                                contactsDb.updateContact(contact.id, {
                                  organization: org.name,
                                  organizations: currentOrgs,
                                }).then(() => {
                                  loadContacts();
                                  window.dispatchEvent(new Event("contacts-updated"));
                                  window.dispatchEvent(new Event("graph-data-updated"));
                                });
                              } else {
                                alert("Contact not found");
                              }
                            }
                          }}
                          className="px-2 py-1 text-[9px] bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600"
                        >
                          Add Existing
                        </button>
                      </div>
                    </div>
                  )}
                  {orgContacts[org.id] && orgContacts[org.id].length > 0 && (
                    <div className="space-y-0.5">
                      {orgContacts[org.id].slice(0, 5).map((contact) => (
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
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-neutral-700 flex-shrink-0 flex items-center justify-center text-[8px] text-neutral-400">
                              {contact.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{contact.name}</span>
                          {contact.email && (
                            <span className="text-[10px] text-neutral-500 truncate">
                              • {contact.email}
                            </span>
                          )}
                        </div>
                      ))}
                      {orgContacts[org.id].length > 5 && (
                        <div className="text-[10px] text-neutral-500">
                          +{orgContacts[org.id].length - 5} more
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Relationship Timeline */}
                <div className="mt-4 pt-4 border-t border-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-white">
                      Relationship Timeline
                    </h3>
                  </div>
                  <Timeline organisationId={org.id} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderSection = (
    title: string | undefined,
    orgs: Organisation[],
    isClientSection: boolean
  ) => {
    if (orgs.length === 0) return null;

    const isGrid = viewMode === "grid";
    const wrapperClasses =
      title === "Clients"
        ? "border border-blue-600/30 rounded-lg p-3 bg-blue-950/20"
        : "";

    return (
      <div className="mb-6">
        {title && (
          <div className="mb-2 flex items-center gap-2">
            <h4 className="text-sm font-semibold text-white">{title}</h4>
            <span className="text-xs text-neutral-500">({orgs.length})</span>
          </div>
        )}
        <div className={wrapperClasses}>
          {isGrid ? (
            <div className="grid grid-cols-2 gap-2">
              {orgs.map((org) => renderOrgCard(org, "grid", isClientSection))}
            </div>
          ) : (
            <div className="space-y-1">
              {orgs.map((org) =>
                renderOrgCard(
                  org,
                  viewMode === "compact" ? "compact" : "list",
                  isClientSection
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const toggleExpandAll = () => {
    if (expandedOrgs.size === organisations.length && organisations.length > 0) {
      // Collapse all
      setExpandedOrgs(new Set());
    } else {
      // Expand all
      setExpandedOrgs(new Set(organisations.map(org => org.id)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Organisations</h3>
        <div className="flex items-center gap-2">
          {organisations.length > 0 && (
            <button
              onClick={toggleExpandAll}
              className="px-3 py-1.5 text-xs bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-colors border border-neutral-700"
            >
              {expandedOrgs.size === organisations.length ? "Collapse All" : "Expand All"}
            </button>
          )}
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </div>

      <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            onKeyDown={(e) => {
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

      {selectedOrgForContracts ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedOrgForContracts(null)}
            className="px-3 py-1.5 bg-neutral-800 text-white rounded text-sm hover:bg-neutral-700 transition-colors"
          >
            ← Back to Organisations
          </button>
          <OrganisationContractsView organisationId={selectedOrgForContracts} />
        </div>
      ) : organisations.length === 0 ? (
        <div className="text-center py-8 text-neutral-400 text-sm">
          No organisations yet. Add one above to get started.
        </div>
      ) : (
        <div>
          {renderSection("Clients", clientOrgs, true)}
          {renderSection(
            clientOrgs.length > 0 ? "All Organisations" : undefined,
            otherOrgs,
            false
          )}
        </div>
      )}
    </div>
  );
}
