import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getQuiz } from "@/lib/academy-quizzes";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const categoryId = req.nextUrl.searchParams.get("category_id");

  // Return all quiz results for user
  let q = svc().from("academy_quiz_results").select("*").eq("user_id", user.id);
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data } = await q;

  return NextResponse.json({ results: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { category_id, answers } = await req.json() as { category_id: string; answers: number[] };
  if (!category_id || !Array.isArray(answers)) {
    return NextResponse.json({ error: "category_id e answers são obrigatórios" }, { status: 400 });
  }

  const quiz = getQuiz(category_id);
  if (!quiz) return NextResponse.json({ error: "Quiz não encontrado" }, { status: 404 });

  // Grade the quiz
  let correct = 0;
  quiz.questions.forEach((q, i) => {
    if (answers[i] === q.correct) correct++;
  });
  const score = Math.round((correct / quiz.questions.length) * 100);
  const passed = score >= quiz.passingScore;

  // Check existing result
  const { data: existing } = await svc()
    .from("academy_quiz_results")
    .select("id, attempts, score, passed")
    .eq("user_id", user.id)
    .eq("category_id", category_id)
    .maybeSingle();

  const attempts = (existing?.attempts ?? 0) + 1;

  // Only update if improving score or first attempt
  if (!existing || score > (existing.score ?? 0)) {
    await svc()
      .from("academy_quiz_results")
      .upsert({
        user_id: user.id,
        category_id,
        score,
        passed,
        answers: JSON.stringify(answers),
        attempts,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,category_id" });
  } else {
    // Just increment attempts
    await svc()
      .from("academy_quiz_results")
      .update({ attempts, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("category_id", category_id);
  }

  return NextResponse.json({ score, passed, correct, total: quiz.questions.length, passingScore: quiz.passingScore });
}
