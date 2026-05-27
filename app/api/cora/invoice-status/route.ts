import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO", "FINANCEIRO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const invoiceId = new URL(req.url).searchParams.get("invoiceId");
  const regId = new URL(req.url).searchParams.get("regId");
  if (!invoiceId) return NextResponse.json({ error: "invoiceId obrigatório" }, { status: 400 });

  try {
    const res = await coraFetch(`/v2/invoices/${invoiceId}`);
    const data = await res.json() as {
      id?: string;
      status?: string;
      payment_terms?: { due_date?: string; amount?: number };
      pix?: { emv?: string; qr_code?: string };
      bank_slip?: { pdf?: { url?: string }; our_number?: string };
      payment_url?: string;
    };

    if (!res.ok) return NextResponse.json({ error: "Erro ao consultar Cora" }, { status: res.status });

    // Mapeia status Cora → nosso padrão
    const statusMap: Record<string, string> = {
      PAID: "PAID",
      PENDING: "PENDING",
      CANCELLED: "CANCELLED",
      EXPIRED: "EXPIRED",
      VOID: "CANCELLED",
    };
    const coraStatus = statusMap[data.status ?? ""] ?? data.status ?? "PENDING";

    // Atualiza o status no banco se tiver regId
    if (regId) {
      const svc = serviceClient();
      await svc.from("partner_registrations").update({
        cora_invoice_status: coraStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", regId);
    }

    return NextResponse.json({ status: coraStatus, invoice: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
