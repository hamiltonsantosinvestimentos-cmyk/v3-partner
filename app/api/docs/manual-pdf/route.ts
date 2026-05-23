import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ManualPlataformaPDF } from "@/lib/manual-plataforma-pdf";

export async function GET() {
  // Requer autenticação
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const buffer = await renderToBuffer(React.createElement(ManualPlataformaPDF));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="manual-v3-partners.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[manual-pdf]", err);
    return NextResponse.json({ error: "Erro ao gerar PDF" }, { status: 500 });
  }
}
