import Link from "next/link";

// Abas do módulo Compliance. São rotas (links), não estado de cliente: o bloqueio real da
// Auditoria de logs continua no servidor (app/(platform)/compliance/auditoria/page.tsx, só ADMIN).
// A aba some para os demais papéis apenas por conveniência.
export function ComplianceTabs({ userRole, active }: { userRole: string; active: "geral" | "auditoria" }) {
  const tabs = [
    { key: "geral" as const, href: "/compliance", label: "Visão geral", visible: true },
    { key: "auditoria" as const, href: "/compliance/auditoria", label: "Auditoria de logs", visible: userRole === "ADMIN" },
  ].filter((t) => t.visible);

  if (tabs.length < 2) return null;

  return (
    <nav aria-label="Seções de Compliance" className="flex gap-1 border-b border-[#9BAFC5]/15">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 transition-colors ${
            active === t.key
              ? "border-[#C9A84C] text-[#F5F1E8]"
              : "border-transparent text-[#9BAFC5] hover:text-[#F5F1E8]"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
