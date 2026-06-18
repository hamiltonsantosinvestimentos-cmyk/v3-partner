/**
 * MPS Documentos V3 — Fase 4: Migracao Historica de Storage
 *
 * Migra arquivos de buckets legados (ma-documents, credit-documents)
 * para o bucket unificado v3-docs-publico com paths MPS governados.
 *
 * Uso:
 *   npx tsx scripts/migrate-storage.ts --dry-run          # Gera manifesto JSON
 *   npx tsx scripts/migrate-storage.ts --dry-run --bucket=credit  # Apenas credito
 *   npx tsx scripts/migrate-storage.ts --execute           # Executa migracao
 *
 * Requisitos: .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MigrationEntry {
  source_bucket: string;
  source_path: string;
  dest_bucket: "v3-docs-publico";
  dest_path: string;
  file_name: string;
  file_size: number;
  context: {
    type: "ma" | "credit" | "orphan";
    deal_code?: string;
    proposal_code?: string;
    partner_name?: string;
    partner_id?: string;
    v3_code?: string;
  };
  sha256_source?: string;
  sha256_dest?: string;
  status: "pending" | "migrated" | "hash_mismatch" | "error" | "skipped";
  error?: string;
}

interface StorageFile {
  id: string;
  name: string;
  metadata?: { size?: number; mimetype?: string };
}

interface MaDeal {
  id: string;
  v3_code: string;
  target_company: string;
  sector: string;
  origin_vertical: string;
  documents: Array<{ storage_path?: string; file_name?: string; doc_id?: string }> | null;
}

interface CreditProposal {
  id: string;
  code: string;
  client_name: string;
  status: string;
  partner_id: string;
  documents: Array<{ storage_path?: string; file_name?: string }> | null;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const ENV_PATH = resolve(__dirname, "../.env.local");
function loadEnv(): void {
  try {
    const lines = readFileSync(ENV_PATH, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) process.env[match[1]] = match[2].trim();
    }
  } catch {
    console.error("ERRO: .env.local nao encontrado em", ENV_PATH);
    process.exit(1);
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatorios");
  process.exit(1);
}

const svc: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEST_BUCKET = "v3-docs-publico" as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function sanitizeAscii(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._\-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 100);
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function listRecursive(bucket: string, prefix: string): Promise<Array<{ path: string; size: number; name: string }>> {
  const { data } = await svc.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!data) return [];

  const files: Array<{ path: string; size: number; name: string }> = [];
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      const sub = await listRecursive(bucket, fullPath);
      files.push(...sub);
    } else {
      files.push({
        path: fullPath,
        size: (item as unknown as StorageFile).metadata?.size ?? 0,
        name: item.name,
      });
    }
  }
  return files;
}

// ── MA Mapper ──────────────────────────────────────────────────────────────────

async function buildMaManifest(): Promise<MigrationEntry[]> {
  console.log("[MA] Buscando deals com v3_code...");
  const { data: deals } = await svc
    .from("ma_deals")
    .select("id, v3_code, target_company, sector, origin_vertical, documents")
    .not("v3_code", "is", null) as { data: MaDeal[] | null };

  if (!deals) return [];

  const dealMap = new Map<string, MaDeal>();
  for (const d of deals) dealMap.set(d.id, d);

  console.log("[MA] Listando arquivos em ma-documents...");
  const storageFiles = await listRecursive("ma-documents", "");
  console.log(`[MA] ${storageFiles.length} arquivos encontrados`);

  const entries: MigrationEntry[] = [];

  for (const file of storageFiles) {
    const pathParts = file.path.split("/");
    // Paths: {deal_id}/{file} or deals/{deal_id}/{file}
    let dealId: string;
    if (pathParts[0] === "deals" && pathParts.length >= 3) {
      dealId = pathParts[1];
    } else {
      dealId = pathParts[0];
    }

    const deal = dealMap.get(dealId);
    if (!deal) {
      entries.push({
        source_bucket: "ma-documents",
        source_path: file.path,
        dest_bucket: DEST_BUCKET,
        dest_path: `Administracao/Documento_Cadastro/${file.name}`,
        file_name: file.name,
        file_size: file.size,
        context: { type: "orphan" },
        status: "pending",
      });
      continue;
    }

    const safeClient = sanitizeAscii(deal.target_company || "Deal");
    const vertical = deal.origin_vertical || "MA";
    const govBase = `${vertical}/${deal.v3_code}_${safeClient}`;
    const destPath = `${govBase}/04_Due_Diligence/${file.name}`;

    entries.push({
      source_bucket: "ma-documents",
      source_path: file.path,
      dest_bucket: DEST_BUCKET,
      dest_path: destPath,
      file_name: file.name,
      file_size: file.size,
      context: {
        type: "ma",
        v3_code: deal.v3_code,
        deal_code: deal.v3_code,
      },
      status: "pending",
    });
  }

  return entries;
}

// ── Credit Mapper ──────────────────────────────────────────────────────────────

async function buildCreditManifest(): Promise<MigrationEntry[]> {
  console.log("[CREDIT] Buscando proposals...");
  const { data: proposals } = await svc
    .from("credit_desk_proposals")
    .select("id, code, client_name, status, partner_id, documents") as { data: CreditProposal[] | null };

  console.log("[CREDIT] Buscando profiles dos partners...");
  const { data: profiles } = await svc
    .from("profiles")
    .select("id, full_name, role") as { data: Profile[] | null };

  if (!proposals || !profiles) return [];

  const profileMap = new Map<string, Profile>();
  for (const p of profiles) profileMap.set(p.id, p);

  // Build reverse index: storage file path → proposal code
  // credit_desk_proposals.documents[].storage_path contém o path no bucket
  const fileToProposal = new Map<string, CreditProposal>();
  for (const prop of proposals) {
    if (!Array.isArray(prop.documents)) continue;
    for (const doc of prop.documents) {
      if (doc.storage_path) {
        // Normalize: pode ser "partner_id/filename" ou só "filename"
        const fileName = doc.storage_path.split("/").pop() ?? doc.storage_path;
        const key = `${prop.partner_id}/${fileName}`;
        fileToProposal.set(key, prop);
      }
      if (doc.file_name) {
        const key = `${prop.partner_id}/${doc.file_name}`;
        fileToProposal.set(key, prop);
      }
    }
  }

  // Fallback: partner com exatamente 1 proposal → todos os arquivos mapeiam pra ela
  const proposalsByPartner = new Map<string, CreditProposal[]>();
  for (const prop of proposals) {
    const list = proposalsByPartner.get(prop.partner_id) ?? [];
    list.push(prop);
    proposalsByPartner.set(prop.partner_id, list);
  }

  console.log("[CREDIT] Listando arquivos em credit-documents...");
  const storageFiles = await listRecursive("credit-documents", "");
  console.log(`[CREDIT] ${storageFiles.length} arquivos encontrados`);

  const entries: MigrationEntry[] = [];

  for (const file of storageFiles) {
    const pathParts = file.path.split("/");
    const partnerId = pathParts[0];
    const partner = profileMap.get(partnerId);
    const partnerName = partner?.full_name ?? "Partner_Desconhecido";
    const safePartnerName = sanitizeAscii(partnerName);

    // Tentar mapear pelo reverse index (storage_path no documents JSONB)
    const lookupKey = `${partnerId}/${file.name}`;
    let matchedProposal = fileToProposal.get(lookupKey);

    // Fallback: se partner tem exatamente 1 proposal, mapear tudo pra ela
    if (!matchedProposal) {
      const partnerProposals = proposalsByPartner.get(partnerId);
      if (partnerProposals && partnerProposals.length === 1) {
        matchedProposal = partnerProposals[0];
      }
    }

    if (matchedProposal) {
      const safeClient = sanitizeAscii(matchedProposal.client_name || "Cliente");
      const destPath = `Credito/${matchedProposal.code}_${safeClient}/02_Documentacao/${file.name}`;

      entries.push({
        source_bucket: "credit-documents",
        source_path: file.path,
        dest_bucket: DEST_BUCKET,
        dest_path: destPath,
        file_name: file.name,
        file_size: file.size,
        context: {
          type: "credit",
          proposal_code: matchedProposal.code,
          partner_name: partnerName,
          partner_id: partnerId,
        },
        status: "pending",
      });
    } else {
      // Orfao → Administracao/Documento_Cadastro/{partner_name}/
      entries.push({
        source_bucket: "credit-documents",
        source_path: file.path,
        dest_bucket: DEST_BUCKET,
        dest_path: `Administracao/Documento_Cadastro/${safePartnerName}/${file.name}`,
        file_name: file.name,
        file_size: file.size,
        context: {
          type: "orphan",
          partner_name: partnerName,
          partner_id: partnerId,
        },
        status: "pending",
      });
    }
  }

  return entries;
}

// ── Migration Engine ───────────────────────────────────────────────────────────

async function migrateFile(entry: MigrationEntry): Promise<MigrationEntry> {
  try {
    // Download
    const { data: blob, error: dlErr } = await svc.storage
      .from(entry.source_bucket)
      .download(entry.source_path);

    if (dlErr || !blob) {
      entry.status = "error";
      entry.error = `Download falhou: ${dlErr?.message ?? "blob nulo"}`;
      return entry;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    entry.sha256_source = sha256(buffer);

    // Upload
    const { error: upErr } = await svc.storage
      .from(entry.dest_bucket)
      .upload(entry.dest_path, buffer, {
        contentType: blob.type || "application/octet-stream",
        upsert: false,
      });

    if (upErr) {
      if (upErr.message?.includes("already exists")) {
        entry.status = "skipped";
        entry.error = "Arquivo ja existe no destino";
        return entry;
      }
      entry.status = "error";
      entry.error = `Upload falhou: ${upErr.message}`;
      return entry;
    }

    // Verificacao SHA-256 pos-upload
    const { data: verifyBlob } = await svc.storage
      .from(entry.dest_bucket)
      .download(entry.dest_path);

    if (verifyBlob) {
      const verifyBuffer = Buffer.from(await verifyBlob.arrayBuffer());
      entry.sha256_dest = sha256(verifyBuffer);

      if (entry.sha256_source !== entry.sha256_dest) {
        entry.status = "hash_mismatch";
        entry.error = `SHA-256 diverge: src=${entry.sha256_source} dest=${entry.sha256_dest}`;

        // Remover arquivo corrompido do destino
        await svc.storage.from(entry.dest_bucket).remove([entry.dest_path]);

        // Registrar em quarentena
        await svc.from("document_quarantine").insert({
          attempted_path: entry.dest_path,
          file_name: entry.file_name,
          file_size: entry.file_size,
          reason: `Hash mismatch na migracao: src=${entry.sha256_source} dest=${entry.sha256_dest}`,
          status: "pending_review",
        });

        await svc.from("folder_governance_log").insert({
          event_type: "UPLOAD_MISROUTED",
          target_path: entry.dest_path,
          severity: "critical",
          details: {
            action: "migration_hash_mismatch",
            source: `${entry.source_bucket}/${entry.source_path}`,
            sha_source: entry.sha256_source,
            sha_dest: entry.sha256_dest,
          },
        });

        return entry;
      }
    }

    entry.status = "migrated";
    return entry;
  } catch (err) {
    entry.status = "error";
    entry.error = err instanceof Error ? err.message : String(err);
    return entry;
  }
}

// ── DB Pointer Updates ─────────────────────────────────────────────────────────

async function updateMaPointers(entries: MigrationEntry[]): Promise<number> {
  const maEntries = entries.filter(e => e.context.type === "ma" && e.status === "migrated");
  if (maEntries.length === 0) return 0;

  // Group by v3_code
  const byDeal = new Map<string, MigrationEntry[]>();
  for (const e of maEntries) {
    const code = e.context.v3_code!;
    const list = byDeal.get(code) ?? [];
    list.push(e);
    byDeal.set(code, list);
  }

  let updated = 0;

  for (const [v3Code, dealEntries] of byDeal) {
    const { data: deal } = await svc
      .from("ma_deals")
      .select("id, documents")
      .eq("v3_code", v3Code)
      .single();

    if (!deal) continue;

    const docs = Array.isArray(deal.documents) ? [...deal.documents] : [];
    let changed = false;

    for (const entry of dealEntries) {
      const idx = docs.findIndex(
        (d: Record<string, unknown>) =>
          d.storage_path === entry.source_path ||
          d.file_name === entry.file_name
      );
      if (idx >= 0) {
        docs[idx] = {
          ...docs[idx],
          storage_path: entry.dest_path,
          bucket: DEST_BUCKET,
          migrated_at: new Date().toISOString(),
          sha256: entry.sha256_source,
        };
        changed = true;
      }
    }

    if (changed) {
      await svc.from("ma_deals").update({ documents: docs }).eq("id", deal.id);
      updated++;
    }
  }

  // Update ma_document_extractions
  for (const entry of maEntries) {
    await svc
      .from("ma_document_extractions")
      .update({
        file_name: entry.file_name,
        // storage_path column may not exist — best effort
      })
      .eq("file_name", entry.file_name);
  }

  return updated;
}

async function updateCreditPointers(entries: MigrationEntry[]): Promise<number> {
  const creditEntries = entries.filter(e => e.context.type === "credit" && e.status === "migrated");
  if (creditEntries.length === 0) return 0;

  // Group by proposal_code
  const byProposal = new Map<string, MigrationEntry[]>();
  for (const e of creditEntries) {
    const code = e.context.proposal_code!;
    const list = byProposal.get(code) ?? [];
    list.push(e);
    byProposal.set(code, list);
  }

  let updated = 0;

  for (const [propCode, propEntries] of byProposal) {
    const { data: proposal } = await svc
      .from("credit_desk_proposals")
      .select("id, documents")
      .eq("code", propCode)
      .single();

    if (!proposal) continue;

    const docs = Array.isArray(proposal.documents) ? [...proposal.documents] : [];
    let changed = false;

    for (const entry of propEntries) {
      const idx = docs.findIndex(
        (d: Record<string, unknown>) =>
          d.storage_path === entry.source_path ||
          d.file_name === entry.file_name
      );
      if (idx >= 0) {
        docs[idx] = {
          ...docs[idx],
          storage_path: entry.dest_path,
          bucket: DEST_BUCKET,
          migrated_at: new Date().toISOString(),
          sha256: entry.sha256_source,
        };
        changed = true;
      }
    }

    if (changed) {
      await svc.from("credit_desk_proposals").update({ documents: docs }).eq("id", proposal.id);
      updated++;
    }
  }

  return updated;
}

// ── Folder Provisioning ────────────────────────────────────────────────────────

async function provisionFolders(entries: MigrationEntry[]): Promise<number> {
  const destPaths = new Set<string>();
  for (const e of entries) {
    if (e.status === "pending") {
      // Extract deal/proposal base path (e.g., MA/V3-2026-05-REA-001_Client or Credito/CRED-26-001_Client)
      const parts = e.dest_path.split("/");
      if (parts.length >= 2) {
        const vertical = parts[0];
        const dealFolder = parts[1];
        if (vertical !== "Administracao") {
          destPaths.add(`${vertical}/${dealFolder}`);
        }
      }
    }
  }

  let provisioned = 0;

  for (const basePath of destPaths) {
    const { data: existing } = await svc
      .from("folder_registry")
      .select("id")
      .eq("full_path", basePath)
      .maybeSingle();

    if (!existing) {
      const parts = basePath.split("/");
      const vertical = parts[0] as "MA" | "Credito" | "Consorcios";
      const dealPart = parts[1];
      const codeMatch = dealPart.match(/^(V3-\d{4}-\d{2}-[A-Z]{3}-\d{3}|CRE[D]?-\d{2}-\d+|CON-\d{4}-\d{3})/);
      const dealCode = codeMatch?.[1] ?? dealPart;
      const clientName = dealPart.replace(dealCode + "_", "").slice(0, 100);

      // Get any admin user for created_by
      const { data: admin } = await svc
        .from("profiles")
        .select("id")
        .eq("role", "ADMIN")
        .limit(1)
        .single();

      if (admin) {
        try {
          await svc.rpc("create_deal_folder", {
            p_vertical: vertical,
            p_deal_code: dealCode,
            p_client_name: clientName,
            p_user_id: admin.id,
          });
          provisioned++;
        } catch {
          // May already exist (unique constraint) — safe to ignore
        }
      }
    }
  }

  return provisioned;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run") || !args.includes("--execute");
  const bucketFilter = args.find(a => a.startsWith("--bucket="))?.split("=")[1] ?? "all";

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  MPS Documentos V3 — Fase 4: Migracao Historica        ║");
  console.log(`║  Modo: ${isDryRun ? "DRY-RUN (manifesto)" : "EXECUTE (migracao real)"}${" ".repeat(isDryRun ? 16 : 13)}║`);
  console.log(`║  Bucket: ${bucketFilter.padEnd(47)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  const manifest: MigrationEntry[] = [];

  if (bucketFilter === "all" || bucketFilter === "ma") {
    const maEntries = await buildMaManifest();
    manifest.push(...maEntries);
  }

  if (bucketFilter === "all" || bucketFilter === "credit") {
    const creditEntries = await buildCreditManifest();
    manifest.push(...creditEntries);
  }

  // Estatisticas
  const stats = {
    total: manifest.length,
    totalMB: +(manifest.reduce((s, e) => s + e.file_size, 0) / 1024 / 1024).toFixed(2),
    byType: {
      ma: manifest.filter(e => e.context.type === "ma").length,
      credit: manifest.filter(e => e.context.type === "credit").length,
      orphan: manifest.filter(e => e.context.type === "orphan").length,
    },
    uniqueDestFolders: new Set(manifest.map(e => e.dest_path.split("/").slice(0, 2).join("/"))).size,
  };

  console.log("");
  console.log("═══ MANIFESTO ═══");
  console.log(`Total:     ${stats.total} arquivos (${stats.totalMB} MB)`);
  console.log(`MA:        ${stats.byType.ma} arquivos`);
  console.log(`Credito:   ${stats.byType.credit} arquivos`);
  console.log(`Orfaos:    ${stats.byType.orphan} arquivos → Administracao/Documento_Cadastro/`);
  console.log(`Destinos:  ${stats.uniqueDestFolders} pastas unicas`);

  // Salvar manifesto
  const manifestPath = resolve(__dirname, "../scripts/migration-manifest.json");
  writeFileSync(manifestPath, JSON.stringify({ stats, entries: manifest }, null, 2));
  console.log(`\nManifesto salvo em: ${manifestPath}`);

  if (isDryRun) {
    console.log("\n[DRY-RUN] Nenhum arquivo foi movido. Revise o manifesto e execute com --execute.");

    // Preview: top 20 mapeamentos
    console.log("\n═══ PREVIEW (primeiros 20) ═══");
    for (const entry of manifest.slice(0, 20)) {
      const type = entry.context.type.toUpperCase().padEnd(6);
      const src = entry.source_path.slice(0, 40).padEnd(40);
      const dst = entry.dest_path.slice(0, 60);
      console.log(`  [${type}] ${src} → ${dst}`);
    }
    if (manifest.length > 20) {
      console.log(`  ... +${manifest.length - 20} mais (ver manifesto JSON)`);
    }

    return;
  }

  // ── EXECUTE MODE ──────────────────────────────────────────────────────────

  console.log("\n[EXECUTE] Provisionando pastas no folder_registry...");
  const provisioned = await provisionFolders(manifest);
  console.log(`[EXECUTE] ${provisioned} pastas provisionadas`);

  console.log("[EXECUTE] Iniciando migracao...\n");

  let migrated = 0;
  let errors = 0;
  let skipped = 0;
  let hashMismatch = 0;

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    const progress = `[${i + 1}/${manifest.length}]`;

    const result = await migrateFile(entry);
    manifest[i] = result;

    switch (result.status) {
      case "migrated":
        migrated++;
        process.stdout.write(`${progress} OK ${result.file_name}\n`);
        break;
      case "skipped":
        skipped++;
        process.stdout.write(`${progress} SKIP ${result.file_name} (ja existe)\n`);
        break;
      case "hash_mismatch":
        hashMismatch++;
        process.stderr.write(`${progress} HASH_MISMATCH ${result.file_name} — QUARENTENA\n`);
        break;
      case "error":
        errors++;
        process.stderr.write(`${progress} ERROR ${result.file_name}: ${result.error}\n`);
        break;
    }

    // Rate limiting: 50ms entre requests para nao sobrecarregar Supabase
    if (i % 10 === 0) await new Promise(r => setTimeout(r, 50));
  }

  console.log("\n═══ RESULTADO ═══");
  console.log(`Migrados:       ${migrated}`);
  console.log(`Skipped:        ${skipped}`);
  console.log(`Hash mismatch:  ${hashMismatch}`);
  console.log(`Erros:          ${errors}`);

  // Update DB pointers
  if (migrated > 0) {
    console.log("\n[DB] Atualizando ponteiros storage_path...");
    const maUpdated = await updateMaPointers(manifest);
    const creditUpdated = await updateCreditPointers(manifest);
    console.log(`[DB] MA deals atualizados: ${maUpdated}`);
    console.log(`[DB] Credit proposals atualizados: ${creditUpdated}`);
  }

  // Salvar manifesto final com status
  writeFileSync(manifestPath, JSON.stringify({ stats: { ...stats, migrated, errors, skipped, hashMismatch }, entries: manifest }, null, 2));
  console.log(`\nManifesto final salvo em: ${manifestPath}`);
}

main().catch(err => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
