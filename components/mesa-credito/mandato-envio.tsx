"use client";

import { useState } from "react";
import { FileSignature, Loader2, ClipboardList, PencilLine, ArrowLeft, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  camposFaltantes, camposVisiveis, dadosDaProposta, montarQualificacao, percentualPorExtenso,
  pickMandatoTemplate, signatarioMandato, mandatoTemplateName,
  type MandatoCampo, type MandatoDados, type MandatoTipo, type MandatoTemplate,
} from "@/lib/mandato-credito";

// Botão "Mandato" do modal da proposta (09/10/2026, pedido do Hamilton).
// Pergunta se o contrato sai com os dados da proposta ou com outros dados;
// com os da proposta, pede só o que faltar da qualificação; com outros, abre
// o formulário completo. Cliente PF recebe a minuta PF, PJ recebe a PJ (sócio
// administrador assina). O % cobrado é o do campo "Mandato" do modal.

type ProposalForMandato = {
  id: string;
  client_name: string;
  client_cpf_cnpj?: string | null;
  cpf_cnpj?: string;
  client_type?: string;
  email?: string;
  telefone?: string;
  metadata?: Record<string, unknown> | null;
};

type Etapa = "origem" | "form" | "revisar" | "enviado";
type Origem = "proposta" | "outros";

const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#C9A84C]/60";

