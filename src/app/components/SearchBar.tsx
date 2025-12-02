"use client";

import { useState } from "react";
import SearchResults from "./SearchResults";

export default function SearchBar() {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="relative w-full">
      <form onSubmit={handleSearch} className="w-full">
        <div className="relative w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files, documents, cards, folders..."
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 pl-8 pr-8 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:border-transparent"
          />
          <svg
            className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSearchQuery("");
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-white text-xs w-4 h-4 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>
      </form>
      <SearchResults query={searchQuery} />
    </div>
  );
}

