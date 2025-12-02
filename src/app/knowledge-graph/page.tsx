"use client";

import { useState } from "react";
import KnowledgeGraph from "../components/KnowledgeGraph";
import ContentPane from "../components/ContentPane";

export default function KnowledgeGraphPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  return (
    <div className="flex h-full">
      <div className="flex-1">
        <KnowledgeGraph onSelectNode={setSelectedNodeId} />
      </div>
      <div className="w-[420px] border-l">
        <ContentPane selectedNodeId={selectedNodeId} />
      </div>
    </div>
  );
}

