"use client";

import type { QuickReplyOption } from "@/lib/whatsapp/quick-reply";

export const DEFAULT_QUICK_REPLY_OPTIONS: QuickReplyOption[] = [
  { key: "1", label: "Tenho interesse" },
  { key: "2", label: "Agendar apresentação" },
];

// Editor compartilhado de opções de resposta rápida — usado no composer do chat 1:1
// e no formulário de campanha de Envio em Massa.
export function QuickReplyOptionsEditor({
  options, onChange, maxOptions = 3,
}: {
  options: QuickReplyOption[];
  onChange: (options: QuickReplyOption[]) => void;
  maxOptions?: number;
}) {
  function updateLabel(i: number, label: string) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, label } : o)));
  }
  function addOption() {
    if (options.length >= maxOptions) return;
    onChange([...options, { key: String(options.length + 1), label: "" }]);
  }
  function removeOption(i: number) {
    onChange(options.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, key: String(idx + 1) })));
  }

  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-xs text-[#7A8FA8] w-4 shrink-0">{opt.key}.</span>
          <input
            value={opt.label}
            onChange={e => updateLabel(i, e.target.value)}
            placeholder="Texto da opção..."
            className="flex-1 px-2 py-1 text-xs rounded-md bg-[#0A1628] border border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
          />
          {options.length > 1 && (
            <button onClick={() => removeOption(i)} className="text-[#7A8FA8] hover:text-red-400 text-xs px-1 shrink-0">✕</button>
          )}
        </div>
      ))}
      {options.length < maxOptions && (
        <button onClick={addOption} className="text-[10px] font-semibold text-[#C9A84C] hover:underline">
          + opção
        </button>
      )}
    </div>
  );
}
