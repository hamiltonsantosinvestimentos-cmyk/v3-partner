// Assinatura da equipe Enterprise (BRIEF docs/briefs/2026-11-23_enterprise-assinatura-da-equipe.md).
// O master define se cobra cada usuário, o valor, a periodicidade e o vencimento, e marca o pagamento.
// A V3 só registra: nenhum dinheiro passa pela plataforma.
// GET   — usuários do master com o registro e a situação (modo ADMIN: só leitura, com ACCESS no log)
// PATCH { id, cobra, valor?, periodicidade?, dia_vencimento?, inicio? }   — define/altera
//       { id, registrar_pagamento: "AAAA-MM-DD" }                          — quita o vencimento em aberto
//       { id, desfazer_pagamento: "AAAA-MM-DD" }                           — volta o último registro
import { NextRequest, NextResponse } from "next/server";
import { exigirEnterprise, logLeituraAdmin } from "@/lib/enterprise-server";
import { getClientIp, logAudit, logAuditStrict } from "@/lib/audit";
import {
  PERIODICIDADES, VALOR_MAXIMO, dataValida, hojeSaoPaulo, lerAssinatura, lerValor, situacaoAssinatura,
  vencimentoAnterior, vencimentoEmAberto, type AssinaturaEquipe, type Periodicidade,
} from "@/lib/enterprise-assinatura";

const INDISPONIVEL = "Indisponível até a atualização do banco.";

export async function GET(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true, req, permitirAdmin: true });
  if (!auth.ok) return auth.res;
  const { data, error } = await auth.db.from("profiles")
    .select("id, full_name, is_active, enterprise_assinatura").eq("enterprise_id", auth.userId);
  const indisponivel = !!error;
  let linhas = (data ?? []) as { id: string; full_name: string | null; is_active: boolean | null; enterprise_assinatura?: unknown }[];
  if (error) {
    const { data: semColuna } = await auth.db.from("profiles").select("id, full_name, is_active").eq("enterprise_id", auth.userId);
    linhas = (semColuna ?? []) as typeof linhas;
  }
  const hoje = hojeSaoPaulo();
  const usuarios = linhas
    .map((u) => {
      const registro = lerAssinatura(u.enterprise_assinatura);
      return { id: u.id, nome: u.full_name ?? "Sem nome", ativo: u.is_active !== false, registro, situacao: situacaoAssinatura(registro, hoje) };
    })
    .sort((a, b) => (a.ativo === b.ativo ? a.nome.localeCompare(b.nome, "pt-BR") : a.ativo ? -1 : 1));
  await logLeituraAdmin(auth, req, { action: "ACCESS", newData: { tela: "enterprise_assinaturas", total: usuarios.length } });
  return NextResponse.json({ usuarios, hoje, indisponivel });
}

export async function PATCH(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true, req });
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id || !auth.ctx.usuariosIds.includes(id)) return NextResponse.json({ error: "Usuário não pertence a este Enterprise." }, { status: 404 });

  const { data: perfil, error: errLeitura } = await auth.db.from("profiles")
    .select("full_name, enterprise_assinatura").eq("id", id).maybeSingle();
  if (errLeitura) return NextResponse.json({ error: INDISPONIVEL }, { status: 503 });
  const atual = lerAssinatura((perfil as { enterprise_assinatura?: unknown } | null)?.enterprise_assinatura);

  let novo: AssinaturaEquipe;
  let acao: string;

  if (typeof body.registrar_pagamento === "string") {
    if (!atual || !atual.cobra) return NextResponse.json({ error: "Este usuário não tem cobrança ativa." }, { status: 400 });
    if (body.registrar_pagamento !== vencimentoEmAberto(atual)) {
      return NextResponse.json({ error: "Este vencimento já foi registrado ou mudou. Atualize a tela." }, { status: 409 });
    }
    novo = { ...atual, pago_ate: body.registrar_pagamento };
    acao = "registrar_pagamento";
  } else if (typeof body.desfazer_pagamento === "string") {
    if (!atual || !atual.pago_ate || body.desfazer_pagamento !== atual.pago_ate) {
      return NextResponse.json({ error: "Este registro já foi desfeito ou mudou. Atualize a tela." }, { status: 409 });
    }
    novo = { ...atual, pago_ate: vencimentoAnterior(atual) };
    acao = "desfazer_pagamento";
  } else {
    const cobra = body.cobra === true;
    if (!cobra) {
      if (!atual) return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
      novo = { ...atual, cobra: false };
      acao = "desligar_cobranca";
    } else {
      const valor = lerValor(body.valor ?? atual?.valor);
      if (valor == null || valor <= 0 || valor > VALOR_MAXIMO) return NextResponse.json({ error: "Informe um valor entre R$ 0,01 e R$ 1.000.000,00." }, { status: 400 });
      const periodicidade = (body.periodicidade ?? atual?.periodicidade) as Periodicidade;
      if (!PERIODICIDADES.includes(periodicidade)) return NextResponse.json({ error: "Periodicidade inválida." }, { status: 400 });
      const dia = Number(body.dia_vencimento ?? atual?.dia_vencimento);
      if (!Number.isInteger(dia) || dia < 1 || dia > 28) return NextResponse.json({ error: "Dia de vencimento deve ser de 1 a 28." }, { status: 400 });
      const inicio = (body.inicio ?? atual?.inicio ?? hojeSaoPaulo()) as string;
      if (!dataValida(inicio)) return NextResponse.json({ error: "Data de início inválida." }, { status: 400 });
      // Mudar periodicidade, dia ou início, ou religar, reinicia a série e zera o último pagamento.
      const reinicia = !atual || !atual.cobra || atual.periodicidade !== periodicidade || atual.dia_vencimento !== dia || atual.inicio !== inicio;
      novo = { cobra: true, valor, periodicidade, dia_vencimento: dia, inicio, pago_ate: reinicia ? null : atual!.pago_ate };
      acao = reinicia ? "definir_cobranca" : "alterar_valor";
    }
  }

  const dadosLog = {
    userId: auth.userId, userName: auth.nome, action: "UPDATE" as const, entity: "profiles", entityId: id,
    oldData: { enterprise_assinatura: atual }, newData: { enterprise_assinatura: novo, acao, usuario: perfil?.full_name ?? null },
    ipAddress: getClientIp(req),
  };
  try {
    await logAuditStrict(dadosLog);
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar a alteração. Nada foi salvo; tente de novo." }, { status: 500 });
  }
  const { error } = await auth.db.from("profiles").update({ enterprise_assinatura: novo }).eq("id", id).eq("enterprise_id", auth.userId);
  if (error) {
    await logAudit({ ...dadosLog, newData: { ...dadosLog.newData, resultado: "falhou", erro: error.message } }).catch(() => {});
    return NextResponse.json({ error: "Não foi possível salvar. Tente de novo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, registro: novo, situacao: situacaoAssinatura(novo, hojeSaoPaulo()) });
}
