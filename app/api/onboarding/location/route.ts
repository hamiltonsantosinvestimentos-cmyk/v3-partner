import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — verifica se o partner já tem localização registrada
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ has_location: false });

  try {
    const { data: authUser } = await svc().auth.admin.getUserById(user.id);
    const meta = authUser?.user?.user_metadata ?? {};
    const hasLocation = !!(meta.location_city || meta.location_denied);
    return NextResponse.json({ has_location: hasLocation });
  } catch {
    return NextResponse.json({ has_location: false });
  }
}

// POST — salva localização ou recusa do partner
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();

  if (body.denied) {
    // Registra recusa
    await svc().auth.admin.updateUserById(user.id, {
      user_metadata: {
        location_denied: true,
        location_denied_at: new Date().toISOString(),
      },
    });
    return NextResponse.json({ ok: true });
  }

  const { city, state, country, lat, lon } = body;
  if (!city) return NextResponse.json({ error: "city obrigatório" }, { status: 400 });

  await svc().auth.admin.updateUserById(user.id, {
    user_metadata: {
      location_city: city,
      location_state: state ?? null,
      location_country: country ?? "BR",
      location_lat: lat ?? null,
      location_lon: lon ?? null,
      location_updated_at: new Date().toISOString(),
      location_denied: false,
    },
  });

  return NextResponse.json({ ok: true });
}
