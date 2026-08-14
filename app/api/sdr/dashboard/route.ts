import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { lookupProspeccaoEtapaByPhones } from "@/lib/sdr-prospeccao-sync";

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "SDR", "CLOSER"] as const;
const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;
const ETAPAS = ["prospect", "contatado", "interessado", "trial", "convertido", "perdido"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("id, role, full_name").eq("id", user.id).single();
  const me = profile as { id: string; role: string; full_name: string } | null;
  if (!me || !ALLOWED_ROLES.includes(me.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const isAdmin = ADMIN_ROLES.includes(me.role as typeof ADMIN_ROLES[number]);

  let leadsQuery = db
    .from("sdr_leads")
    .select("phone, nome, responsavel_id, status, created_at");
  if (!isAdmin) leadsQuery = leadsQuery.eq("responsavel_id", me.id);
  const { data: leadsData } = await leadsQuery;

  const leads = (leadsData ?? []) as Array<{
    phone: string; nome: string | null; responsavel_id: string | null; status: string; created_at: string;
  }>;
  const phones = leads.map(l => l.phone);
  const etapaByPhone = await lookupProspeccaoEtapaByPhones(phones);

  // Funil (etapa de Prospecção — leads sem etapa vinculada contam como "prospect")
  const funil = ETAPAS.map(etapa => ({
    etapa,
    count: leads.filter(l => (etapaByPhone[l.phone] ?? "prospect") === etapa).length,
  }));

  // Mensagens hoje (só do usuário, não da IA), escopadas aos telefones visíveis
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  let mensagensHoje = 0;
  const msgsPorPhone: Record<string, number> = {};
  if (phones.length > 0) {
    const { data: msgs } = await db
      .from("sdr_conversas")
      .select("phone")
      .eq("role", "user")
      .gte("created_at", inicioHoje.toISOString())
      .in("phone", phones);
    for (const m of msgs ?? []) {
      msgsPorPhone[m.phone] = (msgsPorPhone[m.phone] ?? 0) + 1;
      mensagensHoje++;
    }
  }

  // Evolução 7 dias (novos leads por dia, escopado)
  const evolucao7dias: { date: string; novos: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const novos = leads.filter(l => l.created_at.startsWith(dateStr)).length;
    evolucao7dias.push({ date: dateStr, novos });
  }

  const totalLeads = leads.length;
  const convertidos = leads.filter(l => (etapaByPhone[l.phone] ?? "") === "convertido").length;
  const taxaConversao = totalLeads > 0 ? Math.round((convertidos / totalLeads) * 100) : 0;

  const base = {
    totalLeads,
    mensagensHoje,
    taxaConversao,
    convertidos,
    funil,
    evolucao7dias,
  };

  if (!isAdmin) {
    return NextResponse.json(base);
  }

  // Breakdown por responsável (ADMIN/GESTAO)
  const { data: equipe } = await db
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["ADMIN", "GESTAO", "SDR", "CLOSER"])
    .order("full_name");

  const porResponsavel = (equipe ?? []).map(p => {
    const meusLeads = leads.filter(l => l.responsavel_id === p.id);
    const meusConvertidos = meusLeads.filter(l => (etapaByPhone[l.phone] ?? "") === "convertido").length;
    const minhasMensagensHoje = meusLeads.reduce((s, l) => s + (msgsPorPhone[l.phone] ?? 0), 0);
    return {
      id: p.id,
      nome: p.full_name,
      role: p.role,
      totalLeads: meusLeads.length,
      convertidos: meusConvertidos,
      mensagensHoje: minhasMensagensHoje,
    };
  }).sort((a, b) => b.totalLeads - a.totalLeads);

  const semResponsavel = leads.filter(l => !l.responsavel_id).length;

  return NextResponse.json({ ...base, porResponsavel, semResponsavel });
}
