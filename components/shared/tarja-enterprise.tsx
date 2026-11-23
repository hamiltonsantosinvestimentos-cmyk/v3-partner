// Tarja do Enterprise nas mesas da V3 (BRIEF docs/briefs/2026-11-21_tarja-enterprise-nas-mesas-v3.md).
// Só aparece quando a proposta traz o campo `enterprise`, que o servidor só manda para a equipe interna.
// A cor do cliente aparece só aqui (faixa e selo): exceção registrada no CLAUDE.md.

export interface TarjaEnterpriseDados {
  nome: string;
  cor: string;
  corTexto: string;
  corFaixa: string;
  papel: "master" | "equipe";
}

const TOOLTIP = (nome: string) => `Proposta de cliente Enterprise (${nome}). A comissão vai para o master.`;

/** Faixa de 4 px no topo de um card (o card precisa de `relative overflow-hidden`). */
export function FaixaEnterprise({ dados }: { dados: TarjaEnterpriseDados | null | undefined }) {
  if (!dados) return null;
  return <div aria-hidden className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: dados.corFaixa }} />;
}

/** Selo "ENTERPRISE · NOME" (card e cabeçalho) ou só "NOME" (linha de tabela). */
export function SeloEnterprise({ dados, tamanho = "card" }: { dados: TarjaEnterpriseDados | null | undefined; tamanho?: "card" | "linha" | "cabecalho" }) {
  if (!dados) return null;
  const texto = tamanho === "linha" ? dados.nome.toUpperCase() : `ENTERPRISE · ${dados.nome.toUpperCase()}`;
  const classes = tamanho === "cabecalho"
    ? "text-[11px] px-2 py-0.5"
    : tamanho === "linha" ? "text-[9px] px-1.5 py-px" : "text-[9px] px-1.5 py-0.5";
  return (
    <span
      title={TOOLTIP(dados.nome)}
      className={`inline-flex items-center rounded font-bold tracking-wide whitespace-nowrap max-w-full truncate ${classes}`}
      style={{ background: dados.cor, color: dados.corTexto, border: "1px solid color-mix(in srgb, #F0ECE4 20%, transparent)" }}
    >
      {texto}
    </span>
  );
}

/** "Fulano · equipe AGS Finance" / "Fulano · master AGS Finance". */
export function rotuloPartnerEnterprise(nomePartner: string | null | undefined, dados: TarjaEnterpriseDados | null | undefined): string {
  const nome = nomePartner ?? "";
  if (!dados) return nome;
  return `${nome} · ${dados.papel === "master" ? "master" : "equipe"} ${dados.nome}`;
}

export type FiltroOrigem = "todas" | "v3" | "enterprise";

export function passaFiltroOrigem(p: { enterprise?: TarjaEnterpriseDados | null }, filtro: FiltroOrigem): boolean {
  if (filtro === "todas") return true;
  return filtro === "enterprise" ? !!p.enterprise : !p.enterprise;
}

/** Seletor "Origem" (ordem fixa, com contagem). Só renderiza se houver alguma proposta Enterprise ou filtro ativo. */
export function FiltroOrigemSelect({ valor, onChange, contagem }: { valor: FiltroOrigem; onChange: (v: FiltroOrigem) => void; contagem: { todas: number; v3: number; enterprise: number } }) {
  if (contagem.enterprise === 0 && valor === "todas") return null;
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>Origem</span>
      <select
        id="filtro-origem"
        value={valor}
        onChange={(e) => onChange(e.target.value as FiltroOrigem)}
        className="h-8 px-2 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none"
      >
        <option value="todas">Todas ({contagem.todas})</option>
        <option value="v3">V3 ({contagem.v3})</option>
        <option value="enterprise">Enterprise ({contagem.enterprise})</option>
      </select>
    </label>
  );
}
