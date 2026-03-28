import { CRMClient } from "@/components/crm/crm-client";
import { cookies } from "next/headers";

export default async function CRMPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("v3_demo_session")?.value;
  let userRole = "PARTNER";
  let userName = "Partner";
  let userId = "partner-001";
  if (session) {
    try {
      const s = JSON.parse(session);
      userRole = s.role ?? "PARTNER";
      userName = s.full_name ?? "Partner";
      userId = s.id ?? "partner-001";
    } catch {}
  }
  return <CRMClient userRole={userRole} userName={userName} userId={userId} />;
}
