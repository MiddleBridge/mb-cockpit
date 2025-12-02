"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
// @ts-ignore
import * as d3Force from "d3-force";
import type { ForceGraphMethods } from "react-force-graph-2d";

// Dynamic import to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

type GraphNode = {
  id: string;
  label: string;
  type: string; // "contact", "organisation", "category"
  url?: string;
  x?: number;
  y?: number;
  color?: string;
};

type GraphLink = {
  source: string;
  target: string;
  type: string;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

interface Props {
  onSelectNode: (id: string | null) => void;
}

export default function KnowledgeGraph({ onSelectNode }: Props) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGraphData();
    
    // Update dimensions on mount and resize
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Konfiguracja sił dla grafu
  useEffect(() => {
    if (!fgRef.current || data.nodes.length === 0) return;

    const fg = fgRef.current;

    const charge = d3Force.forceManyBody().strength(-220);
    const link = d3Force
      .forceLink()
      .id((d: any) => d.id)
      .distance((l: any) => {
        if (l.type === "belongs_to") return 130;
        if (l.type === "has_category") return 170;
        if (l.type === "has_document") return 90;
        if (l.type === "assigned_task") return 110;
        return 200;
      })
      .strength(0.8);

    const collision = d3Force
      .forceCollide()
      .radius((n: any) => {
        if (n.type === "organisation") return 28;
        if (n.type === "category") return 22;
        if (n.type === "document") return 14;
        if (n.type === "task") return 14;
        return 20;
      })
      .strength(0.9);

    // kategorie trochę dalej od środka, dokumenty i zadania bliżej
    const radial = d3Force
      .forceRadial(
        (n: any) => {
          if (n.type === "category") return 250;
          if (n.type === "document") return 80;
          if (n.type === "task") return 100;
          return 150;
        },
        0,
        0
      )
      .strength(0.05);

    fg.d3Force("charge", charge);
    fg.d3Force("link", link);
    fg.d3Force("collision", collision);
    fg.d3Force("radial", radial);
    fg.d3Force("center", d3Force.forceCenter(0, 0));

    setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(600, 40);
      }
    }, 800);
  }, [data.nodes.length]);

  const loadGraphData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/graph/mb");
      if (!res.ok) throw new Error(`Failed to fetch graph data: ${res.status}`);
      const json = await res.json();
      console.log("Graph data loaded:", { nodes: json.nodes?.length || 0, links: json.links?.length || 0 });
      if (!json.nodes || !json.links) {
        console.warn("Invalid graph data structure:", json);
      }
      setData(json);
    } catch (error) {
      console.error("Error loading graph data:", error);
      setData({ nodes: [], links: [] });
    } finally {
      setLoading(false);
    }
  };

  // Centre view on node
  const focusNode = (id: string) => {
    const node = data.nodes.find((n) => n.id === id);
    if (!node || !fgRef.current) return;

    fgRef.current.centerAt(node.x || 0, node.y || 0, 400);
    fgRef.current.zoom(2, 400);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = search.trim().toLowerCase();
    if (!term) return;

    const node = data.nodes.find((n) =>
      n.label.toLowerCase().includes(term)
    );
    if (node) {
      focusNode(node.id);
      onSelectNode(node.id);
    }
  };

  const handleZoomIn = () => {
    if (fgRef.current) {
      const currentZoom = (fgRef.current as any).zoom() || 1;
      fgRef.current.zoom(currentZoom * 1.2, 300);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      const currentZoom = (fgRef.current as any).zoom() || 1;
      fgRef.current.zoom(currentZoom / 1.2, 300);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-900">
        <div className="text-neutral-400 text-sm">Loading graph...</div>
      </div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-900">
        <div className="text-neutral-400 text-sm text-center px-4">
          <div>No data to display</div>
          <div className="text-xs text-neutral-500 mt-2">
            Add contacts and organisations to see the network
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Search box */}
      <form
        onSubmit={handleSearchSubmit}
        className="absolute top-4 right-4 z-10 flex gap-2"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search node..."
          className="bg-neutral-900/80 backdrop-blur-sm text-sm px-3 py-1.5 rounded-lg border border-neutral-700 outline-none text-white placeholder:text-neutral-500 focus:border-neutral-500"
        />
        <button
          type="submit"
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
        >
          Go
        </button>
      </form>

      {/* Zoom buttons */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button
          className="w-9 h-9 rounded-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 text-lg text-white hover:bg-neutral-800 transition-colors flex items-center justify-center"
          onClick={handleZoomIn}
        >
          +
        </button>
        <button
          className="w-9 h-9 rounded-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 text-lg text-white hover:bg-neutral-800 transition-colors flex items-center justify-center"
          onClick={handleZoomOut}
        >
          −
        </button>
      </div>

      <ForceGraph2D
        ref={fgRef as any}
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0a0a0a"
        nodeColor={(node: any) => node.color || "#6b7280"}
        nodeVal={(node: any) => {
          if (node.type === "organisation") return 18;
          if (node.type === "category") return 14;
          if (node.type === "document") return 10;
          if (node.type === "task") return 10;
          return 12;
        }}
        linkColor={(link: any) => {
          if (link.type === "belongs_to") return "#60a5fa";
          if (link.type === "has_category") return "#10b981";
          if (link.type === "has_document") return "#a78bfa";
          if (link.type === "assigned_task") return "#fbbf24";
          return "#6b7280";
        }}
        linkWidth={(link: any) => {
          if (link.type === "belongs_to") return 2.5;
          if (link.type === "has_category") return 2;
          if (link.type === "has_document") return 2;
          if (link.type === "assigned_task") return 2;
          return 1.5;
        }}
        linkDirectionalArrowLength={5}
        linkDirectionalParticles={0.2}
        linkDirectionalParticleSpeed={0.008}
        linkCurvature={0.15}
        nodeLabel={(node: any) => node.label}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.25}
        // Custom drawing to get colored circles with labels in center
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.label;
          const fontSize = Math.max(9 / globalScale, 7);
          let radius = 18;
          if (node.type === "organisation") radius = Math.max(22, (node.val || 18) * 1.4);
          else if (node.type === "category") radius = Math.max(18, (node.val || 14) * 1.4);
          else if (node.type === "document") radius = Math.max(12, (node.val || 10) * 1.4);
          else if (node.type === "task") radius = Math.max(12, (node.val || 10) * 1.4);
          else radius = Math.max(16, (node.val || 12) * 1.4);

          // Draw circle with glow effect for important nodes
          if (node.type === "organisation") {
            ctx.shadowBlur = 15;
            ctx.shadowColor = node.color || "#3b82f6";
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color || "#6b7280";
          ctx.fill();

          ctx.lineWidth = (node.type === "organisation" ? 3 : 2) / globalScale;
          ctx.strokeStyle = node.type === "organisation" ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)";
          ctx.stroke();

          ctx.shadowBlur = 0;

          // Draw label in the center of the circle
          if (globalScale > 0.25) {
            ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            // Measure text
            const textMetrics = ctx.measureText(label);
            const maxWidth = radius * 1.6;
            
            // If text is too long, truncate it
            let displayLabel = label;
            if (textMetrics.width > maxWidth) {
              let truncated = label;
              while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
              }
              displayLabel = truncated + "...";
            }
            
            // Draw text with shadow for readability
            ctx.shadowBlur = 2;
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.fillStyle = "white";
            ctx.fillText(displayLabel, node.x, node.y);
            ctx.shadowBlur = 0;
          }
        }}
        nodeCanvasObjectMode={() => "replace"}
        onNodeClick={(node: any) => {
          onSelectNode(node.id);
          focusNode(node.id);
        }}
      />
    </div>
  );
}

