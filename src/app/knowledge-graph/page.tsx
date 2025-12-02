"use client";

import { useState } from "react";
import KnowledgeGraph from "../../components/KnowledgeGraph";
import ContentPane from "../../components/ContentPane";

export default function KnowledgeGraphPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-black text-white">
      {/* LEFT: content */}
      <div className="w-[40%] bg-neutral-900 border-r border-neutral-800">
        <ContentPane selectedNodeId={selectedNodeId} />
      </div>

      {/* RIGHT: graph */}
      <div className="flex-1 relative">
        <KnowledgeGraph onSelectNode={setSelectedNodeId} />
      </div>
    </div>
  );
}

