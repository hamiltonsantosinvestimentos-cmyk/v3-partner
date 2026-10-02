import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { labelRevealField, maskIp } from "@/lib/qualification-mask";
import { KYC_DOCUMENT_KIND_LABELS } from "@/lib/kyc-documents";

// Lista de acessos a dados sensíveis de uma qualificação (BRIEF 5.12 C): revelações de campo
// (cm_party_qualification_field_views) e aberturas de documento (cm_party_qualification_document_views),
// quem, o quê, quando. IP sempre mascarado, sem ação de desmascarar. Somente leitura, mesmos papéis
// da ficha. `can_erase` só para ADMIN (a eliminação é a rota irmã .../erase).

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const PAGE_SIZE = 50;
const NO_STORE = { "Cache-Control": "no-store" };

type Item = { id: string; source: "field_views" | "document_views"; field_label: string; viewed_at: string; viewed_by: string | null; ip: string | null };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const offset = Math.max(0, Number(new URL(req.url).searchParams.get("offset") ?? 0) || 0);
  const take = offset + PAGE_SIZE + 1; // um a mais para saber se há "ver mais"

  const [fv, dv] = await Promise.all([
    db.from("cm_party_qualification_field_views")
      .select("id, field, viewed_by, viewed_at, ip")
      .eq("qualification_id", id)
      .order("viewed_at", { ascending: false })
      .limit(take),
    db.from("cm_party_qualification_document_views")
      .select("id, document_id, viewed_by, viewed_at, ip_address")
      .eq("qualification_id", id)
      .order("viewed_at", { ascending: false })
      .limit(take),
  ]);
  if (fv.error || dv.error) {
    return NextResponse.json({ error: "Não foi possível carregar os acessos" }, { status: 500, headers: NO_STORE });
  }

  // Tipo do documento aberto (documento removido depois: o vínculo virou nulo).
  const docIds = [...new Set((dv.data ?? []).map((r) => r.document_id).filter(Boolean))] as string[];
  const kinds = new Map<string, string>();
  if (docIds.length) {
    const { data: docs } = await db.from("cm_party_qualification_documents").select("id, document_kind").in("id", docIds);
    for (const d of docs ?? []) kinds.set(d.id as string, d.document_kind as string);
  }

  const all: Item[] = [
    ...(fv.data ?? []).map((r) => ({
      id: r.id as string, source: "field_views" as const, field_label: labelRevealField(r.field as string),
      viewed_at: r.viewed_at as string, viewed_by: (r.viewed_by as string | null) ?? null, ip: (r.ip as string | null) ?? null,
    })),
    ...(dv.data ?? []).map((r) => {
      const kind = r.document_id ? kinds.get(r.document_id as string) : null;
      const label = kind ? (KYC_DOCUMENT_KIND_LABELS[kind as keyof typeof KYC_DOCUMENT_KIND_LABELS] ?? kind) : "Documento removido";
      return {
        id: r.id as string, source: "document_views" as const, field_label: `${label} aberto`,
        viewed_at: r.viewed_at as string, viewed_by: (r.viewed_by as string | null) ?? null, ip: (r.ip_address as string | null) ?? null,
      };
    }),
  ].sort((a, b) => (a.viewed_at < b.viewed_at ? 1 : a.viewed_at > b.viewed_at ? -1 : 0));

  const page = all.slice(offset, offset + PAGE_SIZE);
  const userIds = [...new Set(page.map((r) => r.viewed_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", userIds);
    for (const p of profiles ?? []) names.set(p.id as string, (p.full_name as string) || "Usuário");
  }

  const items = page.map((r) => ({
    id: r.id,
    source: r.source,
    field_label: r.field_label,
    viewed_at: r.viewed_at,
    viewed_by_name: r.viewed_by ? names.get(r.viewed_by) ?? "Usuário removido" : "Usuário removido",
    ip_masked: maskIp(r.ip),
  }));

  return NextResponse.json(
    { items, has_more: all.length > offset + PAGE_SIZE, can_erase: profile.role === "ADMIN" },
    { headers: NO_STORE },
  );
}
