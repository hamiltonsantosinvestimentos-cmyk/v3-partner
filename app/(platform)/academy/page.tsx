import { AcademyClient } from "@/components/academy/academy-client";
import { cookies } from "next/headers";

interface AcademyPageProps {
  searchParams: Promise<{ cat?: string }>;
}

export default async function AcademyPage({ searchParams }: AcademyPageProps) {
  const params = await searchParams;

  // Read user role from demo session or Supabase
  let userRole = "PARTNER";
  const cookieStore = await cookies();
  const session = cookieStore.get("v3_demo_session")?.value;
  if (session) {
    try { userRole = JSON.parse(session).role ?? "PARTNER"; } catch {}
  }

  return <AcademyClient initialCategory={params.cat} userRole={userRole} />;
}
