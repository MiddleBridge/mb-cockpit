"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganisations, type Organisation } from "../hooks/useSharedLists";
import * as contactsDb from "../../lib/db/contacts";
import * as documentsDb from "../../lib/db/documents";
import * as projectsDb from "../../lib/db/projects";

interface SearchResult {
  type: "contact" | "organisation" | "document" | "project";
  id: string;
  name: string;
  subtitle?: string;
  metadata?: {
    projectType?: string;
    [key: string]: any;
  };
}

export default function SearchResults({ query, onResultClick }: { query: string; onResultClick?: () => void }) {
  const router = useRouter();
  const { organisations } = useOrganisations();
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const performSearch = async () => {
      const searchResults: SearchResult[] = [];
      const searchLower = query.toLowerCase();

      // Load all contacts once (used for contacts search and document search)
      let allContacts: Awaited<ReturnType<typeof contactsDb.getContacts>> = [];
      try {
        allContacts = await contactsDb.getContacts();
      } catch (e) {
        console.error("Error loading contacts:", e);
      }

      // Search contacts from Supabase
      allContacts.forEach((contact) => {
          if (
            contact.name.toLowerCase().includes(searchLower) ||
            contact.email?.toLowerCase().includes(searchLower) ||
            contact.organization?.toLowerCase().includes(searchLower) ||
            contact.notes?.toLowerCase().includes(searchLower) ||
            contact.categories.some((cat) =>
              cat.toLowerCase().includes(searchLower)
            )
          ) {
            searchResults.push({
              type: "contact",
              id: contact.id,
              name: `${contact.name} (${contact.organization || "No organization"})`,
              subtitle: contact.email,
            });
          }
        });

      // Search organisations
      organisations.forEach((org: Organisation) => {
        if (
          org.name.toLowerCase().includes(searchLower) ||
          org.categories.some((cat) =>
            cat.toLowerCase().includes(searchLower)
          )
        ) {
          searchResults.push({
            type: "organisation",
            id: org.id,
            name: org.name,
            subtitle: org.categories.length > 0 ? org.categories.join(", ") : undefined,
          });
        }
      });

      // Search documents
      try {
        const documents = await documentsDb.getDocuments();
        documents.forEach((doc) => {
          const docLower = doc.name?.toLowerCase() || "";
          const notesLower = doc.notes?.toLowerCase() || "";
          const fileTypeLower = doc.file_type?.toLowerCase() || "";
          
          // Check if document matches search
          let matches = false;
          if (
            docLower.includes(searchLower) ||
            notesLower.includes(searchLower) ||
            fileTypeLower.includes(searchLower)
          ) {
            matches = true;
          }
          
          // Also check related contact and organisation names
          if (doc.contact_id) {
            const contact = allContacts.find((c) => c.id === doc.contact_id);
            if (contact?.name.toLowerCase().includes(searchLower)) {
              matches = true;
            }
          }
          
          if (doc.organisation_id) {
            const org = organisations.find((o) => o.id === doc.organisation_id);
            if (org?.name.toLowerCase().includes(searchLower)) {
              matches = true;
            }
          }
          
          if (matches) {
            // Build subtitle with file type and related entities
            const subtitleParts: string[] = [];
            if (doc.file_type) subtitleParts.push(doc.file_type);
            
            if (doc.contact_id) {
              const contact = allContacts.find((c) => c.id === doc.contact_id);
              if (contact) subtitleParts.push(`👤 ${contact.name}`);
            }
            
            if (doc.organisation_id) {
              const org = organisations.find((o) => o.id === doc.organisation_id);
              if (org) subtitleParts.push(`🏢 ${org.name}`);
            }
            
            searchResults.push({
              type: "document",
              id: doc.id,
              name: doc.name,
              subtitle: subtitleParts.length > 0 ? subtitleParts.join(" • ") : "Document",
            });
          }
        });
      } catch (e) {
        console.error("Error searching documents:", e);
      }

      // Search projects
      try {
        const projects = await projectsDb.getProjects();
        projects.forEach((project) => {
          const projectName = project.name || project.title;
          if (
            projectName?.toLowerCase().includes(searchLower) ||
            project.description?.toLowerCase().includes(searchLower) ||
            project.categories.some((cat) =>
              cat.toLowerCase().includes(searchLower)
            )
          ) {
            searchResults.push({
              type: "project",
              id: project.id,
              name: projectName || "Unnamed Project",
              subtitle: project.description || project.categories.join(", ") || project.status,
              metadata: {
                projectType: project.project_type,
              },
            });
          }
        });
      } catch (e) {
        console.error("Error searching projects:", e);
      }

      // Sort results by relevance: exact name matches first, then by type priority
      searchResults.sort((a, b) => {
        const aNameLower = a.name.toLowerCase();
        const bNameLower = b.name.toLowerCase();
        const queryLower = searchLower;

        // Exact name match gets highest priority
        const aExactMatch = aNameLower === queryLower;
        const bExactMatch = bNameLower === queryLower;
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;

        // Starts with query gets next priority
        const aStartsWith = aNameLower.startsWith(queryLower);
        const bStartsWith = bNameLower.startsWith(queryLower);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        // Type priority: documents > projects > contacts > organisations
        const typePriority: Record<string, number> = {
          document: 1,
          project: 2,
          contact: 3,
          organisation: 4,
        };
        const aPriority = typePriority[a.type] || 99;
        const bPriority = typePriority[b.type] || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;

        // Finally, alphabetical
        return aNameLower.localeCompare(bNameLower);
      });

      setResults(searchResults);
    };

    performSearch();
  }, [query, organisations]);

  const handleResultClick = (result: SearchResult) => {
    if (result.type === "contact") {
      router.push(
        `?dimension=Relationships&segment=Contacts`
      );
      // Scroll to the specific contact after navigation
      setTimeout(() => {
        const element = document.querySelector(`[data-contact-id="${result.id}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (element as HTMLElement).classList.add('ring-2', 'ring-blue-500');
          setTimeout(() => {
            (element as HTMLElement).classList.remove('ring-2', 'ring-blue-500');
          }, 2000);
        }
      }, 100);
    } else if (result.type === "organisation") {
      router.push(
        `?dimension=Relationships&segment=Organisations`
      );
      // Scroll to the specific organisation after navigation
      setTimeout(() => {
        const element = document.querySelector(`[data-organisation-id="${result.id}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (element as HTMLElement).classList.add('ring-2', 'ring-blue-500');
          setTimeout(() => {
            (element as HTMLElement).classList.remove('ring-2', 'ring-blue-500');
          }, 2000);
        }
      }, 100);
    } else if (result.type === "document") {
      router.push(
        `?dimension=Relationships&segment=Documents`
      );
      // Scroll to the specific document after navigation
      setTimeout(() => {
        const element = document.querySelector(`[data-document-id="${result.id}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (element as HTMLElement).classList.add('ring-2', 'ring-blue-500');
          setTimeout(() => {
            (element as HTMLElement).classList.remove('ring-2', 'ring-blue-500');
          }, 2000);
        }
      }, 100);
    } else if (result.type === "project") {
      // Determine which project segment to navigate to based on project type
      const projectType = result.metadata?.projectType;
      const segment = projectType === "mb-2.0" 
        ? "Projects MB 2.0" 
        : "Projects Internal";
      router.push(
        `?dimension=Projects&segment=${segment}`
      );
      // Scroll to the specific project after navigation
      setTimeout(() => {
        const element = document.querySelector(`[data-project-id="${result.id}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (element as HTMLElement).classList.add('ring-2', 'ring-blue-500');
          setTimeout(() => {
            (element as HTMLElement).classList.remove('ring-2', 'ring-blue-500');
          }, 2000);
        }
      }, 100);
    }
    
    // Clear search query after clicking
    if (onResultClick) {
      onResultClick();
    }
  };

  if (!query.trim() || results.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-50 max-h-96 overflow-auto">
      <div className="p-2 space-y-1">
        {results.map((result) => (
          <button
            key={`${result.type}-${result.id}`}
            onClick={() => handleResultClick(result)}
            className="w-full text-left px-3 py-2 rounded hover:bg-neutral-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">
                {result.type === "contact" ? "👤" : 
                 result.type === "organisation" ? "🏢" :
                 result.type === "document" ? "📄" : "📋"}
              </span>
              <div className="flex-1">
                <div className="text-sm text-white font-medium">
                  {result.name}
                </div>
                {result.subtitle && (
                  <div className="text-xs text-neutral-400 mt-0.5">
                    {result.subtitle}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

