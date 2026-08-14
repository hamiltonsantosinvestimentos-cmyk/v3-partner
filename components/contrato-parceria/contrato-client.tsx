"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FileText, CheckCircle2, Loader2, AlertCircle, ScrollText } from "lucide-react";

interface DadosContrato {
  userId: string;
  registrationId: string | null;
  plano: "STARTER" | "PARTNER" | "PARTNER_PRO" | "ENTERPRISE";
  email: string;
  telefone: string;
  razaoSocial: string;
  cnpjCpf: string;
  enderecoCompleto: string;
  cidade: string;
  nomeRepresentante: string;
  cpfRepresentante: string;
}

function Campo({ v }: { v: string }) {
  return (
    <span className="inline-block bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C] rounded px-1.5 py-0.5 font-semibold">
      {v || "—"}
    </span>
  );
}

function Secao({ num, titulo, children }: { num: string; titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-[#F0ECE4] mb-3 pb-1 border-b border-[#243A66]">
        {num}. {titulo}
      </h3>
      <div className="text-xs text-[#B0BFD0] space-y-2 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return <p className="pl-3 border-l border-[#243A66]">{children}</p>;
}

export function ContratoClient({ dados }: { dados: DadosContrato }) {
  const router = useRouter();
  const [aceito, setAceito] = useState(false);
  const [lido, setLido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const contratoRef = useRef<HTMLDivElement>(null);

  const planoLabel   = dados.plano === "PARTNER_PRO" ? "Partner PRO" : "Partner";
  const valorMensal  = dados.plano === "PARTNER_PRO" ? "R$ 1.324,75" : "R$ 908,08";
  const comissao     = dados.plano === "PARTNER_PRO" ? "50%" : "35%";
  const agora        = new Date();
  const dataHoje     = agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  useEffect(() => {
    const el = contratoRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
        setLido(true);
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function gerarHtml() {
    const timestamp = agora.toISOString();
    const device = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : "desconhecido";

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Contrato de Parceria — V3 Partners</title>
<style>
body{font-family:Arial,sans-serif;font-size:11pt;color:#222;max-width:800px;margin:40px auto;padding:20px;line-height:1.6}
h1{font-size:14pt;text-align:center;text-transform:uppercase;border-bottom:2px solid #C9A84C;padding-bottom:8px;color:#09081A}
h2{font-size:12pt;margin-top:24px;color:#09081A}
.campo{background:#FFF3CD;border:1px solid #C9A84C;padding:2px 6px;border-radius:4px;font-weight:bold}
.assinatura{border:2px solid #09081A;border-radius:8px;padding:20px;margin-top:32px;background:#f9f9f9}
.meta{font-size:9pt;color:#555;margin-top:4px}
p{margin:6px 0}ul{margin:4px 0 4px 20px}
</style></head><body>
<h1>Contrato de Parceria Comercial<br>Licenciamento ${planoLabel.toUpperCase()} – Plataforma V3</h1>

<h2>1. Das Partes</h2>
<p><strong>LICENCIANTE:</strong> V3 PARTNERS SOLUÇÕES LTDA, CNPJ nº 14.219.287/0001-50, Rua Visconde de Pirajá, nº 414, Sala 718, Ipanema, Rio de Janeiro/RJ, representada por JOÃO LEMOS NETTO, CPF nº 078.678.257-97.</p>
<p><strong>LICENCIADO:</strong> <span class="campo">${dados.razaoSocial}</span>, CNPJ/CPF nº <span class="campo">${dados.cnpjCpf}</span>, com sede em <span class="campo">${dados.enderecoCompleto}</span>, representado por <span class="campo">${dados.nomeRepresentante}</span>, CPF nº <span class="campo">${dados.cpfRepresentante}</span>, e-mail <span class="campo">${dados.email}</span>, telefone <span class="campo">${dados.telefone}</span>.</p>

<h2>2. Do Objeto</h2>
<p>2.1 Parceria comercial que contempla licenciamento de uso de marca, método, know-how, treinamentos, materiais, metodologia e acesso à plataforma e ecossistema comercial da V3.</p>
<p>2.2 O LICENCIADO atuará na intermediação de negócios e comercialização de soluções financeiras estruturadas, incluindo: operações de crédito, home equity, capital de giro, crédito agro, consórcios, seguros, M&A, soluções tributárias e demais produtos do portfólio.</p>
<p>2.3 Este contrato NÃO caracteriza: vínculo empregatício, sociedade, franquia, representação comercial ou joint venture.</p>
<p>2.4 O LICENCIADO atua com total autonomia.</p>
<p>2.5 Este contrato é personalíssimo, intransferível e não reembolsável.</p>

<h2>3. Prazo e Condições Financeiras</h2>
<p>3.1 Plano contratado: <span class="campo">${planoLabel}</span></p>
<p>3.2 Valor mensal: <span class="campo">${valorMensal}</span></p>
<p>3.3 Vigência: 12 (doze) meses. 3.4 Encerramento automático ao término, salvo renovação. 3.5 Renovação com antecedência mínima de 30 dias. 3.6 Após o término: o LICENCIADO mantém comissão das operações em andamento, mas não poderá inserir novas. 3.7 Não haverá reembolso em nenhuma hipótese.</p>

<h2>4. Confidencialidade e Sigilo</h2>
<p>4.1 O LICENCIADO terá acesso a informações confidenciais e se obriga a não divulgar, copiar, compartilhar ou utilizar fora do escopo. 4.3 Vigência: durante o contrato + 5 anos após término. 4.4 Penalidades: multa de 200 salários mínimos + indenização + rescisão imediata.</p>

<h2>5. Área de Atuação</h2>
<p>Todo território nacional, sem exclusividade.</p>

<h2>6. Responsabilidades do Licenciado</h2>
<p>Utilizar obrigatoriamente a plataforma V3; realizar treinamentos; gerenciar operações no sistema; manter contato com clientes; responder alertas (3 notificações — ausência implica perda da operação e comissão); enviar documentação via sistema; custear despesas próprias; cumprir a LGPD (multa: 50 salários mínimos em caso de violação).</p>

<h2>7. Responsabilidades do Licenciante</h2>
<p>Fornecer treinamento e suporte; disponibilizar plataforma e tecnologia; operacionalizar as operações financeiras; relacionamento com instituições financeiras; atualizar materiais comerciais; realizar pagamentos de comissões.</p>

<h2>8. Propriedade Intelectual</h2>
<p>Todo conteúdo pertence exclusivamente ao LICENCIANTE. É proibido copiar, adaptar, replicar modelo ou criar negócio similar. Penalidade: multa de 200 salários mínimos + indenização integral.</p>

<h2>9. Remuneração</h2>
<p>Partner: 35% | Partner PRO: 50% — sobre resultado líquido. Pagamento condicionado à conclusão da operação, semanal, mediante nota fiscal. Não há garantia de ganhos.</p>

<h2>10. Leads</h2>
<p>Leads fornecidos facultativamente. Prazo para conversão: 30 dias. Após prazo, lead retorna ao LICENCIANTE. Proibido: compartilhar leads ou vender fora do portfólio.</p>

<h2>11. Não Concorrência</h2>
<p>Vedado relacionamento direto com instituições financeiras parceiras. Prazo: vigência + 24 meses. Multa: 50 salários mínimos.</p>

<h2>12. Penalidades e Execução</h2>
<p>Multas não compensatórias. O LICENCIANTE poderá bloquear acessos, suspender pagamentos, reter comissões e encerrar contrato. Este contrato é título executivo extrajudicial. São aceitas provas digitais: e-mails, logs, registros da plataforma.</p>

<h2>13. Lei Anticorrupção</h2>
<p>Cumprimento da Lei nº 12.846/2013. Proibição de vantagens indevidas. Responsabilização integral por violação.</p>

<h2>14. Foro</h2>
<p>Comarca do Rio de Janeiro/RJ.</p>

<h2>15. Assinatura Eletrônica e Aceite na Plataforma</h2>
<p>O aceite eletrônico realizado na plataforma V3 possui validade jurídica, conforme Lei nº 14.063/2020. O LICENCIADO concorda com registro de IP, data/hora, autenticação por e-mail e armazenamento de logs. O aceite eletrônico equivale à assinatura física.</p>

<div class="assinatura">
<h2 style="margin-top:0">16. Registro Eletrônico da Assinatura</h2>
<p><strong>Local e Data:</strong> <span class="campo">${dados.cidade}, ${dataHoje}</span></p>
<p><strong>Signatário:</strong> <span class="campo">${dados.nomeRepresentante}</span> — <span class="campo">${dados.email}</span></p>
<p><strong>Data/Hora (UTC):</strong> <span class="campo">${timestamp}</span></p>
<p><strong>IP:</strong> registrado no servidor</p>
<p><strong>Dispositivo:</strong> <span class="campo">${device}</span></p>
<p><strong>Versão do contrato:</strong> v1.0</p>
<p><strong>Plano:</strong> <span class="campo">${planoLabel}</span> — <span class="campo">${valorMensal}/mês</span></p>
<p style="margin-top:16px;font-style:italic;font-size:10pt;color:#444">
  Ao clicar em "ACEITAR E ASSINAR", o LICENCIADO declarou que leu e concordou integralmente com todas as cláusulas deste contrato, está ciente dos riscos comerciais, entende que não há garantia de ganhos e aceita integralmente os termos.
</p>
</div>

<p style="margin-top:24px;font-size:9pt;text-align:center;color:#777">
  © 2026 V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · Rio de Janeiro/RJ
</p>
</body></html>`;
  }

  async function handleAssinar() {
    if (!aceito) return;
    setEnviando(true);
    setErro("");

    const device = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "desconhecido";
    const html = gerarHtml();

    const res = await fetch("/api/contratos/parceria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_id:    dados.registrationId,
        plano:              dados.plano,
        razao_social:       dados.razaoSocial,
        cnpj_cpf:           dados.cnpjCpf,
        endereco_completo:  dados.enderecoCompleto,
        nome_representante: dados.nomeRepresentante,
        cpf_representante:  dados.cpfRepresentante,
        email:              dados.email,
        telefone:           dados.telefone,
        valor_mensal:       valorMensal,
        device_info:        device,
        contract_html:      html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setErro(data.error || "Erro ao registrar assinatura. Tente novamente.");
      setEnviando(false);
      return;
    }

    setSucesso(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  return (
    <div className="min-h-screen bg-[#09081A] flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#09081A]/95 border-b border-[#243A66] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
          <Image src="/logo.jpg" alt="V3 Partners" width={32} height={32} className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold tracking-[0.15em] text-[#C9A84C] uppercase">V3 Partners</p>
          <p className="text-[11px] text-[#7A8FA8] truncate">Contrato de Parceria — {planoLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[#7A8FA8]">
          <ScrollText className="w-3.5 h-3.5" />
          <span>{lido ? "Lido" : "Role para ler"}</span>
        </div>
      </div>

      {/* Contrato */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-6 gap-4">

        {/* Aviso */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/30">
          <FileText className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#C9A84C]">
            Leia o contrato na íntegra. Ao final, marque que concorda e clique em <strong>ACEITAR E ASSINAR</strong>.
            Sua assinatura eletrônica tem validade jurídica conforme Lei nº 14.063/2020.
          </p>
        </div>

        {/* Corpo do contrato */}
        <div
          ref={contratoRef}
          className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 overflow-y-auto"
          style={{ maxHeight: "60vh" }}
        >
          <h2 className="text-base font-bold text-[#F0ECE4] text-center mb-1 tracking-wide uppercase">
            Contrato de Parceria Comercial
          </h2>
          <p className="text-[11px] text-[#C9A84C] text-center font-bold tracking-widest uppercase mb-6">
            Licenciamento {planoLabel} – Plataforma V3
          </p>

          {/* 1. Das Partes */}
          <Secao num="1" titulo="Das Partes">
            <Item>
              <strong className="text-[#F0ECE4]">LICENCIANTE:</strong> V3 PARTNERS SOLUÇÕES LTDA, CNPJ nº 14.219.287/0001-50, Rua Visconde de Pirajá, nº 414, Sala 718, Ipanema, Rio de Janeiro/RJ, CEP 22.410-002, representada por JOÃO LEMOS NETTO, CPF nº 078.678.257-97.
            </Item>
            <Item>
              <strong className="text-[#F0ECE4]">LICENCIADO:</strong>{" "}
              <Campo v={dados.razaoSocial} />, CNPJ/CPF nº <Campo v={dados.cnpjCpf} />, com sede em <Campo v={dados.enderecoCompleto} />, representado por <Campo v={dados.nomeRepresentante} />, CPF nº <Campo v={dados.cpfRepresentante} />, e-mail <Campo v={dados.email} />, telefone <Campo v={dados.telefone} />.
            </Item>
          </Secao>

          {/* 2. Do Objeto */}
          <Secao num="2" titulo="Do Objeto">
            <Item>2.1 O presente contrato tem por objeto a parceria comercial que contempla o licenciamento de uso de marca, método, know-how, treinamentos, materiais, metodologia e acesso à plataforma e ecossistema comercial da V3.</Item>
            <Item>2.2 O LICENCIADO atuará na intermediação de negócios e comercialização de soluções financeiras estruturadas, incluindo: operações de crédito, home equity, capital de giro, crédito agro, consórcios, seguros, M&A (fusões e aquisições), soluções tributárias e demais produtos do portfólio.</Item>
            <Item>2.3 Este contrato NÃO caracteriza: vínculo empregatício, sociedade, franquia, representação comercial ou joint venture.</Item>
            <Item>2.4 O LICENCIADO atua com total autonomia.</Item>
            <Item>2.5 Este contrato é personalíssimo, intransferível e não reembolsável.</Item>
          </Secao>

          {/* 3. Prazo */}
          <Secao num="3" titulo="Prazo e Condições Financeiras">
            <Item>3.1 Plano contratado: <Campo v={planoLabel} /></Item>
            <Item>3.2 Valor mensal: <Campo v={valorMensal} /></Item>
            <Item>3.3 Vigência: 12 (doze) meses.</Item>
            <Item>3.4 Encerramento automático ao término do prazo, salvo renovação.</Item>
            <Item>3.5 Renovação mediante acordo entre as partes com antecedência mínima de 30 dias.</Item>
            <Item>3.6 Após o término: o LICENCIADO mantém comissão das operações em andamento, mas não poderá inserir novas operações.</Item>
            <Item>3.7 Não haverá reembolso em nenhuma hipótese. 3.8 Natureza civil do contrato.</Item>
          </Secao>

          {/* 4. Confidencialidade */}
          <Secao num="4" titulo="Confidencialidade e Sigilo">
            <Item>4.1 O LICENCIADO reconhece que terá acesso a informações confidenciais, incluindo: modelo de negócio, estratégias comerciais, dados de clientes, parceiros financeiros e materiais internos.</Item>
            <Item>4.2 Obrigações: não divulgar, não copiar, não compartilhar, não utilizar fora do escopo.</Item>
            <Item>4.3 Vigência do sigilo: durante o contrato + 5 anos após término.</Item>
            <Item>4.4 Penalidades: multa de 200 salários mínimos + indenização por perdas e danos + rescisão imediata + bloqueio de acessos.</Item>
            <Item>4.5 Responsabilidade se estende a terceiros vinculados.</Item>
          </Secao>

          {/* 5. Área */}
          <Secao num="5" titulo="Área de Atuação">
            <Item>5.1 Atuação em todo território nacional, sem exclusividade.</Item>
          </Secao>

          {/* 6. Responsabilidades Licenciado */}
          <Secao num="6" titulo="Responsabilidades do Licenciado">
            <Item>6.1 Utilizar obrigatoriamente a plataforma V3.</Item>
            <Item>6.2 Realizar treinamentos disponibilizados.</Item>
            <Item>6.3 Gerenciar operações dentro do sistema.</Item>
            <Item>6.4 Manter contato com clientes.</Item>
            <Item>6.5 Responder alertas da plataforma (3 notificações) — ausência implica perda da operação e comissão.</Item>
            <Item>6.6 Enviar documentação via sistema e custear despesas próprias.</Item>
            <Item>6.7 Cumprir a LGPD (Lei Geral de Proteção de Dados) — multa: 50 salários mínimos em caso de violação.</Item>
          </Secao>

          {/* 7. Responsabilidades Licenciante */}
          <Secao num="7" titulo="Responsabilidades do Licenciante">
            <Item>7.1 Fornecer treinamento e suporte.</Item>
            <Item>7.2 Disponibilizar plataforma e tecnologia.</Item>
            <Item>7.3 Operacionalizar as operações financeiras.</Item>
            <Item>7.4 Relacionamento com instituições financeiras.</Item>
            <Item>7.5 Atualizar materiais comerciais.</Item>
            <Item>7.6 Realizar pagamentos de comissões.</Item>
          </Secao>

          {/* 8. Propriedade Intelectual */}
          <Secao num="8" titulo="Propriedade Intelectual">
            <Item>8.1 Todo conteúdo pertence exclusivamente ao LICENCIANTE.</Item>
            <Item>8.2 É proibido: copiar, adaptar, replicar modelo ou criar negócio similar.</Item>
            <Item>8.3 Penalidade: multa de 200 salários mínimos + indenização integral.</Item>
          </Secao>

          {/* 9. Remuneração */}
          <Secao num="9" titulo="Remuneração">
            <Item>9.1 Percentuais: Partner <Campo v="35%" /> | Partner PRO <Campo v="50%" /> — sobre resultado líquido.</Item>
            <Item>9.2 Pagamento condicionado à conclusão da operação. 9.3 Pagamento semanal. 9.4 Necessário emissão de nota fiscal.</Item>
            <Item>9.5 Possibilidade de estorno em caso de fraude ou irregularidade. 9.6 Não há garantia de ganhos.</Item>
          </Secao>

          {/* 10. Leads */}
          <Secao num="10" titulo="Leads">
            <Item>10.1 Leads poderão ser fornecidos de forma facultativa. 10.2 Prazo para conversão: 30 dias. 10.3 Após o prazo, lead retorna ao LICENCIANTE.</Item>
            <Item>10.4 Proibido: compartilhar leads ou vender fora do portfólio.</Item>
          </Secao>

          {/* 11. Não Concorrência */}
          <Secao num="11" titulo="Não Concorrência">
            <Item>11.1 Vedado relacionamento direto com instituições financeiras parceiras.</Item>
            <Item>11.2 Prazo: vigência + 24 meses. 11.3 Multa: 50 salários mínimos.</Item>
            <Item>11.4 Inclui: não concorrência, não solicitação e não difamação.</Item>
          </Secao>

          {/* 12. Penalidades */}
          <Secao num="12" titulo="Penalidades e Execução">
            <Item>12.1 Multas não compensatórias.</Item>
            <Item>12.2 O LICENCIANTE poderá: bloquear acessos, suspender pagamentos, reter comissões e encerrar contrato.</Item>
            <Item>12.3 Contrato é título executivo extrajudicial. 12.4 Aceitas provas digitais: e-mails, logs, registros da plataforma.</Item>
          </Secao>

          {/* 13. Lei Anticorrupção */}
          <Secao num="13" titulo="Lei Anticorrupção">
            <Item>13.1 Cumprimento da Lei nº 12.846/2013. 13.2 Proibição de vantagens indevidas. 13.3 Responsabilização integral por violação.</Item>
          </Secao>

          {/* 14. Foro */}
          <Secao num="14" titulo="Foro">
            <Item>14.1 Foro da Comarca do Rio de Janeiro/RJ.</Item>
          </Secao>

          {/* 15. Assinatura Eletrônica */}
          <Secao num="15" titulo="Assinatura Eletrônica e Aceite na Plataforma">
            <Item>15.1 O LICENCIADO declara que leu integralmente este contrato.</Item>
            <Item>15.2 O aceite eletrônico realizado na plataforma V3 possui validade jurídica, conforme Lei nº 14.063/2020.</Item>
            <Item>15.3 O LICENCIADO concorda com: registro de IP, data e hora, autenticação por e-mail e armazenamento de logs.</Item>
            <Item>15.4 O aceite eletrônico equivale à assinatura física.</Item>
          </Secao>

          {/* 16. Declaração Final */}
          <Secao num="16" titulo="Declaração Final de Aceite">
            <p className="bg-[#0A1628] border border-[#243A66] rounded-xl p-4 text-[#F0ECE4]">
              Ao clicar em <strong className="text-[#C9A84C]">"ACEITAR E ASSINAR"</strong>, o LICENCIADO declara que:
              leu e concorda com todas as cláusulas; está ciente dos riscos comerciais; entende que não há garantia de ganhos; aceita integralmente os termos.
            </p>
          </Secao>

          {/* 17. Dados de Registro Eletrônico */}
          <Secao num="17" titulo="Dados de Registro Eletrônico (preenchidos automaticamente)">
            <Item>Data/Hora: <Campo v={`${dataHoje} — ${agora.toLocaleTimeString("pt-BR")}`} /></Item>
            <Item>E-mail: <Campo v={dados.email} /></Item>
            <Item>Signatário: <Campo v={dados.nomeRepresentante} /></Item>
            <Item>IP: registrado no servidor</Item>
            <Item>Versão do contrato: v1.0</Item>
          </Secao>
        </div>

        {/* Área de aceite */}
        {sucesso ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-400">Contrato assinado com sucesso!</p>
              <p className="text-xs text-[#7A8FA8] mt-0.5">Redirecionando para o dashboard...</p>
            </div>
          </div>
        ) : (
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-4">
            {!lido && (
              <div className="flex items-center gap-2 text-xs text-[#7A8FA8]">
                <AlertCircle className="w-4 h-4 text-[#C9A84C]" />
                Role o contrato acima até o final para habilitar a assinatura.
              </div>
            )}

            <label className={`flex items-start gap-3 cursor-pointer ${!lido ? "opacity-50 pointer-events-none" : ""}`}>
              <input
                type="checkbox"
                checked={aceito}
                onChange={(e) => setAceito(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#C9A84C] flex-shrink-0"
              />
              <span className="text-xs text-[#B0BFD0] leading-relaxed">
                Li integralmente e concordo com todos os termos do <strong className="text-[#F0ECE4]">Contrato de Parceria Comercial — {planoLabel}</strong>, estou ciente dos riscos comerciais e entendo que não há garantia de ganhos.
              </span>
            </label>

            {erro && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {erro}
              </div>
            )}

            <button
              onClick={handleAssinar}
              disabled={!aceito || !lido || enviando}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: aceito && lido ? "#C9A84C" : "#243A66", color: aceito && lido ? "#09081A" : "#7A8FA8" }}
            >
              {enviando ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Registrando assinatura...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> ACEITAR E ASSINAR</>
              )}
            </button>

            <p className="text-[10px] text-[#7A8FA8] text-center">
              Sua assinatura eletrônica possui validade jurídica conforme Lei nº 14.063/2020.
              IP, data/hora e dados do dispositivo serão registrados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
