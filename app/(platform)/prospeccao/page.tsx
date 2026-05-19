import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import Link from "next/link";
import { ProspeccaoClient } from "@/components/prospeccao/prospeccao-client";

const ALLOWED = ["ADMIN", "SDR", "CLOSER", "GESTAO"];

export default async function ProspeccaoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED.includes((profile as { role: string }).role)) redirect("/unauthorized");

  return (
    <div className="p-6">
      <div className="flex justify-end mb-4">
        <Link
          href="/prospeccao/dashboard"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 hover:border-[#C9A84C]/40 transition-colors"
          style={{ color: "#C9A84C", background: "#162744" }}
        >
          📊 Dashboard
        </Link>
      </div>
      <ProspeccaoClient role={(profile as { role: string }).role} />
    </div>
  );
}
