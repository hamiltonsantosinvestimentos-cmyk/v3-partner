import { NextResponse } from "next/server";

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

  const { data: profileData } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const profile = profileData as { role: string } | null;
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const allowedFields = ["role", "is_active", "phone", "full_name", "document_cpf"];
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

  const { error: deleteError } = await supabase.auth.admin.deleteUser(id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
