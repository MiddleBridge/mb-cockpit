"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
// @ts-ignore
import * as d3Force from "d3-force";
import * as contactsDb from "../../lib/db/contacts";
import * as organisationsDb from "../../lib/db/organisations";
import * as documentsDb from "../../lib/db/documents";
import type { Contact } from "../../lib/db/contacts";
import type { Organisation } from "../../lib/db/organisations";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="h-48 flex items-center justify-center text-neutral-400 text-xs">
      Loading graph...
    </div>
  ),
});

interface Node {
  id: string;
  name: string;
  type: "contact" | "organisation" | "document" | "task";
  status?: string;
  categories?: string[];
  avatar?: string;
  linkCount?: number;
}

interface Link {
  source: string;
  target: string;
  type: "belongs_to" | "has_document" | "assigned_task";
}

const SIDEBAR_HEIGHT = 192;

export default function NetworkGraph() {
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: [],
    links: [],
  });
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [avatarImages, setAvatarImages] = useState<Map<string, HTMLImageElement>>(new Map());

  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const forcesInitialisedRef = useRef(false);

  // Mount + initial load
  useEffect(() => {
    setMounted(true);
    loadGraphData();

    // lekki polling, ale bez przesady
    const refreshInterval = setInterval(() => {
      loadGraphData(true);
    }, 15000); // co 15s

    const handleFocus = () => loadGraphData(true);
    window.addEventListener("focus", handleFocus);

    const handleDataUpdate = () => loadGraphData(true);
    window.addEventListener("graph-data-updated", handleDataUpdate as any);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("graph-data-updated", handleDataUpdate as any);
    };
  }, []);

  // Konfiguracja sił gdy mamy dane i graf
  useEffect(() => {
    if (!mounted || loading || !graphRef.current || graphData.nodes.length === 0) return;

    const fg = graphRef.current;

    // Ustawiamy siły tylko raz na instancję, ewentualnie przy zmianie expanded
    const initForces = () => {
      const isWide = isExpanded;
      const simCharge = d3Force.forceManyBody().strength(isWide ? -200 : -120);

      const simLink = d3Force
        .forceLink()
        .id((d: any) => d.id)
        .distance((link: any) => {
          // kontakty bliżej swoich orgów
          if (link.type === "belongs_to") return isWide ? 90 : 60;
          return isWide ? 120 : 80;
        })
        .strength(0.9);

      const simCollision = d3Force
        .forceCollide()
        .radius((node: any) => {
          const base = node.type === "organisation" ? 18 : 12;
          return base + 6; // margines
        })
        .strength(0.9);

      // proste rozbicie góra / dół bez mieszania pikseli z symulacją
      const simY = d3Force
        .forceY()
        .strength(0.15)
        .y((node: any) => (node.type === "organisation" ? -40 : 40));

      fg.d3Force("charge", simCharge);
      fg.d3Force("link", simLink);
      fg.d3Force("collision", simCollision);
      fg.d3Force("y", simY);
      fg.d3Force("center", d3Force.forceCenter(0, 0));
    };

    initForces();
    forcesInitialisedRef.current = true;

    // dopasuj do kontenera po chwili
    setTimeout(() => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.zoomToFit(400, 30);
      }
    }, 800);
  }, [mounted, loading, graphData.nodes.length, isExpanded]);

  const loadGraphData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const [contacts, organisations, documents] = await Promise.all([
        contactsDb.getContacts(),
        organisationsDb.getOrganisations(),
        documentsDb.getDocuments(),
      ]);

      const nodes: Node[] = [];
      const links: Link[] = [];
      const orgByName = new Map<string, Node>();

      // organisations
      organisations.forEach((org: Organisation) => {
        const node: Node = {
          id: `org-${org.id}`,
          name: org.name,
          type: "organisation",
          categories: org.categories,
        };
        nodes.push(node);
        orgByName.set(org.name.toLowerCase(), node);
      });

      // contacts + relacje
      contacts.forEach((contact: Contact) => {
        const node: Node = {
          id: `contact-${contact.id}`,
          name: contact.name,
          type: "contact",
          status: contact.status,
          categories: contact.categories,
          avatar: contact.avatar,
        };
        nodes.push(node);

        if (contact.organization) {
          const orgNode = orgByName.get(contact.organization.toLowerCase());
          if (orgNode) {
            links.push({
              source: node.id,
              target: orgNode.id,
              type: "belongs_to",
            });
          }
        }

        // Link contacts through tasks (assignees)
        if (contact.tasks && Array.isArray(contact.tasks)) {
          contact.tasks.forEach((task) => {
            if (task.assignees && Array.isArray(task.assignees)) {
              task.assignees.forEach((assigneeId) => {
                links.push({
                  source: node.id,
                  target: `contact-${assigneeId}`,
                  type: "assigned_task",
                });
              });
            }
          });
        }
      });

      // documents
      documents.forEach((doc) => {
        const node: Node = {
          id: `document-${doc.id}`,
          name: doc.name,
          type: "document",
        };
        nodes.push(node);

        // Link document to contact
        if (doc.contact_id) {
          links.push({
            source: node.id,
            target: `contact-${doc.contact_id}`,
            type: "has_document",
          });
        }

        // Link document to organisation
        if (doc.organisation_id) {
          links.push({
            source: node.id,
            target: `org-${doc.organisation_id}`,
            type: "has_document",
          });
        }
      });

      // linkCount
      const linkCounts = new Map<string, number>();
      nodes.forEach((n) => linkCounts.set(n.id, 0));
      links.forEach((l) => {
        linkCounts.set(l.source as string, (linkCounts.get(l.source as string) || 0) + 1);
        linkCounts.set(l.target as string, (linkCounts.get(l.target as string) || 0) + 1);
      });
      nodes.forEach((n) => {
        n.linkCount = linkCounts.get(n.id) || 0;
      });

      // avatary
      const imageMap = new Map<string, HTMLImageElement>();
      const imagePromises: Promise<void>[] = [];

      nodes.forEach((node) => {
        if (node.avatar && node.type === "contact") {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const p = new Promise<void>((resolve) => {
            img.onload = () => {
              imageMap.set(node.id, img);
              resolve();
            };
            img.onerror = () => resolve();
          });
          img.src = node.avatar;
          imagePromises.push(p);
        }
      });

      await Promise.all(imagePromises);
      setAvatarImages(imageMap);
      setGraphData({ nodes, links });
    } catch (e) {
      console.error("Error loading graph data:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div>
        <h3 className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
          Network
        </h3>
        <div className="h-48 rounded border border-neutral-800 flex items-center justify-center bg-neutral-900">
          <div className="text-neutral-400 text-xs">Loading...</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h3 className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
          Network
        </h3>
        <div className="h-48 rounded border border-neutral-800 flex items-center justify-center bg-neutral-900">
          <div className="text-neutral-400 text-xs">Loading network...</div>
        </div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div>
        <h3 className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
          Network
        </h3>
        <div className="h-48 rounded border border-neutral-800 flex items-center justify-center bg-neutral-900">
          <div className="text-neutral-400 text-xs text-center px-2">
            No data to display
            <span className="text-[10px] text-neutral-500 mt-1 block">
              Add contacts and organisations to see the network
            </span>
          </div>
        </div>
      </div>
    );
  }

  const orgCount = graphData.nodes.filter((n) => n.type === "organisation").length;
  const contactCount = graphData.nodes.filter((n) => n.type === "contact").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wide text-neutral-400">
          Network ({graphData.nodes.length} nodes, {graphData.links.length} links)
        </h3>
        <div className="flex gap-2 text-[10px] text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> {orgCount}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" /> {contactCount}
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`rounded border border-neutral-800 overflow-hidden bg-white relative transition-all duration-300 ${
          isExpanded ? "fixed inset-4 z-50" : "h-48"
        }`}
        style={{
          minHeight: isExpanded ? "calc(100vh - 2rem)" : `${SIDEBAR_HEIGHT}px`,
        }}
      >
        {/* Expand / fit */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            onClick={() => {
              setIsExpanded((prev) => !prev);
              setTimeout(() => {
                if (graphRef.current && containerRef.current) {
                  graphRef.current.zoomToFit(400, 30);
                }
              }, 120);
            }}
            className="px-2 py-1 bg-white/90 hover:bg-white border border-neutral-300 rounded text-xs text-neutral-700 shadow-sm"
          >
            {isExpanded ? "−" : "+"}
          </button>
          {isExpanded && (
            <button
              onClick={() => {
                if (graphRef.current && containerRef.current) {
                  graphRef.current.zoomToFit(400, 30);
                }
              }}
              className="px-2 py-1 bg-white/90 hover:bg-white border border-neutral-300 rounded text-xs text-neutral-700 shadow-sm"
            >
              Fit
            </button>
          )}
        </div>

        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          backgroundColor="#0a0a0a"
          nodeRelSize={6}
          linkCurvature={0.1}
          cooldownTicks={80}
          d3AlphaDecay={0.04}
          d3VelocityDecay={0.3}
          nodeLabel={(node: any) => `${node.name} (${node.type})`}
          nodeColor={(node: any) => {
            if (node.type === "organisation") return "#3b82f6";
            if (node.type === "document") return "#8b5cf6";
            if (node.type === "task") return "#f59e0b";
            switch (node.status) {
              case "high prio":
                return "#ef4444";
              case "prio":
                return "#f97316";
              case "mid":
                return "#eab308";
              default:
                return "#6b7280";
            }
          }}
          nodeVal={(node: any) => {
            if (node.type === "organisation") return 16;
            if (node.type === "document") return 8;
            if (node.type === "task") return 8;
            return 12;
          }}
          linkColor={(link: any) => {
            if (link.type === "belongs_to") return "#60a5fa";
            if (link.type === "has_document") return "#a78bfa";
            if (link.type === "assigned_task") return "#fbbf24";
            return "#9ca3af";
          }}
          linkWidth={(link: any) => {
            if (link.type === "belongs_to") return 2;
            if (link.type === "has_document") return 1.5;
            if (link.type === "assigned_task") return 1.5;
            return 1;
          }}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={0.1}
          linkDirectionalParticleSpeed={0.005}
          width={containerRef.current?.clientWidth}
          height={
            isExpanded
              ? containerRef.current?.clientHeight
              : SIDEBAR_HEIGHT
          }
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.name;
            let baseSize = 10;
            if (node.type === "organisation") baseSize = 16;
            else if (node.type === "document") baseSize = 8;
            else if (node.type === "task") baseSize = 8;
            else baseSize = 12;
            
            const radius = baseSize;
            const img = avatarImages.get(node.id);

            // Draw node
            if (img && node.type === "contact") {
              ctx.save();
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
              ctx.clip();
              ctx.drawImage(img, node.x - radius, node.y - radius, radius * 2, radius * 2);
              ctx.restore();
            } else {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
              ctx.fillStyle = node.color || "#6b7280";
              ctx.fill();
            }

            // Draw border
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = node.type === "organisation" ? "#ffffff" : "rgba(255,255,255,0.6)";
            ctx.lineWidth = (node.type === "organisation" ? 2 : 1.5) / globalScale;
            ctx.stroke();

            // Draw label
            if (globalScale > 0.5) {
              const fontSize = Math.max(9 / globalScale, 7);
              ctx.font = `${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";

              const text = label.length > 20 ? label.substring(0, 17) + "..." : label;
              const metrics = ctx.measureText(text);
              const padding = 3;
              const bgWidth = metrics.width + padding * 2;
              const bgHeight = fontSize + padding * 2;
              const bgX = node.x - bgWidth / 2;
              const bgY = node.y + radius + 3;

              // Dark background with border
              ctx.fillStyle = "rgba(10, 10, 10, 0.9)";
              ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
              ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
              ctx.lineWidth = 1 / globalScale;
              ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);

              ctx.fillStyle = "#ffffff";
              ctx.fillText(text, node.x, bgY + padding + fontSize / 2);
            }
          }}
          nodeCanvasObjectMode={() => "replace"}
        />
      </div>
    </div>
  );
}
