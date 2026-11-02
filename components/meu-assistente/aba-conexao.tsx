"use client";

import { useCallback, useEffect, useState } from "react";
import { Dica } from "@/components/shared/dica";
import { dataHoraBr } from "@/lib/assistente/formato";
import { chamarApi, classeBotao, classeBotaoPerigo, classeCampo, classeRotulo, ModalPerigo } from "./ui";

type Estado = {
  status: "sem_sessao" | "desconectado" | "iniciando" | "aguardando_qr" | "conectado" | "erro";
  qrcode: string | null;
  telefone: string | null;
  verificado: boolean;
  ultimaLimpeza: string | null;
  limpezaAtrasada: boolean;
  mensagensComFalha: number;
  erro?: string;
};

const OUTROS_DDIS = [
  { pais: "Alemanha", ddi: "49" }, { pais: "Argentina", ddi: "54" }, { pais: "Canadá", ddi: "1" }, { pais: "Chile", ddi: "56" },
  { pais: "China", ddi: "86" }, { pais: "Colômbia", ddi: "57" }, { pais: "Emirados Árabes", ddi: "971" }, { pais: "Espanha", ddi: "34" },
  { pais: "Estados Unidos", ddi: "1" }, { pais: "França", ddi: "33" }, { pais: "Itália", ddi: "39" }, { pais: "Japão", ddi: "81" },
  { pais: "México", ddi: "52" }, { pais: "Paraguai", ddi: "595" }, { pais: "Portugal", ddi: "351" }, { pais: "Reino Unido", ddi: "44" },
  { pais: "Suíça", ddi: "41" }, { pais: "Uruguai", ddi: "598" },
].sort((a, b) => a.pais.localeCompare(b.pais, "pt-BR"));

