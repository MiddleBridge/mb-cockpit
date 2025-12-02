"use client";

import { useEffect, useState } from "react";

type NodeDetails = {
  id: string;
  title: string;
  type: string;
  description?: string;
  email?: string;
  organization?: string;
  categories?: string[];
  status?: string;
  externalUrl?: string;
};

interface Props {
  selectedNodeId: string | null;
}

export default function ContentPane({ selectedNodeId }: Props) {
  const [details, setDetails] = useState<NodeDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedNodeId) {
      setDetails(null);
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/nodes/${selectedNodeId}`);
        if (!res.ok) throw new Error("Failed to fetch node details");
        const json = await res.json();
        setDetails(json);
      } catch (error) {
        console.error("Error loading node details:", error);
        setDetails(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [selectedNodeId]);

  if (!selectedNodeId) {
    return (
      <div className="h-full p-4 text-sm text-neutral-400 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">👆</div>
          <div>Select a node on the graph to see details here.</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full p-4 text-sm text-neutral-400 flex items-center justify-center">
        <div>Loading…</div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="h-full p-4 text-sm text-neutral-400 flex items-center justify-center">
        <div>Node not found</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950">
        <div className="text-xs uppercase text-neutral-500 mb-1">{details.type}</div>
        <div className="text-lg font-semibold text-white">{details.title}</div>
      </div>

      <div className="flex-1 overflow-auto p-4 text-sm bg-neutral-900">
        {details.description && (
          <p className="text-neutral-200 mb-4">{details.description}</p>
        )}

        {details.email && (
          <div className="mb-3">
            <div className="text-xs text-neutral-500 mb-1">Email</div>
            <div className="text-neutral-200">{details.email}</div>
          </div>
        )}

        {details.organization && (
          <div className="mb-3">
            <div className="text-xs text-neutral-500 mb-1">Organization</div>
            <div className="text-neutral-200">{details.organization}</div>
          </div>
        )}

        {details.status && (
          <div className="mb-3">
            <div className="text-xs text-neutral-500 mb-1">Status</div>
            <div className="text-neutral-200">{details.status}</div>
          </div>
        )}

        {details.categories && details.categories.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-neutral-500 mb-1">Categories</div>
            <div className="flex flex-wrap gap-1">
              {details.categories.map((cat, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-neutral-800 text-neutral-300 text-xs rounded"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {details.externalUrl && (
          <a
            href={details.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-xs px-3 py-1.5 rounded-lg border border-neutral-600 text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            Open external page →
          </a>
        )}
      </div>
    </div>
  );
}


