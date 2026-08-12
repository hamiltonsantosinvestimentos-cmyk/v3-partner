// Script de auditoria: valida a integridade do array `parties` de todo
// contrato real da Central de Contratos (11/08/2026, criado após achar que
// a esteira de qualificação sobrescrevia `parties` e derrubava a contraparte
// principal de 2 contratos reais silenciosamente).
//
// Roda contra QUALQUER ambiente apontado por NEXT_PUBLIC_SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY (.env.local por padrao). Uso:
//   node scripts/audit-contract-parties.js
//
// Mesma regra aplicada em app/api/contracts/[id]/send/route.ts: sinaliza
// contrato com parte incompleta (nome sem e-mail) ou sem nenhum signatario
// fora do papel de testemunha.

const fs = require("fs");
const path = require("path");

// Parse .env.local na mão (sem dependencia de "dotenv", que nao esta no
// package.json deste projeto) — mesmo padrao ja usado em outros scripts
// avulsos desta sessao.
function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnvLocal();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local");
    process.exit(1);
  }

  const res = await fetch(
    // "aprovado" nao e valor real do enum contract_signature_status (achado
    // ja documentado em sessao anterior, UI/codigo referenciam um valor que
    // nao existe no banco) — auditar so os valores reais que importam aqui.
    `${url}/rest/v1/operation_contracts?select=contract_code,contract_title,status_signature,parties&status_signature=in.(rascunho,enviado_assinatura)`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const contracts = await res.json();
  if (!Array.isArray(contracts)) {
    console.error("Resposta inesperada da API:", JSON.stringify(contracts).slice(0, 300));
    process.exit(1);
  }

  let problemCount = 0;

  for (const c of contracts) {
    const parties = c.parties ?? [];
    const incomplete = parties.filter((p) => p.name?.trim() && !p.email?.trim());
    const nonWitness = parties.filter((p) => p.role !== "testemunha" && p.email?.trim());

    const problems = [];
    if (incomplete.length > 0) problems.push(`${incomplete.length} parte(s) sem e-mail: ${incomplete.map((p) => p.name).join(", ")}`);
    if (nonWitness.length === 0) problems.push("nenhum signatario fora de testemunha (falta parte principal)");

    if (problems.length > 0) {
      problemCount++;
      console.log(`\n[PROBLEMA] ${c.contract_code ?? "(sem codigo)"} — ${c.contract_title}`);
      console.log(`  status: ${c.status_signature}`);
      problems.forEach((p) => console.log(`  - ${p}`));
      console.log(`  parties atual: ${JSON.stringify(parties)}`);
    }
  }

  console.log(`\n${contracts.length} contratos verificados (rascunho/aprovado/enviado_assinatura), ${problemCount} com problema real.`);
  process.exit(problemCount > 0 ? 1 : 0);
}

main();
