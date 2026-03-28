import { RankingClient } from "@/components/ranking/ranking-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RankingPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("v3_demo_session")?.value;
  let userRole = "PARTNER";
  let userName = "Usuário";
  if (session) {
    try {
      const s = JSON.parse(session);
      userRole = s.role ?? "PARTNER";
      userName = s.full_name ?? "Usuário";
    } catch {}
  }
  if (userRole !== "ADMIN" && userRole !== "PARTNER") redirect("/dashboard");
  return <RankingClient userRole={userRole} userName={userName} />;
}
