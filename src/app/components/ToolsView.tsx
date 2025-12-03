"use client";

import { useState } from "react";
import BusinessModelCanvas from "./BusinessModelCanvas";

type Tool = "business-model-canvas";

export default function ToolsView() {
  const [selectedTool, setSelectedTool] = useState<Tool>("business-model-canvas");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Tools</h2>
          <p className="text-sm text-neutral-500 mt-1">Strategy</p>
        </div>
      </div>

      {/* Tool Selector */}
      <div className="flex gap-2 border-b border-neutral-800">
        <button
          onClick={() => setSelectedTool("business-model-canvas")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            selectedTool === "business-model-canvas"
              ? "text-white border-b-2 border-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Business Model Canvas
        </button>
      </div>

      {/* Tool Content */}
      <div className="mt-4">
        {selectedTool === "business-model-canvas" && <BusinessModelCanvas />}
      </div>
    </div>
  );
}

