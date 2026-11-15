// Aviso por e-mail ao titular da qualificação quando a V3 devolve a ficha para correção ou exclui um documento
// dele (BRIEF "Aviso automático ao titular da qualificação (W23)", 15/11/2026). O e-mail sai pelo workflow W23
// do n8n (formata, roda o Brand Audit e dispara pelo Resend); nunca direto de uma rota. Só passa pela chave
// `qualificacao_aviso_email_titular` (desligada por padrão: sem linha na tabela, getCmFlag devolve desligado).
//
// Só o payload mínimo vai ao webhook: tipo, destinatário, primeiro nome (só pessoa física), link, nome externo do
// documento e frase do motivo (ambos do catálogo). Nunca motivo em texto livre, número de documento, código do deal,
// setor, nome de parceiro, nome das demais partes ou nome completo. Política de sigilo de 31/10/2026.
//
// O aviso é a ÚLTIMA etapa da rota: nunca lança erro e nunca desfaz a reabertura nem a exclusão.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCmFlag } from "@/lib/cm-flags";
import {
  MOTIVOS_DEVOLUCAO,
  MOTIVOS_EXCLUSAO,
  fraseMotivo,
  nomeExternoDocumentoCadastro,
} from "@/lib/comunicacao-externa";

export const FLAG_AVISO_EMAIL_TITULAR = "qualificacao_aviso_email_titular";
export const ACAO_TITULAR_ENVIADO = "TITULAR_EMAIL_ENVIADO";
export const ACAO_TITULAR_SUPRIMIDO = "TITULAR_EMAIL_SUPRIMIDO";
export const ACAO_TITULAR_FALHA = "TITULAR_EMAIL_FALHA";
export const ACAO_TITULAR_NAO_ENVIADO = "TITULAR_EMAIL_NAO_ENVIADO";

const WEBHOOK_W23 = `${process.env.N8N_BASE_URL ?? "https://n8n-514n.onrender.com"}/webhook/v3-aviso-titular-qualificacao`;
const TEMPO_LIMITE_MS = 8000;
const JANELA_DEDUPE_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TipoAviso = "devolucao" | "exclusao";

export type PayloadAvisoTitular = {
  tipo: TipoAviso;
  destinatario: string;
  /** Vazio em pessoa jurídica ou nome vazio: o e-mail abre com "Olá,". */
  primeiro_nome: string;
  link: string;
  /** Só no tipo exclusao. */
  nome_documento_padrao: string;
  /** Vazio em "Outro motivo": o e-mail sai sem a linha do motivo. */
  motivo_padrao: string;
};

