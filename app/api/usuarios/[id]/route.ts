import { NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svcClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const IS_DEMO = false;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (IS_DEMO) {
    return NextResponse.json({ id, ...body });
  }

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profileData } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  const profile = profileData as { role: string; full_name: string | null; email: string } | null;
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Se enviou novo e-mail, atualiza no Supabase Auth primeiro
  if (body.email) {
    const { error: authEmailError } = await supabase.auth.admin.updateUserById(id, { email: body.email });
    if (authEmailError) {
      return NextResponse.json({ error: authEmailError.message }, { status: 500 });
    }
  }

  const allowedFields = ["role", "is_active", "phone", "full_name", "document_cpf", "trial_expires_at", "email"];
  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updateData[field] = body[field];
  }

  const supabaseAny = supabase as unknown as {
    from: (table: string) => {
      update: (data: unknown) => {
        eq: (col: string, val: string) => {
          select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
      };
    };
  };
  const { data, error: updateError } = await supabaseAny
    .from("profiles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Grava auditoria (fire-and-forget)
  const actionLabel = body.email ? "EDITAR_EMAIL"
    : body.role ? "EDITAR_ROLE"
    : body.is_active === false ? "SUSPENDER"
    : body.is_active === true ? "REATIVAR"
    : body.trial_expires_at ? "RENOVAR_TRIAL"
    : "EDITAR_PERFIL";

  svcClient().from("audit_logs").insert({
    user_id: user.id,
    user_name: profile?.full_name ?? profile?.email ?? user.email,
    action: actionLabel,
    entity: "profiles",
    entity_id: id,
    new_data: updateData,
    old_data: null,
    ip_address: null,
  }).then(() => {}, () => {});

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (IS_DEMO) {
    return NextResponse.json({ success: true, id });
  }

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profileData } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const profile = profileData as { role: string } | null;
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Limpa tabelas que referenciam o usuário antes de deletar do Auth
  await Promise.allSettled([
    supabase.from("profiles").delete().eq("id", id),
    supabase.from("notifications").delete().eq("user_id", id),
    supabase.from("ai_conversations").delete().eq("user_id", id),
    supabase.from("agent_sessions").delete().eq("user_id", id),
  ]);

  // Usa REST API direta do Supabase Admin para garantir deleção mesmo com constraints
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
  });

  if (!adminRes.ok) {
    const body = await adminRes.json().catch(() => ({}));
    const msg = (body as { msg?: string; message?: string })?.msg ?? (body as { msg?: string; message?: string })?.message ?? `Erro ${adminRes.status}`;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
