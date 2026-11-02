import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exigirUsuarioAutorizado } from "@/lib/assistente/acesso";
import { desconectarSessao, garantirConfig, svcAssistente } from "@/lib/assistente/conexao";

// DELETE: "Excluir todos os meus dados". As linhas do banco V3 só são apagadas depois de o gateway confirmar.
export async function DELETE(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const corpo = z.object({ confirmacao: z.literal("EXCLUIR") }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ error: "Digite EXCLUIR para confirmar." }, { status: 400 });

  const db = svcAssistente();
  try {
    const config = await garantirConfig(db, auth.user.id);
    await desconectarSessao(db, config);
  } catch (e) {
    console.error("[Assistente dados] gateway falhou", { erro: e instanceof Error ? e.name : "erro" });
    return NextResponse.json({ error: "O servidor de WhatsApp não confirmou. Nada foi excluído. Tente novamente." }, { status: 502 });
  }

  // assistente_config por último: é ela que libera as políticas do banco, e uma repetição continua funcionando.
  for (const tabela of ["assistente_lancamentos", "assistente_compromissos", "assistente_mensagens", "assistente_verificacao", "assistente_config"]) {
    const { error } = await db.from(tabela).delete().eq("user_id", auth.user.id);
    if (error) {
      console.error("[Assistente dados] falha ao apagar", { tabela, codigo: error.code });
      return NextResponse.json({ error: "A exclusão ficou incompleta. Tente novamente." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
