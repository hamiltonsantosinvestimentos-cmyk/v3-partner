import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ProspeccaoDashboardClient } from "@/components/prospeccao/prospeccao-dashboard-client";

const ALLOWED = ["ADMIN", "SDR", "CLOSER", "GESTAO"];
const META_MENSAL = 10;

export default async function ProspeccaoDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: profile } = await db
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  const p = profile as { id: string; role: string; full_name: string } | null;
  if (!p || !ALLOWED.includes(p.role)) redirect("/unauthorized");

  // ── Buscar todos os leads ───────────────────────────────────────────────────
  const { data: allLeads } = await db
    .from("prospeccao_leads")
    .select("id, etapa, responsavel_id, responsavel_nome, origem, created_at, convertido_em");

  const leads = (allLeads ?? []) as Array<{
    id: string;
    etapa: string;
    responsavel_id: string | null;
    responsavel_nome: string | null;
    origem: string;
    created_at: string;
    convertido_em: string | null;
  }>;

  const isPersonal = p.role === "SDR" || p.role === "CLOSER";
  const etapas = ["prospect", "contatado", "interessado", "trial", "convertido"];

  // ── Funil global ─────────────────────────────────────────────────────────────
  const funil = etapas.map(etapa => ({
    etapa,
    count: leads.filter(l => l.etapa === etapa).length,
  }));

  // ── Taxa de conversão ─────────────────────────────────────────────────────────
  const total = leads.length;
  const totalConvertidos = leads.filter(l => l.etapa === "convertido").length;
  const taxaConversao = total > 0 ? Math.round((totalConvertidos / total) * 100) : 0;

  // ── Meta mensal ───────────────────────────────────────────────────────────────
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const convertidosMes = leads.filter(
    l => l.etapa === "convertido" && l.convertido_em && l.convertido_em >= inicioMes
  ).length;
  const metaMensal = { atual: convertidosMes, meta: META_MENSAL };

  // ── Top closers ───────────────────────────────────────────────────────────────
  const closerMap: Record<string, { nome: string; convertidos: number }> = {};
  for (const lead of leads) {
    if (lead.etapa === "convertido" && lead.responsavel_id) {
      if (!closerMap[lead.responsavel_id]) {
        closerMap[lead.responsavel_id] = {
          nome: lead.responsavel_nome ?? lead.responsavel_id,
          convertidos: 0,
        };
      }
      closerMap[lead.responsavel_id].convertidos++;
    }
  }
  const topClosers = Object.values(closerMap)
    .sort((a, b) => b.convertidos - a.convertidos)
    .slice(0, 3);

  // ── Origens ───────────────────────────────────────────────────────────────────
  const origensMap: Record<string, number> = {};
  for (const lead of leads) {
    origensMap[lead.origem] = (origensMap[lead.origem] ?? 0) + 1;
  }
  const origens = Object.entries(origensMap)
    .map(([origem, count]) => ({ origem, count }))
    .sort((a, b) => b.count - a.count);

  // ── Evolução 7 dias ───────────────────────────────────────────────────────────
  const evolucao7dias: { date: string; novos: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const novos = leads.filter(l => l.created_at.startsWith(dateStr)).length;
    evolucao7dias.push({ date: dateStr, novos });
  }

  // ── Funil do Quiz Seja Partner (progresso passo a passo) ──────────────────────
  const QUIZ_STEPS: { key: string; label: string }[] = [
    { key: "intro", label: "Abriu a página" },
    { key: "objetivo", label: "Começou o quiz" },
    { key: "ocupacao", label: "Ocupação" },
    { key: "experiencia", label: "Experiência B2B" },
    { key: "rede", label: "Rede" },
    { key: "porte", label: "Porte da rede" },
    { key: "renda", label: "Renda" },
    { key: "disponibilidade", label: "Disponibilidade" },
    { key: "prazo", label: "Quando começar" },
    { key: "previa", label: "Viu o plano sugerido" },
    { key: "dados", label: "Dados de contato" },
    { key: "concluido", label: "Concluiu ✓" },
  ];
  const { data: qpRows } = await db
    .from("quiz_progress")
    .select("session_id, step")
    .eq("quiz", "seja_partner");
  const stepSessions: Record<string, Set<string>> = {};
  for (const r of (qpRows ?? []) as { session_id: string; step: string }[]) {
    (stepSessions[r.step] ??= new Set()).add(r.session_id);
  }
  const quizFunil = QUIZ_STEPS.map(s => ({ ...s, count: stepSessions[s.key]?.size ?? 0 }));

  // ── Meu funil pessoal ─────────────────────────────────────────────────────────
  let meusFunil: { etapa: string; count: number }[] | undefined = undefined;
  if (isPersonal) {
    const meusLeads = leads.filter(l => l.responsavel_id === p.id);
    meusFunil = etapas.map(etapa => ({
      etapa,
      count: meusLeads.filter(l => l.etapa === etapa).length,
    }));
  }

  const dashData = {
    funil,
    taxaConversao,
    metaMensal,
    topClosers,
    origens,
    evolucao7dias,
    meusFunil,
    quizFunil,
  };

  return (
    <div className="p-6">
      <ProspeccaoDashboardClient
        data={dashData}
        role={p.role}
        userName={p.full_name}
      />
    </div>
  );
}