export function MandatoEnvio({
  proposal,
  percMandato,
  onMetadataUpdate,
}: {
  proposal: ProposalForMandato;
  percMandato: number;
  onMetadataUpdate?: (metadata: Record<string, unknown>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("origem");
  const [origem, setOrigem] = useState<Origem>("proposta");
  const [tipo, setTipo] = useState<MandatoTipo>("PF");
  const [dados, setDados] = useState<MandatoDados>({});
  // Campos que a Mesa precisa preencher (na origem "proposta", só os que faltavam).
  const [camposForm, setCamposForm] = useState<MandatoCampo[]>([]);
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const [templates, setTemplates] = useState<MandatoTemplate[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ code: string | null; enviado: boolean; email: string } | null>(null);

  function abrir() {
    setAberto(true);
    setEtapa("origem");
    setErro(null);
    setResultado(null);
    setTentouAvancar(false);
    if (!templates) {
      fetch("/api/contracts/templates?vertical=credito")
        .then((r) => r.json())
        .then((j) => setTemplates(j.templates ?? []))
        .catch(() => setTemplates([]));
    }
  }

  function fechar() {
    if (enviando) return;
    setAberto(false);
  }

  function escolherOrigem(o: Origem) {
    setOrigem(o);
    setTentouAvancar(false);
    setErro(null);
    if (o === "proposta") {
      const base = dadosDaProposta(proposal);
      setTipo(base.tipo);
      setDados(base.dados);
      const faltam = camposFaltantes(base.tipo, base.dados);
      if (faltam.length === 0) {
        setEtapa("revisar");
      } else {
        setCamposForm(faltam);
        setEtapa("form");
      }
    } else {
      const t = dadosDaProposta(proposal).tipo;
      setTipo(t);
      setDados({});
      setEtapa("form");
    }
  }

  // Na origem "outros" o formulário é completo e reage ao estado civil (regime de bens).
  const camposExibidos = origem === "outros"
    ? camposVisiveis(tipo, dados)
    : camposForm.concat(
        // estado civil preenchido agora como casado/união estável passa a exigir regime de bens
        camposVisiveis(tipo, dados).filter((c) => c.key.endsWith("regime_bens") && !camposForm.some((f) => f.key === c.key)),
      );
  const faltantes = camposFaltantes(tipo, dados);
  const faltantesKeys = new Set(faltantes.map((c) => c.key));

  function avancarDoForm() {
    setTentouAvancar(true);
    if (faltantes.length === 0) setEtapa("revisar");
  }

  const template = templates ? pickMandatoTemplate(templates, tipo) : null;
  const templateAprovado = template?.approval_status === "aprovado";
  const signatario = signatarioMandato(tipo, dados);

  async function gerarEEnviar() {
    if (!template) return;
    setEnviando(true);
    setErro(null);
    try {
      const genRes = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: template.id,
          credit_proposal_id: proposal.id,
          extra_data: {
            nome_cedente: signatario.nome,
            cpf_cnpj_cedente: signatario.doc,
            email_cedente: signatario.email,
            contratante_qualificacao: montarQualificacao(tipo, dados),
            percentual_mandato: percentualPorExtenso(percMandato),
            rotulo_assinatura_cedente: signatario.rotulo,
            rotulo_assinatura_v3: "Contratada, V3 Partners",
          },
        }),
      }).then((r) => r.json());
      if (genRes.error || !genRes.contract) {
        setErro(genRes.error ?? "Erro ao gerar o mandato.");
        return;
      }
      const code: string | null = genRes.contract.contract_code ?? null;

      const sendRes = await fetch(`/api/contracts/${genRes.contract.id}/send`, { method: "POST" }).then((r) => r.json());

      // Registro na proposta: dados completados (só quando vieram da proposta) + histórico de envios.
      const meta = (proposal.metadata ?? {}) as Record<string, unknown>;
      const envios = Array.isArray(meta.mandato_envios) ? (meta.mandato_envios as unknown[]) : [];
      const patch: Record<string, unknown> = {
        mandato_envios: [
          ...envios,
          {
            contract_id: genRes.contract.id,
            contract_code: code,
            tipo,
            origem,
            percentual: percMandato,
            signatario_email: signatario.email,
            enviado: !sendRes.error,
            em: new Date().toISOString(),
          },
        ],
      };
      if (origem === "proposta") patch.mandato_qualificacao = { tipo, dados };
      fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, metadata: patch }),
      }).catch(() => {});
      onMetadataUpdate?.({ ...meta, ...patch });

      if (sendRes.error) {
        setResultado({ code, enviado: false, email: signatario.email });
        setErro(`Mandato gerado (${code ?? "sem código"}), mas o envio para assinatura falhou: ${sendRes.error}. Ele ficou como rascunho na Central de Contratos.`);
        setEtapa("enviado");
        return;
      }
      setResultado({ code, enviado: true, email: signatario.email });
      setEtapa("enviado");
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setEnviando(false);
    }
  }

  function renderCampo(c: MandatoCampo) {
    const invalido = tentouAvancar && faltantesKeys.has(c.key);
    const cls = `${INPUT} ${invalido ? "border-red-500/60" : ""}`;
    const valor = dados[c.key] ?? "";
    const set = (v: string) => setDados((d) => ({ ...d, [c.key]: v }));
    return (
      <label key={c.key} className="block space-y-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {c.label}{c.opcional ? " (opcional)" : ""}
        </span>
        {c.opcoes ? (
          <select value={valor} onChange={(e) => set(e.target.value)} className={cls}>
            <option value="">Selecione</option>
            {c.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input value={valor} onChange={(e) => set(e.target.value)} placeholder={c.placeholder} className={cls} />
        )}
        {invalido && <span className="text-[10px] text-red-400">Preencha corretamente</span>}
      </label>
    );
  }

  const grupos: { titulo: string; campos: MandatoCampo[] }[] = tipo === "PF"
    ? [{ titulo: "Cliente pessoa física", campos: camposExibidos }]
    : [
        { titulo: "Empresa", campos: camposExibidos.filter((c) => c.grupo === "empresa") },
        { titulo: "Sócio administrador (assina pela empresa)", campos: camposExibidos.filter((c) => c.grupo === "socio") },
      ].filter((g) => g.campos.length > 0);

  return (
    <>
      <div title={percMandato > 0 ? `Mandato ${percMandato}%` : "Defina o % do mandato antes de enviar"}>
        <Button
          variant="outline"
          size="sm"
          onClick={abrir}
          disabled={percMandato <= 0}
          className="gap-1.5 border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileSignature className="w-3.5 h-3.5" />
          Mandato
        </Button>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-card border border-[#C9A84C]/30 rounded-2xl w-full max-w-2xl animate-fade-in">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <FileSignature className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-sm font-bold text-white">Mandato do cliente</h3>
              <span className="ml-auto text-[10px] uppercase tracking-widest text-[#C9A84C]">
                {etapa !== "origem" ? `Cliente ${tipo} · ` : ""}Mandato {percMandato}%
              </span>
            </div>

            {etapa === "origem" && (
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-muted-foreground">Quais dados vão no contrato de mandato?</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button onClick={() => escolherOrigem("proposta")}
                    className="text-left rounded-xl border border-border hover:border-[#C9A84C]/60 bg-background/40 p-4 space-y-1 transition-colors">
                    <ClipboardList className="w-4 h-4 text-[#C9A84C]" />
                    <p className="text-sm font-semibold text-white">Dados da proposta</p>
                    <p className="text-[11px] text-muted-foreground">
                      Usa o cadastro de {proposal.client_name} ({dadosDaProposta(proposal).tipo}) e pede só o que faltar.
                    </p>
                  </button>
                  <button onClick={() => escolherOrigem("outros")}
                    className="text-left rounded-xl border border-border hover:border-[#C9A84C]/60 bg-background/40 p-4 space-y-1 transition-colors">
                    <PencilLine className="w-4 h-4 text-[#C9A84C]" />
                    <p className="text-sm font-semibold text-white">Outros dados</p>
                    <p className="text-[11px] text-muted-foreground">Preencher a qualificação completa de outro contratante.</p>
                  </button>
                </div>
              </div>
            )}

            {etapa === "form" && (
              <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
                {origem === "outros" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo de cliente</span>
                    {(["PF", "PJ"] as MandatoTipo[]).map((t) => (
                      <button key={t} onClick={() => { setTipo(t); setTentouAvancar(false); }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border ${tipo === t ? "bg-[#C9A84C] text-[#09081A] border-[#C9A84C]" : "border-border text-muted-foreground hover:text-white"}`}>
                        {t === "PF" ? "Pessoa física" : "Pessoa jurídica"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    Faltam {camposForm.length} dado(s) da qualificação de {proposal.client_name} para enviar o mandato {tipo}.
                  </p>
                )}
                {grupos.map((g) => (
                  <div key={g.titulo} className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">{g.titulo}</p>
                    <div className="grid sm:grid-cols-2 gap-3">{g.campos.map(renderCampo)}</div>
                  </div>
                ))}
              </div>
            )}

            {etapa === "revisar" && (
              <div className="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
                <div className="grid sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg border border-border p-2"><p className="text-muted-foreground">Minuta</p><p className="text-white font-medium">{mandatoTemplateName(tipo)}</p></div>
                  <div className="rounded-lg border border-border p-2"><p className="text-muted-foreground">Remuneração de sucesso</p><p className="text-white font-medium">{percentualPorExtenso(percMandato)}</p></div>
                  <div className="rounded-lg border border-border p-2"><p className="text-muted-foreground">Assina pela contratante</p><p className="text-white font-medium">{signatario.nome}</p><p className="text-muted-foreground">{signatario.email}</p></div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] mb-1">Qualificação da contratante</p>
                  {/* montarQualificacao escapa todo dado digitado; só <strong> é markup próprio. */}
                  <p className="text-xs text-[#F0ECE4]/90 leading-relaxed bg-background/40 border border-border rounded-lg p-3"
                    dangerouslySetInnerHTML={{ __html: montarQualificacao(tipo, dados) }} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  O contrato é gerado na Central de Contratos e enviado para assinatura eletrônica do cliente, de João Lemos Netto pela V3 e do partner da proposta como testemunha.
                </p>
                {templates === null && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Carregando minuta...</p>}
                {templates !== null && !template && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    Minuta &quot;{mandatoTemplateName(tipo)}&quot; não encontrada na Central de Contratos.
                  </p>
                )}
                {template && !templateAprovado && (
                  <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    A minuta &quot;{template.template_name}&quot; ainda não foi aprovada (status: {template.approval_status ?? "—"}). Aprove em Central de Contratos › Minutas para liberar o envio.
                  </p>
                )}
              </div>
            )}

            {etapa === "enviado" && resultado && (
              <div className="px-5 py-5 space-y-2">
                {resultado.enviado ? (
                  <p className="text-sm text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Mandato {resultado.code ?? ""} enviado para assinatura de {resultado.email}.
                  </p>
                ) : null}
              </div>
            )}

            {erro && (
              <p className="mx-5 mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{erro}</p>
            )}

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              {(etapa === "form" || etapa === "revisar") && (
                <Button size="sm" variant="outline" onClick={() => {
                  setErro(null);
                  if (etapa === "revisar" && (origem === "outros" || camposForm.length > 0)) setEtapa("form");
                  else setEtapa("origem");
                }} className="gap-1.5 mr-auto" disabled={enviando}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={fechar} disabled={enviando}>
                {etapa === "enviado" ? "Fechar" : "Cancelar"}
              </Button>
              {etapa === "form" && (
                <Button size="sm" onClick={avancarDoForm} className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] border-0">
                  Revisar mandato
                </Button>
              )}
              {etapa === "revisar" && (
                <Button size="sm" onClick={gerarEEnviar} disabled={enviando || !templateAprovado || faltantes.length > 0}
                  className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] border-0 gap-1.5 disabled:opacity-40">
                  {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {enviando ? "Enviando..." : "Gerar e enviar para assinatura"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
