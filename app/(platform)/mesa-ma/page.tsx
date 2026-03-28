import { MesaMaClient } from "@/components/mesa-ma/mesa-ma-client";
import { cookies } from "next/headers";

export default async function MesaMaPage() {
  let userRole = "GESTAO";
  const cookieStore = await cookies();
  const session = cookieStore.get("v3_demo_session")?.value;
  if (session) {
    try { userRole = JSON.parse(session).role ?? "GESTAO"; } catch {}
  }
  return <MesaMaClient userRole={userRole} />;
}
