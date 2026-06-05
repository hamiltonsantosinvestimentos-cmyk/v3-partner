// Script de recuperação de metadata das propostas em ANALISE
// Busca no audit_logs os dados anteriores e restaura no banco

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://sbmuashewklfhdyyuezr.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibXVhc2hld2tsZmhkeXl1ZXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NjQ4NiwiZXhwIjoyMDkwODUyNDg2fQ.Hjl0KdHEkZY-Ha-3lsCmSNcEubnFXuvv6tsfC6C9Kz0";

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log("=== RECUPERAÇÃO DE METADATA — PROPOSTAS ANALISE ===\n");

  // 1. Busca todas as propostas em ANALISE
  const { data: proposals, error: propErr } = await svc
    .from("credit_desk_proposals")
    .select("id, code, client_name, stage, metadata, created_at")
    .eq("stage", "ANALISE")
    .order("created_at", { ascending: false });

  if (propErr) { console.error("Erro ao buscar propostas:", propErr); return; }
  console.log(`Propostas em ANALISE encontradas: ${proposals.length}\n`);

  // Identifica propostas com metadata vazia/corrompida
  // (metadata sem campos de cliente — apenas sla_override ou vazia)
  const affected = proposals.filter(p => {
    const meta = p.metadata ?? {};
    const keys = Object.keys(meta);
    // Corrompida se não tem nenhum dado de cliente
    const hasClientData = keys.some(k => [
      "email","telefone","phone","client_type","personType",
      "renda_mensal","renda","faturamento_mensal","faturamento",
      "nascimento","rg","estado_civil","razao_social","razaoSocial",
      "endereco_rua","enderecoRua","endereco","prazo","finalidade"
    ].includes(k));
    return !hasClientData;
  });

  console.log(`Propostas com metadata possivelmente corrompida: ${affected.length}`);
  if (affected.length === 0) {
    console.log("Nenhuma proposta afetada encontrada. Nada a restaurar.");
    return;
  }

  affected.forEach(p => {
    console.log(`  - ${p.code} | ${p.client_name} | metadata atual:`, JSON.stringify(p.metadata));
  });
  console.log();

  // 2. Busca no audit_logs registros anteriores para cada proposta afetada
  const affectedIds = affected.map(p => p.id);

  const { data: logs, error: logErr } = await svc
    .from("audit_logs")
    .select("entity_id, old_data, new_data, created_at, action")
    .eq("entity", "credit_desk_proposals")
    .in("entity_id", affectedIds)
    .order("created_at", { ascending: false });

  if (logErr) {
    console.warn("Tabela audit_logs não encontrada ou erro:", logErr.message);
    console.log("\nTentando buscar via histórico de stage_history no metadata...\n");
  } else {
    console.log(`Registros de audit encontrados: ${logs?.length ?? 0}`);
  }

  // 3. Para cada proposta afetada, tenta recuperar metadata do audit_log
  let restored = 0;
  let notFound = 0;

  for (const proposal of affected) {
    console.log(`\nProcessando: ${proposal.code} — ${proposal.client_name}`);

    // Busca logs mais antigos que tenham metadata com dados de cliente
    const proposalLogs = (logs ?? [])
      .filter(l => l.entity_id === proposal.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let recoveredMeta = null;

    for (const log of proposalLogs) {
      // Tenta old_data primeiro (estado antes da corrupção)
      const candidates = [log.old_data, log.new_data].filter(Boolean);
      for (const candidate of candidates) {
        const meta = candidate?.metadata ?? {};
        const hasClientData = Object.keys(meta).some(k => [
          "email","telefone","phone","client_type","personType",
          "renda_mensal","renda","faturamento_mensal","faturamento",
          "nascimento","rg","estado_civil","razao_social","razaoSocial",
          "endereco_rua","enderecoRua","endereco","prazo","finalidade"
        ].includes(k));
        if (hasClientData) {
          recoveredMeta = meta;
          console.log(`  ✓ Metadata recuperado de audit_log (${log.created_at}):`, JSON.stringify(recoveredMeta).slice(0, 200));
          break;
        }
      }
      if (recoveredMeta) break;
    }

    if (recoveredMeta) {
      // Restaura metadata — merge com sla_override existente se houver
      const currentMeta = proposal.metadata ?? {};
      const restoredMeta = {
        ...recoveredMeta,
        ...(currentMeta.sla_override ? { sla_override: currentMeta.sla_override } : {}),
        ...(currentMeta.stage_changed_at ? { stage_changed_at: currentMeta.stage_changed_at } : {}),
        ...(currentMeta.stage_history ? { stage_history: currentMeta.stage_history } : {}),
        ...(currentMeta.ai_analysis ? { ai_analysis: currentMeta.ai_analysis } : {}),
        ...(currentMeta.ocr_results ? { ocr_results: currentMeta.ocr_results } : {}),
        ...(currentMeta.ocr_resultados ? { ocr_resultados: currentMeta.ocr_resultados } : {}),
      };

      const { error: updateErr } = await svc
        .from("credit_desk_proposals")
        .update({ metadata: restoredMeta })
        .eq("id", proposal.id);

      if (updateErr) {
        console.error(`  ✗ Erro ao restaurar ${proposal.code}:`, updateErr.message);
      } else {
        console.log(`  ✅ Metadata restaurado com sucesso para ${proposal.code}`);
        restored++;
      }
    } else {
      console.log(`  ⚠ Nenhum dado recuperável encontrado nos audit_logs para ${proposal.code}`);
      console.log(`    → Metadata atual:`, JSON.stringify(proposal.metadata));
      notFound++;
    }
  }

  console.log(`\n=== RESULTADO ===`);
  console.log(`Restauradas: ${restored}`);
  console.log(`Não encontradas nos logs: ${notFound}`);

  if (notFound > 0) {
    console.log(`\n⚠ Para as ${notFound} proposta(s) sem dados no audit_log:`);
    console.log(`  Use o botão "Editar Proposta" no modal para reinserir manualmente.`);
  }
}

main().catch(console.error);
