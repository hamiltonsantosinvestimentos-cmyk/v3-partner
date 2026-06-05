import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://sbmuashewklfhdyyuezr.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibXVhc2hld2tsZmhkeXl1ZXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NjQ4NiwiZXhwIjoyMDkwODUyNDg2fQ.Hjl0KdHEkZY-Ha-3lsCmSNcEubnFXuvv6tsfC6C9Kz0";

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Propostas afetadas
const AFFECTED = [
  { id: null, code: "CRED-26-133404", name: "MARCOS MAGNI PEREIRA" },
  { id: null, code: "CRED-26-374235", name: "Orivaldo Álvares perico" },
  { id: null, code: "CRED-26-760334", name: "Sérgio Ricardo Cunha" },
  { id: null, code: "CRED-26-921670", name: "ADILSON JOSE BUENO DE SOUZA" },
  { id: null, code: "CRED-26-845932", name: "APARECIDO ROBERTO BRAGA" },
  { id: null, code: "CRED-26-980190", name: "RODRIGO FERREIRA PINTO" },
  { id: null, code: "CRED-26-201478", name: "BONIFACIO DARCI NUNES" },
  { id: null, code: "CRED-26-596257", name: "RAMBORGER E PLETSCH LTDA" },
  { id: null, code: "CRED-26-266830", name: "Abastecedora de Combustíveis Volken I Ltda" },
  { id: null, code: "CRED-26-846530", name: "ELIANE APARECIDA FONTANELLA PILON" },
];

