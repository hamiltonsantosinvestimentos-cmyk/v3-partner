import Link from "next/link";
import { createClient as sc } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import { CLOSER_ASSINATURA_PERCENT, CLOSER_ASSINATURA_REF_PREFIX, CLOSER_OPERATION_REF, CLOSER_PERCENT } from "@/lib/closer-commissions";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const dataBR = (d: string | null) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("pt-BR") : "—";

const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_AUTORIZACAO: "Aguardando autorização",
  A_PAGAR: "A pagar",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
};

type Partner = { id: string; full_name: string | null; email: string; role: string; is_active: boolean; closer_vinculado_em: string | null };
type Linha = {
  id: string; code: string; operation_code: string | null; operation_description: string;
  operation_value: number; commission_value: number | null; status: string;
  operation_closed_at: string | null; payment_date: string | null; referral_source_commission_id: string | null;
  operation_ref: string | null; operation_id: string | null;
};
type Origem = { id: string; partner_id: string; operation_value: number; commission_value: number | null };

export default async function CloserPage({ searchParams }: { searchParams: Promise<{ closer?: string }> }) {
  const { user, role } = await requireRole(["ADMIN", "GESTAO", "FINANCEIRO", "CLOSER"]);

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // O closer vê só o que é dele; a gestão escolhe o closer
  let closers: { id: string; full_name: string | null; email: string }[] = [];
  if (role !== "CLOSER") {
    const { data } = await svc.from("profiles").select("id, full_name, email").eq("role", "CLOSER").order("full_name");
    closers = data ?? [];
  }
  const { closer: closerParam } = await searchParams;
  const closerId = role === "CLOSER" ? user.id : (closers.find((c) => c.id === closerParam) ?? closers[0])?.id;

  const { data: partnersRaw } = closerId
    ? await svc.from("profiles")
        .select("id, full_name, email, role, is_active, closer_vinculado_em")
        .eq("closer_id", closerId)
        .order("full_name")
    : { data: [] };
  const partners = (partnersRaw ?? []) as Partner[];

  const { data: linhasRaw } = closerId
    ? await svc.from("commissions")
        .select("id, code, operation_code, operation_description, operation_value, commission_value, status, operation_closed_at, payment_date, referral_source_commission_id, operation_ref, operation_id")
        .eq("partner_id", closerId)
        .like("operation_ref", "closer%")
        .order("created_at", { ascending: false })
    : { data: [] };
  const todas = (linhasRaw ?? []) as Linha[];
  const linhas = todas.filter((l) => l.operation_ref === CLOSER_OPERATION_REF);
  const mensalidades = todas.filter((l) => l.operation_ref?.startsWith(CLOSER_ASSINATURA_REF_PREFIX));

  const origemIds = linhas.map((l) => l.referral_source_commission_id).filter((x): x is string => !!x);
  const { data: origensRaw } = origemIds.length
    ? await svc.from("commissions").select("id, partner_id, operation_value, commission_value").in("id", origemIds)
    : { data: [] };
  const origens = new Map(((origensRaw ?? []) as Origem[]).map((o) => [o.id, o]));

  const validas = todas.filter((l) => l.status !== "CANCELADA");
  const operacoesValidas = validas.filter((l) => l.operation_ref === CLOSER_OPERATION_REF);
  const mensalidadesValidas = validas.filter((l) => l.operation_ref !== CLOSER_OPERATION_REF);
  const soma = (ls: Linha[], campo: "operation_value" | "commission_value") =>
    ls.reduce((t, l) => t + Number(l[campo] ?? 0), 0);
  const kpis = [
    { label: "Partners vinculados", valor: String(partners.length) },
    { label: "Líquido V3 gerado", valor: money(soma(operacoesValidas, "operation_value")) },
    { label: "Mensalidades pagas", valor: money(soma(mensalidadesValidas, "operation_value")) },
    { label: "A receber", valor: money(soma(validas.filter((l) => l.status !== "PAGA"), "commission_value")) },
    { label: "Recebido", valor: money(soma(validas.filter((l) => l.status === "PAGA"), "commission_value")) },
  ];

  // Busca pela origem: o partner pode ter sido desvinculado depois da comissão
  const idsOrigem = [...new Set([
    ...[...origens.values()].map((o) => o.partner_id),
    ...mensalidades.map((l) => l.operation_id).filter((x): x is string => !!x),
  ])];
  const { data: nomesRaw } = idsOrigem.length
    ? await svc.from("profiles").select("id, full_name, email").in("id", idsOrigem)
    : { data: [] };
  const nomePartner = new Map(((nomesRaw ?? []) as { id: string; full_name: string | null; email: string }[]).map((p) => [p.id, p.full_name || p.email]));
  const th = "text-left text-[10px] font-bold uppercase tracking-wider text-[#C9A84C] px-4 py-3 whitespace-nowrap";
  const td = "px-4 py-3 text-sm text-[#7A8FA8] whitespace-nowrap";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F0ECE4]">Closer</h1>
        <p className="text-sm text-[#7A8FA8] mt-1">
          Em todos os partners vinculados: {CLOSER_ASSINATURA_PERCENT}% de cada mensalidade paga e {CLOSER_PERCENT}% sobre o que fica líquido para a V3 nas operações.
          Exemplo: entrou R$ 100.000 para a V3, R$ 50.000 foram para o partner, o closer recebe R$ 5.000.
        </p>
      </div>

      {closers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {closers.map((c) => (
            <Link
              key={c.id}
              href={`/closer?closer=${c.id}`}
              className={`px-3 py-1.5 rounded-lg text-sm border ${c.id === closerId ? "border-[#C9A84C] text-[#C9A84C]" : "border-[#243A66] text-[#7A8FA8]"}`}
            >
              {c.full_name || c.email}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-[#162744] border border-[#243A66] rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C]">{k.label}</p>
            <p className="text-xl font-bold text-[#F0ECE4] mt-1">{k.valor}</p>
          </div>
        ))}
      </div>

      <section className="bg-[#162744] border border-[#243A66] rounded-xl overflow-hidden">
        <h2 className="text-base font-semibold text-[#F0ECE4] px-4 pt-4 pb-2">Partners vinculados</h2>
        {partners.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-[#7A8FA8]">Nenhum partner vinculado. O vínculo é feito em Usuários, no campo Closer responsável.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-[#243A66]"><th className={th}>Partner</th><th className={th}>Plano</th><th className={th}>Situação</th><th className={th}>Vinculado em</th></tr></thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-b border-[#243A66]/50">
                    <td className={`${td} text-[#F0ECE4]`}>{p.full_name || p.email}</td>
                    <td className={td}>{ROLE_LABELS[p.role as UserRole] ?? p.role}</td>
                    <td className={td}>{p.is_active ? "Ativo" : "Inativo"}</td>
                    <td className={td}>{dataBR(p.closer_vinculado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-[#162744] border border-[#243A66] rounded-xl overflow-hidden">
        <h2 className="text-base font-semibold text-[#F0ECE4] px-4 pt-4 pb-2">Comissões sobre mensalidades ({CLOSER_ASSINATURA_PERCENT}%)</h2>
        {mensalidades.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-[#7A8FA8]">Nenhuma mensalidade paga até agora.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#243A66]">
                  <th className={th}>Código</th><th className={th}>Partner</th><th className={th}>Mensalidade paga</th>
                  <th className={th}>Closer {CLOSER_ASSINATURA_PERCENT}%</th><th className={th}>Status</th><th className={th}>Data</th>
                </tr>
              </thead>
              <tbody>
                {mensalidades.map((l) => (
                  <tr key={l.id} className="border-b border-[#243A66]/50">
                    <td className={td}>{l.code}</td>
                    <td className={`${td} text-[#F0ECE4]`}>{(l.operation_id && nomePartner.get(l.operation_id)) || "—"}</td>
                    <td className={td}>{money(Number(l.operation_value))}</td>
                    <td className={`${td} font-semibold text-[#C9A84C]`}>{money(Number(l.commission_value ?? 0))}</td>
                    <td className={td}>{STATUS_LABEL[l.status] ?? l.status}</td>
                    <td className={td}>{dataBR(l.payment_date ?? l.operation_closed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-[#162744] border border-[#243A66] rounded-xl overflow-hidden">
        <h2 className="text-base font-semibold text-[#F0ECE4] px-4 pt-4 pb-2">Comissões sobre operações ({CLOSER_PERCENT}%)</h2>
        {linhas.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-[#7A8FA8]">Nenhuma comissão gerada até agora.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#243A66]">
                  <th className={th}>Código</th><th className={th}>Partner</th><th className={th}>Operação</th>
                  <th className={th}>Entrada V3</th><th className={th}>Partner</th><th className={th}>Líquido V3</th>
                  <th className={th}>Closer {CLOSER_PERCENT}%</th><th className={th}>Status</th><th className={th}>Data</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const o = l.referral_source_commission_id ? origens.get(l.referral_source_commission_id) : undefined;
                  return (
                    <tr key={l.id} className="border-b border-[#243A66]/50">
                      <td className={td}>{l.code}</td>
                      <td className={`${td} text-[#F0ECE4]`}>{(o && nomePartner.get(o.partner_id)) || "—"}</td>
                      <td className={td}>{l.operation_code || l.operation_description}</td>
                      <td className={td}>{o ? money(Number(o.operation_value)) : "—"}</td>
                      <td className={td}>{o ? money(Number(o.commission_value ?? 0)) : "—"}</td>
                      <td className={td}>{money(Number(l.operation_value))}</td>
                      <td className={`${td} font-semibold text-[#C9A84C]`}>{money(Number(l.commission_value ?? 0))}</td>
                      <td className={td}>{STATUS_LABEL[l.status] ?? l.status}</td>
                      <td className={td}>{dataBR(l.payment_date ?? l.operation_closed_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
