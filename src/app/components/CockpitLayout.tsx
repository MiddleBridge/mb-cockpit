"use client";

import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useState, useEffect, Suspense } from "react";
import { supabase } from "../../lib/supabase";
import TasksView from "./TasksView";
import GoogleCalendarIntegration from "./GoogleCalendarIntegration";
import RelationshipsView from "./RelationshipsView";
import BusinessModelCanvas from "./BusinessModelCanvas";
import StrategyView from "./StrategyView";
import SearchBar from "./SearchBar";
import Navigation from "./Navigation";
import SegmentContent from "./SegmentContent";
import HomeIcon from "./HomeIcon";

// Default layout configuration - similar to original 3-column layout
const defaultLayout: Layout[] = [
  { i: "tasks", x: 0, y: 0, w: 5, h: 15 },
  { i: "navigation", x: 5, y: 0, w: 2, h: 12 },
  { i: "content", x: 7, y: 0, w: 5, h: 15 },
  { i: "calendar", x: 0, y: 15, w: 4, h: 10 },
  { i: "relationships", x: 4, y: 15, w: 4, h: 10 },
  { i: "bmc", x: 8, y: 15, w: 4, h: 12 },
  { i: "strategy", x: 0, y: 25, w: 6, h: 8 },
];

// Get user ID - for now using a default, can be replaced with actual auth
function getUserId(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("mb_cockpit_user_id");
    if (stored) return stored;
    const userId = "default";
    localStorage.setItem("mb_cockpit_user_id", userId);
    return userId;
  }
  return "default";
}

interface PanelProps {
  title: string;
  children: React.ReactNode;
  showTitle?: boolean;
}

function Panel({ title, children, showTitle = true }: PanelProps) {
  return (
    <div className="border border-neutral-800 rounded-lg bg-neutral-900 text-white h-full flex flex-col overflow-hidden">
      {showTitle && (
        <div className="drag-handle bg-neutral-800 px-3 py-2 text-sm font-semibold cursor-move border-b border-neutral-700 flex items-center justify-between">
          <span>{title}</span>
          <span className="text-xs text-neutral-500">⋮⋮</span>
        </div>
      )}
      <div className={`flex-1 overflow-auto ${showTitle ? 'p-4' : 'p-2'}`}>
        {children}
      </div>
    </div>
  );
}

export default function CockpitLayout() {
  const [layout, setLayout] = useState<Layout[]>(defaultLayout);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [width, setWidth] = useState(1500);

  // Load layout from Supabase on mount
  useEffect(() => {
    loadLayout();
  }, []);

  // Handle window resize
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateWidth = () => {
      setWidth(window.innerWidth - 32);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const loadLayout = async () => {
    try {
      const userId = getUserId();
      const { data, error } = await supabase
        .from("user_settings")
        .select("cockpit_layout")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned, which is fine for first time
        console.error("Error loading layout:", error);
      }

      if (data?.cockpit_layout) {
        setLayout(data.cockpit_layout as Layout[]);
      }
    } catch (error) {
      console.error("Error loading layout:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveLayout = async () => {
    try {
      setSaving(true);
      const userId = getUserId();
      
      const { error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: userId,
            cockpit_layout: layout,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        console.error("Error saving layout:", error);
        alert("Failed to save layout. Please try again.");
      } else {
        setEditMode(false);
      }
    } catch (error) {
      console.error("Error saving layout:", error);
      alert("Failed to save layout. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const onLayoutChange = (newLayout: Layout[]) => {
    if (editMode) {
      // Only update layout if in edit mode, and don't compact
      setLayout(newLayout);
    }
  };

  const handleEditToggle = () => {
    if (editMode) {
      // Save when turning off edit mode
      saveLayout();
    } else {
      // Turn on edit mode
      setEditMode(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-950 text-white">
        <div className="text-neutral-400">Loading cockpit...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 bg-neutral-950 relative">
      <div className="flex-1 p-4 min-h-0 flex flex-col">
        <div className="mb-4 flex items-center justify-between flex-shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <HomeIcon />
            <div className="h-px w-px bg-neutral-700"></div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-sm text-neutral-300">MB Cockpit</span>
            </div>
          </div>
          <button
            onClick={handleEditToggle}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
              editMode
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? "Saving..." : editMode ? "Save Layout" : "Edit Layout"}
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={30}
            width={width}
            onLayoutChange={onLayoutChange}
            isDraggable={editMode}
            isResizable={editMode}
            draggableHandle=".drag-handle"
            compactType={null}
            preventCollision={true}
            verticalCompact={false}
            margin={[8, 8]}
          >
            <div key="tasks">
              <Panel title="Tasks">
                <Suspense fallback={<div className="text-neutral-400 text-xs">Loading...</div>}>
                  <TasksView />
                </Suspense>
              </Panel>
            </div>

            <div key="navigation" style={{ zIndex: 1 }}>
              <Panel title="Navigation" showTitle={false}>
                <Suspense fallback={<div className="text-neutral-400 text-xs">Loading...</div>}>
                  <Navigation />
                </Suspense>
              </Panel>
            </div>

            <div key="calendar">
              <Panel title="Calendar">
                <GoogleCalendarIntegration />
              </Panel>
            </div>

            <div key="relationships">
              <Panel title="Relationships">
                <RelationshipsView />
              </Panel>
            </div>

            <div key="bmc">
              <Panel title="Business Model Canvas">
                <BusinessModelCanvas />
              </Panel>
            </div>

            <div key="strategy">
              <Panel title="Strategy">
                <StrategyView />
              </Panel>
            </div>

            <div key="content" style={{ zIndex: 2 }}>
              <Panel title="Content">
                <Suspense fallback={null}>
                  <SegmentContent />
                </Suspense>
              </Panel>
            </div>
          </GridLayout>
        </div>
      </div>
    </div>
  );
}

