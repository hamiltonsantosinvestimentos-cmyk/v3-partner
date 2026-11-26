// "Redefinir senha" do Meu Perfil. Equipe de Enterprise com domínio pronto recebe o e-mail e o link
// da marca (a marca segue o usuário, não o host); os demais seguem o e-mail padrão do Supabase.
// BRIEF docs/briefs/2026-11-26_perfil-redefinir-senha-marca-enterprise.md
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/audit";
import { daEquipe } from "@/lib/recuperar-senha-regras";
import { dominioProntoDoMaster, enviarLinkDaMarca, servico, type PerfilEquipe } from "@/lib/recuperar-senha";

const MSG_FALHA = "Não foi possível enviar o e-mail agora. Tente de novo em instantes.";
const MSG_LIMITE = "Já enviamos um e-mail há pouco. Confira sua caixa de entrada e o spam, ou tente de novo em alguns minutos.";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = servico();
  const ok = () => NextResponse.json({ ok: true, message: `E-mail de redefinição enviado para ${user.email}` });

  try {
    const { data: p, error } = await svc.from("profiles")
      .select("id, role, enterprise_id, full_name").eq("id", user.id).maybeSingle();
    if (error) throw new Error(`profiles: ${error.message}`);
    const perfil = p as PerfilEquipe | null;
    const masterId = perfil?.role === "ENTERPRISE" ? (perfil.enterprise_id ?? perfil.id) : null;

    if (perfil && masterId && daEquipe(perfil, masterId)) {
      const dominio = await dominioProntoDoMaster(svc, masterId);
      if (dominio) {
        const r = await enviarLinkDaMarca(svc, perfil, dominio, getClientIp(req), "perfil");
        if (r === "enviado") return ok();
        if (r === "limite") return NextResponse.json({ error: MSG_LIMITE }, { status: 429 });
        return NextResponse.json({ error: MSG_FALHA }, { status: 500 });
      }
    }
  } catch (e) {
    // Falha fechado: nunca cai no e-mail da V3 por erro de consulta.
    console.error("[reset-password] envio da marca não concluído", user.id, (e as Error)?.message ?? "erro");
    return NextResponse.json({ error: MSG_FALHA }, { status: 500 });
  }

  // Fluxo padrão (V3): e-mail do Supabase.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.v3partners.com.br";
  const { error } = await svc.auth.resetPasswordForEmail(user.email, { redirectTo: `${siteUrl}/auth/update-password` });
  if (error) {
    console.error("[reset-password] Supabase recusou o envio", user.id, error.message);
    return NextResponse.json({ error: MSG_FALHA }, { status: 500 });
  }
  return ok();
}
