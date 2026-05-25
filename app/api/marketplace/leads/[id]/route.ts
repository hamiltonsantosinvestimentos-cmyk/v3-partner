import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyLeadStatusAtualizado } from "@/lib/email";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const VALID_STATUSES = ["NEW", "IN_PROGRESS", "CONVERTED", "LOST", "PENDING"];

const STATUS_LABELS: Record<string, string> = {
  NEW: "Novo",
  IN_PROGRESS: "Em andamento",
  CONVERTED: "Convertido 🎉",
  LOST: "Não avançou",
  PENDING: "Aguardando resposta",
};

/** PATCH /api/marketplace/leads/[id] — update lead status (supplier or admin) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status, notes } = await req.json();

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const supplierId = req.headers.get("x-supplier-id");
  const svc = serviceClient();

  if (supplierId) {
    // Supplier updating their own lead
    const { data: lead } = await svc
      .from("marketplace_leads")
      .select("id, supplier_id")
      .eq("id", id)
      .eq("supplier_id", supplierId)
      .single();
    if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }
  // Admin can update any lead (no extra check needed with service role)

  const update: Record<string, unknown> = { status };
  if (notes !== undefined) update.notes = notes;

  const { data, error } = await svc
    .from("marketplace_leads")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email notification to partner (non-blocking)
  if (data && ["IN_PROGRESS", "CONVERTED", "LOST", "PENDING"].includes(status)) {
    const { data: fullLead } = await svc
      .from("marketplace_leads")
      .select(`
        partner:profiles(full_name, email),
        product:marketplace_products(name, supplier:marketplace_suppliers(company_name))
      `)
      .eq("id", id)
      .single();

    const partner = (fullLead as { partner?: { full_name: string; email: string } | null } | null)?.partner;
    const product = (fullLead as { product?: { name: string; supplier?: { company_name: string } | null } | null } | null)?.product;

    if (partner?.email) {
      notifyLeadStatusAtualizado({
        partnerEmail: partner.email,
        partnerName: partner.full_name,
        productName: product?.name ?? "Produto",
        supplierName: product?.supplier?.company_name ?? "Fornecedor",
        novoStatus: status,
      }).then(null, () => {});
    }

    // In-app notification for the partner who owns this lead
    const { data: leadOwner } = await svc
      .from("marketplace_leads")
      .select("partner_id, client_name")
      .eq("id", id)
      .single();

    if (leadOwner?.partner_id) {
      const clientName = leadOwner.client_name ?? partner?.full_name ?? "Cliente";
      const productName = product?.name ?? "Produto";
      const statusLabel = STATUS_LABELS[status] ?? status;

      svc.from("notifications").insert({
        user_id: leadOwner.partner_id,
        title: "Status do lead atualizado",
        message: `Seu lead "${clientName}" para ${productName} foi atualizado para: ${statusLabel}`,
        type: "info",
        action_url: "/marketplace?tab=leads",
      }).then(() => {}, () => {});
    }
  }

  return NextResponse.json({ lead: data });
}
