import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { extractContractText } from "@/lib/contract-upload-extract";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// P0 hotfix (02/09/2026): mesmo motivo do POST de app/api/contracts/templates/route.ts
// — Dr. Athaydes (Jurídico) tem role GESTAO, não existe role "JURIDICO" no
// sistema, GESTAO estendido aqui em vez de inventar role nova.
async function requireWriter(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id };
}

// P0 hotfix, achado real ao testar com o Dr. Athaydes (GESTAO) em produção
// (02/09/2026): a rota inteira tinha só o bloco de extração dentro de
// try/catch. requireWriter() e req.formData() ficavam FORA -- qualquer
// exceção ali (ex: multipart malformado, cliente Supabase indisponível)
// nunca virava JSON, virava a página de erro genérica 500 do Next/Vercel.
// O frontend faz `await res.json()` sem checar content-type antes, então
// isso sempre caía no catch genérico do cliente ("Erro ao fazer upload"),
// escondendo a causa raiz real -- é exatamente esse sintoma que o Dr.
// Athaydes reportou. Handler inteiro agora dentro de um único try/catch,
// com log do erro real para diagnosticar sem precisar reproduzir de novo.
export async function POST(req: NextRequest) {
  try {
    const caller = await requireWriter(req);
    if (!caller) return NextResponse.json({ error: "Apenas ADMIN ou GESTAO podem fazer upload" }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 422 });

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize)
      return NextResponse.json({ error: "Arquivo excede 5MB" }, { status: 422 });

    const allowed = [".txt", ".docx", ".pdf"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowed.includes(ext))
      return NextResponse.json({ error: `Formato ${ext} não suportado. Use: ${allowed.join(", ")}` }, { status: 422 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = await extractContractText(buffer, file.type, file.name);

    if (!text.trim())
      return NextResponse.json({ error: "Arquivo vazio ou sem texto extraível" }, { status: 422 });

    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
    const detectedVars = (text.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) => v.replace(/\{\{|\}\}/g, "").trim());

    return NextResponse.json({
      file_name: file.name,
      suggested_name: baseName,
      body_text: text.trim(),
      detected_variables: detectedVars,
      char_count: text.length,
    });
  } catch (err: any) {
    console.error("[contracts/templates/upload] falha não tratada:", err);
    return NextResponse.json({ error: `Erro ao processar arquivo: ${err?.message ?? "erro desconhecido"}` }, { status: 500 });
  }
}
