import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { renderComprovanteComissaoPDF, type ComprovanteComissao } from "@/lib/comprovante-comissao-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "FINANCEIRO"];

// GET — comprovante/demonstrativo da comissão em PDF.
// Acesso: ADMIN/GESTAO/FINANCEIRO ou o próprio partner dono da comissão.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const svc = serviceClient();

  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = ADMIN_ROLES.includes(profile?.role as string);

  const { data: c, error } = await svc
    .from("commissions")
    .select(`
      id, code, partner_id, operation_type, operation_code, operation_description,
      operation_value, commission_percent, commission_value,
      tax_percent, tax_value, commission_net_value,
      status, operation_closed_at, payment_date, notes
    `)
    .eq("id", id)
    .single();

  if (error || !c) return NextResponse.json({ error: "Comissão não encontrada" }, { status: 404 });
  if (!isAdmin && c.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão para este comprovante" }, { status: 403 });
  }

  const { data: partnerProfile } = await svc
    .from("profiles").select("full_name").eq("id", c.partner_id).single();

  const gross = c.commission_value ?? (c.operation_value * c.commission_percent / 100);
  const taxPercent = c.tax_percent ?? 0;
  const taxValue = c.tax_value ?? (taxPercent > 0 ? gross * taxPercent / 100 : 0);
  const net = c.commission_net_value ?? (gross - taxValue);

  const data: ComprovanteComissao = {
    code: c.code,
    partnerName: partnerProfile?.full_name ?? "Partner",
    operationType: c.operation_type,
    operationDescription: c.operation_description,
    operationCode: c.operation_code,
    operationValue: c.operation_value ?? 0,
    commissionPercent: c.commission_percent ?? 0,
    grossValue: gross,
    taxPercent,
    taxValue,
    netValue: net,
    status: c.status,
    operationClosedAt: c.operation_closed_at,
    paymentDate: c.payment_date,
    generatedAt: new Date().toISOString(),
    notes: c.notes,
  };

  let buffer: Buffer;
  try {
    buffer = await renderComprovanteComissaoPDF(data);
  } catch (e) {
    console.error("[commissions/comprovante] erro ao gerar PDF:", e);
    return NextResponse.json({ error: "Erro ao gerar PDF" }, { status: 500 });
  }

  const prefixo = c.status === "PAGA" ? "comprovante" : "demonstrativo";
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${prefixo}-comissao-${c.code}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
