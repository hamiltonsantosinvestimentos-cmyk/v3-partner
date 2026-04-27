import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, role, full_name").eq("id", user.id).single();
  return { user, profile };
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { proposal_id, proposal_code, doc_key } = body as {
    proposal_id: string;
    proposal_code: string;
    doc_key: string;
  };

  if (!proposal_id || !doc_key) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const db = svc();

  // Verifica se o partner é dono da proposta
  const { data: proposta } = await db
    .from("credit_desk_proposals")
    .select("partner_id, metadata, current_level")
    .eq("id", proposal_id)
    .single();

  const partnerRole = (profile as { role?: string } | null)?.role ?? "";
  const isPartner = ["PARTNER", "PARTNER_PRO"].includes(partnerRole);
  const isMesa = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(partnerRole);

  if (isPartner && (proposta as { partner_id?: string } | null)?.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão para esta proposta" }, { status: 403 });
  }
  if (!isPartner && !isMesa) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Atualiza status da pendência no metadata
  const currentMeta = (proposta as { metadata?: Record<string, unknown> } | null)?.metadata ?? {};
  const pendenciasOcr = (currentMeta.pendencias_ocr as Record<string, Record<string, unknown>> ?? {});

  if (!pendenciasOcr[doc_key]) {
    return NextResponse.json({ error: "Pendência não encontrada" }, { status: 404 });
  }

  pendenciasOcr[doc_key] = {
    ...pendenciasOcr[doc_key],
    status: "corrigido",
    corrigido_at: new Date().toISOString(),
    corrigido_por: (profile as { full_name?: string } | null)?.full_name ?? user.id,
  };

  // Verifica se todas as pendências foram corrigidas
  const todasCorrigidas = Object.values(pendenciasOcr).every(
    (p) => (p as { status?: string }).status === "corrigido"
  );

  const updates: Record<string, unknown> = {
    metadata: { ...currentMeta, pendencias_ocr: pendenciasOcr },
    updated_at: new Date().toISOString(),
  };

  // Se partner corrigiu, move SEMPRE para TRIAGEM (independente de outras pendências)
  if (isPartner) {
    updates.stage = "TRIAGEM";
  } else if (todasCorrigidas) {
    updates.stage = "ANALISE";
  }

  await db
    .from("credit_desk_proposals")
    .update(updates)
    .eq("id", proposal_id);

  // Notifica a mesa operacional
  const mesaRoles = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
  const { data: mesaUsers } = await db
    .from("profiles")
    .select("id")
    .in("role", mesaRoles);

  const docLabel = (pendenciasOcr[doc_key] as { doc_label?: string }).doc_label ?? doc_key;
  const partnerName = (profile as { full_name?: string } | null)?.full_name ?? "Partner";

  if (mesaUsers && mesaUsers.length > 0) {
    await db.from("notifications").insert(
      (mesaUsers as { id: string }[]).map(u => ({
        user_id: u.id,
        title: "✅ Documento corrigido pelo partner",
        message: `${partnerName} corrigiu "${docLabel}" na proposta ${proposal_code}. Proposta movida para ${isPartner ? "Triagem" : todasCorrigidas ? "Análise" : "Pendência"}.`,
        type: "success",
        read: false,
        action_url: `/mesa-operacional`,
      }))
    );
  }

  return NextResponse.json({
    ok: true,
    todas_corrigidas: todasCorrigidas,
    novo_stage: isPartner ? "TRIAGEM" : todasCorrigidas ? "ANALISE" : "PENDENCIA",
  });
}
