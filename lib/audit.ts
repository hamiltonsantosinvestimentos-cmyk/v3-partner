import { createClient as sc } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "ACCESS" | "LOGIN" | "LOGOUT" | "EXPORT";
export type AuditEntity =
  | "ma_deals"
  | "operational_tickets"
  | "credit_desk_proposals"
  | "split_fiscal"
  | "profiles"
  | "crm_leads"
  | "commissions"
  | "notifications"
  | "kyc";

interface AuditParams {
  userId: string;
  userName?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Extrai o IP real do request (suporta Vercel/proxies) */
export function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/** Registra uma entrada no audit_log — falha silenciosamente para não interromper a operação principal */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const svc = serviceClient();
    await svc.from("audit_logs").insert({
      user_id:    params.userId,
      user_name:  params.userName ?? null,
      action:     params.action,
      entity:     params.entity,
      entity_id:  params.entityId ?? null,
      old_data:   params.oldData ?? null,
      new_data:   params.newData ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    });
  } catch {
    // Audit log não deve derrubar a operação principal
  }
}
