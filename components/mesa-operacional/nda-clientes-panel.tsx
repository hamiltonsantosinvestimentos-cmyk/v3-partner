"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Send, Copy, Check, MessageCircle, X, RefreshCw, Link2, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PartyQualificationCardModal } from "@/components/cm/party-qualification-card";

// Painel "NDA para clientes" (topo da aba Contratos da Mesa Operacional, 30/09/2026).
// 1) "Enviar NDA para cliente": cria o lote de qualificação do template
//    "NDA (Mesa de operações)" (/api/cm/qualifications) — o cliente recebe o
//    link por e-mail e a Mesa também pode copiar/mandar no WhatsApp.
// 2) O cliente preenche dados + documentos em /intake/qualificacao/[token].
// 3) A Mesa revisa e clica "Gerar e enviar NDA" (contrato com os dados do
//    lote, enviado para assinatura). 4) Vínculo opcional a uma proposta.

type Cliente = {
  id: string; full_name: string; email: string; phone: string | null; status: string; filled_at: string | null;
  qualification_token: string; cpf_cnpj: string | null; company_name: string | null; company_cnpj: string | null;
  party_nature: string | null; person_type: string | null;
};
type Item = {
  batch_id: string; batch_status: string; created_at: string; completed_at: string | null;
  cliente: Cliente | null;
  contrato: { id: string; contract_code: string | null; status_signature: string; sent_to_signature_at: string | null; signed_at: string | null } | null;
  proposta: { id: string; code: string; client_name: string | null } | null;
};
type PropostaOpcao = { id: string; code: string; client_name: string };

const APP_URL = "https://app.v3partners.com.br";
const linkDe = (token: string) => `${APP_URL}/intake/qualificacao/${token}`;
const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

function waLink(cliente: Cliente) {
  const tel = soDigitos(cliente.phone);
  const texto = `Olá, ${cliente.full_name.split(/\s+/)[0]}! Aqui é da V3 Partners. Para prosseguirmos, preencha sua qualificação e envie os documentos por este link seguro: ${linkDe(cliente.qualification_token)}`;
  const numero = tel ? (tel.length <= 11 ? `55${tel}` : tel) : "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function statusDo(item: Item): { label: string; color: string } {
  if (item.contrato) {
    if (item.contrato.status_signature === "assinado") return { label: "NDA assinado", color: "#34D399" };
    if (item.contrato.status_signature === "enviado_assinatura") return { label: "NDA enviado — aguardando assinatura", color: "#60A5FA" };
    return { label: "NDA gerado — não enviado", color: "#F59E0B" };
  }
  if (item.batch_status === "completo") return { label: "Qualificado — revisar e enviar", color: "#E8C97A" };
  return { label: "Aguardando o cliente preencher", color: "#7A8FA8" };
}

function nomeDoc(c: Cliente) {
  const pj = c.party_nature === "PJ" || c.person_type === "PJ";
  return {
    nome: pj ? (c.company_name || c.full_name) : c.full_name,
    doc: pj ? (c.company_cnpj || c.cpf_cnpj) : c.cpf_cnpj,
  };
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" title="Copiar link de qualificação"
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1800); }); }}
      className="h-7 px-2 rounded-md border border-border text-[11px] flex items-center gap-1 hover:bg-secondary transition-colors text-muted-foreground hover:text-white">
      {ok ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} {ok ? "Copiado" : "Link"}
    </button>
  );
}

function PropostaSelect({ propostas, value, onChange }: { propostas: PropostaOpcao[]; value: string; onChange: (v: string) => void }) {
  const [busca, setBusca] = useState("");
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (q ? propostas.filter((p) => p.code.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q)) : propostas).slice(0, 50);
  }, [busca, propostas]);
  return (
    <div className="space-y-1.5">
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar proposta por código ou cliente..."
        className="w-full h-8 px-3 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-2 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
        <option value="">— Sem vínculo por enquanto —</option>
        {filtradas.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.client_name}</option>)}
      </select>
    </div>
  );
}

