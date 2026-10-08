import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerDocumentoCadastro, mimeSuportado, type TipoCliente } from "@/lib/leitura-cadastro";

// Modal de nova proposta → "Enviar documento": lê CNH/RG, cartão CNPJ ou
// contrato social e devolve os dados para preencher a aba Dados do Cliente.
// Não grava nada: o arquivo só sobe de verdade junto com a proposta.

export const maxDuration = 60;

const LIMITE_BYTES = 4 * 1024 * 1024; // corpo de função na Vercel é 4,5 MB

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const tipoCliente = form?.get("clientType") === "PJ" ? "PJ" : "PF" as TipoCliente;
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });

  const mime = mimeSuportado(file.name);
  if (!mime) return NextResponse.json({ error: "Formato não suportado. Use PDF, JPG ou PNG." }, { status: 400 });
  if (file.size > LIMITE_BYTES) return NextResponse.json({ error: "Arquivo acima de 4 MB. Envie uma versão menor ou digite manualmente." }, { status: 413 });

  try {
    const dados = await lerDocumentoCadastro(Buffer.from(await file.arrayBuffer()), mime, tipoCliente);
    return NextResponse.json({ dados });
  } catch (e) {
    console.error("[ler-documento]", e);
    return NextResponse.json({ error: "Não consegui ler o documento. Tente uma foto mais nítida ou digite manualmente." }, { status: 422 });
  }
}
