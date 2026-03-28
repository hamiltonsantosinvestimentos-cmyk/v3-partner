import { MesaConsorcioClient } from "@/components/mesa-consorcio/mesa-consorcio-client";
import { cookies } from "next/headers";

export default async function MesaConsorcioOpPage() {
  let userRole = "GESTAO";
  const cookieStore = await cookies();
  const session = cookieStore.get("v3_demo_session")?.value;
  if (session) {
    try { userRole = JSON.parse(session).role ?? "GESTAO"; } catch {}
  }
  return <MesaConsorcioClient userRole={userRole} />;
}