export function NdaClientesPanel({ propostas }: { propostas: PropostaOpcao[] }) {
  const [itens, setItens] = useState<Item[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [novoAberto, setNovoAberto] = useState(false);
  const [gerando, setGerando] = useState<Item | null>(null);
  const [vinculando, setVinculando] = useState<Item | null>(null);
  const [vendoId, setVendoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const r = await fetch("/api/mesa-op/nda-clientes");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao carregar");
      setItens(j.itens ?? []); setTemplateId(j.template?.id ?? null);
    } catch (e) { setErro((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const pendentes = itens.filter((i) => !i.contrato && i.batch_status === "completo").length;

  return (
    <div className="rounded-2xl border border-[#C9A84C]/30 overflow-hidden" style={{ background: "linear-gradient(160deg, rgba(201,168,76,0.08), rgba(17,31,53,0.6))" }}>
      <div className="px-5 py-4 flex flex-wrap items-center gap-3 justify-between border-b border-[#C9A84C]/15">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#C9A84C20" }}>
            <FileText className="w-4 h-4 text-[#C9A84C]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">NDA para clientes — Mesa de operações</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Gere o link de qualificação: o cliente preenche os dados e envia os documentos; a Mesa revisa e envia o NDA para assinatura.
              {pendentes > 0 && <span className="text-[#E8C97A] font-semibold"> {pendentes} aguardando revisão.</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={carregar} title="Atualizar"
            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:bg-secondary">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Button size="sm" className="gap-1.5" onClick={() => setNovoAberto(true)} disabled={!templateId}>
            <Plus className="w-3.5 h-3.5" /> Enviar NDA para cliente
          </Button>
        </div>
      </div>

      {erro && <p className="px-5 py-3 text-xs text-[#FF6B6B]">{erro}</p>}

      {!loading && !erro && itens.length === 0 && (
        <p className="px-5 py-6 text-xs text-muted-foreground text-center">Nenhum NDA enviado para clientes ainda.</p>
      )}

      {itens.length > 0 && (
        <div className="divide-y divide-border/60 max-h-[420px] overflow-y-auto">
          {itens.map((it) => {
            const st = statusDo(it);
            const c = it.cliente;
            return (
              <div key={it.batch_id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{c ? nomeDoc(c).nome : "—"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {c?.email}{c?.phone ? ` · ${c.phone}` : ""} · {new Date(it.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: `${st.color}20`, color: st.color }}>{st.label}</span>
                {it.contrato?.contract_code && <span className="text-[10px] font-mono text-[#C9A84C]">{it.contrato.contract_code}</span>}
                {it.proposta && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400" title={it.proposta.client_name ?? ""}>
                    Proposta {it.proposta.code}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  {c && !it.contrato && it.batch_status !== "completo" && (
                    <>
                      <CopyBtn text={linkDe(c.qualification_token)} />
                      <a href={waLink(c)} target="_blank" rel="noreferrer" title="Mandar o link no WhatsApp"
                        className="h-7 px-2 rounded-md border border-border text-[11px] flex items-center gap-1 hover:bg-secondary text-muted-foreground hover:text-white">
                        <MessageCircle className="w-3 h-3" /> WhatsApp
                      </a>
                    </>
                  )}
                  {c && it.batch_status === "completo" && (
                    <button type="button" onClick={() => setVendoId(c.id)} title="Ver dados e documentos enviados"
                      className="h-7 px-2 rounded-md border border-border text-[11px] flex items-center gap-1 hover:bg-secondary text-muted-foreground hover:text-white">
                      <Eye className="w-3 h-3" /> Dados
                    </button>
                  )}
                  {c && !it.contrato && it.batch_status === "completo" && (
                    <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setGerando(it)}>
                      <Send className="w-3 h-3" /> Gerar e enviar NDA
                    </Button>
                  )}
                  {it.contrato && !it.proposta && (
                    <button type="button" onClick={() => setVinculando(it)}
                      className="h-7 px-2 rounded-md border border-[#C9A84C]/40 text-[11px] flex items-center gap-1 text-[#E8C97A] hover:bg-[#C9A84C]/10">
                      <Link2 className="w-3 h-3" /> Vincular proposta
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {novoAberto && templateId && (
        <NovoNdaModal templateId={templateId} onClose={() => setNovoAberto(false)} onCriado={carregar} />
      )}
      {gerando && templateId && (
        <GerarNdaModal item={gerando} templateId={templateId} propostas={propostas}
          onClose={() => setGerando(null)} onFeito={() => { setGerando(null); carregar(); }} />
      )}
      {vinculando?.contrato && (
        <VincularModal contractId={vinculando.contrato.id} codigo={vinculando.contrato.contract_code} propostas={propostas}
          onClose={() => setVinculando(null)} onFeito={() => { setVinculando(null); carregar(); }} />
      )}
      <PartyQualificationCardModal qualificationId={vendoId} onClose={() => setVendoId(null)} />
    </div>
  );
}

function ModalShell({ titulo, onClose, children, rodape }: { titulo: string; onClose: () => void; children: React.ReactNode; rodape: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-[#C9A84C]/30 rounded-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C9A84C]" />
            <h2 className="text-sm font-bold text-white">{titulo}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">{rodape}</div>
      </div>
    </div>
  );
}

const inputCls = "w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50";

function NovoNdaModal({ templateId, onClose, onCriado }: { templateId: string; onClose: () => void; onCriado: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [criado, setCriado] = useState<Cliente | null>(null);

  const valido = nome.trim().length >= 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function criar() {
    setBusy(true); setErro("");
    try {
      const r = await fetch("/api/cm/qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          document_type: "nda_quadripartite",
          parties: [{ full_name: nome.trim(), email: email.trim(), phone: telefone.trim() || undefined, role_in_document: "parte_principal" }],
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao gerar o link");
      const q = (j.qualifications ?? [])[0];
      setCriado({
        id: q.id, full_name: q.full_name, email: q.email, phone: q.phone ?? (telefone.trim() || null), status: "pendente", filled_at: null,
        qualification_token: q.qualification_token, cpf_cnpj: null, company_name: null, company_cnpj: null, party_nature: null, person_type: null,
      });
      onCriado();
    } catch (e) { setErro((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell titulo="Enviar NDA para cliente" onClose={onClose}
      rodape={criado
        ? <Button size="sm" onClick={onClose}>Concluir</Button>
        : <>
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={criar} disabled={!valido || busy} className="gap-1.5">
              {busy ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {busy ? "Gerando..." : "Gerar link e enviar"}
            </Button>
          </>}>
      {criado ? (
        <div className="space-y-3">
          <p className="text-xs text-emerald-400 font-semibold">Link de qualificação gerado e enviado por e-mail para {criado.email}.</p>
          <div className="rounded-lg p-3 text-[11px] font-mono break-all text-[#E8C97A]" style={{ background: "#111F35" }}>{linkDe(criado.qualification_token)}</div>
          <div className="flex gap-2">
            <CopyBtn text={linkDe(criado.qualification_token)} />
            <a href={waLink(criado)} target="_blank" rel="noreferrer"
              className="h-7 px-2 rounded-md border border-border text-[11px] flex items-center gap-1 hover:bg-secondary text-muted-foreground hover:text-white">
              <MessageCircle className="w-3 h-3" /> Mandar no WhatsApp
            </a>
          </div>
          <p className="text-[11px] text-muted-foreground">Quando o cliente terminar, ele aparece como &quot;Qualificado&quot; aqui no painel para você revisar e enviar o NDA.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Usa o template <strong className="text-foreground">NDA (Mesa de operações)</strong>. O cliente recebe por e-mail o link para preencher a qualificação e enviar os documentos.
          </p>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Nome do cliente *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">E-mail *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">WhatsApp (opcional)</label>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" className={inputCls} />
          </div>
          {erro && <p className="text-[11px] text-[#FF6B6B]">{erro}</p>}
        </>
      )}
    </ModalShell>
  );
}

function GerarNdaModal({ item, templateId, propostas, onClose, onFeito }: {
  item: Item; templateId: string; propostas: PropostaOpcao[]; onClose: () => void; onFeito: () => void;
}) {
  const c = item.cliente!;
  const { nome, doc } = nomeDoc(c);
  const [propostaId, setPropostaId] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<{ codigo: string | null; enviado: boolean } | null>(null);

  async function gerar() {
    setBusy(true); setErro("");
    try {
      const gen = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          qualification_batch_id: item.batch_id,
          ...(propostaId ? { credit_proposal_id: propostaId } : {}),
          extra_data: { nome_cedente: nome, cpf_cnpj_cedente: doc || "[CPF/CNPJ]", email_cedente: c.email },
        }),
      }).then((r) => r.json());
      if (gen.error) throw new Error(gen.error);
      const send = await fetch(`/api/contracts/${gen.contract.id}/send`, { method: "POST" }).then((r) => r.json());
      if (send.error) {
        setResultado({ codigo: gen.contract.contract_code ?? null, enviado: false });
        setErro(`NDA gerado, mas o envio falhou: ${send.error}`);
        return;
      }
      setResultado({ codigo: gen.contract.contract_code ?? null, enviado: true });
    } catch (e) { setErro((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell titulo="Gerar e enviar NDA" onClose={resultado ? onFeito : onClose}
      rodape={resultado
        ? <Button size="sm" onClick={onFeito}>Fechar</Button>
        : <>
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={gerar} disabled={busy} className="gap-1.5">
              {busy ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {busy ? "Enviando..." : "Gerar e enviar para assinatura"}
            </Button>
          </>}>
      {resultado ? (
        <p className={`text-xs font-semibold ${resultado.enviado ? "text-emerald-400" : "text-[#F59E0B]"}`}>
          {resultado.enviado ? `NDA ${resultado.codigo ?? ""} enviado para assinatura de ${c.email}.` : `NDA ${resultado.codigo ?? ""} gerado, não enviado.`}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Confira os dados que o cliente preencheu antes de enviar:</p>
          <div className="rounded-xl p-4 space-y-1.5 text-xs" style={{ background: "#111F35", border: "1px solid rgba(201,168,76,0.2)" }}>
            <p><span className="text-muted-foreground">Nome/Razão social:</span> <strong className="text-white">{nome}</strong></p>
            <p><span className="text-muted-foreground">CPF/CNPJ:</span> <strong className="text-white">{doc || "—"}</strong></p>
            <p><span className="text-muted-foreground">E-mail (assinatura):</span> <strong className="text-white">{c.email}</strong></p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Vincular a uma proposta (opcional)</label>
            <PropostaSelect propostas={propostas} value={propostaId} onChange={setPropostaId} />
          </div>
        </>
      )}
      {erro && <p className="text-[11px] text-[#FF6B6B]">{erro}</p>}
    </ModalShell>
  );
}

function VincularModal({ contractId, codigo, propostas, onClose, onFeito }: {
  contractId: string; codigo: string | null; propostas: PropostaOpcao[]; onClose: () => void; onFeito: () => void;
}) {
  const [propostaId, setPropostaId] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  async function vincular() {
    setBusy(true); setErro("");
    try {
      const r = await fetch(`/api/mesa-op/nda-clientes/${contractId}/vincular`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credit_proposal_id: propostaId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao vincular");
      onFeito();
    } catch (e) { setErro((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell titulo={`Vincular ${codigo ?? "NDA"} a uma proposta`} onClose={onClose}
      rodape={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={vincular} disabled={!propostaId || busy} className="gap-1.5">
          <Link2 className="w-3.5 h-3.5" /> {busy ? "Vinculando..." : "Vincular"}
        </Button>
      </>}>
      <PropostaSelect propostas={propostas} value={propostaId} onChange={setPropostaId} />
      {erro && <p className="text-[11px] text-[#FF6B6B]">{erro}</p>}
    </ModalShell>
  );
}
