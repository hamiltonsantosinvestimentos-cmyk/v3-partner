// Criação de proposta de crédito, compartilhada pelo modal "Nova proposta"
// (POST /api/credit-proposals) e pela API de partners (POST /api/v1/propostas).
// Extraída sem reescrever de app/api/credit-proposals/route.ts (BRIEF 2026-11-06 API de
// Propostas): mesmas travas, mesmo código, mesma pasta MPS e mesmas notificações.
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyNovaProposta } from "@/lib/email";
import { createNotification, notifyByRoles } from "@/lib/notify";
import { issueCreditCode } from "@/lib/v3-codes";
import { resolveClient } from "@/lib/v3-clients";
import { PARTNER_HE_CREDIT_LINES } from "@/lib/constants";

export type NivelCredito = "NIVEL_1" | "NIVEL_2" | "NIVEL_3";

export interface NovaPropostaInput {
  code?: string;
  title: string;
  client_name: string;
  client_cpf_cnpj?: string | null;
  credit_line: string;
  requested_value: number;
  current_level: NivelCredito;
  metadata?: Record<string, unknown> | null;
  /** Dono da proposta (partner). */
  partnerId: string;
  /** Quem criou (usuário logado ou o partner dono da chave de API). */
  createdBy: string;
  /** Papel de quem cria: aplica a trava do PARTNER_HE. */
  creatorRole: string | null | undefined;
  /** Nome exibido nas notificações. */
  creatorName: string | null | undefined;
  origem?: "plataforma" | "api";
  referenciaExterna?: string | null;
}

export type NovaPropostaResult =
  | { ok: true; proposal: { id: string; code: string; title: string; client_name: string; credit_line: string } }
  | { ok: false; status: number; error: string; codigo?: "regra_de_credito" | "sem_acesso" | "referencia_repetida" | "erro_interno" };

export const VALOR_MINIMO_N3 = 5_000_000;

function normLinha(x: string) {
  return x.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Trava do papel PARTNER_HE: só as linhas da família Home Equity. */
export function linhaPermitidaParaPapel(role: string | null | undefined, linha: string): boolean {
  if (role !== "PARTNER_HE") return true;
  return PARTNER_HE_CREDIT_LINES.map(normLinha).includes(normLinha(linha));
}

export async function criarPropostaCredito(db: SupabaseClient, d: NovaPropostaInput): Promise<NovaPropostaResult> {
  if (!linhaPermitidaParaPapel(d.creatorRole, d.credit_line)) {
    return {
      ok: false, status: 403, codigo: "sem_acesso",
      error: "Seu acesso só permite propostas de Home Equity, HomeCash, Antecipação de Contratos e Crédito no Aval/Recebíveis.",
    };
  }

  if (d.current_level === "NIVEL_3" && d.requested_value < VALOR_MINIMO_N3) {
    return { ok: false, status: 400, codigo: "regra_de_credito", error: "Nível 3 exige valor mínimo de R$ 5.000.000" };
  }

  // credit_line_id resolvido no servidor a partir do nome (nunca aceito do payload).
  const { data: linhaMatch } = await db
    .from("regras_linhas_credito")
    .select("id")
    .eq("nome", d.credit_line)
    .maybeSingle();

  let code: string;
  try {
    // Truthiness, não `??`: code:"" gravaria código em branco.
    code = d.code || (await issueCreditCode(linhaMatch?.id ?? null, undefined, db)).code;
  } catch (codeErr) {
    const msg = codeErr instanceof Error ? codeErr.message : String(codeErr);
    return { ok: false, status: 500, codigo: "erro_interno", error: `Falha ao emitir código da proposta: ${msg}` };
  }

  // Client 360: best-effort, nunca bloqueia a criação.
  const v3ClientId = await resolveClient(d.client_cpf_cnpj, { legalName: d.client_name, vertical: "credito" }).catch(() => null);

  const row: Record<string, unknown> = {
    code,
    title:           d.title,
    client_name:     d.client_name,
    client_cpf_cnpj: d.client_cpf_cnpj ?? null,
    v3_client_id:    v3ClientId,
    credit_line:     d.credit_line,
    credit_line_id:  linhaMatch?.id ?? null,
    requested_value: d.requested_value,
    current_level:   d.current_level,
    status:          "PENDING",
    stage:           "RECEBIDO",
    partner_id:      d.partnerId,
    created_by:      d.createdBy,
    metadata:        d.metadata ?? {},
  };
  // Colunas novas só entram quando informadas: o modal continua gravando exatamente como antes.
  if (d.origem) row.origem = d.origem;
  if (d.referenciaExterna) row.referencia_externa = d.referenciaExterna;

  const { data: inserted, error } = await db.from("credit_desk_proposals").insert(row).select().single();
  if (error) {
    if ((error as { code?: string }).code === "23505" && d.referenciaExterna && /referencia_externa|ref_externa/.test(error.message)) {
      return { ok: false, status: 409, codigo: "referencia_repetida", error: "Já existe proposta com esta referencia_externa." };
    }
    return { ok: false, status: 500, codigo: "erro_interno", error: error.message };
  }

  const data = inserted as unknown as { id: string; code: string; title: string; client_name: string; credit_line: string };

  // Pasta pública do cliente em Crédito: best-effort.
  const { error: folderError } = await db.rpc("create_deal_folder", {
    p_vertical: "Credito",
    p_deal_code: data.code,
    p_client_name: data.client_name,
    p_user_id: d.createdBy,
  });
  if (folderError) console.error("[criarPropostaCredito] falha ao criar pasta MPS", folderError.message);

  try {
    const adminEmail = process.env.EMAIL_ADMIN;
    if (adminEmail) {
      notifyNovaProposta({
        adminEmail,
        partnerName:    d.creatorName ?? "Partner",
        proposalCode:   data.code,
        proposalTitle:  data.title,
        clientName:     data.client_name,
        creditLine:     data.credit_line,
        requestedValue: d.requested_value,
      });
    }
  } catch { /* notificação é opcional */ }

  const partnerName = d.creatorName ?? "Partner";
  const viaApi = d.origem === "api" ? " (via API)" : "";
  await Promise.allSettled([
    createNotification({
      user_id: d.createdBy,
      type: "proposal",
      title: "Proposta de crédito enviada",
      message: `${data.code} — ${d.client_name} · ${d.credit_line}`,
      action_url: "/mesa-credito",
    }),
    notifyByRoles(["ADMIN", "GESTAO", "MESA_OPERACIONAL"], {
      type: "proposal",
      title: `Nova Proposta — ${data.code}${viaApi}`,
      message: `${partnerName}: ${d.client_name} · ${d.credit_line} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(d.requested_value)}`,
      action_url: `/mesa-credito/${d.current_level.toLowerCase().replace("_", "-")}`,
    }),
  ]);

  return { ok: true, proposal: data };
}
