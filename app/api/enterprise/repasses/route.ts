import { NextRequest, NextResponse } from "next/server";
import { exigirEnterprise } from "@/lib/enterprise-server";
import { listarRepasses } from "@/lib/enterprise-repasses";
import { periodoDoMes } from "@/lib/relatorio-mensal-partners";

// GET   ?mes=YYYY-MM|todos — master: repasses de todos os usuários dele; usuário: os próprios
// PATCH { ids: string[], status: "PAGO" | "PENDENTE" } — só o master marca pagamento

export async function GET(req: NextRequest) {
  const auth = await exigirEnterprise();
  if (!auth.ok) return auth.res;
  const mes = new URL(req.url).searchParams.get("mes");
  const periodo = !mes || mes === "todos" ? null : periodoDoMes(mes);
  try {
    const dados = await listarRepasses(auth.db, auth.ctx.ehMaster
      ? { enterpriseId: auth.userId, periodo }
      : { usuarioId: auth.userId, periodo });
    return NextResponse.json({ ...dados, ehMaster: auth.ctx.ehMaster, periodo });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true });
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as { ids?: string[]; status?: string };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
  if (ids.length === 0 || !["PAGO", "PENDENTE"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "Informe os repasses e o status (PAGO ou PENDENTE)." }, { status: 400 });
  }
  const pago = body.status === "PAGO";
  const { data, error } = await auth.db
    .from("enterprise_repasses")
    .update({ status: body.status, pago_em: pago ? new Date().toISOString() : null, pago_por: pago ? auth.userId : null })
    .in("id", ids)
    .eq("enterprise_id", auth.userId)
    .neq("status", "CANCELADO")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, atualizados: data?.length ?? 0 });
}
