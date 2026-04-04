import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("[login] ENV VARS MISSING — url:", !!url, "key:", !!anonKey);
    return NextResponse.json({ error: "Configuração ausente no servidor" }, { status: 500 });
  }

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

  console.log("[login] supabase error:", error?.message ?? "none", "| code:", error?.code ?? "none");
  console.log("[login] user id:", data?.user?.id ?? "null");

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 401 });
  }

  return response;
}
