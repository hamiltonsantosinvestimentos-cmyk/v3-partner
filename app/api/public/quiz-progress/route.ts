import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";

// Beacon do quiz público /seja-partner — registra que uma sessão anônima
// alcançou um passo. Append-only, upsert idempotente por (quiz, session_id,
// step). Sem PII: só um id de sessão gerado no cliente.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const schema = z.object({
  session_id: z.string().min(8).max(64),
  quiz: z.string().max(40).optional(),
  step: z.string().min(1).max(40),
  step_index: z.number().int().min(0).max(50),
  ref: z.string().max(64).nullable().optional(),
  utm: z.record(z.string(), z.string().max(300)).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const p = schema.safeParse(body);
  if (!p.success) return NextResponse.json({ ok: false }, { status: 400 });
  const d = p.data;

  await svc()
    .from("quiz_progress")
    .upsert(
      {
        session_id: d.session_id,
        quiz: d.quiz ?? "seja_partner",
        step: d.step,
        step_index: d.step_index,
        ref: d.ref ?? null,
        utm: d.utm ?? null,
      },
      { onConflict: "quiz,session_id,step", ignoreDuplicates: true },
    )
    .then(() => {}, () => {});

  return NextResponse.json({ ok: true });
}
