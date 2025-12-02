import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";
import * as contactsDb from "../../../../lib/db/contacts";
import * as organisationsDb from "../../../../lib/db/organisations";
import * as documentsDb from "../../../../lib/db/documents";
import type { Category } from "../../../../lib/db/categories";

type GraphNode = {
  id: string;
  label: string;
  type: string;
  color?: string;
};

type GraphLink = {
  source: string;
  target: string;
  type: string;
};

export async function GET() {
  try {
    // Fetch categories with full objects (id + name)
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    const categories: Category[] = categoriesData || [];

    const [contacts, organisations] = await Promise.all([
      contactsDb.getContacts(),
      organisationsDb.getOrganisations(),
    ]);

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // Fetch documents
    const documents = await documentsDb.getDocuments();

    // Color mapping
    const typeColors: Record<string, string> = {
      organisation: "#3b82f6", // blue
      contact: "#6b7280", // gray (default)
      category: "#10b981", // green
      document: "#8b5cf6", // purple
      task: "#f59e0b", // amber
    };

    // Add category nodes
    categories.forEach((category) => {
      const nodeId = `category-${category.id}`;
      const node: GraphNode = {
        id: nodeId,
        label: category.name,
        type: "category",
        color: typeColors.category,
      };
      nodes.push(node);
      nodeMap.set(category.name.toLowerCase(), node);
    });

    // Add organisation nodes
    organisations.forEach((org) => {
      const nodeId = `org-${org.id}`;
      const node: GraphNode = {
        id: nodeId,
        label: org.name,
        type: "organisation",
        color: typeColors.organisation,
      };
      nodes.push(node);
      nodeMap.set(org.name.toLowerCase(), node);

      // Link organisations to their categories
      if (org.categories && org.categories.length > 0) {
        org.categories.forEach((catName) => {
          const catNode = nodeMap.get(catName.toLowerCase());
          if (catNode) {
            links.push({
              source: nodeId,
              target: catNode.id,
              type: "has_category",
            });
          }
        });
      }
    });

    // Add contact nodes and links
    contacts.forEach((contact) => {
      const nodeId = `contact-${contact.id}`;
      
      // Color by status
      let contactColor = typeColors.contact;
      switch (contact.status) {
        case "high prio":
          contactColor = "#ef4444"; // red
          break;
        case "prio":
          contactColor = "#f97316"; // orange
          break;
        case "mid":
          contactColor = "#eab308"; // yellow
          break;
        case "low":
          contactColor = "#6b7280"; // gray
          break;
      }

      const node: GraphNode = {
        id: nodeId,
        label: contact.name,
        type: "contact",
        color: contactColor,
      };
      nodes.push(node);

      // Link contact to organisation
      if (contact.organization) {
        const orgNode = nodeMap.get(contact.organization.toLowerCase());
        if (orgNode) {
          links.push({
            source: nodeId,
            target: orgNode.id,
            type: "belongs_to",
          });
        }
      }

      // Link contacts to their categories
      if (contact.categories && contact.categories.length > 0) {
        contact.categories.forEach((catName) => {
          const catNode = nodeMap.get(catName.toLowerCase());
          if (catNode) {
            links.push({
              source: nodeId,
              target: catNode.id,
              type: "has_category",
            });
          }
        });
      }

      // Link contacts through tasks (assignees)
      if (contact.tasks && Array.isArray(contact.tasks)) {
        contact.tasks.forEach((task) => {
          if (task.assignees && Array.isArray(task.assignees)) {
            task.assignees.forEach((assigneeId) => {
              const assigneeNodeId = `contact-${assigneeId}`;
              // Only add link if assignee node exists (will be created)
              links.push({
                source: nodeId,
                target: assigneeNodeId,
                type: "assigned_task",
              });
            });
          }
        });
      }
    });

    // Add document nodes and links
    documents.forEach((doc) => {
      const nodeId = `document-${doc.id}`;
      const node: GraphNode = {
        id: nodeId,
        label: doc.name,
        type: "document",
        color: typeColors.document,
      };
      nodes.push(node);
      nodeMap.set(nodeId, node);

      // Link document to contact
      if (doc.contact_id) {
        const contactNodeId = `contact-${doc.contact_id}`;
        links.push({
          source: nodeId,
          target: contactNodeId,
          type: "has_document",
        });
      }

      // Link document to organisation
      if (doc.organisation_id) {
        const orgNodeId = `org-${doc.organisation_id}`;
        links.push({
          source: nodeId,
          target: orgNodeId,
          type: "has_document",
        });
      }
    });

    return NextResponse.json({ nodes, links });
  } catch (error) {
    console.error("Error generating graph data:", error);
    return NextResponse.json(
      { error: "Failed to generate graph data" },
      { status: 500 }
    );
  }
}

