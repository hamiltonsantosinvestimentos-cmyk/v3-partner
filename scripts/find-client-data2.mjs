import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://sbmuashewklfhdyyuezr.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibXVhc2hld2tsZmhkeXl1ZXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NjQ4NiwiZXhwIjoyMDkwODUyNDg2fQ.Hjl0KdHEkZY-Ha-3lsCmSNcEubnFXuvv6tsfC6C9Kz0";
const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const AFFECTED_NAMES = [
  "MARCOS MAGNI PEREIRA",
  "Orivaldo Álvares perico",
  "Sérgio Ricardo Cunha",
  "ADILSON JOSE BUENO DE SOUZA",
  "APARECIDO ROBERTO BRAGA",
  "RODRIGO FERREIRA PINTO",
  "BONIFACIO DARCI NUNES",
  "RAMBORGER E PLETSCH LTDA",
  "Abastecedora de Combustíveis Volken I Ltda",
  "ELIANE APARECIDA FONTANELLA PILON",
];

const AFFECTED_CPFS = [
  "887.873.460-87", "99111926872", "47624485915",
  "650.476.569-34", "612.465.909-30", "01565564995",
  "04707953956", "04.904.642/0001-76",
  "03.774.632/0001-09", "032 742 289-07",
];

function nameMatches(str) {
  if (!str) return false;
  const up = str.toUpperCase();
  return AFFECTED_NAMES.some(n => {
    const parts = n.toUpperCase().split(" ");
    return parts.filter(p => p.length > 3).some(p => up.includes(p));
  });
}

function cpfMatches(str) {
  if (!str) return false;
  const clean = str.replace(/\D/g, "");
  return AFFECTED_CPFS.some(c => c.replace(/\D/g, "") === clean);
}

async function inspectTable(tableName) {
  const { data, error } = await svc.from(tableName).select("*").limit(1);
  if (error) return null;
  if (!data || data.length === 0) return [];
  return Object.keys(data[0]);
}

