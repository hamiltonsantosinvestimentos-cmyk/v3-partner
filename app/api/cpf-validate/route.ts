import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { cpf, birthDate } = await req.json();

    if (!cpf) {
      return NextResponse.json({ error: "CPF obrigatório." }, { status: 400 });
    }

    const clean = cpf.replace(/\D/g, "");

    if (clean.length === 11) {
      // CPF — requer data de nascimento para consulta na RF
      if (!birthDate) {
        return NextResponse.json({ error: "Data de nascimento obrigatória para validar CPF." }, { status: 400 });
      }

      const res = await fetch(
        `https://brasilapi.com.br/api/cpf/v1/${clean}/${birthDate}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) }
      );

      if (!res.ok) {
        if (res.status === 404 || res.status === 400) {
          return NextResponse.json(
            { error: "CPF não encontrado ou data de nascimento incorreta. Verifique e tente novamente." },
            { status: 422 }
          );
        }
        return NextResponse.json(
          { error: "Serviço da Receita Federal indisponível. Tente novamente em instantes." },
          { status: 502 }
        );
      }

      const data = await res.json();
      return NextResponse.json({
        valid: true,
        tipo: "CPF",
        nome: (data.nome as string) ?? "",
        situacao: (data.situacao?.descricao as string) ?? "Regular",
      });
    }

    if (clean.length === 14) {
      // CNPJ — não requer data de nascimento
      const res = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${clean}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) }
      );

      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json({ error: "CNPJ não encontrado." }, { status: 422 });
        }
        return NextResponse.json(
          { error: "Serviço da Receita Federal indisponível. Tente novamente." },
          { status: 502 }
        );
      }

      const data = await res.json();
      return NextResponse.json({
        valid: true,
        tipo: "CNPJ",
        nome: (data.razao_social as string) ?? "",
        situacao: (data.descricao_situacao_cadastral as string) ?? "Ativa",
      });
    }

    return NextResponse.json(
      { error: "Documento inválido. CPF: 11 dígitos · CNPJ: 14 dígitos." },
      { status: 400 }
    );
  } catch (err) {
    console.error("cpf-validate error:", err);
    return NextResponse.json(
      { error: "Serviço da Receita Federal indisponível. Tente novamente." },
      { status: 502 }
    );
  }
}
