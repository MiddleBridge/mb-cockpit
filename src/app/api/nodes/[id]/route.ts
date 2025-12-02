import { NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";
import * as contactsDb from "../../../../../lib/db/contacts";
import * as organisationsDb from "../../../../../lib/db/organisations";
import type { Category } from "../../../../../lib/db/categories";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;

    // Parse node type and actual ID
    if (nodeId.startsWith("contact-")) {
      const contactId = nodeId.replace("contact-", "");
      const contacts = await contactsDb.getContacts();
      const contact = contacts.find((c) => c.id === contactId);

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
        categories: contact.categories || [],
        status: contact.status || undefined,
      });
    } else if (nodeId.startsWith("org-")) {
      const orgId = nodeId.replace("org-", "");
      const organisations = await organisationsDb.getOrganisations();
      const org = organisations.find((o) => o.id === orgId);

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
        categories: org.categories || [],
      });
    } else if (nodeId.startsWith("category-")) {
      const categoryId = nodeId.replace("category-", "");
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('id', categoryId)
        .single();
      
      const category = categoriesData as Category | null;

      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: nodeId,
        title: category.name,
        type: "category",
      });
    }

    return NextResponse.json(
      { error: "Invalid node ID format" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching node details:", error);
    return NextResponse.json(
      { error: "Failed to fetch node details" },
      { status: 500 }
    );
  }
}