async function main() {
  console.log("=== BUSCA DETALHADA POR DADOS DOS CLIENTES ===\n");

  // ── CRM LEADS ──
  console.log("── CRM LEADS ──");
  const crmCols = await inspectTable("crm_leads");
  if (!crmCols) { console.log("Inacessível\n"); }
  else {
    console.log("Colunas:", crmCols.join(", "));
    const { data: crm } = await svc.from("crm_leads").select("*").limit(300);
    const found = (crm ?? []).filter(r => {
      return Object.values(r).some(v => typeof v === "string" && (nameMatches(v) || cpfMatches(v)));
    });
    if (found.length) found.forEach(r => console.log("ENCONTRADO:", JSON.stringify(r)));
    else console.log("Nenhum match por nome ou CPF.");
    console.log();
  }

  // ── PROSPECÇÃO LEADS ──
  console.log("── PROSPECÇÃO LEADS ──");
  const prospCols = await inspectTable("prospeccao_leads");
  if (!prospCols) { console.log("Inacessível\n"); }
  else {
    console.log("Colunas:", prospCols.join(", "));
    const { data: prosp } = await svc.from("prospeccao_leads").select("*").limit(300);
    const found = (prosp ?? []).filter(r =>
      Object.values(r).some(v => typeof v === "string" && (nameMatches(v) || cpfMatches(v)))
    );
    if (found.length) found.forEach(r => console.log("ENCONTRADO:", JSON.stringify(r)));
    else console.log("Nenhum match.");
    console.log();
  }

  // ── CONTRATOS MANDATO ──
  console.log("── CONTRATOS MANDATO ──");
  const mandatoCols = await inspectTable("contratos_mandato");
  if (!mandatoCols) { console.log("Inacessível\n"); }
  else {
    console.log("Colunas:", mandatoCols.join(", "));
    const { data: mandato } = await svc.from("contratos_mandato").select("*").limit(300);
    const found = (mandato ?? []).filter(r =>
      Object.values(r).some(v => typeof v === "string" && (nameMatches(v) || cpfMatches(v)))
    );
    if (found.length) found.forEach(r => console.log("ENCONTRADO:", JSON.stringify(r)));
    else console.log("Nenhum match.");
    console.log();
  }

  // ── KYC ANALYSES ──
  console.log("── KYC ANALYSES ──");
  const kycCols = await inspectTable("kyc_analyses");
  if (!kycCols) { console.log("Inacessível\n"); }
  else {
    console.log("Colunas:", kycCols.join(", "));
    const { data: kyc } = await svc.from("kyc_analyses").select("*").limit(300);
    const found = (kyc ?? []).filter(r =>
      Object.values(r).some(v => typeof v === "string" && (nameMatches(v) || cpfMatches(v)))
    );
    if (found.length) found.forEach(r => console.log("ENCONTRADO:", JSON.stringify(r)));
    else console.log("Nenhum match.");
    console.log();
  }

  // ── PARTNER CONTRACTS ──
  console.log("── PARTNER CONTRACTS ──");
  const pcCols = await inspectTable("partner_contracts");
  if (!pcCols) { console.log("Inacessível\n"); }
  else {
    console.log("Colunas:", pcCols.join(", "));
    const { data: pc } = await svc.from("partner_contracts").select("*").limit(300);
    const found = (pc ?? []).filter(r =>
      Object.values(r).some(v => typeof v === "string" && (nameMatches(v) || cpfMatches(v)))
    );
    if (found.length) found.forEach(r => console.log("ENCONTRADO:", JSON.stringify(r)));
    else console.log("Nenhum match.");
    console.log();
  }

  // ── MARKETPLACE LEADS ──
  console.log("── MARKETPLACE LEADS ──");
  const mlCols = await inspectTable("marketplace_leads");
  if (!mlCols) { console.log("Inacessível\n"); }
  else {
    console.log("Colunas:", mlCols.join(", "));
    const { data: ml } = await svc.from("marketplace_leads").select("*").limit(300);
    const found = (ml ?? []).filter(r =>
      Object.values(r).some(v => typeof v === "string" && (nameMatches(v) || cpfMatches(v)))
    );
    if (found.length) found.forEach(r => console.log("ENCONTRADO:", JSON.stringify(r)));
    else console.log("Nenhum match.");
    console.log();
  }

  // ── PARTNER REGISTRATIONS (formulário de cadastro do partner) ──
  console.log("── PARTNER REGISTRATIONS ──");
  const prCols = await inspectTable("partner_registrations");
  if (!prCols) { console.log("Inacessível\n"); }
  else {
    console.log("Colunas:", prCols.join(", "));
    // Busca pelos partner_ids que enviaram as propostas afetadas
    const partnerIds = [
      "f5a021d4-a8b9-41e6-8926-c7ad5bf16d80",
      "344f141c-177c-49a9-bc40-89f737a3d9f7",
      "aa8336a7-36f0-4f84-a01b-533f3dfe7abd",
    ];
    const { data: pr } = await svc.from("partner_registrations").select("*").in("user_id", partnerIds);
    if (pr?.length) {
      console.log(`Registros dos partners:`);
      pr.forEach(r => console.log(" ", JSON.stringify(r).slice(0, 400)));
    } else {
      console.log("Nenhum registro encontrado para esses partners.");
    }
    console.log();
  }

  // ── DOCS INGERIDOS (PDFs processados pelo n8n) ──
  console.log("── DOCS INGERIDOS ──");
  const diCols = await inspectTable("docs_ingeridos");
  if (!diCols) { console.log("Inacessível\n"); }
  else {
    console.log("Colunas:", diCols.join(", "));
    const { data: di } = await svc.from("docs_ingeridos").select("*").limit(300);
    const found = (di ?? []).filter(r =>
      Object.values(r).some(v => typeof v === "string" && (nameMatches(v) || cpfMatches(v)))
    );
    if (found.length) {
      console.log(`Encontrados ${found.length} docs ingeridos com dados dos clientes:`);
      found.forEach(r => console.log(" ", JSON.stringify(r).slice(0, 400)));
    } else console.log("Nenhum match.");
    console.log();
  }

  console.log("\n=== CONCLUSÃO ===");
  console.log("Dados SEGUROS no banco (campos top-level da proposta):");
  console.log("  ✅ Nome do cliente (client_name)");
  console.log("  ✅ CPF/CNPJ (client_cpf_cnpj) — todos os 10 ainda têm");
  console.log("  ✅ Linha de crédito, valor, nível");
  console.log("  ✅ Documentos enviados (storage_path ainda apontam para os arquivos)");
  console.log("\nDados PERDIDOS (estavam só no metadata):");
  console.log("  ❌ Email, Telefone");
  console.log("  ❌ Renda mensal / Faturamento");
  console.log("  ❌ Nascimento, RG, Estado Civil (PF)");
  console.log("  ❌ Razão Social, Sócio (PJ)");
  console.log("  ❌ Endereço completo");
  console.log("  ❌ Prazo, Finalidade, Observações");
  console.log("\nPartners responsáveis pelas 10 propostas:");
  console.log("  Diego Alberto Souza Augsten — comercial@astrumfinance.com.br (8 propostas)");
  console.log("  Carlos Adilson Gaudêncio — carlos@fortenegociosimobiliarios.com.br (2 propostas)");
  console.log("  Celso Luis Vogel — celsoparanabrasil@gmail.com (1 proposta — Rodrigo)");
}

main().catch(console.error);
