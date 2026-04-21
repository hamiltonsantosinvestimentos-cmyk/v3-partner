import { NextRequest, NextResponse } from "next/server";

// ─── Validação matemática de CPF (dígitos verificadores) ───────────────────
function validarCPF(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  // Rejeita sequências iguais (ex: 111.111.111-11)
  if (/^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf[10]);
}

export async function POST(req: NextRequest) {
  try {
    const { cpf } = await req.json();

    if (!cpf) {
      return NextResponse.json({ error: "CPF obrigatório." }, { status: 400 });
    }

    const clean = cpf.replace(/\D/g, "");

    // ── CPF ──────────────────────────────────────────────────────────────────
    if (clean.length === 11) {
      if (!validarCPF(clean)) {
        return NextResponse.json(
          { error: "CPF inválido. Verifique os dígitos informados." },
          { status: 422 }
        );
      }
      return NextResponse.json({
        valid: true,
        tipo: "CPF",
        nome: "",           // sem consulta externa — usuário preenche o nome
        situacao: "Válido", // verificado pelos dígitos verificadores
      });
    }

    // ── CNPJ — consulta BrasilAPI (razão social) ──────────────────────────
    if (clean.length === 14) {
      try {
        const res = await fetch(
          `https://brasilapi.com.br/api/cnpj/v1/${clean}`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) }
        );

        if (!res.ok) {
          return NextResponse.json(
            { error: res.status === 404 ? "CNPJ não encontrado." : "Serviço da Receita Federal indisponível. Tente novamente." },
            { status: res.status === 404 ? 422 : 502 }
          );
        }

        const data = await res.json();
        return NextResponse.json({
          valid: true,
          tipo: "CNPJ",
          nome: (data.razao_social as string) ?? "",
          situacao: (data.descricao_situacao_cadastral as string) ?? "Ativa",
        });
      } catch {
        return NextResponse.json(
          { error: "Serviço da Receita Federal indisponível. Tente novamente." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { error: "Documento inválido. CPF: 11 dígitos · CNPJ: 14 dígitos." },
      { status: 400 }
    );
  } catch (err) {
    console.error("cpf-validate error:", err);
    return NextResponse.json({ error: "Erro ao processar. Tente novamente." }, { status: 500 });
  }
}
