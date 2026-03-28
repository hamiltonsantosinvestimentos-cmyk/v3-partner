import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createServiceClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado", status: 401, user: null };

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = data as { role: string } | null;
  if (profile?.role !== "ADMIN") return { error: "Acesso negado", status: 403, user: null };
  return { error: null, status: 200, user };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServiceClient();
  const { id } = await params;

  const { error, status } = await checkAdmin(supabase);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json();
  const allowedFields = ["role", "is_active", "phone", "full_name"];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  // Use raw supabase call to avoid type strictness on dynamic update data
  const supabaseAny = supabase as unknown as {
    from: (table: string) => {
      update: (data: unknown) => {
        eq: (col: string, val: string) => {
          select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> }
        }
      }
    }
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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServiceClient();
  const { id } = await params;

  const { error, status } = await checkAdmin(supabase);
  if (error) return NextResponse.json({ error }, { status });

  const { error: deleteError } = await supabase.auth.admin.deleteUser(id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
