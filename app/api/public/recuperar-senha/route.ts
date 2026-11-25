// Pedido de recuperação de senha no domínio do Enterprise. Responde sempre { ok: true }: a busca
// e o envio rodam depois da resposta (after), para não revelar se o e-mail existe.
// BRIEF docs/briefs/2026-11-25_recuperar-senha-marca-enterprise.md
import { NextRequest, NextResponse, after } from "next/server";
import { getClientIp } from "@/lib/audit";
import { normalizarEmail } from "@/lib/recuperar-senha-regras";
import { processarPedido } from "@/lib/recuperar-senha";

export async function POST(req: NextRequest) {
  let email: string | null = null;
  try {
    const body = (await req.json()) as { email?: unknown };
    email = normalizarEmail(body?.email);
  } catch { /* corpo inválido: mesma resposta */ }

  if (email) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const ip = getClientIp(req);
    const alvo = email;
    after(async () => {
      try {
        await processarPedido(alvo, host, ip);
      } catch (e) {
        console.error("[recuperar-senha] pedido não processado:", (e as Error)?.message ?? "erro");
      }
    });
  }
  return NextResponse.json({ ok: true });
}
