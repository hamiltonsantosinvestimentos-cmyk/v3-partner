import { NextRequest, NextResponse } from "next/server";

// Proxy for public CNPJ APIs — avoids CORS and centralizes rate-limit handling

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cnpj = searchParams.get("cnpj") || "";
  const q = searchParams.get("q") || "";
  const uf = searchParams.get("uf") || "";
  const cidade = searchParams.get("cidade") || "";

  try {
    // ── Mode 1: individual CNPJ lookup ────────────────────────────────────────
    if (cnpj) {
      const clean = cnpj.replace(/\D/g, "");
      if (clean.length !== 14) {
        return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
      }
      const res = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        return NextResponse.json({ error: "CNPJ não encontrado" }, { status: 404 });
      }
      const data = await res.json();
      return NextResponse.json(data);
    }

    // ── Mode 2: search by query + city/state ──────────────────────────────────
    let municipioCode = "";
    if (cidade && uf) {
      try {
        const muniRes = await fetch(
          `https://brasilapi.com.br/api/ibge/municipios/v1/${uf.toUpperCase()}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (muniRes.ok) {
          const munis = await muniRes.json() as Array<{ nome: string; codigo_ibge: string }>;
          const found = munis.find(
            (m) => m.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
              cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          );
          if (found) municipioCode = found.codigo_ibge;
        }
      } catch {
        // proceed without municipio code
      }
    }

    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (municipioCode) params.set("municipio", municipioCode);

    const searchUrl = `https://publica.cnpj.ws/cnpj/search?${params.toString()}`;
    const res = await fetch(searchUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `API indisponível (${res.status})` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: `Erro ao consultar dados públicos: ${msg}` }, { status: 500 });
  }
}
