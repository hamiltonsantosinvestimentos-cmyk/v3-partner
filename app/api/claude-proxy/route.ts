import { NextRequest, NextResponse } from "next/server";

// QW-3: 127.0.0.1:5500 (setup local Hamilton) só ativo fora de produção
const ALLOWED_ORIGINS_PROD = ["https://jlnetto35.github.io"];
const ALLOWED_ORIGINS_DEV  = [...ALLOWED_ORIGINS_PROD, "http://localhost:3000", "http://127.0.0.1:5500"];
const ALLOWED_ORIGINS = process.env.NODE_ENV === "production" ? ALLOWED_ORIGINS_PROD : ALLOWED_ORIGINS_DEV;

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // QW-1: autenticação obrigatória — endpoint nunca é público
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers });

  // API key: do header (uso local do Hamilton) ou da env var do servidor
  const clientKey = req.headers.get("x-api-key");
  const apiKey = clientKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key não configurada" },
      { status: 500, headers }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400, headers });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500, headers });
  }
}
