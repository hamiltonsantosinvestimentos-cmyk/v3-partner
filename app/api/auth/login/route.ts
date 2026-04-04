import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const response = NextResponse.json({ success: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options ?? {});
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  console.log("[login] url:", process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30));
  console.log("[login] error:", error?.message, error?.status, error?.code);

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code, status: error.status }, { status: 401 });
  }

  return response;
}
