import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ehDaEquipe } from "@/lib/enterprise";
import { createNotification, notifyByRoles } from "@/lib/notify";

/**
 * DOCUMENTOS PARA ASSINATURA DO CLIENTE (27/09/2026) — migration 20260927_credit_documentos_assinatura.sql
 *
 * Mesa sobe o arquivo → partner/Mesa envia por e-mail (link /assinatura/<token>) → cliente baixa,
 * assina e sobe pelo link (ou partner/Mesa sobe na plataforma) → partner/Mesa confirma o envio →
 * notificação para a Mesa Operacional.
 */

export const BUCKET = "credit-documents";
export const MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
export const MAX_BYTES = 20 * 1024 * 1024;
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.v3partners.com.br";

const TIPOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export const svcAssinatura = (): SupabaseClient => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type DocAssinatura = {
  id: string; proposal_id: string; titulo: string; orientacao: string | null;
  original_path: string; original_nome: string; created_at: string;
  token: string; token_expira_em: string; email_cliente: string | null; email_enviado_em: string | null; cliente_baixou_em: string | null;
  assinado_path: string | null; assinado_nome: string | null; assinado_origem: "cliente" | "plataforma" | null; assinado_em: string | null;
  confirmado_em: string | null; status: string;
};

export const COLUNAS =
  "id, proposal_id, titulo, orientacao, original_path, original_nome, created_at, token, token_expira_em, email_cliente, email_enviado_em, cliente_baixou_em, assinado_path, assinado_nome, assinado_origem, assinado_em, confirmado_em, status";

/** Extensão aceita para o arquivo (PDF, Word ou imagem), a partir do tipo ou do nome. */
export function extensaoValida(file: File): string | null {
  if (TIPOS[file.type]) return TIPOS[file.type];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return Object.values(TIPOS).includes(ext) ? ext : ext === "jpeg" ? "jpg" : null;
}

/** Usuário logado e o que ele pode fazer na proposta: Mesa (tudo) ou partner da equipe (enviar/subir/confirmar). */
export async function acessoProposta(proposalId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Não autorizado" };
  const db = svcAssinatura();
  const [{ data: perfil }, { data: proposal }] = await Promise.all([
    db.from("profiles").select("role, full_name").eq("id", user.id).single(),
    db.from("credit_desk_proposals").select("id, code, title, client_name, partner_id, metadata").eq("id", proposalId).single(),
  ]);
  if (!proposal) return { ok: false as const, status: 404, error: "Proposta não encontrada" };
  const mesa = MESA_ROLES.includes(perfil?.role ?? "");
  const partner = !mesa && (await ehDaEquipe(user.id, proposal.partner_id as string | null));
  if (!mesa && !partner) return { ok: false as const, status: 403, error: "Sem permissão" };
  return { ok: true as const, db, userId: user.id, nome: (perfil?.full_name as string | null) ?? null, mesa, proposal };
}

/** URL temporária (1h) para baixar um arquivo do bucket. */
export async function urlArquivo(db: SupabaseClient, path: string, nomeDownload?: string) {
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 3600, nomeDownload ? { download: nomeDownload } : undefined);
  return data?.signedUrl ?? null;
}

export async function salvarArquivo(db: SupabaseClient, path: string, file: File) {
  const { error } = await db.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  return error?.message ?? null;
}

/** Avisa a Mesa Operacional (e o partner, quando quem agiu foi o cliente). */
export async function notificarAssinatura(opts: {
  proposal: { id: string; code: string | null; client_name: string | null; partner_id: string | null };
  titulo: string;
  evento: "cliente_subiu" | "confirmado";
  quem?: string | null;
}) {
  const ref = `${opts.proposal.code ?? "Proposta"} · ${opts.proposal.client_name ?? ""}`.trim();
  const action_url = `/mesa-operacional?proposalId=${opts.proposal.id}`;
  if (opts.evento === "cliente_subiu") {
    const n = { title: "Cliente enviou documento assinado", message: `${ref}: "${opts.titulo}" foi assinado e enviado pelo cliente.`, type: "proposal" as const, action_url };
    await notifyByRoles(["ADMIN", "MESA_OPERACIONAL"], n);
    if (opts.proposal.partner_id) await createNotification({ ...n, user_id: opts.proposal.partner_id, action_url: "/mesa-credito" });
  } else {
    await notifyByRoles(["ADMIN", "MESA_OPERACIONAL"], {
      title: "Documento assinado confirmado",
      message: `${ref}: "${opts.titulo}" assinado foi confirmado${opts.quem ? ` por ${opts.quem}` : ""}. Conferir na aba Documentos.`,
      type: "proposal",
      action_url,
    });
  }
}
