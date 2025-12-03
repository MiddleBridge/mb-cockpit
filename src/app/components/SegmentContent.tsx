"use client";

import { useSearchParams } from "next/navigation";
import ContactsView from "./ContactsView";
import OrganisationsView from "./OrganisationsView";
import DocumentsView from "./DocumentsView";
import ToolsView from "./ToolsView";
import ProjectsView from "./ProjectsView";

export default function SegmentContent() {
  const searchParams = useSearchParams();
  const dimension = searchParams.get("dimension");
  const segment = searchParams.get("segment");

  if (!dimension || !segment) {
    return null;
  }

  // Render different content based on segment
  if (dimension === "Relationships" && segment === "Contacts") {
    return <ContactsView />;
  }

  if (dimension === "Relationships" && segment === "Organisations") {
    return <OrganisationsView />;
  }

  if (dimension === "Relationships" && segment === "Documents") {
    return <DocumentsView />;
  }

  if (dimension === "Strategy" && segment === "Tools") {
    return <ToolsView />;
  }

  if (dimension === "Projects" && (segment === "Projects Internal" || segment === "Projects MB 2.0")) {
    return <ProjectsView />;
  }

  // Default placeholder for other segments
  return (
    <div className="text-neutral-400 text-sm">
      Content for {segment} will be displayed here.
    </div>
  );
}

