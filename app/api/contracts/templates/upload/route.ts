import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { extractContractText } from "@/lib/contract-upload-extract";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireAdmin(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") return null;
  return { userId: user.id };
}

export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN pode fazer upload" }, { status: 403 });

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

  try {
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
    return NextResponse.json({ error: `Erro ao processar arquivo: ${err.message}` }, { status: 500 });
  }
}