async function main() {
  console.log("=== BUSCA DE DADOS DE CLIENTES EM OUTRAS TABELAS ===\n");

  // Busca IDs e dados completos das propostas afetadas (incluindo todos os campos)
  const codes = AFFECTED.map(a => a.code);
  const { data: proposals } = await svc
    .from("credit_desk_proposals")
    .select("*")
    .in("code", codes);

  console.log("── DADOS JÁ EXISTENTES NA PROPOSTA (campos top-level) ──");
  const proposalMap = {};
  for (const p of (proposals ?? [])) {
    proposalMap[p.code] = p;
    console.log(`\n${p.code} — ${p.client_name}`);
    console.log(`  client_cpf_cnpj : ${p.client_cpf_cnpj ?? "(vazio)"}`);
    console.log(`  credit_line     : ${p.credit_line}`);
    console.log(`  requested_value : R$ ${p.requested_value?.toLocaleString("pt-BR")}`);
    console.log(`  current_level   : ${p.current_level}`);
    console.log(`  partner_id      : ${p.partner_id}`);
    console.log(`  metadata        : ${JSON.stringify(p.metadata)}`);
    console.log(`  documents       : ${JSON.stringify(p.documents)?.slice(0,200) ?? "(vazio)"}`);
  }

  // Busca nomes para pesquisa parcial
  const names = AFFECTED.map(a => a.name.split(" ")[0].toUpperCase()); // primeiro nome

  console.log("\n\n── CRM LEADS ──");
  const { data: crmLeads, error: crmErr } = await svc
    .from("crm_leads")
    .select("name, email, phone, cpf_cnpj, company, notes, created_at")
    .limit(200);

  if (crmErr) {
    console.log("Tabela crm_leads não acessível:", crmErr.message);
  } else {
    const matched = (crmLeads ?? []).filter(l => {
      const fullName = (l.name ?? "").toUpperCase();
      return AFFECTED.some(a => {
        const parts = a.name.toUpperCase().split(" ");
        return parts.some(p => p.length > 3 && fullName.includes(p));
      });
    });
    if (matched.length === 0) {
      console.log("Nenhum cliente encontrado no CRM.");
    } else {
      matched.forEach(l => console.log("  ENCONTRADO:", JSON.stringify(l)));
    }
  }

  console.log("\n── PROSPECÇÃO LEADS ──");
  const { data: prospLeads, error: prospErr } = await svc
    .from("prospeccao_leads")
    .select("nome, email, telefone, cpf_cnpj, empresa, created_at")
    .limit(200);

  if (prospErr) {
    console.log("Tabela prospeccao_leads não acessível:", prospErr.message);
  } else {
    const matched = (prospLeads ?? []).filter(l => {
      const fullName = (l.nome ?? l.empresa ?? "").toUpperCase();
      return AFFECTED.some(a => {
        const parts = a.name.toUpperCase().split(" ");
        return parts.some(p => p.length > 3 && fullName.includes(p));
      });
    });
    if (matched.length === 0) {
      console.log("Nenhum cliente encontrado em prospeccao_leads.");
    } else {
      matched.forEach(l => console.log("  ENCONTRADO:", JSON.stringify(l)));
    }
  }

  console.log("\n── PARTNER REGISTRATIONS (dados do partner que enviou) ──");
  const partnerIds = [...new Set((proposals ?? []).map(p => p.partner_id).filter(Boolean))];
  if (partnerIds.length > 0) {
    const { data: partners } = await svc
      .from("profiles")
      .select("id, full_name, email")
      .in("id", partnerIds);
    console.log("Partners que enviaram as propostas afetadas:");
    (partners ?? []).forEach(p => console.log(`  ${p.full_name} — ${p.email} (id: ${p.id})`));
  }

  console.log("\n── CONTRATOS MANDATO ──");
  const { data: contratos, error: contErr } = await svc
    .from("contratos_mandato")
    .select("nome_cliente, cpf_cnpj, email, telefone, created_at")
    .limit(500);

  if (contErr) {
    console.log("Tabela contratos_mandato não acessível:", contErr.message);
  } else {
    const matched = (contratos ?? []).filter(c => {
      const fullName = (c.nome_cliente ?? "").toUpperCase();
      return AFFECTED.some(a => {
        const parts = a.name.toUpperCase().split(" ");
        return parts.some(p => p.length > 3 && fullName.includes(p));
      });
    });
    if (matched.length === 0) {
      console.log("Nenhum cliente encontrado em contratos_mandato.");
    } else {
      matched.forEach(c => console.log("  ENCONTRADO:", JSON.stringify(c)));
    }
  }

  console.log("\n── DEAL INTAKES ──");
  const { data: intakes, error: intakeErr } = await svc
    .from("deal_intakes")
    .select("nome, email, telefone, cpf_cnpj, empresa, created_at")
    .limit(200);

  if (intakeErr) {
    console.log("Tabela deal_intakes não acessível:", intakeErr.message);
  } else {
    const matched = (intakes ?? []).filter(i => {
      const fullName = (i.nome ?? i.empresa ?? "").toUpperCase();
      return AFFECTED.some(a => {
        const parts = a.name.toUpperCase().split(" ");
        return parts.some(p => p.length > 3 && fullName.includes(p));
      });
    });
    if (matched.length === 0) {
      console.log("Nenhum encontrado em deal_intakes.");
    } else {
      matched.forEach(i => console.log("  ENCONTRADO:", JSON.stringify(i)));
    }
  }

  console.log("\n── CAPTAÇÃO LINKS (formulários públicos) ──");
  const { data: captLinks, error: captErr } = await svc
    .from("captacao_links")
    .select("*")
    .limit(100);

  if (captErr) {
    console.log("Tabela captacao_links não acessível:", captErr.message);
  } else {
    console.log(`captacao_links encontradas: ${captLinks?.length ?? 0}`);
    if (captLinks?.length) console.log("  Colunas:", Object.keys(captLinks[0]).join(", "));
  }

  console.log("\n── AUDIT LOGS (qualquer ação nas propostas) ──");
  const propIds = (proposals ?? []).map(p => p.id);
  const { data: allLogs } = await svc
    .from("audit_logs")
    .select("entity_id, action, old_data, new_data, created_at")
    .eq("entity", "credit_desk_proposals")
    .in("entity_id", propIds)
    .order("created_at", { ascending: true });

  if (!allLogs || allLogs.length === 0) {
    console.log("Nenhum registro de audit para estas propostas.");
  } else {
    console.log(`Encontrados ${allLogs.length} registros de audit.`);
    for (const log of allLogs) {
      const prop = (proposals ?? []).find(p => p.id === log.entity_id);
      const oldMeta = log.old_data?.metadata;
      const newMeta = log.new_data?.metadata;
      console.log(`\n  ${prop?.code} | ação: ${log.action} | data: ${log.created_at}`);
      if (oldMeta) console.log(`    old_meta: ${JSON.stringify(oldMeta).slice(0,300)}`);
      if (newMeta) console.log(`    new_meta: ${JSON.stringify(newMeta).slice(0,300)}`);
    }
  }

  console.log("\n\n=== RESUMO — DADOS RECUPERÁVEIS ===");
  console.log("Verificar acima se alguma tabela contém email/telefone/CPF para os clientes afetados.");
  console.log("Os campos básicos que ainda existem no banco:");
  for (const p of (proposals ?? [])) {
    console.log(`\n${p.code} — ${p.client_name}`);
    console.log(`  CPF/CNPJ: ${p.client_cpf_cnpj ?? "PERDIDO"}`);
  }
}

main().catch(console.error);