function mascaraNacional(ddi: string, valor: string): string {
  const d = valor.replace(/\D/g, "");
  if (ddi !== "55") return d.slice(0, 13);
  const n = d.slice(0, 11);
  if (n.length <= 2) return n ? `(${n}` : "";
  const corte = n.length === 11 ? 7 : 6;
  if (n.length <= corte) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, corte)}-${n.slice(corte)}`;
}

const ROTULO_STATUS: Record<Estado["status"], string> = {
  sem_sessao: "Sem número",
  desconectado: "Desconectado",
  iniciando: "Iniciando",
  aguardando_qr: "Aguardando leitura do QR Code",
  conectado: "Conectado",
  erro: "Indisponível",
};

export function AbaConexao() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ddi, setDdi] = useState("55");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [modal, setModal] = useState<"desconectar" | "excluir" | null>(null);

  const carregar = useCallback(async () => {
    try {
      setEstado(await chamarApi<Estado>("/api/assistente/conexao"));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao consultar a conexão.");
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const emAndamento = estado?.status === "aguardando_qr" || estado?.status === "iniciando";
  useEffect(() => {
    if (!emAndamento) return;
    const t = setInterval(() => void carregar(), 5000);
    return () => clearInterval(t);
  }, [emAndamento, carregar]);

  const agir = async (acao: () => Promise<unknown>) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      setOcupado(false);
    }
  };

  if (!estado) {
    return erro ? <p className="text-[13px] text-red-300" role="alert">{erro}</p> : <p className="text-[13px] text-[#7A8FA8]">Carregando...</p>;
  }

  const temSessao = estado.status !== "sem_sessao";

  return (
    <div className="space-y-5">
      {erro && <p className="text-[12px] text-red-300" role="alert">{erro}</p>}
      {estado.limpezaAtrasada && (
        <p className="rounded-lg border border-red-500/60 px-3 py-2 text-[12px] text-red-300" role="alert">
          A limpeza diária está atrasada. A cópia técnica pode ficar além de 48 horas.
        </p>
      )}

      <section className="rounded-xl border border-[#243A66] bg-[#162744] p-4">
        <h2 className="text-[20px] font-semibold text-[#F0ECE4] mb-2">
          Número exclusivo <Dica id="assistente_qr" />
        </h2>
        {!temSessao ? (
          <p className="text-[13px] text-[#7A8FA8] mb-3">Nenhum número conectado. Gere o QR Code com o chip exclusivo do assistente.</p>
        ) : (
          <p className="text-[13px] text-[#7A8FA8] mb-3">Status: <span className="text-[#F0ECE4]">{ROTULO_STATUS[estado.status]}</span>{estado.erro ? `. ${estado.erro}` : ""}</p>
        )}
        {estado.qrcode && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={estado.qrcode} alt="QR Code do número exclusivo" className="w-56 h-56 rounded-lg mb-3" />
        )}
        <div className="flex flex-wrap gap-2">
          {(estado.status === "sem_sessao" || estado.status === "desconectado") && (
            <button type="button" className={classeBotao} disabled={ocupado}
              onClick={() => agir(() => chamarApi("/api/assistente/conexao", { method: "POST" }))}>Gerar QR Code</button>
          )}
          {temSessao && (
            <button type="button" className={classeBotaoPerigo} disabled={ocupado} onClick={() => setModal("desconectar")}>Desconectar número</button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#243A66] bg-[#162744] p-4">
        <h2 className="text-[20px] font-semibold text-[#F0ECE4] mb-2">
          Celular autorizado <Dica id="assistente_celular" />
        </h2>
        {estado.verificado && <p className="text-[13px] text-[#F0ECE4] mb-3">Verificado: {estado.telefone}</p>}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={classeRotulo} htmlFor="assistente-ddi">DDI</label>
            <select id="assistente-ddi" className={classeCampo} value={ddi} onChange={(e) => { setDdi(e.target.value); setTelefone(""); }}>
              <option value="55">Brasil +55</option>
              {OUTROS_DDIS.map((o) => <option key={o.pais} value={o.ddi}>{o.pais} +{o.ddi}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className={classeRotulo} htmlFor="assistente-telefone">Celular</label>
            <input id="assistente-telefone" className={classeCampo} inputMode="tel" value={telefone}
              placeholder={ddi === "55" ? "(11) 98765-4321" : "Número com código de área"}
              onChange={(e) => setTelefone(mascaraNacional(ddi, e.target.value))} />
          </div>
          <button type="button" className={classeBotao} disabled={ocupado || !telefone || estado.status !== "conectado"}
            onClick={() => agir(async () => {
              await chamarApi("/api/assistente/verificacao", { method: "POST", body: JSON.stringify({ telefone: `+${ddi}${telefone.replace(/\D/g, "")}` }) });
              setCodigoEnviado(true);
            })}>Enviar código</button>
        </div>
        {codigoEnviado && (
          <div className="flex flex-wrap items-end gap-2 mt-3">
            <div>
              <label className={classeRotulo} htmlFor="assistente-codigo">Código recebido</label>
              <input id="assistente-codigo" className={classeCampo} inputMode="numeric" autoComplete="one-time-code" value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
            <button type="button" className={classeBotao} disabled={ocupado || codigo.length !== 6}
              onClick={() => agir(async () => {
                await chamarApi("/api/assistente/verificacao", { method: "PUT", body: JSON.stringify({ codigo }) });
                setCodigo("");
                setCodigoEnviado(false);
                setTelefone("");
              })}>Confirmar</button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#243A66] bg-[#162744] p-4 text-[13px] text-[#7A8FA8] space-y-1">
        <p>Uso de IA <Dica id="assistente_ia" /></p>
        <p>Última limpeza: <span className="text-[#F0ECE4]">{estado.ultimaLimpeza ? dataHoraBr(estado.ultimaLimpeza) : "ainda não executada"}</span></p>
        {estado.mensagensComFalha > 0 && (
          <p className="text-[#F0ECE4]">{estado.mensagensComFalha} mensagem(ns) não processada(s). Nada foi lançado por elas: reenvie pelo WhatsApp.</p>
        )}
      </section>

      <button type="button" className="rounded-lg bg-red-700 px-4 py-2 text-[13px] font-semibold text-[#F0ECE4] hover:bg-red-600 disabled:opacity-50"
        disabled={ocupado} onClick={() => setModal("excluir")}>Excluir todos os meus dados</button>

      {modal === "desconectar" && (
        <ModalPerigo titulo="Desconectar número" botao="Desconectar"
          onCancelar={() => setModal(null)}
          onConfirmar={async () => {
            await chamarApi("/api/assistente/conexao", { method: "DELETE" });
            setModal(null);
            await carregar();
          }}>
          <p>A sessão é encerrada e as mensagens, os arquivos e os mapeamentos dela são apagados do servidor de WhatsApp. Painel, lançamentos e compromissos continuam disponíveis. Para reconectar, será preciso novo QR Code e nova verificação do celular.</p>
          <p className="text-[#7A8FA8]">O que pode continuar: status do WhatsApp guardados no servidor por até 24 horas; uma linha de identificação cujo último registro veio de outra sessão; e o aparelho em &quot;Aparelhos conectados&quot; no celular do chip, até ser removido ali.</p>
        </ModalPerigo>
      )}

      {modal === "excluir" && (
        <ModalPerigo titulo="Excluir todos os meus dados" botao="Excluir tudo" confirmarTexto="EXCLUIR"
          onCancelar={() => setModal(null)}
          onConfirmar={async () => {
            await chamarApi("/api/assistente/dados", { method: "DELETE", body: JSON.stringify({ confirmacao: "EXCLUIR" }) });
            setModal(null);
            setCodigoEnviado(false);
            await carregar();
          }}>
          <p>Apaga de forma definitiva lançamentos, compromissos, mensagens, verificação e configuração, além da sessão, das mensagens guardadas, dos arquivos de mídia e dos mapeamentos de identificação no servidor de WhatsApp. Não dá para desfazer.</p>
          <p className="text-[#7A8FA8]">Fica fora do alcance da V3: backups, pelo período de retenção deles; tarefas na fila do servidor por até 24 horas; status do WhatsApp guardados por até 24 horas, que podem conter status de terceiros recebidos pelo chip; o que Anthropic e OpenAI retêm conforme as próprias políticas; e as mensagens no próprio WhatsApp do celular e do chip.</p>
          <p className="text-[#7A8FA8]">O chip pode ter aprendido o telefone de terceiros. Uma linha cujo último registro veio de outra sessão continua na tabela, sem conteúdo de mensagens.</p>
        </ModalPerigo>
      )}
    </div>
  );
}
