import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;

const ALLOWED_ROLES = ["ADMIN", "MESA_OPERACIONAL"];

const DATAJUD_KEY = process.env.DATAJUD_API_KEY ?? "";

const TRIBUNAIS_PRINCIPAIS = [
  "api_publica_tjsp",
  "api_publica_tjrj",
  "api_publica_tjmg",
  "api_publica_tjrs",
  "api_publica_tjba",
  "api_publica_tjpr",
  "api_publica_tjsc",
  "api_publica_tjdf",
  "api_publica_tjgo",
  "api_publica_tjce",
  "api_publica_trf1",
  "api_publica_trf2",
  "api_publica_trf3",
  "api_publica_trf4",
  "api_publica_trf5",
  "api_publica_trf6",
  "api_publica_tst",
  "api_publica_stj",
  "api_publica_tjto",
];

async function searchTribunal(tribunal: string, body: object): Promise<object[]> {
  try {
    const res = await fetch(
      `https://api-publica.datajud.cnj.jus.br/${tribunal}/_search`,
      {
        method: "POST",
        headers: {
          Authorization: `APIKey ${DATAJUD_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, size: 10 }),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const hits = json?.hits?.hits ?? [];
    return hits.map((h: { _source: object }) => ({
      ...h._source,
      _tribunal: tribunal.replace("api_publica_", "").toUpperCase(),
    }));
  } catch {
    return [];
  }
}

function buildQuery(tipo: string, valor: string) {
  const valorLimpo = valor.replace(/\D/g, "");

  if (tipo === "processo") {
    return {
      query: { match: { numeroProcesso: valorLimpo || valor } },
    };
  }

  if (tipo === "cpf" || tipo === "cnpj") {
    return {
      query: {
        bool: {
          should: [
            { match: { "partes.cpfCnpj": valor } },
            { match: { "partes.cpfCnpj": valorLimpo } },
            { match: { "partes.documento": valorLimpo } },
            { match: { "partes.numeroDocumentoPrincipal": valorLimpo } },
          ],
          minimum_should_match: 1,
        },
      },
    };
  }

  if (tipo === "nome") {
    return {
      query: {
        bool: {
          should: [
            { match: { "partes.nome": { query: valor, operator: "and" } } },
            { match: { "partes.nomeParteAtiva": { query: valor, operator: "and" } } },
            { match: { "partes.nomePartePassiva": { query: valor, operator: "and" } } },
          ],
          minimum_should_match: 1,
        },
      },
    };
  }

  return { query: { match_all: {} } };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { tipo, valor, tribunais } = await req.json();

  if (!tipo || !valor) {
    return NextResponse.json({ error: "tipo e valor são obrigatórios" }, { status: 400 });
  }

  const query = buildQuery(tipo, valor);

  // Para processo por número: detecta o tribunal pelo número CNJ ou busca nos selecionados
  let targets: string[] = tribunais?.length ? tribunais : TRIBUNAIS_PRINCIPAIS;

  // Se for número de processo, reduz para os selecionados (ou todos se não especificado)
  if (tipo === "processo" && !tribunais?.length) {
    // Tenta detectar tribunal pelos dígitos 13-14 do número CNJ (segmento J.TT)
    const digits = valor.replace(/\D/g, "");
    targets = TRIBUNAIS_PRINCIPAIS; // busca em todos na falta de detecção
    if (digits.length === 20) {
      // Segmento de justiça é o 14º dígito, tribunal são os dígitos 15-16
      targets = TRIBUNAIS_PRINCIPAIS;
    }
  }

  // Limita para evitar timeout: CPF/CNPJ/nome nos tribunais selecionados em lotes de 6
  const BATCH = 6;
  const allResults: object[] = [];

  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(t => searchTribunal(t, query)));
    results.forEach(r => allResults.push(...r));
    if (allResults.length >= 50) break; // limite de resultados
  }

  return NextResponse.json({ resultados: allResults, total: allResults.length });
}
