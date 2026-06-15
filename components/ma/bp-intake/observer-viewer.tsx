import type { IntakeSchema, IntakeField } from "@/lib/ma/bp-intake/engine/schema-registry";
import type { AgronegocioProjections } from "@/lib/ma/bp-intake/engine/adapter";

// Read-only viewer — "Observador Ilimitado". Sem formulários, sem mutação.
// Renderiza intake_responses + financial_projections já persistidos em asset_data.

const C = {
  nd: "#09081A", nc: "#162744", nm: "#243A66",
  go: "#C9A84C", gl: "#E8C97A", cr: "#F5F1E8", mu: "#9BAFC5",
};

interface Props {
  dealTitle: string;
  schema: IntakeSchema;
  intakeResponses: Record<string, unknown> | null;
  financialProjections: Record<string, unknown> | null;
  submittedAt?: string;
}

function formatValue(field: IntakeField, raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "—";
  const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));

  switch (field.type) {
    case "currency":
      return isNaN(num) ? String(raw) : `R$ ${num.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
    case "currency_usd":
      return isNaN(num) ? String(raw) : `US$ ${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    case "percentage":
      return isNaN(num) ? String(raw) : `${num.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
    case "number":
      return isNaN(num) ? String(raw) : num.toLocaleString("pt-BR");
    default:
      return String(raw);
  }
}

function formatBRL(n: number | undefined): string {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export function ObserverViewer({
  dealTitle,
  schema,
  intakeResponses,
  financialProjections,
  submittedAt,
}: Props) {
  if (!intakeResponses) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: C.nd }}>
        <div className="max-w-sm w-full text-center space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-10 w-auto mx-auto" />
          <p className="text-sm" style={{ color: C.mu }}>
            Nenhum dado submetido ainda para este deal.
          </p>
        </div>
      </div>
    );
  }

  const projections = financialProjections as unknown as AgronegocioProjections | null;

  return (
    <div className="min-h-screen p-4 sm:p-8" style={{ background: C.nd }}>
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: C.nm }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-8 w-auto" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.gl }}>
              Observador
            </p>
            <p className="text-xs" style={{ color: C.mu }}>{dealTitle}</p>
          </div>
        </header>

        <div>
          <h1 className="text-lg font-semibold" style={{ color: C.cr }}>{schema.label}</h1>
          {submittedAt && (
            <p className="text-[11px]" style={{ color: C.mu }}>
              Dados submetidos em {new Date(submittedAt).toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        {schema.sections.map((section) => (
          <section key={section.id} className="rounded-xl p-4 space-y-3" style={{ background: C.nc, border: `1px solid ${C.nm}` }}>
            <h2 className="text-sm font-semibold" style={{ color: C.go }}>{section.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.fields.map((field) => (
                <div key={field.key} className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.gl }}>
                    {field.label}
                  </p>
                  <p className="text-sm" style={{ color: C.cr }}>
                    {formatValue(field, intakeResponses[field.key])}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {projections && (
          <section className="rounded-xl p-4 space-y-4" style={{ background: C.nc, border: `1px solid ${C.nm}` }}>
            <h2 className="text-sm font-semibold" style={{ color: C.go }}>Projeções Financeiras</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: C.gl }}>
                    <th className="text-left font-semibold py-1">Ano</th>
                    <th className="text-right font-semibold py-1">Receita Total</th>
                    <th className="text-right font-semibold py-1">EBITDA</th>
                    <th className="text-right font-semibold py-1">Margem EBITDA</th>
                  </tr>
                </thead>
                <tbody>
                  {projections.anos?.map((ano) => (
                    <tr key={ano.ano} style={{ borderTop: `1px solid ${C.nm}` }}>
                      <td className="py-1" style={{ color: C.cr }}>{ano.ano}</td>
                      <td className="py-1 text-right" style={{ color: C.cr }}>{formatBRL(ano.receita_total_brl)}</td>
                      <td className="py-1 text-right" style={{ color: C.cr }}>{formatBRL(ano.ebitda_brl)}</td>
                      <td className="py-1 text-right" style={{ color: C.cr }}>
                        {ano.margem_ebitda_pct?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {projections.scenarios && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(projections.scenarios).map(([key, scenario]) => (
                  <div key={key} className="rounded-lg p-3" style={{ background: C.nd, border: `1px solid ${C.nm}` }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.gl }}>
                      {scenario.label}
                    </p>
                    <p className="text-sm mt-1" style={{ color: C.cr }}>
                      CAGR: {scenario.cagr_pct?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                    </p>
                    <p className="text-sm" style={{ color: C.cr }}>
                      Valor terminal: {formatBRL(scenario.valor_terminal_brl)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
