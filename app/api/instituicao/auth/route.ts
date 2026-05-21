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

  const svc = serviceClient();
  const { data: inst } = await svc
    .from("instituicoes")
    .select("id, nome, status")
    .eq("auth_user_id", data.user.id)
    .single();

  if (!inst) {
    return NextResponse.json({ error: "Instituição não encontrada." }, { status: 403 });
  }

  if (inst.status === "inativo") {
    return NextResponse.json({ error: "Acesso inativo. Entre em contato com a V3 Partners." }, { status: 403 });
  }

  const finalResponse = NextResponse.json({
    success: true,
    instituicao_id: inst.id,
    nome: inst.nome,
  });

  response.cookies.getAll().forEach(cookie => {
    finalResponse.cookies.set(cookie.name, cookie.value);
  });

  return finalResponse;
}
