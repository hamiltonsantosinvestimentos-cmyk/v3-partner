// POST /api/admin/api-termos — ADMIN publica uma versão do Termo de Uso da API.
// Recusa texto com lacunas ("[...]"). Publicar versão nova suspende as chaves de quem não aceitou
// (a conferência é feita em cada chamada da API, em lib/api-v1/auth.ts).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chamador, svcDb } from "@/lib/integracao-api";
import { hashTexto, termoTemLacuna } from "@/lib/api-keys";
import { logAuditStrict } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  versao: z.string().trim().regex(/^\d+(\.\d+){0,2}$/, "Versão no formato 2.1"),
  texto: z.string().min(2000, "Cole o texto integral do termo."),
  vigencia_inicio: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), "Data de vigência inválida."),
});

export async function POST(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (c.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito ao ADMIN." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const texto = parsed.data.texto.replace(/\r\n/g, "\n").trim();
  if (termoTemLacuna(texto)) {
    const lacunas = [...new Set(texto.replace(/^\[ \]/gm, "").match(/\[[^\]]*\]/g) ?? [])].slice(0, 6);
    return NextResponse.json({ error: `O termo ainda tem lacunas: ${lacunas.join(", ")}. Preencha antes de publicar.` }, { status: 400 });
  }
  const hash = hashTexto(texto);
  try {
    await logAuditStrict({ userId: c.id, userName: c.nome, action: "CREATE", entity: "profiles", entityId: c.id, ipAddress: c.ip,
      newData: { evento: "api_termo_publicado", versao: parsed.data.versao, hash, vigencia_inicio: parsed.data.vigencia_inicio } });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar a auditoria. Nada foi publicado." }, { status: 500 });
  }
  const { error } = await svcDb().from("partner_api_termos").insert({
    versao: parsed.data.versao, texto, hash, vigencia_inicio: new Date(parsed.data.vigencia_inicio).toISOString(), created_by: c.id,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "Essa versão já foi publicada. Use um número de versão novo." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível publicar. Tente de novo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, hash });
}
