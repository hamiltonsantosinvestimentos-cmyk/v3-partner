import { NextRequest, NextResponse } from "next/server";
import { ehDaEquipe } from "@/lib/enterprise";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { resolveBucket } from "@/lib/documentos/bucket";
import { nomesDeExibicao } from "@/lib/documentos/nome-arquivo";
import { nomesGravados } from "@/lib/documentos/nomear-proposta";

// GET /api/credit-proposals/documents/download?proposal_id=&storage_path=
// URL de baixar com o nome de exibição (BRIEF 09/11/2026, nomear documentos). Gerada só no clique, para a aba
// Documentos não fazer uma chamada ao Storage por arquivo. Mesma checagem de acesso do GET de documentos.

export const dynamic = "force-dynamic";

const READ_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] as const;
const EXPIRA_S = 5 * 60;

type DocEntry = { doc_id: string; file_name: string; storage_path: string; uploaded_at: string; bucket?: string };

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const proposalId = req.nextUrl.searchParams.get("proposal_id");
  const storagePath = req.nextUrl.searchParams.get("storage_path");
  if (!proposalId || !storagePath) return NextResponse.json({ error: "proposal_id e storage_path obrigatórios" }, { status: 400 });

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: proposal } = await svc.from("credit_desk_proposals").select("id, partner_id, documents").eq("id", proposalId).single();
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const isReader = READ_ROLES.includes(profile?.role as typeof READ_ROLES[number]);
  if (!isReader && !(await ehDaEquipe(user.id, proposal.partner_id))) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const docs: DocEntry[] = Array.isArray(proposal.documents) ? proposal.documents : [];
  const doc = docs.find((d) => d.storage_path === storagePath);
  if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  const gravados = await nomesGravados(svc, proposalId);
  const nome = nomesDeExibicao(docs, new Map([...gravados].map(([k, v]) => [k, v.nome]))).get(storagePath) ?? doc.file_name;

  const { data, error } = await svc.storage.from(resolveBucket(doc)).createSignedUrl(storagePath, EXPIRA_S, { download: nome });
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Não foi possível gerar o link de download." }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, nome });
}
