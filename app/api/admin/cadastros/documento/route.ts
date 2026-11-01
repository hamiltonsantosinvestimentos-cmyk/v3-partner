import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const NO_STORE = { "Cache-Control": "no-store" };
const BUCKET = "partner-docs";
const LINK_SEGUNDOS = 60;

// Caminho gravado por /api/cadastro-partner: <uuid do cadastro>/(identidade|cnpj|socio)/<arquivo>
const CAMINHO_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(identidade|cnpj|socio)\/[A-Za-z0-9._-]+$/i;

// GET /api/admin/cadastros/documento?path=: documento de cadastro de partner (identidade, contrato social,
// documento de sócio). Política de sigilo (31/10/2026): o bucket partner-docs é privado e o arquivo só sai por
// aqui, só para ADMIN, só se o caminho constar no próprio cadastro, com o acesso registrado ANTES e link
// assinado de 60 segundos. Anônimo: 401. Qualquer outro caso: 404 genérico.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: perfil } = await db.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  const naoEncontrado = NextResponse.json({ error: "Documento não encontrado" }, { status: 404, headers: NO_STORE });
  if ((perfil as { role?: string } | null)?.role !== "ADMIN") return naoEncontrado;

  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!CAMINHO_RE.test(path) || path.includes("..")) return naoEncontrado;

  const cadastroId = path.split("/")[0];
  const tipo = path.split("/")[1].toLowerCase();
  const { data: cadastro } = await db
    .from("partner_registrations")
    .select("id, doc_identidade, doc_cnpj, doc_socio")
    .eq("id", cadastroId)
    .maybeSingle();
  if (!cadastro) return naoEncontrado;
  const c = cadastro as { doc_identidade: string[] | null; doc_cnpj: string[] | null; doc_socio: string[] | null };
  const constaNoCadastro = [...(c.doc_identidade ?? []), ...(c.doc_cnpj ?? []), ...(c.doc_socio ?? [])].includes(path);
  if (!constaNoCadastro) return naoEncontrado;

  // Registro do acesso ANTES do dado: falhou o log, o documento não sai.
  const { error: logErr } = await db.from("audit_logs").insert({
    user_id: user.id,
    user_name: (perfil as { full_name?: string } | null)?.full_name ?? null,
    action: "cadastro_partner_documento_aberto",
    entity: "partner_registrations",
    entity_id: cadastroId,
    new_data: { tipo, perfil: "ADMIN" },
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
  });
  if (logErr) {
    console.error("[admin/cadastros/documento] falha ao gravar log de acesso", { code: logErr.code });
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  const { data: link, error } = await db.storage.from(BUCKET).createSignedUrl(path, LINK_SEGUNDOS);
  if (error || !link?.signedUrl) return naoEncontrado;
  return NextResponse.redirect(link.signedUrl, { status: 302, headers: NO_STORE });
}
