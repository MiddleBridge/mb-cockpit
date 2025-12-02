"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganisations, type Organisation } from "../hooks/useSharedLists";
import * as contactsDb from "../../lib/db/contacts";

interface SearchResult {
  type: "contact" | "organisation";
  id: string;
  name: string;
  subtitle?: string;
}

export default function SearchResults({ query }: { query: string }) {
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

      // Search contacts from Supabase
      try {
        const contacts = await contactsDb.getContacts();
        contacts.forEach((contact) => {
          const searchLower = query.toLowerCase();
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
      } catch (e) {
        console.error("Error searching contacts:", e);
      }

      // Search organisations
      organisations.forEach((org: Organisation) => {
        if (
          org.name.toLowerCase().includes(query.toLowerCase()) ||
          org.categories.some((cat) =>
            cat.toLowerCase().includes(query.toLowerCase())
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

      setResults(searchResults);
    };

    performSearch();
  }, [query, organisations]);

  const handleResultClick = (result: SearchResult) => {
    if (result.type === "contact") {
      router.push(
        `?dimension=Relationships+%26+Network&segment=Contacts`
      );
    } else if (result.type === "organisation") {
      router.push(
        `?dimension=Relationships+%26+Network&segment=Organisations`
      );
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
                {result.type === "contact" ? "👤" : "🏢"}
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

