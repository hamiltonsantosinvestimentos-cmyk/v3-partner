import { NextRequest, NextResponse } from "next/server";

// BrasilAPI CNPJ lookup — free, reliable, no auth required
// https://brasilapi.com.br/api/cnpj/v1/{cnpj}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cnpj = searchParams.get("cnpj") || "";

  if (!cnpj) {
    return NextResponse.json({ error: "Informe o CNPJ" }, { status: 400 });
  }

  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) {
    return NextResponse.json({ error: "CNPJ inválido — deve ter 14 dígitos" }, { status: 400 });
  }

  try {
    // Primary: BrasilAPI
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // cache 1h
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(normalizebrasilapi(data));
    }

    // Fallback: ReceitaWS (rate limited: 3 req/min on free tier)
    const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`, {
      headers: { Accept: "application/json" },
    });

    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.status === "ERROR") {
        return NextResponse.json({ error: data2.message || "CNPJ não encontrado" }, { status: 404 });
      }
      return NextResponse.json(normalizeReceitaWS(data2));
    }

    return NextResponse.json({ error: "CNPJ não encontrado nas bases públicas" }, { status: 404 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro de conexão";
    return NextResponse.json({ error: `Erro ao consultar CNPJ: ${msg}` }, { status: 500 });
  }
}

interface BrasilApiData {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  capital_social?: number;
  email?: string;
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  municipio?: string;
  uf?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  porte?: string;
  cnae_fiscal_descricao?: string;
  data_inicio_atividade?: string;
  qsa?: Array<{
    nome_socio?: string;
    qualificacao_socio?: string;
    data_entrada_sociedade?: string;
    faixa_etaria?: string;
  }>;
}

function normalizebrasilapi(d: BrasilApiData) {
  return {
    cnpj: d.cnpj || "",
    razao_social: d.razao_social || "",
    nome_fantasia: d.nome_fantasia || "",
    situacao_cadastral: d.descricao_situacao_cadastral || "ATIVA",
    capital_social: d.capital_social || 0,
    email: d.email || "",
    telefone: d.ddd_telefone_1 || "",
    telefone2: d.ddd_telefone_2 || "",
    municipio: d.municipio || "",
    uf: d.uf || "",
    logradouro: `${d.logradouro || ""}, ${d.numero || ""}`.trim().replace(/^,\s*/, ""),
    bairro: d.bairro || "",
    cep: d.cep || "",
    porte: d.porte || "",
    cnae: d.cnae_fiscal_descricao || "",
    data_abertura: d.data_inicio_atividade || "",
    socios: (d.qsa || []).map((s) => ({
      nome: s.nome_socio || "",
      qualificacao: s.qualificacao_socio || "",
      entrada: s.data_entrada_sociedade || "",
      faixa_etaria: s.faixa_etaria || "",
    })),
  };
}

interface ReceitaWSData {
  cnpj?: string;
  nome?: string;
  fantasia?: string;
  situacao?: string;
  capital_social?: string;
  email?: string;
  telefone?: string;
  municipio?: string;
  uf?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  porte?: string;
  atividade_principal?: Array<{ text?: string }>;
  abertura?: string;
  qsa?: Array<{ nome?: string; qual?: string }>;
  status?: string;
  message?: string;
}

function normalizeReceitaWS(d: ReceitaWSData) {
  return {
    cnpj: d.cnpj || "",
    razao_social: d.nome || "",
    nome_fantasia: d.fantasia || "",
    situacao_cadastral: d.situacao || "ATIVA",
    capital_social: parseFloat((d.capital_social || "0").replace(/\./g, "").replace(",", ".")) || 0,
    email: d.email || "",
    telefone: d.telefone || "",
    telefone2: "",
    municipio: d.municipio || "",
    uf: d.uf || "",
    logradouro: `${d.logradouro || ""}, ${d.numero || ""}`.trim().replace(/^,\s*/, ""),
    bairro: d.bairro || "",
    cep: d.cep || "",
    porte: d.porte || "",
    cnae: d.atividade_principal?.[0]?.text || "",
    data_abertura: d.abertura || "",
    socios: (d.qsa || []).map((s) => ({
      nome: s.nome || "",
      qualificacao: s.qual || "",
      entrada: "",
      faixa_etaria: "",
    })),
  };
}
