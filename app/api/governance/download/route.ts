import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { logAuditStrict, getClientIp } from "@/lib/audit";
import { carregarConcessoes } from "@/lib/governance/concessoes-server";
import { concessoesEfetivas, ehAdmin, podeAcessarCaminho, caminhoSeguro, MSG_SEM_ACESSO_ARQUIVO } from "@/lib/governance/acesso-pasta";

// Download da Pasta Pública (BRIEF 2026-11-24): só arquivo dentro de pasta concedida e válida, fora de subpasta
// oculta para externo, sem "..". Log gravado antes do link; se não gravar, nenhum link sai.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const BUCKET = "v3-docs-publico";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  const role = profile?.role ?? "";

  const filePath = new URL(req.url).searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "path obrigatório" }, { status: 400 });
  if (!caminhoSeguro(filePath)) return NextResponse.json({ error: MSG_SEM_ACESSO_ARQUIVO }, { status: 403 });

  if (!ehAdmin(role)) {
    const efetivas = concessoesEfetivas(role, await carregarConcessoes(db, user.id), new Date().toISOString());
    if (!podeAcessarCaminho(role, efetivas, filePath)) {
      return NextResponse.json({ error: MSG_SEM_ACESSO_ARQUIVO }, { status: 403 });
    }
  }

  try {
    await logAuditStrict({
      userId: user.id, userName: profile?.full_name, action: "ACCESS", entity: "profiles", entityId: user.id,
      newData: { pasta_publica_download: filePath, papel: role }, ipAddress: getClientIp(req),
    });
  } catch (e) {
    console.error("[governance/download] auditoria falhou:", e);
    return NextResponse.json({ error: "Não foi possível registrar o acesso. Tente novamente." }, { status: 500 });
  }

  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(filePath, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Não foi possível gerar o link do arquivo." }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl, expires_in: 300 });
}
