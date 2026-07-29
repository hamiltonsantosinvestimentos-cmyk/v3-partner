import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { isAmadeusConfigured, searchFlights } from "@/lib/amadeus";

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

const searchSchema = z.object({
  origin: z.string().regex(/^[A-Z]{3}$/, "Código IATA de origem inválido"),
  destination: z.string().regex(/^[A-Z]{3}$/, "Código IATA de destino inválido"),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de ida inválida"),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// GET — busca ofertas de voo reais (Amadeus) para uma rota/data, ordenadas por preço
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  if (!isAmadeusConfigured()) {
    return NextResponse.json(
      { error: "Busca de voos ao vivo ainda não configurada (faltam AMADEUS_API_KEY / AMADEUS_API_SECRET)." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = searchSchema.safeParse({
    origin: searchParams.get("origin")?.toUpperCase(),
    destination: searchParams.get("destination")?.toUpperCase(),
    departureDate: searchParams.get("departureDate"),
    returnDate: searchParams.get("returnDate") || null,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const offers = await searchFlights({
      originIata: d.origin,
      destinationIata: d.destination,
      departureDate: d.departureDate,
      returnDate: d.returnDate,
    });
    return NextResponse.json({ offers });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
