import { SplitFiscalClient } from "@/components/split-fiscal/split-fiscal-client";
import { DEMO_SPLITS } from "@/lib/demo-data";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function SplitFiscalPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("v3_demo_session")?.value;
  let userRole = "PARTNER";
  if (session) {
    try {
      const s = JSON.parse(session);
      userRole = s.role ?? "PARTNER";
    } catch {}
  }

  if (userRole !== "ADMIN" && userRole !== "PARTNER") redirect("/dashboard");

  let list = DEMO_SPLITS;

  if (!IS_DEMO) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profileData } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
    const role = (profileData as { role: string } | null)?.role || "PARTNER";
    let query = supabase.from("split_fiscal").select("*").order("created_at", { ascending: false });
    if (role === "PARTNER") query = query.eq("partner_id", user?.id ?? "");
    const { data: splits } = await query;
    list = (splits ?? []) as typeof DEMO_SPLITS;
  }

  return <SplitFiscalClient list={list} />;
}
