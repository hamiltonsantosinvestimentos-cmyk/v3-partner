"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CreditCard } from "lucide-react";

interface SubscriptionGuardProps {
  trialExpiresAt: string | null;
  isActive: boolean | null;
  role: string;
}

const EXEMPT_PATHS = ["/minha-assinatura", "/perfil"];

export function SubscriptionGuard({ trialExpiresAt, isActive, role }: SubscriptionGuardProps) {
  const pathname = usePathname();

  // Só aplica a partners
  if (!["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"].includes(role)) return null;

  // Não bloqueia nas páginas isentas
  if (EXEMPT_PATHS.some(p => pathname.startsWith(p))) return null;

  const expired = trialExpiresAt ? new Date(trialExpiresAt) < new Date() : false;
  const inactive = isActive === false;

  if (!expired && !inactive) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#09081A]/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F0ECE4]">
            {inactive ? "Conta Inativa" : "Assinatura Expirada"}
          </h2>
          <p className="text-[#7A8FA8] text-sm leading-relaxed">
            {inactive
              ? "Sua conta está inativa. Entre em contato com a equipe V3 Partners para reativar o acesso."
              : "Seu período de acesso encerrou. Renove sua assinatura para continuar usando a plataforma V3 Partners."}
          </p>
        </div>

        {trialExpiresAt && expired && (
          <div className="rounded-xl bg-[#111F35] border border-[#1B3050] px-4 py-3 text-sm text-[#7A8FA8]">
            Expirou em <span className="text-[#F0ECE4] font-semibold">
              {new Date(trialExpiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/minha-assinatura"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm text-[#09081A] transition-opacity hover:opacity-90"
            style={{ background: "#C9A84C" }}
          >
            <CreditCard className="w-4 h-4" />
            Ver Planos e Renovar
          </Link>
          <p className="text-[10px] text-[#7A8FA8]">
            Dúvidas? Fale com seu consultor V3 Partners pelo WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
