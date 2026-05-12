import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { coraFetch } from "@/lib/cora";
import { randomUUID } from "crypto";

interface CobrancaBody {
  // Devedor
  nome: string;
  documento: string; // CPF ou CNPJ (só números)
  email?: string;
  // Cobrança
  valor: number; // em centavos
  vencimento: string; // "YYYY-MM-DD"
  descricao: string;
  // Juros e multa (opcional)
  juros_ao_mes?: number; // ex: 1 = 1% ao mês
  multa?: number; // ex: 2 = 2%
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO", "FINANCEIRO"].includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json() as CobrancaBody;

  const payload = {
    code: randomUUID().slice(0, 8).toUpperCase(),
    customer: {
      name: body.nome,
      document: {
        identity: body.documento,
        type: body.documento.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ",
      },
      ...(body.email ? { contacts: [{ contact: body.email, type: "EMAIL" }] } : {}),
    },
    payment_terms: {
      due_date: body.vencimento,
      amount: body.valor,
    },
    ...(body.juros_ao_mes || body.multa ? {
      payment_options: {
        ...(body.juros_ao_mes ? { interest: { type: "MONTHLY_PERCENTAGE", value: body.juros_ao_mes } } : {}),
        ...(body.multa ? { fine: { type: "PERCENTAGE", value: body.multa } } : {}),
      }
    } : {}),
    services: [{ name: body.descricao, amount: body.valor }],
    notifications: {
      ...(body.email ? {
        formats: ["EMAIL"],
        by_email: { should_notify: true }
      } : {}),
    },
  };

  try {
    const res = await coraFetch("/v2/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
      idempotencyKey: randomUUID(),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data?.message ?? "Erro Cora", details: data }, { status: res.status });
    }

    return NextResponse.json({ cobranca: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO", "FINANCEIRO"].includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page") ?? "0";
  const limit = searchParams.get("limit") ?? "20";
  const status = searchParams.get("status"); // PENDING, PAID, CANCELLED, etc.

  // Testa vários endpoints até encontrar o correto
  const candidates = [
    status
      ? `/invoices?page_number=${page}&page_size=${limit}&status=${status}`
      : `/invoices?page_number=${page}&page_size=${limit}`,
    `/invoices?page=${page}&limit=${limit}`,
    `/v2/invoices?page_number=${page}&page_size=${limit}`,
    `/invoices`,
    `/v2/invoices`,
  ];

  const results: Record<string, unknown>[] = [];
  for (const path of candidates) {
    try {
      const res = await coraFetch(path);
      const data = await res.json() as Record<string, unknown>;
      if (res.ok) return NextResponse.json({ _path: path, ...data });
      results.push({ path, status: res.status, data });
    } catch (e) {
      results.push({ path, error: String(e) });
    }
  }
  // Retorna todos os erros para debug
  return NextResponse.json({ error: "Nenhum endpoint funcionou", attempts: results }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO", "FINANCEIRO"].includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  try {
    const res = await coraFetch(`/v2/invoices/${id}/cancel`, {
      method: "PUT",
      idempotencyKey: randomUUID(),
    });
    if (!res.ok) {
      const data = await res.json();
      return NextResponse.json({ error: data?.message ?? "Erro Cora" }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
