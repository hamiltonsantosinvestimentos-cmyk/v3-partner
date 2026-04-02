import { NextResponse } from "next/server";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export async function GET() {
  if (IS_DEMO) {
    return NextResponse.json([]);
  }

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const { email, password, full_name, role, phone } = await request.json();

  if (IS_DEMO) {
    const fakeUser = {
      id: `demo-${Date.now()}`,
      email,
      full_name,
      role,
      phone: phone || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({ user: fakeUser }, { status: 201 });
  }

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { data: newProfile, error: profileError } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ role, phone, full_name } as any)
    .eq("id", authData.user.id)
    .select()
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ user: newProfile }, { status: 201 });
}
