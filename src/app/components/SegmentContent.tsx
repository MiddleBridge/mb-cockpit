"use client";

import { useSearchParams } from "next/navigation";
import ContactsView from "./ContactsView";
import OrganisationsView from "./OrganisationsView";
import DocumentsView from "./DocumentsView";

export default function SegmentContent() {
  const searchParams = useSearchParams();
  const dimension = searchParams.get("dimension");
  const segment = searchParams.get("segment");

  if (!dimension || !segment) {
    return null;
  }

  // Render different content based on segment
  if (dimension === "Relationships & Network" && segment === "Contacts") {
    return <ContactsView />;
  }

  if (dimension === "Relationships & Network" && segment === "Organisations") {
    return <OrganisationsView />;
  }

  if (dimension === "Relationships & Network" && segment === "Documents") {
    return <DocumentsView />;
  }

  // Default placeholder for other segments
  return (
    <div className="text-neutral-400 text-sm">
      Content for {segment} will be displayed here.
    </div>
  );
}

