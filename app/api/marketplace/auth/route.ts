import { createServerClient } from "@supabase/ssr";
import { createClient as sc } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const response = NextResponse.json({ success: true });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return []; },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options ?? {});
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 401 });
  }

  // Verify supplier exists and get their status
  const svc = serviceClient();
  const { data: supplier } = await svc
    .from("marketplace_suppliers")
    .select("id, status")
    .eq("auth_user_id", data.user.id)
    .single();

  if (!supplier) {
    return NextResponse.json({ error: "Conta de fornecedor não encontrada." }, { status: 403 });
  }

  // Attach supplier info to response so frontend can store it
  const finalResponse = NextResponse.json({
    success: true,
    supplier_id: supplier.id,
    supplier_status: supplier.status,
  });

  // Copy cookies from intermediate response
  response.cookies.getAll().forEach(cookie => {
    finalResponse.cookies.set(cookie.name, cookie.value);
  });

  return finalResponse;
}

/** DELETE /api/marketplace/auth — logout supplier */
export async function DELETE() {
  const { createServerClient } = await import("@supabase/ssr");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const response = NextResponse.json({ success: true });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return []; },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options ?? {});
        });
      },
    },
  });
  await supabase.auth.signOut();
  return response;
}
