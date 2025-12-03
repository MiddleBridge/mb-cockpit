"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useOrganisations, useCategories } from "../hooks/useSharedLists";
import * as projectsDb from "../../lib/db/projects";
import * as documentsDb from "../../lib/db/documents";
import * as contactsDb from "../../lib/db/contacts";
import type { Project, ProjectType } from "../../lib/db/projects";
import type { Document } from "../../lib/db/documents";
import type { Contact } from "../../lib/db/contacts";

export default function ProjectsView() {
  const searchParams = useSearchParams();
  const segment = searchParams.get("segment");
  
  // Determine project type from segment
  const projectType: ProjectType = segment === "Projects Internal" ? "internal" : "mb-2.0";
  
  const { organisations } = useOrganisations();
  const { categories, addCategory } = useCategories();
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDocumentForProject, setAddingDocumentForProject] = useState<string | null>(null);
  const [documentFormData, setDocumentFormData] = useState({
    name: "",
    file_url: "",
    file_type: "",
    notes: "",
    google_docs_url: "",
  });
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "ongoing" as Project["status"],
    priority: "mid" as Project["priority"],
    organisation_id: "",
    selectedCategories: [] as string[],
    notes: "",
    project_type: "internal" as Project["project_type"],
  });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();

    const handleProjectUpdate = () => {
      loadProjects();
    };
    window.addEventListener('projects-updated', handleProjectUpdate);

    return () => {
      window.removeEventListener('projects-updated', handleProjectUpdate);
    };
  }, [projectType]); // Reload when project type changes

  const loadProjects = async () => {
    try {
      setLoading(true);
      const [projectsData, documentsData, contactsData] = await Promise.all([
        projectsDb.getProjects(),
        documentsDb.getDocuments(),
        contactsDb.getContacts(),
      ]);
      setProjects(projectsData);
      setDocuments(documentsData);
      setContacts(contactsData);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDocumentToProject = async (projectId: string) => {
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

    const project = projects.find(p => p.id === projectId);
    
    const newDocument = {
      name: documentFormData.name,
      file_url: documentFormData.file_url,
      file_type: documentFormData.file_type || undefined,
      contact_id: undefined,
      organisation_id: project?.organisation_id,
      notes: documentFormData.notes || undefined,
      google_docs_url: documentFormData.google_docs_url || undefined,
      project_id: projectId,
      task_id: undefined,
    };

    const result = await documentsDb.createDocument(newDocument);
    if (result) {
      await loadProjects();
      setAddingDocumentForProject(null);
      setDocumentFormData({ name: "", file_url: "", file_type: "", notes: "", google_docs_url: "" });
      window.dispatchEvent(new Event('documents-updated'));
    } else {
      alert("Failed to create document. Please try again.");
    }
  };

  // Filter projects based on project type from URL
  const filteredProjects = projects.filter(project => project.project_type === projectType);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("Project name is required");
      return;
    }

    try {
      const projectData = {
        name: formData.name.trim(),
        title: formData.name.trim(),
        description: formData.description.trim() || undefined,
        status: formData.status,
        priority: formData.priority,
        organisation_id: formData.organisation_id || undefined,
        categories: formData.selectedCategories,
        notes: formData.notes.trim() || undefined,
        project_type: formData.project_type,
      };

      let result;
      if (editingProject) {
        result = await projectsDb.updateProject(editingProject, projectData);
      } else {
        result = await projectsDb.createProject(projectData);
      }

      if (!result) {
        alert("Failed to save project. Check console for details.");
        return;
      }

      setIsAdding(false);
      setEditingProject(null);
      setFormData({
        name: "",
        description: "",
        status: "ongoing",
        priority: "mid",
        organisation_id: "",
        selectedCategories: [],
        notes: "",
        project_type: projectType,
      });
      loadProjects();
      window.dispatchEvent(new Event('projects-updated'));
    } catch (error) {
      console.error("Error saving project:", error);
      alert("Failed to save project: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) {
      return;
    }

    try {
      await projectsDb.deleteProject(id);
      loadProjects();
      window.dispatchEvent(new Event('projects-updated'));
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project");
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project.id);
    setFormData({
      name: project.name || project.title || "",
      description: project.description || "",
      status: project.status || "ongoing",
      priority: project.priority || "mid",
      organisation_id: project.organisation_id || "",
      selectedCategories: project.categories || [],
      notes: project.notes || "",
      project_type: project.project_type || projectType,
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingProject(null);
    setFormData({
      name: "",
      description: "",
      status: "ongoing",
      priority: "mid",
      organisation_id: "",
      selectedCategories: [],
      notes: "",
      project_type: projectType,
    });
  };

  const handleCategoryToggle = (category: string) => {
    setFormData({
      ...formData,
      selectedCategories: formData.selectedCategories.includes(category)
        ? formData.selectedCategories.filter((c) => c !== category)
        : [...formData.selectedCategories, category],
    });
  };

  const handleAddNewCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim());
      setNewCategoryName("");
      setShowAddCategory(false);
    }
  };

  const getStatusStyles = (status: Project["status"]) => {
    switch (status) {
      case "ongoing":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "done":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "on-hold":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-neutral-700 text-neutral-400 border-neutral-600";
    }
  };

  const getPriorityStyles = (priority: Project["priority"]) => {
    switch (priority) {
      case "high prio":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "prio":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "mid":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "low":
        return "bg-neutral-700 text-neutral-400 border-neutral-600";
      default:
        return "bg-neutral-700 text-neutral-400 border-neutral-600";
    }
  };

  if (loading) {
    return <div className="text-neutral-400 text-sm">Loading projects...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Projects</h3>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingProject(null);
            setFormData({
              name: "",
              description: "",
              status: "ongoing",
              priority: "mid",
              organisation_id: "",
              selectedCategories: [],
              notes: "",
              project_type: projectType,
            });
          }}
          className="px-3 py-1.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-100 transition-colors"
        >
          + Dodaj projekt
        </button>
      </div>


      {isAdding && (
        <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900 space-y-3">
          {editingProject && (
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Project ID</label>
              <input
                type="text"
                value={editingProject}
                disabled
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-500 font-mono cursor-not-allowed"
                readOnly
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Nazwa projektu *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nazwa projektu"
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              autoFocus={!editingProject}
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Opis</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Opis projektu..."
              rows={3}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Project["status"] })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
              >
                <option value="ongoing">Ongoing</option>
                <option value="done">Done</option>
                <option value="failed">Failed</option>
                <option value="on-hold">On Hold</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as Project["priority"] })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
              >
                <option value="low">Low</option>
                <option value="mid">Mid</option>
                <option value="prio">Prio</option>
                <option value="high prio">High Prio</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Project Type *</label>
              <select
                value={formData.project_type}
                onChange={(e) => setFormData({ ...formData, project_type: e.target.value as Project["project_type"] })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
              >
                <option value="internal">Internal</option>
                <option value="mb-2.0">MB 2.0</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Organisation</label>
              <select
                value={formData.organisation_id}
                onChange={(e) => setFormData({ ...formData, organisation_id: e.target.value })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
              >
                <option value="">Select organisation...</option>
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
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
                  className="px-3 py-1 bg-neutral-700 text-white rounded text-sm hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewCategoryName("");
                  }}
                  className="px-3 py-1 border border-neutral-700 rounded text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCategory(true)}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                + Add category
              </button>
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
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSubmit}
              disabled={!formData.name.trim()}
              className="flex-1 px-4 py-2 bg-white text-black rounded text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {editingProject ? "Update" : "Save"}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-neutral-700 rounded text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {filteredProjects.length === 0 && !isAdding ? (
        <div className="text-center py-8 text-neutral-400 text-sm">
          No {projectType === 'mb-2.0' ? 'MB 2.0' : 'internal'} projects yet. Click "+ Dodaj projekt" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="border border-neutral-800 rounded-lg p-4 bg-neutral-900 hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-white">{project.name}</h4>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded border ${
                        project.project_type === 'mb-2.0' 
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                          : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      }`}
                    >
                      {project.project_type === 'mb-2.0' ? 'MB 2.0' : 'Internal'}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusStyles(project.status)}`}
                    >
                      {project.status}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded border ${getPriorityStyles(project.priority)}`}
                    >
                      {project.priority}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-sm text-neutral-400 mb-2">{project.description}</p>
                  )}
                  {project.organisation_id && (
                    <p className="text-xs text-neutral-500 mb-1">
                      Organisation: {organisations.find((o) => o.id === project.organisation_id)?.name || "Unknown"}
                    </p>
                  )}
                  {project.categories && project.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {project.categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 bg-neutral-800 text-neutral-300 text-xs rounded"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Linked Contacts */}
                  {(() => {
                    const linkedContacts = contacts.filter(c => c.projects?.includes(project.id));
                    if (linkedContacts.length > 0) {
                      return (
                        <div className="mt-3 pt-3 border-t border-neutral-800">
                          <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold block mb-2">
                            Linked Contacts ({linkedContacts.length})
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {linkedContacts.map((contact) => (
                              <a
                                key={contact.id}
                                href={`/?dimension=Relationships&segment=Contacts`}
                                className="px-2 py-1 bg-neutral-800 text-blue-400 hover:text-blue-300 text-xs rounded hover:bg-neutral-700 transition-colors"
                              >
                                {contact.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Linked Tasks */}
                  {(() => {
                    const linkedTasks: Array<{task: any, contact: Contact}> = [];
                    contacts.forEach(contact => {
                      if (contact.tasks && Array.isArray(contact.tasks)) {
                        contact.tasks.forEach(task => {
                          // Check if task has doc_url that might be related to project
                          // Or we could add project_id to tasks in the future
                          // For now, show tasks from linked contacts
                          if (contact.projects?.includes(project.id)) {
                            linkedTasks.push({ task, contact });
                          }
                        });
                      }
                    });
                    
                    if (linkedTasks.length > 0) {
                      return (
                        <div className="mt-3 pt-3 border-t border-neutral-800">
                          <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold block mb-2">
                            Related Tasks ({linkedTasks.length})
                          </label>
                          <div className="space-y-1">
                            {linkedTasks.slice(0, 5).map(({ task, contact }) => (
                              <div key={`${contact.id}-${task.id}`} className="bg-neutral-800/50 p-2 rounded">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white font-medium">{task.text}</p>
                                    <p className="text-[10px] text-neutral-400 mt-0.5">From: {contact.name}</p>
                                  </div>
                                  <a
                                    href={`/?dimension=Relationships&segment=Contacts`}
                                    className="text-[10px] text-blue-400 hover:text-blue-300"
                                  >
                                    View →
                                  </a>
                                </div>
                              </div>
                            ))}
                            {linkedTasks.length > 5 && (
                              <p className="text-xs text-neutral-500 italic">+{linkedTasks.length - 5} more tasks</p>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Linked Documents */}
                  <div className="mt-3 pt-3 border-t border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-neutral-500 uppercase tracking-wide font-semibold">
                        Linked Documents
                      </label>
                      {addingDocumentForProject === project.id ? (
                        <button
                          onClick={() => {
                            setAddingDocumentForProject(null);
                            setDocumentFormData({ name: "", file_url: "", file_type: "", notes: "", google_docs_url: "" });
                          }}
                          className="text-xs text-neutral-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => setAddingDocumentForProject(project.id)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          + Add Document
                        </button>
                      )}
                    </div>
                    
                    {addingDocumentForProject === project.id && (
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
                          onClick={() => handleAddDocumentToProject(project.id)}
                          disabled={!documentFormData.name.trim() || !documentFormData.file_url.trim()}
                          className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Document
                        </button>
                      </div>
                    )}
                    
                    {(() => {
                      const linkedDocs = documents.filter(doc => doc.project_id === project.id);
                      
                      if (linkedDocs.length === 0 && !addingDocumentForProject) {
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
                                      href={doc.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-2 underline"
                                    >
                                      <span>{doc.name}</span>
                                    </a>
                                    <p className="text-xs text-neutral-500 mt-1 break-all">{doc.file_url}</p>
                                    {doc.google_docs_url && (
                                      <div className="mt-2">
                                        <a
                                          href={doc.google_docs_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-green-400 hover:text-green-300 inline-flex items-center gap-1 underline break-all"
                                        >
                                          <span>📝</span>
                                          <span>Google Docs: {doc.google_docs_url}</span>
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={async () => {
                                    if (confirm("Delete this document?")) {
                                      await documentsDb.deleteDocument(doc.id);
                                      await loadProjects();
                                      window.dispatchEvent(new Event('documents-updated'));
                                    }
                                  }}
                                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
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
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(project)}
                    className="px-3 py-1.5 text-xs bg-neutral-700 text-white rounded hover:bg-neutral-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

