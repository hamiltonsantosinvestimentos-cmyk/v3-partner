import type { SupabaseClient } from "@supabase/supabase-js";

// 06/09/2026 (BRIEF Link de Captacao pos-NCNDA, Mesa M&A): helper unico para
// gerar/reaproveitar o link publico de upload de documentos de um deal.
// Usado por /api/ma/upload-links (botao manual no card do NCNDA) e por
// /api/ma/document-requests/[id] (embutido no email da aba "Docs"), para as
// duas rotas nunca divergirem e nunca criarem tokens duplicados para o mesmo
// deal — mesmo padrao de dedupe ja usado em /api/cm/intake/generate e
// /api/credit-engine/intake/generate.

interface UploadTokenResult {
  token: string;
  expires_at: string;
  reused: boolean;
}

interface UploadTokenError {
  error: string;
}

export async function getOrCreateDealUploadToken(
  svc: SupabaseClient,
  dealId: string,
  userId: string,
  opts?: { label?: string; expiresDays?: number; maxUses?: number }
): Promise<UploadTokenResult | UploadTokenError> {
  const { data: existing } = await svc
    .from("deal_upload_tokens")
    .select("id, token, expires_at")
    .eq("deal_id", dealId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { token: existing.token as string, expires_at: existing.expires_at as string, reused: true };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (opts?.expiresDays ?? 14));

  const { data: tokenRow, error } = await svc
    .from("deal_upload_tokens")
    .insert({
      deal_id:    dealId,
      label:      opts?.label ?? null,
      expires_at: expiresAt.toISOString(),
      max_uses:   opts?.maxUses ?? 20,
      created_by: userId,
    })
    .select("id, token, expires_at")
    .single();

  if (error || !tokenRow) return { error: "Erro ao criar token de upload" };
  return { token: tokenRow.token as string, expires_at: tokenRow.expires_at as string, reused: false };
}

export function buildUploadUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
  return `${baseUrl}/upload/${token}`;
}
