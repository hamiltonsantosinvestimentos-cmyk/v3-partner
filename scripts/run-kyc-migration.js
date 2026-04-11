/**
 * V3 Partners — Executor de Migration KYC
 *
 * USO:
 *   Opção A (com PAT Supabase):
 *     SUPABASE_PAT=seu_token node run-kyc-migration.js
 *
 *   Opção B (com DB password):
 *     DB_PASSWORD=sua_senha node run-kyc-migration.js
 *
 * Onde obter:
 *   PAT → https://supabase.com/dashboard/account/tokens → New token
 *   DB password → Supabase Dashboard → Project Settings → Database → Database password
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_REF = 'sbmuashewklfhdyyuezr';
const SQL_FILE    = path.join(__dirname, '..', 'supabase-kyc.sql');
const PAT         = process.env.SUPABASE_PAT;
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!PAT && !DB_PASSWORD) {
  console.error('\n❌  Forneça SUPABASE_PAT ou DB_PASSWORD\n');
  console.error('  SUPABASE_PAT=token node run-kyc-migration.js');
  console.error('  DB_PASSWORD=senha node run-kyc-migration.js\n');
  process.exit(1);
}

const sql = fs.readFileSync(SQL_FILE, 'utf8');

// ── Opção A: Management API com PAT ──────────────────────
async function runViaPAT() {
  console.log('\n🔐 Executando via Management API (PAT)...\n');

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Opção B: pg direto com DB password ───────────────────
async function runViaPG() {
  console.log('\n🔐 Executando via PostgreSQL direto...\n');
  const { Client } = require('pg');

  const client = new Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('✅  Conectado ao banco de dados\n');

  // Executar statement por statement para melhor feedback
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let success = 0;
  let skipped = 0;

  for (const stmt of statements) {
    try {
      await client.query(stmt);
      success++;
      // Extrair nome do objeto criado para log
      const match = stmt.match(/(?:CREATE|ALTER|INSERT INTO|CREATE OR REPLACE)\s+(?:TABLE|INDEX|POLICY|VIEW|FUNCTION|TRIGGER|TYPE)?\s+(?:IF NOT EXISTS\s+)?(?:public\.)?(\w+)/i);
      if (match) process.stdout.write(`   ✅ ${match[1]}\n`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('já existe')) {
        skipped++;
        process.stdout.write(`   ⚠️  já existe — ok\n`);
      } else {
        console.error(`\n   ❌ Erro: ${err.message.split('\n')[0]}`);
      }
    }
  }

  await client.end();
  return { success, skipped };
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  V3 Partners — KYC Migration Runner');
  console.log('  Projeto:', PROJECT_REF);
  console.log('  Arquivo:', SQL_FILE);
  console.log('══════════════════════════════════════════════');

  try {
    let result;

    if (PAT) {
      result = await runViaPAT();
      console.log('\n✅  Migration executada com sucesso via PAT!\n');
    } else {
      result = await runViaPG();
      console.log(`\n✅  Migration concluída: ${result.success} statements OK, ${result.skipped} já existiam\n`);
    }

    console.log('Tabelas criadas:');
    console.log('  • kyc_blacklist  — INTERPOL, OFAC, PEP, V3 Interno');
    console.log('  • kyc_analyses   — Histórico de análises KYC');
    console.log('  • kyc_access_log — Auditoria de acessos');
    console.log('  • kyc_api_keys   — Chaves de API (somente ADMIN)');
    console.log('\nPolíticas RLS:');
    console.log('  • ADMIN   → acesso total');
    console.log('  • GESTAO  → leitura + análises próprias');
    console.log('  • Demais  → BLOQUEADO\n');

  } catch (err) {
    console.error('\n❌ Erro na migration:', err.message);
    if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      console.error('\n   Verifique a senha do banco em:');
      console.error('   Supabase Dashboard → Project Settings → Database → Database password\n');
    }
    process.exit(1);
  }
}

main();
