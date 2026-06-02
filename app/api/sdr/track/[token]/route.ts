import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Pixel de tracking de abertura — retorna GIF 1x1 transparente
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Atualiza contato como aberto (só na primeira vez)
  const { data: contato } = await svc()
    .from("sdr_campanha_contatos")
    .select("id, campanha_id, status")
    .eq("track_token", token)
    .single();

  if (contato && contato.status === "enviado") {
    await svc().from("sdr_campanha_contatos").update({
      status: "aberto",
      aberto_at: new Date().toISOString(),
    }).eq("id", contato.id);

    // Incrementa contador de abertos na campanha
    await svc().rpc("increment_campanha_abertos", { campanha_id: contato.campanha_id }).catch(() => {});
  }

  // Retorna GIF 1x1 transparente
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  return new NextResponse(gif, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
