"use client";

import { useState, useEffect, useRef } from "react";
import * as canvasDb from "../../lib/db/business-model-canvas";
import type { PlatformObject, PlatformObjectType } from "../../lib/db/business-model-canvas";
import { useOrganisations, type Organisation } from "../hooks/useSharedLists";
import * as contactsDb from "../../lib/db/contacts";
import * as documentsDb from "../../lib/db/documents";
import type { Contact } from "../../lib/db/contacts";
import type { Document } from "../../lib/db/documents";

const PROJECT_NAME = "Middle Bridge 2.0";

interface CanvasData {
  customer_segments: string;
  customer_segments_org_ids?: string[]; // Legacy
  customer_segments_objects?: PlatformObject[];
  value_propositions: string;
  channels: string;
  channels_org_ids?: string[]; // Legacy
  channels_objects?: PlatformObject[];
  customer_relationships: string;
  customer_relationships_org_ids?: string[]; // Legacy
  customer_relationships_objects?: PlatformObject[];
  revenue_streams: string;
  revenue_streams_org_ids?: string[]; // Legacy
  revenue_streams_objects?: PlatformObject[];
  key_resources: string;
  key_resources_org_ids?: string[]; // Legacy
  key_resources_objects?: PlatformObject[];
  key_activities: string;
  key_activities_org_ids?: string[]; // Legacy
  key_activities_objects?: PlatformObject[];
  key_partnerships: string;
  key_partnerships_org_ids?: string[]; // Legacy
  key_partnerships_objects?: PlatformObject[];
  cost_structure: string;
  cost_structure_org_ids?: string[]; // Legacy
  cost_structure_objects?: PlatformObject[];
}

interface PlatformObjectMultiSelectProps {
  selectedObjects: PlatformObject[];
  onChange: (objects: PlatformObject[]) => void;
  placeholder?: string;
  filterByType?: PlatformObjectType[];
  filterByCategory?: string[];
}

