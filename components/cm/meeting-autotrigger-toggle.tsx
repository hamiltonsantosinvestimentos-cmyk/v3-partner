"use client";

// Interruptor do agendamento automatico da reuniao (Bloco 2, 08/10/2026). So aparece para ADMIN
// (o servidor tambem exige ADMIN). Ligar dispara convites reais as contrapartes, por isso confirmar().

import { useEffect, useState } from "react";
import { Loader2, CalendarClock } from "lucide-react";
import { Dica } from "@/components/shared/dica";
import { aviso, confirmar } from "@/lib/aviso";

const URL_FLAG = "/api/cm/feature-flags/meeting_autotrigger";

type FlagState = { enabled: boolean; updated_at_br: string | null; updated_by_name: string | null };

export function MeetingAutotriggerToggle() {
  const [state, setState] = useState<FlagState | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(URL_FLAG)
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) { setFailed(true); return; }
        setState(await res.json());
      })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function toggle() {
    if (!state) return;
    const next = !state.enabled;
    const ok = await confirmar(
      next
        ? "Ligar o agendamento automático? Os convites de reunião passarão a ser enviados às contrapartes sem passar pelo analista."
        : "Desligar o agendamento automático? Novos intakes ficarão aguardando o analista agendar a reunião manualmente.",
    );
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(URL_FLAG, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        aviso(json.error ?? "Não foi possível alterar o agendamento automático");
        // Recarrega o valor real: a mudanca pode nao ter sido aplicada.
        const again = await fetch(URL_FLAG);
        if (again.ok) setState(await again.json());
        return;
      }
      setState(json);
      aviso(next ? "Agendamento automático ligado." : "Agendamento automático desligado.");
    } catch {
      aviso("Erro de conexão: confira o valor atual do agendamento automático");
    } finally {
      setSaving(false);
    }
  }

  const indisponivel = failed || (!loading && !state);

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={loading || saving || indisponivel}
        className="flex items-center gap-2 px-4 py-2 border border-[#9BAFC5]/20 text-[#9BAFC5] rounded-lg text-sm font-medium hover:bg-[#9BAFC5]/10 hover:text-[#F5F1E8] transition disabled:opacity-50"
      >
        {loading || saving ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
        Agendamento automático: {indisponivel ? "Indisponível" : state?.enabled ? "Ligado" : "Desligado"}
      </button>
      <Dica id="agendamento_auto" />
      {state?.updated_at_br && (
        <span className="text-[11px] text-[#9BAFC5]">
          Alterado em {state.updated_at_br}{state.updated_by_name ? ` por ${state.updated_by_name}` : ""}
        </span>
      )}
    </div>
  );
}
