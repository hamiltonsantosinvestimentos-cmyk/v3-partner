// Selo "Via API" (BRIEF 2026-11-06): proposta criada pelo sistema do partner pela API v1.
// Lê metadata.origem_api, gravado na criação (lib/api-v1/proposta.ts).
export function ehViaApi(metadata: unknown): boolean {
  return !!metadata && typeof metadata === "object" && (metadata as Record<string, unknown>).origem_api === true;
}

export function SeloViaApi({ metadata, className = "" }: { metadata: unknown; className?: string }) {
  if (!ehViaApi(metadata)) return null;
  const ref = (metadata as Record<string, unknown>).referencia_externa;
  return (
    <span
      title={typeof ref === "string" && ref ? `Enviada pelo sistema do partner. Referência externa: ${ref}` : "Enviada pelo sistema do partner pela API"}
      className={`inline-flex items-center rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-1.5 py-0 text-[9px] font-bold uppercase leading-4 tracking-wide text-[#E8C97A] ${className}`}
    >
      Via API
    </span>
  );
}
