import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyUser, SOCIOS_IDS } from "@/lib/contract-notify";
import {
  COMMISSION_GROUP_LABELS, centsToPercent, validateAllocations,
  type CommissionGroup, type GridAllocationInput, type GridParticipant,
} from "@/lib/commission-grid";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

async function loadGrid(token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) return { error: "Link inválido.", status: 404 } as const;
  const { data: grid } = await svc().from("cm_commission_grids").select("*").eq("token", token).maybeSingle();
  if (!grid) return { error: "Link inválido.", status: 404 } as const;
  if (grid.status === "substituido") return { error: "Este link foi substituído por um novo. Peça o link atual à equipe V3 Partners.", status: 410 } as const;
  if (new Date(grid.token_expires_at as string) < new Date()) return { error: "Link expirado. Peça um novo à equipe V3 Partners.", status: 410 } as const;
  return { grid } as const;
}

// GET público: só grupo, parcela e NOMES. Nunca CPF, e-mail, telefone ou dado bancário.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await loadGrid(token);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
  const g = r.grid;
  const group = g.group_code as CommissionGroup;
  const base = {
    group_code: group,
    group_label: COMMISSION_GROUP_LABELS[group],
    group_percent: g.group_percent,
    representative_name: g.representative_name,
    participants: (g.participants as GridParticipant[]).map((p) => ({ qualification_id: p.qualification_id, name: p.name, fixed_percent: p.fixed_percent ?? null })),
    fixed_allocations: g.fixed_allocations,
    expires_at: g.token_expires_at,
  };
  if (g.status === "enviado") {
    const sent = (g.allocations as { qualification_id: string; percent: number }[] | null) ?? [];
    return NextResponse.json({ ...base, locked: true, allocations: sent, submitted_at: g.submitted_at, message: "A divisão deste grupo já foi confirmada e está travada. Para qualquer ajuste, fale com a equipe V3 Partners." }, { status: 409, headers: noStore });
  }
  return NextResponse.json({ ...base, locked: false }, { headers: noStore });
}

// POST público: valida em centésimos, grava com update atômico condicional (só se ainda pendente), trava a grade.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await loadGrid(token);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
  const g = r.grid;
  if (g.status !== "pendente") return NextResponse.json({ error: "A divisão deste grupo já foi confirmada.", locked: true }, { status: 409, headers: noStore });

  const body = await req.json().catch(() => ({}));
  const { allocations, submitted_by_name, acknowledged } = body as { allocations?: GridAllocationInput[]; submitted_by_name?: string; acknowledged?: boolean };
  if (!Array.isArray(allocations)) return NextResponse.json({ error: "Informe os percentuais." }, { status: 422, headers: noStore });
  const name = (submitted_by_name ?? "").trim();
  if (name.split(/\s+/).filter(Boolean).length < 2) return NextResponse.json({ error: "Informe o seu nome completo." }, { status: 422, headers: noStore });
  if (acknowledged !== true) return NextResponse.json({ error: "É preciso aceitar o Aviso de Privacidade e confirmar a divisão." }, { status: 422, headers: noStore });

  const participants = g.participants as GridParticipant[];
  const fixed = (g.fixed_allocations as { label: string; percent: number }[]) ?? [];
  const check = validateAllocations(participants, fixed, allocations);
  if (!check.ok || !check.cents) return NextResponse.json({ error: check.error }, { status: 422, headers: noStore });

  const stored = participants.map((p) => ({ qualification_id: p.qualification_id, percent: Number(centsToPercent(check.cents![p.qualification_id])) }));
  const nowIso = new Date().toISOString();
  const { data: updated, error } = await svc()
    .from("cm_commission_grids")
    .update({ allocations: stored, status: "enviado", submitted_by_name: name, submitted_at: nowIso, acknowledged_at: nowIso })
    .eq("id", g.id)
    .eq("status", "pendente")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível gravar. Tente de novo." }, { status: 500, headers: noStore });
  if (!updated) return NextResponse.json({ error: "A divisão deste grupo já foi confirmada.", locked: true }, { status: 409, headers: noStore });

  // Avisa os sócios (com await: gravação de aviso nunca "void").
  const label = COMMISSION_GROUP_LABELS[g.group_code as CommissionGroup];
  await Promise.all(
    SOCIOS_IDS.map((uid) =>
      notifyUser({
        userId: uid,
        title: `Grade de comissão enviada: ${label}`,
        message: `${name} confirmou a divisão percentual do grupo ${label}. Veja em Central de Contratos > Grade de Comissão.`,
        type: "comissao_grade",
        actionUrl: "https://app.v3partners.com.br/juridico/contratos",
      }).catch((e) => console.error("[commission-grid] falha ao notificar sócio:", e)),
    ),
  );
  return NextResponse.json({ ok: true }, { status: 200, headers: noStore });
}
