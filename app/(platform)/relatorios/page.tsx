import { ReportosClient, type Report, type GeneratedReport } from "@/components/relatorios/relatorios-client";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const GITHUB_RAW = "https://raw.githubusercontent.com/Jlnetto35/relat-rios-de-intelig-ncia-de-mercado-v3-M-A/main";
const GITHUB_API = "https://api.github.com/repos/Jlnetto35/relat-rios-de-intelig-ncia-de-mercado-v3-M-A/contents";
const TEAM_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"];

function parseReport(name: string, folder: "root" | "historico"): Report | null {
  if (!name.endsWith(".html") || name === "index.html" || name === "prompts.html") return null;

  const path = folder === "historico" ? `historico/${name}` : name;
  const rawUrl = `${GITHUB_RAW}/${path}`;

  // Extract date: v3-report-2026-05-08.html or v3-report-topic-2026-04-19.html
  const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : "0000-00-00";

  // Extract topic (everything between "v3-report-" and "-YYYY" or ".html")
  const topicMatch = name.replace("v3-report-", "").replace(/[-_]?\d{4}-\d{2}-\d{2}\.html$/, "").replace(".html", "");
  const topic = topicMatch.trim();
  const isDaily = !topic || topic === "" || /^\d{4}/.test(topic);

  return {
    id: name,
    name,
    date,
    title: isDaily ? `Inteligência de Mercado — ${formatDate(date)}` : capitalize(topic.replace(/-/g, " ")),
    type: isDaily ? "diario" : "setor",
    rawUrl,
    folder,
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function fetchReports(): Promise<Report[]> {
  const headers: Record<string, string> = { "User-Agent": "v3-partners-portal" };
  const token = (process.env.GITHUB_REPORTS_TOKEN ?? "").replace(/\s/g, "");
  if (token) headers["Authorization"] = `token ${token}`;

  try {
    const [rootRes, histRes] = await Promise.allSettled([
      fetch(GITHUB_API, { headers, next: { revalidate: 3600 } }),
      fetch(`${GITHUB_API}/historico`, { headers, next: { revalidate: 3600 } }),
    ]);

    const reports: Report[] = [];

    if (rootRes.status === "fulfilled" && rootRes.value.ok) {
      const rootFiles = await rootRes.value.json();
      for (const f of rootFiles) {
        const r = parseReport(f.name, "root");
        if (r) reports.push(r);
      }
    }

    if (histRes.status === "fulfilled" && histRes.value.ok) {
      const histFiles = await histRes.value.json();
      for (const f of histFiles) {
        const r = parseReport(f.name, "historico");
        if (r) reports.push(r);
      }
    }

    return reports.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export default async function RelatoriosPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userRole = "PARTNER";
  let userName = "";

  if (user) {
    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: profile } = await svc.from("profiles").select("full_name, role").eq("id", user.id).single();
    userRole = profile?.role ?? "PARTNER";
    userName = profile?.full_name ?? "";
  }

  if (!TEAM_ROLES.includes(userRole)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#9BAFC5] text-sm">Acesso restrito ao time interno.</p>
      </div>
    );
  }

  const reports = await fetchReports();

  // Fetch generated reports from Supabase
  let generatedReports: GeneratedReport[] = [];
  if (user) {
    const svc2 = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: genData } = await svc2
      .from("generated_reports")
      .select("id, squad_id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    generatedReports = (genData ?? []) as GeneratedReport[];
  }

  return <ReportosClient reports={reports} generatedReports={generatedReports} userRole={userRole} userName={userName} />;
}
