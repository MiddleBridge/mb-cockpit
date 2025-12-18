"use client";

import { useSearchParams } from "next/navigation";
import ContactsView from "./ContactsView";
import OrganisationsView from "./OrganisationsView";
import DocumentsView from "./DocumentsView";

import EmailsView from "./EmailsView";
import LawView from "./LawView";
import ProjectsView from "./ProjectsView";
import ChineseLearningView from "./ChineseLearningView";

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

  if (dimension === "Relationships & Network" && segment === "E-mails") {
    return <EmailsView />;
  }

  if (dimension === "Knowledge" && segment === "Law") {
    return <LawView />;
  }

  if (dimension === "Knowledge" && segment === "Communication") {
    return (
      <div className="text-neutral-400 text-sm">
        Content for Communication will be displayed here.
      </div>
    );
  }

  if (dimension === "Projects" && segment === "Projects") {
    return <ProjectsView />;
  }

  if (dimension === "Projects" && segment === "Nauka chińskiego") {
    return <ChineseLearningView />;
  }

  // Default placeholder for other segments
  return (
    <div className="text-neutral-400 text-sm">
      Content for {segment} will be displayed here.
    </div>
  );
}