function PlatformObjectMultiSelect({ 
  selectedObjects, 
  onChange, 
  placeholder = "Select objects...",
  filterByType,
  filterByCategory
}: PlatformObjectMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PlatformObjectType>('contact');
  const selectRef = useRef<HTMLDivElement>(null);
  
  const { organisations } = useOrganisations();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Array<{id: string, text: string, contactId: string, contactName: string}>>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    const [contactsData, documentsData] = await Promise.all([
      contactsDb.getContacts(),
      documentsDb.getDocuments(),
    ]);
    
    setContacts(contactsData);
    setDocuments(documentsData);
    
    // Extract tasks from contacts
    const allTasks: Array<{id: string, text: string, contactId: string, contactName: string}> = [];
    contactsData.forEach(contact => {
      if (contact.tasks && Array.isArray(contact.tasks)) {
        contact.tasks.forEach(task => {
          allTasks.push({
            id: task.id,
            text: task.text,
            contactId: contact.id,
            contactName: contact.name,
          });
        });
      }
    });
    setTasks(allTasks);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getAvailableObjects = (): Array<{type: PlatformObjectType, id: string, name: string, category?: string}> => {
    const all: Array<{type: PlatformObjectType, id: string, name: string, category?: string}> = [];
    
    if (!filterByType || filterByType.includes('contact')) {
      let filteredContacts = contacts;
      if (filterByCategory) {
        filteredContacts = contacts.filter(c => 
          c.categories.some(cat => filterByCategory!.includes(cat))
        );
      }
      filteredContacts.forEach(contact => {
        if (!selectedObjects.some(obj => obj.type === 'contact' && obj.id === contact.id)) {
          all.push({ type: 'contact', id: contact.id, name: contact.name });
        }
      });
    }
    
    if (!filterByType || filterByType.includes('organisation')) {
      let filteredOrgs = organisations;
      if (filterByCategory) {
        filteredOrgs = organisations.filter(org => 
          org.categories.some(cat => filterByCategory!.includes(cat))
        );
      }
      filteredOrgs.forEach(org => {
        if (!selectedObjects.some(obj => obj.type === 'organisation' && obj.id === org.id)) {
          all.push({ type: 'organisation', id: org.id, name: org.name });
        }
      });
    }
    
    if (!filterByType || filterByType.includes('document')) {
      documents.forEach(doc => {
        if (!selectedObjects.some(obj => obj.type === 'document' && obj.id === doc.id)) {
          all.push({ type: 'document', id: doc.id, name: doc.name });
        }
      });
    }
    
    if (!filterByType || filterByType.includes('task')) {
      tasks.forEach(task => {
        if (!selectedObjects.some(obj => obj.type === 'task' && obj.id === task.id)) {
          all.push({ type: 'task', id: task.id, name: task.text });
        }
      });
    }
    
    return all;
  };

  const toggleObject = (type: PlatformObjectType, id: string, name: string) => {
    const existing = selectedObjects.find(obj => obj.type === type && obj.id === id);
    if (existing) {
      onChange(selectedObjects.filter(obj => !(obj.type === type && obj.id === id)));
    } else {
      onChange([...selectedObjects, { type, id, name }]);
    }
  };

  const getObjectsByType = (type: PlatformObjectType) => {
    return getAvailableObjects().filter(obj => obj.type === type);
  };

  const getTypeLabel = (type: PlatformObjectType): string => {
    const labels = {
      contact: 'Contacts',
      organisation: 'Organisations',
      document: 'Documents',
      task: 'Tasks',
    };
    return labels[type];
  };

  const getTypeIcon = (type: PlatformObjectType): string => {
    const icons = {
      contact: '👤',
      organisation: '🏢',
      document: '📄',
      task: '✓',
    };
    return icons[type];
  };

  const availableObjects = getAvailableObjects();
  const objectsByActiveTab = getObjectsByType(activeTab);

  return (
    <div className="relative" ref={selectRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[80px] rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 cursor-pointer hover:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
      >
        {selectedObjects.length === 0 ? (
          <span className="text-zinc-500">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedObjects.map((obj, idx) => (
              <span
                key={`${obj.type}-${obj.id}-${idx}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-200 rounded text-[10px]"
              >
                <span className="text-[8px]">{getTypeIcon(obj.type)}</span>
                <span>{obj.name || obj.id}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedObjects.filter((o, i) => i !== idx));
                  }}
                  className="hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-20 w-full mt-1 rounded-md border border-zinc-800 bg-zinc-900 shadow-lg">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            {(['contact', 'organisation', 'document', 'task'] as PlatformObjectType[]).map(type => {
              const count = getObjectsByType(type).length;
              if (count === 0 && !selectedObjects.some(obj => obj.type === type)) return null;
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`flex-1 px-2 py-1.5 text-[10px] text-center border-b-2 transition-colors ${
                    activeTab === type
                      ? 'border-zinc-400 text-zinc-200 bg-zinc-800'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {getTypeIcon(type)} {getTypeLabel(type)} ({count + selectedObjects.filter(o => o.type === type).length})
                </button>
              );
            })}
          </div>

          {/* Selected objects in this tab */}
          {selectedObjects.filter(obj => obj.type === activeTab).length > 0 && (
            <div className="px-2 py-1 border-b border-zinc-800">
              <div className="text-[10px] text-zinc-500 mb-1">Selected:</div>
              <div className="flex flex-wrap gap-1">
                {selectedObjects.filter(obj => obj.type === activeTab).map((obj, idx) => (
                  <span
                    key={`selected-${obj.type}-${obj.id}-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-700 text-zinc-200 rounded text-[10px]"
                  >
                    {obj.name || obj.id}
                    <button
                      onClick={() => onChange(selectedObjects.filter((o, i) => 
                        !(o.type === obj.type && o.id === obj.id)
                      ))}
                      className="hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Available objects list */}
          <div className="max-h-48 overflow-y-auto">
            {objectsByActiveTab.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">No {getTypeLabel(activeTab).toLowerCase()} available</div>
            ) : (
              <div className="py-1">
                {objectsByActiveTab.map(obj => (
                  <button
                    key={`${obj.type}-${obj.id}`}
                    onClick={() => toggleObject(obj.type, obj.id, obj.name)}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span>{getTypeIcon(obj.type)}</span>
                      <span>{obj.name}</span>
                    </span>
                    {obj.category && (
                      <span className="text-[10px] text-zinc-500">{obj.category}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Legacy component kept for backward compatibility
interface OrganisationMultiSelectProps {
  organisations: Organisation[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

function OrganisationMultiSelect({ organisations, selectedIds, onChange, placeholder }: OrganisationMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOrgs = organisations.filter(org => selectedIds.includes(org.id));
  const availableOrgs = organisations.filter(org => !selectedIds.includes(org.id));

  const toggleOrg = (orgId: string) => {
    if (selectedIds.includes(orgId)) {
      onChange(selectedIds.filter(id => id !== orgId));
    } else {
      onChange([...selectedIds, orgId]);
    }
  };

  return (
    <div className="relative" ref={selectRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[80px] rounded-md border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 cursor-pointer hover:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
      >
        {selectedOrgs.length === 0 ? (
          <span className="text-zinc-500">{placeholder || "Select organisations..."}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedOrgs.map(org => (
              <span
                key={org.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-200 rounded text-[10px]"
              >
                {org.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOrg(org.id);
                  }}
                  className="hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 shadow-lg">
          {availableOrgs.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">No more organisations available</div>
          ) : (
            <div className="py-1">
              {availableOrgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => toggleOrg(org.id)}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 flex items-center justify-between"
                >
                  <span>{org.name}</span>
                  {org.categories.length > 0 && (
                    <span className="text-[10px] text-zinc-500">
                      {org.categories.join(", ")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BusinessModelCanvas() {
  const [data, setData] = useState<CanvasData>({
    customer_segments: "",
    customer_segments_objects: [],
    value_propositions: "",
    channels: "",
    channels_objects: [],
    customer_relationships: "",
    customer_relationships_objects: [],
    revenue_streams: "",
    revenue_streams_objects: [],
    key_resources: "",
    key_resources_objects: [],
    key_activities: "",
    key_activities_objects: [],
    key_partnerships: "",
    key_partnerships_objects: [],
    cost_structure: "",
    cost_structure_objects: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadCanvas();
  }, []);

  const loadCanvas = async () => {
    try {
      setLoading(true);
      const canvas = await canvasDb.getBusinessModelCanvas(PROJECT_NAME);
      if (canvas) {
        // Migrate from old org_ids format to new objects format if needed
        const migrateObjects = (orgIds?: string[], objects?: PlatformObject[]): PlatformObject[] => {
          if (objects && objects.length > 0) return objects;
          if (orgIds && orgIds.length > 0) {
            return orgIds.map(id => ({ type: 'organisation' as PlatformObjectType, id }));
          }
          return [];
        };

        setData({
          customer_segments: canvas.customer_segments || "",
          customer_segments_objects: migrateObjects(canvas.customer_segments_org_ids, canvas.customer_segments_objects),
          value_propositions: canvas.value_propositions || "",
          channels: canvas.channels || "",
          channels_objects: migrateObjects(canvas.channels_org_ids, canvas.channels_objects),
          customer_relationships: canvas.customer_relationships || "",
          customer_relationships_objects: migrateObjects(canvas.customer_relationships_org_ids, canvas.customer_relationships_objects),
          revenue_streams: canvas.revenue_streams || "",
          revenue_streams_objects: migrateObjects(canvas.revenue_streams_org_ids, canvas.revenue_streams_objects),
          key_resources: canvas.key_resources || "",
          key_resources_objects: migrateObjects(canvas.key_resources_org_ids, canvas.key_resources_objects),
          key_activities: canvas.key_activities || "",
          key_activities_objects: migrateObjects(canvas.key_activities_org_ids, canvas.key_activities_objects),
          key_partnerships: canvas.key_partnerships || "",
          key_partnerships_objects: migrateObjects(canvas.key_partnerships_org_ids, canvas.key_partnerships_objects),
          cost_structure: canvas.cost_structure || "",
          cost_structure_objects: migrateObjects(canvas.cost_structure_org_ids, canvas.cost_structure_objects),
        });
        if (canvas.updated_at) {
          setLastSaved(new Date(canvas.updated_at));
        }
      }
    } catch (error) {
      console.error("Error loading canvas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (dataToSave?: CanvasData) => {
    try {
      setSaving(true);
      const result = await canvasDb.createOrUpdateBusinessModelCanvas({
        project_name: PROJECT_NAME,
        ...(dataToSave || data),
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error("Error saving canvas:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Failed to save: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CanvasData, value: string) => {
    const newData = { ...data, [field]: value };
    setData(newData);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Auto-save after 2 seconds of no changes
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(newData);
    }, 2000);
  };

  const handleObjectsChange = (field: keyof CanvasData, objects: PlatformObject[]) => {
    const objectsField = `${field}_objects` as keyof CanvasData;
    const newData = { ...data, [objectsField]: objects };
    setData(newData);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Auto-save after 2 seconds of no changes
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(newData);
    }, 2000);
  };

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading canvas...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold">Business Model Canvas</h1>
          <p className="text-xs text-zinc-500">{PROJECT_NAME}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-zinc-500">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="px-4 py-2 bg-white text-black rounded text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div
        className="
          mt-3 grid gap-3
          grid-cols-1
          xl:grid-cols-4
          auto-rows-[minmax(120px,auto)]
        "
      >
        {/* LEFT – INFRASTRUCTURE */}
        <div className="xl:row-span-2">
          <CanvasCard title="Key Partnerships">
            <PlatformObjectMultiSelect
              selectedObjects={data.key_partnerships_objects || []}
              onChange={(objects) => handleObjectsChange("key_partnerships", objects)}
              placeholder="Select partners..."
              filterByCategory={["Partner"]}
            />
          </CanvasCard>
        </div>

        <div className="xl:row-span-2">
          <CanvasCard title="Key Activities">
            <PlatformObjectMultiSelect
              selectedObjects={data.key_activities_objects || []}
              onChange={(objects) => handleObjectsChange("key_activities", objects)}
              placeholder="Select objects..."
            />
          </CanvasCard>
        </div>

        {/* CENTER – VALUE PROPOSITION (BIG) */}
        <div className="xl:col-span-2 xl:row-span-3">
          <CanvasCard title="Value Propositions">
            <textarea
              value={data.value_propositions}
              onChange={(e) => handleChange("value_propositions", e.target.value)}
              placeholder="Enter value propositions..."
              className="w-full h-[80px] resize-y rounded-md border border-zinc-800 bg-black/40 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </CanvasCard>
        </div>

        {/* LEFT LOWER – RESOURCES */}
        <div className="">
          <CanvasCard title="Key Resources">
            <PlatformObjectMultiSelect
              selectedObjects={data.key_resources_objects || []}
              onChange={(objects) => handleObjectsChange("key_resources", objects)}
              placeholder="Select objects..."
            />
          </CanvasCard>
        </div>

        {/* RIGHT – CUSTOMER SIDE */}
        <div className="">
          <CanvasCard title="Customer Relationships">
            <PlatformObjectMultiSelect
              selectedObjects={data.customer_relationships_objects || []}
              onChange={(objects) => handleObjectsChange("customer_relationships", objects)}
              placeholder="Select clients/prospects..."
              filterByCategory={["Client", "Prospect"]}
            />
          </CanvasCard>
        </div>

        <div className="">
          <CanvasCard title="Channels">
            <PlatformObjectMultiSelect
              selectedObjects={data.channels_objects || []}
              onChange={(objects) => handleObjectsChange("channels", objects)}
              placeholder="Select objects..."
            />
          </CanvasCard>
        </div>

        <div className="">
          <CanvasCard title="Customer Segments">
            <PlatformObjectMultiSelect
              selectedObjects={data.customer_segments_objects || []}
              onChange={(objects) => handleObjectsChange("customer_segments", objects)}
              placeholder="Select clients/prospects..."
              filterByCategory={["Client", "Prospect"]}
            />
          </CanvasCard>
        </div>

        {/* BOTTOM – FINANCIALS */}
        <div className="xl:col-span-2">
          <CanvasCard title="Cost Structure">
            <PlatformObjectMultiSelect
              selectedObjects={data.cost_structure_objects || []}
              onChange={(objects) => handleObjectsChange("cost_structure", objects)}
              placeholder="Select objects..."
            />
          </CanvasCard>
        </div>

        <div className="xl:col-span-2">
          <CanvasCard title="Revenue Streams">
            <PlatformObjectMultiSelect
              selectedObjects={data.revenue_streams_objects || []}
              onChange={(objects) => handleObjectsChange("revenue_streams", objects)}
              placeholder="Select clients/prospects..."
              filterByCategory={["Client", "Prospect"]}
            />
          </CanvasCard>
        </div>
      </div>
    </div>
  );
}

type CanvasCardProps = {
  title: string;
  className?: string;
  children?: React.ReactNode;
};

function CanvasCard({ title, className, children }: CanvasCardProps) {
  return (
    <section
      className={[
        "rounded-lg border border-zinc-800 bg-zinc-950/80",
        "px-3 py-2",
        "text-xs",
        "flex flex-col gap-2",
        "min-h-[120px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="font-semibold tracking-wide text-zinc-300">
        {title.toUpperCase()}
      </header>
      <div className="text-[11px] text-zinc-500 flex-1">
        {children}
      </div>
    </section>
  );
}

