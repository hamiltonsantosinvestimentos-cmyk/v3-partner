"use client";

import { useState } from "react";

interface ContratoData {
  id: string;
  status: string;
  client_name: string;
  client_cpf: string | null;
  client_email: string;
  commission_perc: number;
  deal_value: number | null;
  credit_line: string | null;
  proposal_code: string | null;
  expires_at: string;
  signed_at: string | null;
  telefone?: string | null;
  endereco_cadastrado?: string | null;
  bairro_cadastrado?: string | null;
  municipio_cadastrado?: string | null;
  estado_cadastrado?: string | null;
  cep_cadastrado?: string | null;
}

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const EXTENSO: Record<number, string> = {
  1:"um",2:"dois",3:"três",4:"quatro",5:"cinco",6:"seis",7:"sete",8:"oito",
  9:"nove",10:"dez",11:"onze",12:"doze",13:"treze",14:"quatorze",15:"quinze",
  16:"dezesseis",17:"dezessete",18:"dezoito",19:"dezenove",20:"vinte",
  25:"vinte e cinco",30:"trinta",
};
function percExtenso(v: number): string {
  return EXTENSO[v] ? `${v}% (${EXTENSO[v]} por cento)` : `${v}%`;
}

// Componente de cláusula
function Clausula({ numero, titulo, children }: { numero: string; titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1B3050] pb-2">
        CLÁUSULA {numero} – {titulo}
      </h3>
      <div className="space-y-3 text-[12.5px] text-[#7A8FA8] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function AssinarClient({ token, contrato }: { token: string; contrato: ContratoData }) {
  const [nomeAssinatura, setNomeAssinatura] = useState("");
  const [endereco, setEndereco] = useState(contrato.endereco_cadastrado ?? "");
  const [bairro, setBairro] = useState(contrato.bairro_cadastrado ?? "");
  const [municipio, setMunicipio] = useState(contrato.municipio_cadastrado ?? "");
  const [estado, setEstado] = useState(contrato.estado_cadastrado ?? "");
  const [cep, setCep] = useState(contrato.cep_cadastrado ?? "");
  const [leu, setLeu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assinado, setAssinado] = useState(contrato.status === "ASSINADO");
  const [error, setError] = useState("");

  // CPF / Receita Federal
  const [cpf, setCpf] = useState(contrato.client_cpf ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfResult, setCpfResult] = useState<{ tipo: string; nome: string; situacao: string; nomeCorrigido: boolean } | null>(null);
  const [cpfError, setCpfError] = useState("");

  function toTitleCase(s: string) {
    const minors = new Set(["da","de","do","das","dos","e","a","o","em"]);
    return s.toLowerCase().split(" ").map((w, i) =>
      i === 0 || !minors.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
    ).join(" ");
  }

  function normName(s: string) {
    return s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  async function handleValidarCPF() {
    setCpfError("");
    setCpfResult(null);
    if (!cpf.trim()) { setCpfError("Informe o CPF/CNPJ."); return; }
    setCpfLoading(true);
    try {
      const res = await fetch("/api/cpf-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf }),
      });
      const json = await res.json();
      if (!res.ok) { setCpfError(json.error ?? "Erro ao validar CPF."); return; }
      // Para CNPJ: preenche com razão social. Para CPF: usuário mantém seu nome.
      const rfNome: string = json.nome ?? "";
      if (rfNome && json.tipo === "CNPJ") {
        const rfNomeTitle = toTitleCase(rfNome);
        const nomeAtual = nomeAssinatura.trim();
        const nomeCorrigido = nomeAtual !== "" && normName(rfNome) !== normName(nomeAtual);
        setNomeAssinatura(rfNomeTitle);
        setCpfResult({ tipo: json.tipo, nome: rfNome, situacao: json.situacao, nomeCorrigido });
      } else {
        setCpfResult({ tipo: json.tipo, nome: rfNome, situacao: json.situacao, nomeCorrigido: false });
      }
    } catch {
      setCpfError("Erro de conexão. Tente novamente.");
    } finally {
      setCpfLoading(false);
    }
  }

  const jaAssinado = contrato.status === "ASSINADO";
  const expirado = contrato.status === "EXPIRADO" || contrato.status === "CANCELADO";
  const dataExpira = new Date(contrato.expires_at).toLocaleDateString("pt-BR");
  const hoje = new Date().toLocaleDateString("pt-BR");
  const perc = percExtenso(contrato.commission_perc);

  async function handleAssinar() {
    setError("");
    if (!nomeAssinatura.trim()) { setError("Digite seu nome completo para assinar."); return; }
    if (!cpfResult) { setError("Valide seu CPF na Receita Federal antes de assinar."); return; }
    if (!leu) { setError("Você precisa confirmar que leu o contrato."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/contratos/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_assinatura: nomeAssinatura, endereco, bairro, municipio, estado, cep, birthdate: birthDate }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao registrar assinatura."); return; }
      setAssinado(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (assinado) {
    return (
      <div className="min-h-screen bg-[#09081A] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Contrato Assinado!</h1>
          <p className="text-[#7A8FA8] text-sm">
            Obrigado, <strong className="text-white">{contrato.client_name}</strong>.
            Seu mandato foi registrado com sucesso.
          </p>
          <p className="text-[#7A8FA8] text-sm">
            Nossa equipe dará andamento à sua operação em breve.
            Você receberá uma confirmação no e-mail{" "}
            <strong className="text-[#C9A84C]">{contrato.client_email}</strong>.
          </p>
          <div className="pt-4 border-t border-[#1B3050]">
            <span className="text-[11px] text-[#7A8FA8]">V3 Partners · {contrato.proposal_code}</span>
          </div>
        </div>
      </div>
    );
  }

  if (expirado) {
    return (
      <div className="min-h-screen bg-[#09081A] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto">
            <span className="text-3xl">⏰</span>
          </div>
          <h1 className="text-xl font-bold text-white">Link Expirado</h1>
          <p className="text-[#7A8FA8] text-sm">
            Este link expirou ou foi cancelado. Entre em contato com a equipe V3 Partners.
          </p>
          <a href="mailto:contato@v3partners.com.br" className="text-[#C9A84C] text-sm hover:underline">
            contato@v3partners.com.br
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09081A] py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center">
            <span className="text-lg font-black text-[#09081A]">V3</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">V3 PARTNERS</h1>
            <p className="text-[11px] text-[#7A8FA8]">Contrato de Prestação de Serviços · {contrato.proposal_code}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-[#7A8FA8]">Expira em</p>
            <p className="text-xs font-semibold text-[#C9A84C]">{dataExpira}</p>
          </div>
        </div>

        {/* ── CONTRATO ── */}
        <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-[#1B3050] bg-[#07101E] text-center space-y-1">
            <h2 className="text-sm font-bold text-white tracking-widest uppercase">
              Contrato de Prestação de Serviços Financeiros
            </h2>
            <p className="text-[11px] text-[#7A8FA8]">Instrumento Particular de Mandato de Representação</p>
          </div>

          <div className="px-6 py-8 space-y-8">

            {/* Preâmbulo */}
            <div className="space-y-4 text-[12.5px] text-[#7A8FA8] leading-relaxed">
              <p>
                Pelo presente Instrumento Particular de Contrato de Parceria Comercial, de um lado:
              </p>

              {/* CONTRATADA */}
              <div className="bg-[#13243D] rounded-xl p-4 space-y-1">
                <p className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Contratada</p>
                <p>
                  <strong className="text-white">V3 PARTNERS SOLUÇÕES LTDA</strong>, com sede à Rua Visconde de Pirajá,
                  414/Sala 718 – CEP 22.410-002 – Ipanema – Rio de Janeiro – RJ, inscrita no CNPJ nº{" "}
                  <strong className="text-white">14.219.287/0001-50</strong>, registrada na JUCERJA sob o NIRE nº 33.2.0898614-3,
                  neste ato representada por JOÃO LEMOS NETTO, brasileiro, divorciado, empresário, CPF nº 078.678.257-97,
                  doravante denominada simplesmente <strong className="text-white">CONTRATADA</strong>.
                </p>
              </div>

              {/* CONTRATANTE */}
              <div className="bg-[#13243D] rounded-xl p-4 space-y-1">
                <p className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Contratante</p>
                <p>
                  <strong className="text-[#C9A84C]">{contrato.client_name}</strong>
                  {contrato.client_cpf && (
                    <span>, inscrito(a) no CPF/CNPJ nº <strong className="text-white">{contrato.client_cpf}</strong></span>
                  )}
                  {contrato.telefone && (
                    <span>, Tel: <strong className="text-white">{contrato.telefone}</strong></span>
                  )}
                  {(endereco || municipio) && (
                    <span>
                      , estabelecido(a) à{" "}
                      <strong className="text-white">
                        {[endereco, bairro, municipio && estado ? `${municipio} – ${estado}` : municipio || estado, cep].filter(Boolean).join(", ")}
                      </strong>
                    </span>
                  )}
                  , e-mail: <strong className="text-white">{contrato.client_email}</strong>,
                  doravante denominado(a) simplesmente <strong className="text-white">CONTRATANTE</strong>.
                </p>
              </div>

              <p>
                Sendo CONTRATADA e CONTRATANTE designadas simplesmente <em>"Partes"</em> ou, isoladamente, <em>"Parte"</em>,
                e sendo este Contrato de Prestação de Serviços designado como <strong className="text-white">MANDATO</strong>, considerando que:
              </p>
              <p>
                <strong className="text-white">I</strong> – A CONTRATANTE tem interesse em encontrar oportunidades de crédito e recursos para suas atividades;
              </p>
              <p>
                <strong className="text-white">II</strong> – A CONTRATADA tem condições de encontrar as devidas Instituições Financeiras Originadoras de Crédito para realizar Operações, aproximando a CONTRATANTE destes potenciais fornecedores de recursos;
              </p>
              <p>
                <strong className="text-white">III</strong> – A CONTRATANTE deseja contratar a CONTRATADA para intermediar a aproximação;
              </p>
              <p>
                <strong className="text-white">IV</strong> – As Partes compreendem que o presente MANDATO estabelece o escopo dos serviços, a remuneração aplicável, as hipóteses de indenização e rescisão, obrigações de confidencialidade, entre outros.
              </p>
              <p>
                Pelo atual MANDATO, as partes têm entre si, ajustadas e contratadas, o presente instrumento, conforme abaixo se consigna para todos os efeitos legais e administrativos.
              </p>
            </div>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 1 */}
            <Clausula numero="1" titulo="DEFINIÇÕES">
              <Item>
                <strong className="text-white">1.1.</strong> Sem prejuízo das demais definições dispostas neste MANDATO, os termos iniciados em letra maiúscula terão os significados a eles atribuídos neste instrumento:
              </Item>
              <Item>
                <strong className="text-white">"Operação de Crédito"</strong>: Refere-se à operação por meio da qual a CONTRATADA, diretamente ou por meio de suas Afiliadas, celebrará empréstimos, financiamentos, adiantamentos, outras modalidades de crédito ou qualquer outra transação jurídica a ser definida pelas partes, na modalidade de <strong className="text-[#C9A84C]">{contrato.credit_line ?? "Crédito Estruturado"}</strong>{contrato.deal_value ? `, no valor estimado de <strong className="text-[#C9A84C]">${moeda(contrato.deal_value)}</strong>` : ""}.
              </Item>
              <Item>
                <strong className="text-white">"Afiliadas"</strong>: Empresas com relação jurídica com a CONTRATADA por vínculos de controle ou participação acionária, podendo ser subsidiárias, controladoras ou empresas do mesmo grupo econômico.
              </Item>
              <Item>
                <strong className="text-white">"Instituições Financeiras Originadoras do Crédito"</strong>: Entidades que atuam no mercado financeiro na criação, estruturação e aporte financeiro em operações de crédito, incluindo Bancos, Cooperativas de Crédito, Financeiras, Fundos de Investimentos, FIDCs, entre outras.
              </Item>
              <Item>
                <strong className="text-white">"Valor da Operação"</strong>: Montante efetivamente disponibilizado à CONTRATANTE na concretização das Operações de Crédito, correspondente ao valor líquido recebido após a intermediação realizada pela CONTRATADA.
              </Item>
              <Item>
                <strong className="text-white">"Data da Concretização da Operação"</strong>: Data em que os recursos forem efetivamente disponibilizados à CONTRATANTE, conforme a forma de recebimento estipulada na estruturação da operação.
              </Item>
              <Item>
                <strong className="text-white">"Remuneração de Sucesso"</strong>: Comissionamentos devidos à CONTRATADA pagos exclusivamente em caso de êxito na estruturação da Operação de Crédito, somente após a Concretização da Operação.
              </Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 2 */}
            <Clausula numero="2" titulo="DO OBJETO DO CONTRATO">
              <Item>
                <strong className="text-white">2.1.</strong> A CONTRATANTE contrata a CONTRATADA para a identificação, apresentação e intermediação de relações comerciais com Instituições Financeiras Originadoras do Crédito. Em contrapartida, a CONTRATADA será remunerada conforme a Cláusula 3 deste instrumento.
              </Item>
              <Item>
                <strong className="text-white">2.2.</strong> A obrigação da CONTRATADA consistirá em prestar serviços à CONTRATANTE com ética, clareza e eficácia, sendo responsável por: (a) analisar os dados para a melhor estruturação da operação; (b) estudar o perfil da CONTRATANTE; (c) identificar e apresentar as melhores opções de crédito disponíveis; (d) analisar ofertas das Instituições Financeiras; (e) definir estratégias de negociação; (f) prestar suporte na organização de documentos; (g) estruturar e apresentar a Defesa de Crédito; (h) contribuir com materiais complementares quando necessário; (i) representar a CONTRATANTE nos processos de due diligence; (j) coordenar reuniões entre as partes; (k) elaborar e apresentar cronograma dos principais marcos da operação; (l) conduzir as negociações finais junto às Instituições Financeiras; (m) defender os interesses da CONTRATANTE visando a fluidez dos processos e o levantamento do crédito no menor tempo e custo possível.
              </Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 3 */}
            <Clausula numero="3" titulo="DA REMUNERAÇÃO">
              <Item>
                <strong className="text-white">3.1.</strong> Como contraprestação pelos serviços prestados conforme a Cláusula 2, a CONTRATANTE pagará à CONTRATADA uma Remuneração de Sucesso correspondente a{" "}
                <strong className="text-[#C9A84C]">{perc}</strong> do Valor da Operação, recebido em moeda corrente nacional. A referida Remuneração de Sucesso será paga conforme as condições especificadas.
              </Item>
              <Item>
                <strong className="text-white">3.1.1.</strong> Para os fins desta Cláusula, o Valor da Operação corresponde aos parâmetros apresentados na Cláusula 1 deste MANDATO.
              </Item>
              <Item>
                <strong className="text-white">3.2.</strong> Na hipótese de concretização da Operação, a CONTRATANTE pagará à CONTRATADA a Remuneração de Sucesso em moeda corrente nacional, no prazo de até 2 (dois) dias contados a partir da Data da Concretização da Operação, mediante apresentação de Nota Fiscal correspondente.
              </Item>
              <Item>
                <strong className="text-white">3.3.</strong> A Remuneração de Sucesso será devida sobre as operações de crédito (incluindo renovações, prorrogações e novas operações) efetivamente originadas durante a vigência deste MANDATO, desde que a CONTRATADA tenha apresentado a Instituição Financeira à CONTRATANTE e participado ativamente das negociações.
              </Item>
              <Item>
                <strong className="text-white">3.4.</strong> A CONTRATADA terá direito ao recebimento da Remuneração de Sucesso sobre operações realizadas com Instituição Financeira apresentada pela CONTRATADA, mesmo após a rescisão deste contrato, desde que a operação seja efetivada até 24 (vinte e quatro) meses após o término ou rescisão.
              </Item>
              <Item>
                <strong className="text-white">3.5.</strong> Os honorários relativos às operações de antecipação de recebíveis incidirão sobre o valor total do limite aprovado. Após a concretização, serão cobrados à razão de 0,20% sobre os valores efetivamente disponibilizados.
              </Item>
              <Item>
                <strong className="text-white">3.6.</strong> O pagamento será efetuado por depósito bancário: PIX CNPJ 14.219.287/0001-50 · Banco 461 ASAAS IP SA · Agência 0001 · Conta 7208828-9. O comprovante de transferência servirá como recibo de pagamento.
              </Item>
              <Item>
                <strong className="text-white">3.7.</strong> O atraso no pagamento acarretará multa de 2% sobre o valor devido, juros de mora de 2% ao mês, proporcionais aos dias de atraso, além de correção monetária pelo IPCA-IBGE.
              </Item>
              <Item>
                <strong className="text-white">3.8.</strong> O atraso superior a 30 (trinta) dias resultará no encaminhamento do débito ao Cartório de Protestos.
              </Item>
              <Item>
                <strong className="text-white">3.9.</strong> Em caso de alterações significativas nas condições de mercado, as Partes comprometem-se a negociar de boa-fé os novos termos de Remuneração. Não havendo acordo, a questão será resolvida por mediação e, se frustrada, judicialmente.
              </Item>
              <Item>
                <strong className="text-white">3.10.</strong> Caso a operação seja aprovada pela instituição financeira nas condições acordadas e o CONTRATANTE opte por não efetivar a operação sem justificativa legalmente aceita, ficará obrigado a pagar à CONTRATADA multa compensatória equivalente a 2% (dois por cento) sobre o Valor da Operação, em até 10 (dez) dias corridos contados da comunicação da desistência.
              </Item>
              <Item>
                <strong className="text-white">3.11.</strong> Na modalidade <strong className="text-white">V3GIRO</strong>, a multa da cláusula 3.10 só é exigível nas condições: imóveis em garantia — CET entre 0,56% a.m. e 1,2% a.m., prazo de 140 a 180 meses; frotas e maquinários — CET entre 0,56% a.m. e 1,4% a.m., prazo de 80 a 110 meses.
              </Item>
              <Item>
                <strong className="text-white">3.12.</strong> Na modalidade <strong className="text-white">HOME EQUITY / HOMECASH</strong>: CET entre 1,30% a.m. e 2,50% a.m., prazo de 60 a 240 meses.
              </Item>
              <Item>
                <strong className="text-white">3.13.</strong> Na modalidade <strong className="text-white">ANTECIPAÇÃO DE RECEBÍVEIS</strong>: CET entre 1,20% a.m. e 2,50% a.m., prazo de 30 a 180 dias.
              </Item>
              <Item>
                <strong className="text-white">3.14.</strong> Na modalidade <strong className="text-white">CRÉDITO AGRO</strong>: CET entre 0,90% a.m. e 2,50% a.m., prazo de 12 a 120 meses.
              </Item>
              <Item>
                <strong className="text-white">3.15.</strong> Na modalidade <strong className="text-white">FUNDO CONSTRUÇÃO</strong>: CET entre 1,7% a.m. e 3% a.m., com prazo ajustado ao cronograma do projeto.
              </Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 4 */}
            <Clausula numero="4" titulo="DA NÃO EXCLUSIVIDADE">
              <Item>
                <strong className="text-white">4.1.</strong> A CONTRATADA não terá exclusividade, podendo a CONTRATANTE contratar outras empresas para serviços similares sem que isso configure descumprimento deste MANDATO.
              </Item>
              <Item>
                <strong className="text-white">4.2.</strong> Durante a vigência, a CONTRATANTE poderá buscar e contratar operações de crédito diretamente com quaisquer instituições financeiras, sem gerar direito à remuneração da CONTRATADA, desde que observadas as condições desta Cláusula.
              </Item>
              <Item>
                <strong className="text-white">4.3.</strong> A CONTRATADA somente fará jus à remuneração se a operação for efetivamente originada por meio de sua intermediação e a instituição financeira tiver sido apresentada por ela à CONTRATANTE.
              </Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 5 */}
            <Clausula numero="5" titulo="DAS OBRIGAÇÕES DAS PARTES">
              <Item><strong className="text-white">5.1.</strong> As Partes se comprometem a prestar contas uma à outra sempre que solicitado, mantendo a maior transparência possível.</Item>
              <Item><strong className="text-white">5.2.</strong> A CONTRATADA obriga-se a fornecer à CONTRATANTE informações relativas aos seus procedimentos, pautados na lisura, ética e transparência.</Item>
              <Item><strong className="text-white">5.3.</strong> A CONTRATANTE compromete-se a fornecer, de forma clara, correta e em tempo hábil, todas as informações e documentos necessários, sendo responsável pela veracidade e atualização dos dados.</Item>
              <Item><strong className="text-white">5.3.1.</strong> Após a assinatura, a CONTRATANTE terá 30 (trinta) dias corridos para encaminhar toda a documentação solicitada via checklist disponibilizado pela CONTRATADA.</Item>
              <Item><strong className="text-white">5.3.2.</strong> O não envio da documentação no prazo, sem justificativa aceita, acarretará taxa administrativa equivalente a 1% sobre o valor do crédito solicitado, devida em até 10 (dez) dias corridos.</Item>
              <Item><strong className="text-white">5.4.</strong> A CONTRATADA não se responsabilizará por eventual negativa de crédito pelas Instituições Financeiras decorrente de análise de crédito ou inconsistência na documentação apresentada.</Item>
              <Item><strong className="text-white">5.5.</strong> Caso alguma das Partes utilize informações fraudadas, a Parte infratora arcará com todas as perdas, danos e custos decorrentes, isentando a outra Parte de qualquer responsabilidade.</Item>
              <Item><strong className="text-white">5.6.</strong> Nenhuma das Partes se responsabiliza por atos praticados pela outra ou seus prepostos em desacordo com as disposições deste MANDATO.</Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 6 */}
            <Clausula numero="6" titulo="DA PROTEÇÃO DE DADOS">
              <Item><strong className="text-white">6.1.</strong> A CONTRATADA adotará todas as medidas necessárias para garantir a proteção dos Dados Pessoais fornecidos pela CONTRATANTE, em conformidade com a Lei nº 13.709/18 (LGPD).</Item>
              <Item><strong className="text-white">6.2.</strong> Os Dados Pessoais serão tratados exclusivamente para as finalidades relacionadas à execução das operações de crédito, sendo vedado seu uso para qualquer outra finalidade não autorizada.</Item>
              <Item><strong className="text-white">6.3.</strong> A CONTRATADA implementará medidas de segurança técnicas e administrativas adequadas e notificará imediatamente a CONTRATANTE em caso de qualquer incidente de segurança.</Item>
              <Item><strong className="text-white">6.4.</strong> A CONTRATADA cooperará com a CONTRATANTE no cumprimento das obrigações previstas pela LGPD, incluindo respostas a solicitações de titulares de dados e auditorias.</Item>
              <Item><strong className="text-white">6.5.</strong> "Dados Pessoais" referem-se às informações relacionadas à CONTRATANTE e/ou seus representantes, coletadas no contexto da estruturação das operações de crédito.</Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 7 */}
            <Clausula numero="7" titulo="DA CONFIDENCIALIDADE">
              <Item><strong className="text-white">7.1.</strong> Todas as informações, dados, documentos, materiais, know-how e segredos de negócio de qualquer natureza fornecidos pela CONTRATANTE ou aos quais a CONTRATADA tenha acesso em razão deste contrato serão considerados Informações Confidenciais.</Item>
              <Item><strong className="text-white">7.2.</strong> Não serão consideradas Informações Confidenciais as informações: (a) de domínio público sem contribuição da CONTRATADA; (b) recebidas de terceiros sem obrigação de confidencialidade; (c) desenvolvidas independentemente pela CONTRATADA sem referência às informações da CONTRATANTE.</Item>
              <Item><strong className="text-white">7.3.</strong> Caso compelida a divulgar Informações Confidenciais por força de lei ou ordem judicial, a CONTRATADA deverá notificar imediatamente a CONTRATANTE e divulgar apenas o estritamente necessário.</Item>
              <Item><strong className="text-white">7.4.</strong> A CONTRATADA poderá compartilhar Informações Confidenciais com seus representantes desde que tais pessoas necessitem conhecê-las para a execução dos serviços e assumam compromisso formal de confidencialidade.</Item>
              <Item><strong className="text-white">7.5.</strong> Após o término deste Mandato, a CONTRATADA deverá devolver ou destruir todas as Informações Confidenciais e mantê-las em sigilo por 2 (dois) anos.</Item>
              <Item><strong className="text-white">7.6.</strong> A CONTRATADA será integralmente responsável por qualquer violação desta Cláusula e deverá indenizar a CONTRATANTE por todas as perdas e danos decorrentes.</Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 8 */}
            <Clausula numero="8" titulo="DA LEI ANTICORRUPÇÃO">
              <Item><strong className="text-white">8.1.</strong> As Partes comprometem-se a cumprir rigorosamente a Lei nº 12.846/13 (Lei Anticorrupção) e a Lei nº 9.613/1998 (Lei de Lavagem de Dinheiro), bem como quaisquer outras normas aplicáveis.</Item>
              <Item><strong className="text-white">8.2.</strong> As Partes concordam em não oferecer, prometer, autorizar ou pagar qualquer vantagem indevida a agentes públicos ou pessoas jurídicas com o intuito de influenciar atos ou decisões.</Item>
              <Item><strong className="text-white">8.3.</strong> Em caso de violação, a parte infratora responsabiliza-se por todas as penalidades aplicáveis, incluindo indenizações e reembolso de despesas.</Item>
              <Item><strong className="text-white">8.4.</strong> A CONTRATADA declara que possui e implementa políticas internas de prevenção à corrupção.</Item>
              <Item><strong className="text-white">8.5.</strong> As Partes declaram e garantem que não se encontram sob investigação por corrupção, listadas em entidades governamentais por terrorismo ou lavagem de dinheiro, nem sujeitas a sanções econômicas.</Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 9 */}
            <Clausula numero="9" titulo="DA DECLARAÇÃO DAS PARTES">
              <Item><strong className="text-white">9.1.</strong> As Partes declaram que seus signatários estão devidamente autorizados a celebrar o presente MANDATO, tendo sido satisfeitos todos os requisitos legais e estatutários.</Item>
              <Item><strong className="text-white">9.2.</strong> As Partes declaram que o presente contrato constitui instrumento válido, eficaz e exequível, comprometendo-se a cumprir todas as obrigações aqui pactuadas.</Item>
              <Item><strong className="text-white">9.3.</strong> A celebração deste MANDATO não infringe qualquer outro contrato, documento ou entendimento assinado pelas Partes.</Item>
              <Item><strong className="text-white">9.4.</strong> A CONTRATADA declara que possui a expertise, capacidade técnica e recursos necessários para prestar os serviços com qualidade e eficiência.</Item>
              <Item><strong className="text-white">9.5.</strong> A CONTRATADA manterá a CONTRATANTE informada sobre quaisquer fatos ou circunstâncias que possam afetar a prestação dos serviços.</Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 10 */}
            <Clausula numero="10" titulo="DAS DISPOSIÇÕES GERAIS">
              <Item><strong className="text-white">10.1.</strong> A CONTRATADA está autorizada a contratar ou associar-se a terceiros para viabilizar as Operações de Crédito, mediante ciência e autorização prévia da CONTRATANTE.</Item>
              <Item><strong className="text-white">10.2.</strong> Os avisos e notificações deverão ser endereçados às Partes nos endereços indicados neste contrato, cabendo comunicar por escrito quaisquer alterações.</Item>
              <Item><strong className="text-white">10.3.</strong> O presente Mandato constitui a totalidade dos acordos entre as Partes, cancelando acordos anteriores sobre o mesmo objeto. Seus termos somente poderão ser modificados mediante acordo por escrito.</Item>
              <Item><strong className="text-white">10.4.</strong> As Partes concordam que este MANDATO foi celebrado respeitando os princípios de probidade e boa-fé, por livre, consciente e firme manifestação de vontade.</Item>
              <Item><strong className="text-white">10.5.</strong> O presente instrumento constitui título executivo extrajudicial, nos termos da legislação civil e processual civil vigente.</Item>
              <Item><strong className="text-white">10.6.</strong> A eventual renúncia de qualquer das Partes a um direito deverá ser formalizada por escrito e não implicará renúncia aos demais direitos.</Item>
              <Item><strong className="text-white">10.7.</strong> A tolerância ao descumprimento de qualquer obrigação não implicará renúncia ao direito de exigir seu cumprimento, nem perdão ou novação do contrato.</Item>
              <Item><strong className="text-white">10.8.</strong> Nenhuma das Partes poderá ceder ou transferir seus direitos e obrigações a terceiros sem consentimento prévio por escrito da outra Parte.</Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 11 */}
            <Clausula numero="11" titulo="DO PRAZO DE VIGÊNCIA E RESCISÃO">
              <Item><strong className="text-white">11.1.</strong> O presente MANDATO tem vigência por prazo indeterminado, iniciada na data de sua assinatura, podendo ser rescindido imotivadamente mediante notificação por escrito com antecedência mínima de 30 (trinta) dias, e imediatamente em caso de: (a) descumprimento contratual não sanado em até 30 dias após notificação; (b) decretação de falência ou recuperação judicial.</Item>
              <Item><strong className="text-white">11.2.</strong> Em caso de rescisão, as obrigações de pagamento da CONTRATANTE à CONTRATADA permanecerão vigentes de acordo com a Cláusula 3.</Item>
              <Item><strong className="text-white">11.3.</strong> No caso de rescisão por culpa comprovada, a Parte culpada será responsável por indenizar a Parte inocente por todas as perdas, danos, custos e despesas, incluindo honorários advocatícios.</Item>
              <Item><strong className="text-white">11.3.1.</strong> A obrigação de indenizar continuará em pleno vigor mesmo após encerrada a prestação de serviços e se estenderá aos sucessores e cessionários.</Item>
              <Item><strong className="text-white">11.4.</strong> A responsabilidade da Parte Culpada limita-se aos casos de dolo comprovado por decisão judicial final, excluindo perdas indiretas e danos causados por terceiros subcontratados.</Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* CLÁUSULA 12 */}
            <Clausula numero="12" titulo="DO FORO">
              <Item>
                <strong className="text-white">12.1.</strong> O presente contrato será regido pelas leis brasileiras, e ambas as Partes elegem o Foro da Comarca de <strong className="text-white">Ipanema/RJ</strong> para dirimir qualquer conflito, com renúncia expressa a qualquer outro foro, por mais privilegiado que seja.
              </Item>
            </Clausula>

            <div className="border-t border-[#1B3050]" />

            {/* Encerramento */}
            <div className="text-[12px] text-[#7A8FA8] space-y-2 text-center">
              <p>
                E, por estarem assim justas e contratadas, as Partes reconhecem como válidas as assinaturas
                celebradas por meio digital, firmando o presente instrumento com assinatura eletrônica via
                plataforma eletrônica, dispensando-se testemunhas instrumentárias.
              </p>
              <p className="text-[11px]">Rio de Janeiro, {hoje}</p>
            </div>

          </div>
        </div>

        {/* ── DADOS DO CONTRATANTE ── */}
        <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Dados do Contratante</h3>
          <p className="text-[12px] text-[#7A8FA8]">
            Preencha seus dados pessoais e endereço para constar no contrato.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">Data de Nascimento *</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => { setBirthDate(e.target.value); setCpfResult(null); setCpfError(""); }}
                className="w-full h-9 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">Endereço (Rua, nº)</label>
              <input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua Exemplo, 123"
                className="w-full h-9 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white placeholder:text-[#7A8FA8] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">Bairro</label>
              <input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Centro"
                className="w-full h-9 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white placeholder:text-[#7A8FA8] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">CEP</label>
              <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000"
                className="w-full h-9 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white placeholder:text-[#7A8FA8] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">Município</label>
              <input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="São Paulo"
                className="w-full h-9 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white placeholder:text-[#7A8FA8] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50">
                <option value="">Selecione</option>
                {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── CONFIRMAÇÃO DE IDENTIDADE ── */}
        <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Confirmação de Identidade</h3>
            {cpfResult && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${!cpfResult.nomeCorrigido ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                {!cpfResult.nomeCorrigido ? "✓ Nome e CPF validados" : "⚠ Nome ajustado pela RF"}
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#7A8FA8]">
            Informe seu CPF/CNPJ. O sistema valida os dígitos verificadores.
            Para CNPJ, também retorna a razão social cadastrada.
          </p>
          <div>
            <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">CPF / CNPJ *</label>
            <input
              value={cpf}
              onChange={(e) => { setCpf(e.target.value); setCpfResult(null); setCpfError(""); }}
              placeholder="000.000.000-00"
              className="w-full h-9 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white placeholder:text-[#7A8FA8] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
            />
          </div>
          <button
            onClick={handleValidarCPF}
            disabled={cpfLoading || !cpf.trim()}
            className="w-full h-9 rounded-lg bg-[#13243D] border border-[#C9A84C]/40 hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed text-[#C9A84C] font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {cpfLoading
              ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />Validando...</>
              : "🔍 Validar CPF / CNPJ"}
          </button>
          {cpfResult && (
            <div className="space-y-2">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-1">
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">✅ {cpfResult.tipo} Válido — Dígitos verificados</p>
                {cpfResult.nome && <p className="text-sm font-semibold text-white">{toTitleCase(cpfResult.nome)}</p>}
                <p className="text-[11px] text-[#7A8FA8]">Situação: {cpfResult.situacao}</p>
              </div>
              {cpfResult.nomeCorrigido && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
                  <p className="text-[11px] text-amber-400">
                    ⚠️ O nome no campo de assinatura foi corrigido para corresponder ao cadastro da Receita Federal.
                  </p>
                </div>
              )}
            </div>
          )}
          {cpfError && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{cpfError}</div>
          )}
        </div>

        {/* ── ASSINATURA ── */}
        <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Assinatura Eletrônica</h3>
          <div>
            <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">
              Digite seu nome completo para assinar *
            </label>
            <input value={nomeAssinatura} onChange={(e) => setNomeAssinatura(e.target.value)}
              placeholder={contrato.client_name}
              className="w-full h-10 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white placeholder:text-[#7A8FA8]/60 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={leu} onChange={(e) => setLeu(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#C9A84C] flex-shrink-0" />
            <span className="text-[12px] text-[#7A8FA8]">
              Declaro que li e compreendi o Contrato de Prestação de Serviços Financeiros (Mandato de Representação)
              acima na íntegra, e que estou de acordo com todos os seus termos e condições. Esta assinatura eletrônica
              tem validade jurídica nos termos da MP 2.200-2/2001 e Lei 14.063/2020.
            </span>
          </label>
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <button onClick={handleAssinar} disabled={saving || !leu || !nomeAssinatura.trim()}
            className="w-full h-11 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] disabled:opacity-40 disabled:cursor-not-allowed text-[#09081A] font-bold text-sm transition-colors flex items-center justify-center gap-2">
            {saving ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-[#09081A] border-t-transparent animate-spin" />
                Registrando assinatura...
              </>
            ) : "✍️ Assinar Contrato"}
          </button>
          <p className="text-[10px] text-[#7A8FA8] text-center">
            Ao assinar, seu IP e data/hora serão registrados como prova de assinatura eletrônica.
          </p>
        </div>

        <div className="text-center pb-6">
          <span className="text-[11px] text-[#7A8FA8]">
            V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br
          </span>
        </div>
      </div>
    </div>
  );
}
