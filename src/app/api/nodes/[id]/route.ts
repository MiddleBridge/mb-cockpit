import { NextResponse, type NextRequest } from "next/server";
import * as contactsDb from "../../../../lib/db/contacts";
import * as organisationsDb from "../../../../lib/db/organisations";

export async function GET(
  request: NextRequest,
  context: { params: any }
) {
  const nodeId = (await Promise.resolve(context.params)).id;

  try {
    // Contact
    if (nodeId.startsWith("contact-")) {
      const id = nodeId.replace("contact-", "");
      const contacts = await contactsDb.getContacts();
      const c: any = contacts.find((x) => x.id === id);

      if (!c) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: nodeId,
        title: c.name,
        type: "contact",
        description: c.notes,
        email: c.email,
        organization: c.organization,
        categories: c.categories || [],
        status: c.status,
      });
    }

    // Organisation
    if (nodeId.startsWith("org-")) {
      const id = nodeId.replace("org-", "");
      const orgs = await organisationsDb.getOrganisations();
      const o: any = orgs.find((x) => x.id === id);

      if (!o) {
        return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: nodeId,
        title: o.name,
        type: "organisation",
        description: o.description,
        categories: o.categories || [],
        status: o.status,
      });
    }

    return NextResponse.json({ error: "Unsupported node type" }, { status: 400 });
  } catch (e) {
    console.error("API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