/** Primeiro nome só de pessoa física com nome preenchido; PJ e nome vazio devolvem "". */
export function primeiroNomeTitular(nomeCompleto: string | null | undefined, personType: string | null | undefined): string {
  if (personType !== "PF") return "";
  return (nomeCompleto ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Payload filtrado. Função pura: é o único ponto que decide o que sai da V3. Devolve null (nada é enviado) quando
 * falta e-mail válido, token, código de motivo válido ou, na exclusão, nome externo do documento no catálogo.
 */
export function montarPayloadAvisoTitular(p: {
  tipo: TipoAviso;
  email: string | null | undefined;
  nomeCompleto: string | null | undefined;
  personType: string | null | undefined;
  token: string | null | undefined;
  appUrl: string;
  motivoCodigo: unknown;
  documentKind?: unknown;
}): PayloadAvisoTitular | null {
  const email = (p.email ?? "").trim();
  if (!EMAIL_RE.test(email) || email.length > 254) return null;
  if (!p.token) return null;

  const motivo = fraseMotivo(p.tipo === "exclusao" ? MOTIVOS_EXCLUSAO : MOTIVOS_DEVOLUCAO, p.motivoCodigo);
  if (!motivo.ok) return null;

  let nomeDocumento = "";
  if (p.tipo === "exclusao") {
    const nome = nomeExternoDocumentoCadastro(p.documentKind);
    if (!nome) return null;
    nomeDocumento = nome;
  }

  return {
    tipo: p.tipo,
    destinatario: email,
    primeiro_nome: primeiroNomeTitular(p.nomeCompleto, p.personType),
    link: `${p.appUrl.replace(/\/+$/, "")}/intake/qualificacao/${p.token}`,
    nome_documento_padrao: nomeDocumento,
    motivo_padrao: motivo.frase ?? "",
  };
}

/** Registro sem e-mail completo, sem nome e sem motivo em texto livre. Sempre com await. */
async function registrar(db: SupabaseClient, action: string, qualificationId: string, extra: Record<string, unknown>) {
  const { error } = await db.from("audit_logs").insert({
    action, entity: "cm_party_qualifications", entity_id: qualificationId, new_data: extra,
  });
  if (error) console.error("[aviso-titular] falha ao gravar audit_logs", { action, code: error.code });
  return !error;
}

export type ResultadoAvisoTitular = "desligado" | "sem_catalogo" | "suprimido" | "enviado" | "falhou";

/**
 * Chamar DEPOIS de a reabertura ou a exclusão ter dado certo. Nunca lança. Um e-mail por qualificação e por motivo a
 * cada 24 horas; o excedente é registrado como TITULAR_EMAIL_SUPRIMIDO.
 */
export async function avisarTitularDaQualificacao(
  db: SupabaseClient,
  p: { qualificationId: string; tipo: TipoAviso; motivoCodigo: string; documentKind?: string | null },
): Promise<ResultadoAvisoTitular> {
  try {
    if (!(await getCmFlag(FLAG_AVISO_EMAIL_TITULAR, false))) return "desligado";
    const segredo = process.env.N8N_AVISO_TITULAR_SECRET;
    if (!segredo) {
      console.error("[aviso-titular] N8N_AVISO_TITULAR_SECRET ausente, nada enviado");
      await registrar(db, ACAO_TITULAR_FALHA, p.qualificationId, { tipo: p.tipo, motivo_codigo: p.motivoCodigo, causa: "segredo_ausente" });
      return "falhou";
    }

    const { data: q } = await db
      .from("cm_party_qualifications")
      .select("id, email, full_name, person_type, qualification_token")
      .eq("id", p.qualificationId)
      .maybeSingle();
    if (!q) return "sem_catalogo";

    const payload = montarPayloadAvisoTitular({
      tipo: p.tipo,
      email: q.email as string | null,
      nomeCompleto: q.full_name as string | null,
      personType: q.person_type as string | null,
      token: q.qualification_token as string | null,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br",
      motivoCodigo: p.motivoCodigo,
      documentKind: p.documentKind,
    });
    if (!payload) {
      await registrar(db, ACAO_TITULAR_NAO_ENVIADO, p.qualificationId, { tipo: p.tipo, motivo_codigo: p.motivoCodigo, causa: "sem_catalogo_ou_email" });
      return "sem_catalogo";
    }

    const desde = new Date(Date.now() - JANELA_DEDUPE_MS).toISOString();
    const { data: jaAvisado } = await db
      .from("audit_logs").select("id")
      .eq("action", ACAO_TITULAR_ENVIADO).eq("entity", "cm_party_qualifications").eq("entity_id", p.qualificationId)
      .eq("new_data->>motivo_codigo", p.motivoCodigo).eq("new_data->>tipo", p.tipo)
      .gte("created_at", desde).limit(1);
    if (jaAvisado && jaAvisado.length > 0) {
      await registrar(db, ACAO_TITULAR_SUPRIMIDO, p.qualificationId, { tipo: p.tipo, motivo_codigo: p.motivoCodigo });
      return "suprimido";
    }

    const res = await fetch(WEBHOOK_W23, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-v3-secret": segredo },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!res.ok) {
      console.error("[aviso-titular] W23 respondeu", res.status);
      await registrar(db, ACAO_TITULAR_FALHA, p.qualificationId, { tipo: p.tipo, motivo_codigo: p.motivoCodigo, causa: `http_${res.status}` });
      return "falhou";
    }
    await registrar(db, ACAO_TITULAR_ENVIADO, p.qualificationId, { tipo: p.tipo, motivo_codigo: p.motivoCodigo });
    return "enviado";
  } catch (e) {
    console.error("[aviso-titular] falhou:", e);
    try {
      await registrar(db, ACAO_TITULAR_FALHA, p.qualificationId, { tipo: p.tipo, motivo_codigo: p.motivoCodigo, causa: "excecao" });
    } catch { /* o aviso nunca derruba a rota */ }
    return "falhou";
  }
}
