import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";
export type AuditEntity =
  | "ma_deals"
  | "operational_tickets"
  | "credit_desk_proposals"
  | "split_fiscal"
  | "profiles";

interface AuditParams {
  userId: string;
  userName?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string | null;
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
    });
  } catch {
    // Audit log não deve derrubar a operação principal
  }
}
