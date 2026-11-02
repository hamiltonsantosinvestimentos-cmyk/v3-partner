// Selo de classificação pendente (BRIEF Mesa M&A bloco C, segunda entrega, 01/11/2026). Aparece só para a equipe:
// a rota só devolve `classificacao_pendente` para ADMIN, GESTAO e MESA_OPERACIONAL. Registro que veio da
// transferência da Mesa M&A e ainda não tem código emitido. Texto abaixo de 12px usa Gold Light (brandbook V4.2).
export function SeloClassificacaoPendente({ className = "" }: { className?: string }) {
  return (
    <span
      title="Veio da Mesa M&A e ainda não tem código. Confirme a classificação no card do deal para emitir o código e liberar a publicação."
      className={`inline-flex items-center rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-1.5 py-0 text-[9px] font-bold uppercase leading-4 tracking-wide text-[#E8C97A] ${className}`}
    >
      Classificação pendente
    </span>
  );
}
