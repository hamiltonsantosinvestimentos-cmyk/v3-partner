import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;

const ALLOWED_ROLES = ["ADMIN", "MESA_OPERACIONAL"];
const ESCAVADOR_BASE = "https://api.escavador.com/api/v2";

async function escavadorGet(path: string, token: string) {
  const res = await fetch(`${ESCAVADOR_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  const text = await res.text();
  if (!text) throw new Error(`Escavador ${res.status}: resposta vazia`);

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Escavador ${res.status}: resposta inválida — ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg = (json as { message?: string })?.message ?? text.slice(0, 200);
    throw new Error(`Escavador ${res.status}: ${msg}`);
  }

  return json;
}

async function getValorCausa(numeroCnj: string, token: string): Promise<number | null> {
  try {
    const detalhe = await escavadorGet(
      `/processos/numero_cnj/${encodeURIComponent(numeroCnj)}`,
      token
    );
    return (detalhe as { valor?: number; valor_causa?: number }).valor
      ?? (detalhe as { valor?: number; valor_causa?: number }).valor_causa
      ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (!ALLOWED_ROLES.includes(profile?.role ?? "")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const token = process.env.ESCAVADOR_API_TOKEN;
    if (!token) return NextResponse.json({ error: "ESCAVADOR_API_TOKEN não configurado" }, { status: 500 });

    const body = await req.json();
    const { tipo, valor } = body;
    if (!tipo || !valor?.trim()) {
      return NextResponse.json({ error: "tipo e valor são obrigatórios" }, { status: 400 });
    }

    const param = (tipo === "cpf" || tipo === "cnpj") ? "cpf_cnpj" : "nome";
    const query = encodeURIComponent(valor.trim());

    // Busca lista de processos
    let data: Record<string, unknown>;
    try {
      data = await escavadorGet(`/envolvido/processos?${param}=${query}`, token);
    } catch (err) {
      return NextResponse.json(
        { error: `Erro ao consultar Escavador: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 }
      );
    }

    const envolvido = (data.envolvido_encontrado as Record<string, unknown>) ?? null;
    const total = (data.quantidade_processos as number) ?? 0;
    const matchTipo = (data.match_documento_por as string) ?? null;
    const items = ((data.items as unknown[]) ?? []).slice(0, 10); // limita a 10 para evitar timeout

    // Busca valor da causa em paralelo (máx 5 por vez)
    const processos = [];
    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);
      const batchResult = await Promise.all(
        batch.map(async (p) => {
          const processo = p as {
            numero_cnj: string;
            titulo_polo_ativo?: string;
            titulo_polo_passivo?: string;
            data_inicio?: string;
            data_ultima_movimentacao?: string;
            estado_origem?: string;
            unidade_origem?: string;
            fontes?: { sigla: string; grau: string }[];
            status_predito?: string;
          };
          const valor_causa = await getValorCausa(processo.numero_cnj, token);
          return {
            numero_cnj: processo.numero_cnj,
            polo_ativo: processo.titulo_polo_ativo ?? null,
            polo_passivo: processo.titulo_polo_passivo ?? null,
            data_inicio: processo.data_inicio ?? null,
            data_ultima_movimentacao: processo.data_ultima_movimentacao ?? null,
            estado: processo.estado_origem ?? null,
            tribunal: processo.fontes?.[0]?.sigla ?? null,
            grau: processo.fontes?.[0]?.grau ?? null,
            unidade: processo.unidade_origem ?? null,
            status: processo.status_predito ?? null,
            valor_causa,
          };
        })
      );
      processos.push(...batchResult);
    }

    return NextResponse.json({
      envolvido,
      total_processos: total,
      match_tipo: matchTipo,
      processos,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Erro interno: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
