"use client";

import { useEffect, useState } from "react";
import { TrendingUp, X, Crown } from "lucide-react";
import Link from "next/link";

const DISMISS_KEY = "upgrade-nudge-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

interface UpgradeCheckData {
  eligible: boolean;
  totalDeals: number;
  totalAmount: number;
  extraEarned: number;
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Date.now() - ts < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignorar erros de localStorage
  }
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function UpgradeNudge() {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<UpgradeCheckData | null>(null);

  useEffect(() => {
    // Não mostra se já foi dispensado nos últimos 7 dias
    if (isDismissed()) return;

    fetch("/api/upgrade/check")
      .then((res) => res.json())
      .then((json: UpgradeCheckData) => {
        if (json.eligible) {
          setData(json);
          setVisible(true);
        }
      })
      .catch(() => {
        // Silencia erros de rede
      });
  }, []);

  function handleDismiss() {
    dismiss();
    setVisible(false);
  }

  if (!visible || !data) return null;

  return (
    <div className="relative rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/5 p-5">
      {/* Badge OPORTUNIDADE */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Ícone */}
          <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-[#C9A84C]" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Badge */}
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-2 py-0.5 rounded-full mb-2">
              <Crown className="w-2.5 h-2.5" />
              OPORTUNIDADE
            </span>

            {/* Título */}
            <p className="text-sm font-bold text-[#F0ECE4] leading-snug">
              Você já fechou{" "}
              <span className="text-[#E8C97A]">{data.totalDeals} deals!</span>
            </p>

            {/* Subtítulo com cálculo */}
            {data.totalAmount > 0 && (
              <p className="text-xs text-[#7A8FA8] mt-1 leading-relaxed">
                Se fosse PRO, teria ganho{" "}
                <span className="text-[#C9A84C] font-semibold">
                  {formatBRL(data.extraEarned)} a mais
                </span>{" "}
                em comissões (50% vs 30% atual).
              </p>
            )}
          </div>
        </div>

        {/* Botão fechar */}
        <button
          onClick={handleDismiss}
          aria-label="Fechar sugestão de upgrade"
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#7A8FA8] hover:text-[#F0ECE4] hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* CTA */}
      <div className="mt-4 flex items-center gap-3">
        <Link
          href="/minha-assinatura"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold hover:bg-[#E8C97A] transition-colors"
        >
          <Crown className="w-3.5 h-3.5" />
          Quero ser PRO — R$397/mês
        </Link>
        <button
          onClick={handleDismiss}
          className="text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
