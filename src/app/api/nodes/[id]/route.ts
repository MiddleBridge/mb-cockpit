import { NextResponse, type NextRequest } from "next/server";
import * as contactsDb from "../../../../lib/db/contacts";
import * as organisationsDb from "../../../../lib/db/organisations";
import type { Category } from "../../../../lib/db/categories";

export async function GET(
  request: NextRequest,
  context: { params: any }
) {
  const params = await Promise.resolve(context.params);
  const nodeId: string = params.id;

  try {
    // contact node
    if (nodeId.startsWith("contact-")) {
      const contactId = nodeId.replace("contact-", "");
      const contacts = await contactsDb.getContacts();
      const contact = contacts.find((c) => c.id === contactId) as any;

      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: nodeId,
        title: contact.name,
        type: "contact",
        description: contact.notes || undefined,
        email: contact.email || undefined,
        organization: contact.organization || undefined,
        categories: (contact.categories as any as Category[]) || [],
        status: contact.status || undefined,
      });
    }

    // organisation node
    if (nodeId.startsWith("org-")) {
      const orgId = nodeId.replace("org-", "");
      const organisations = await organisationsDb.getOrganisations();
      const org = organisations.find((o) => o.id === orgId) as any;

      if (!org) {
        return NextResponse.json(
          { error: "Organisation not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: nodeId,
        title: org.name,
        type: "organisation",
        description: org.description || undefined,
        categories: (org.categories as any as Category[]) || [],
        status: org.status || undefined,
      });
    }

    return NextResponse.json(
      { error: "Unsupported node type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in GET /api/nodes/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
