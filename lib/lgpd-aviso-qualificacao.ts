// Aviso de Privacidade da Qualificação (consentimento LGPD do formulário público de
// qualificação de partes). Texto aprovado por João e autorizado por Robson Lino em
// reunião (05/10/2026). Qualquer mudança no texto exige nova versão: o aceite grava
// a versão exibida em cm_party_qualifications.lgpd_text_version.
//
// Versão 2 (08/10/2026): acrescenta a análise de KYC e de due diligence para cedentes e mandatários
// (item 11 e ajustes nos itens 2, 3, 4, 5, 6 e 9). Texto aprovado por João; revisão final do Robson
// Lino. A versão 1 continua exportada como LGPD_AVISO_QUALIFICACAO_V1 e é a que a página pública
// de comissão exibe (representantes de comissão não passam por KYC de cedente ou mandatário).
// Rascunho de origem: 06_Operacional/SOPs/2026-10-08_Operacional_Texto-Aceite-LGPD-KYC-Qualificacao-v2_RASCUNHO.md

export const LGPD_AVISO_QUALIFICACAO_VERSION = "2026-10-08-v2";
export const LGPD_AVISO_QUALIFICACAO_VERSION_V1 = "2026-10-05-v1";

export const LGPD_CHECKBOX_TEXT =
  "Li e concordo com o tratamento dos meus dados pessoais pela V3 Partners Soluções Ltda, nos termos do Aviso de Privacidade da Qualificação.";

export const LGPD_AVISO_QUALIFICACAO_V1: { title: string; text: string }[] = [
  {
    title: "1. Quem trata seus dados",
    text: "V3 Partners Soluções Ltda, CNPJ 14.219.287/0001-50, Rua Visconde de Pirajá, 414, sala 718, Ipanema, Rio de Janeiro/RJ (controladora).",
  },
  {
    title: "2. Quais dados coletamos",
    text: "Nome completo, CPF ou CNPJ, nacionalidade, estado civil, profissão, data de nascimento, documento de identidade, e-mail, telefone, endereço, cópia do documento de identificação com foto ou do contrato social e, quando você receber repasse, dados bancários ou chave PIX. Registramos também o endereço IP e a data e hora do seu aceite.",
  },
  {
    title: "3. Para que usamos",
    text: "Exclusivamente para (a) qualificar você como parte na operação identificada neste formulário, (b) verificar sua identidade e a regularidade do seu cadastro, (c) elaborar, enviar para assinatura e arquivar o respectivo instrumento contratual, e (d) cumprir obrigações legais e regulatórias, inclusive de prevenção à lavagem de dinheiro.",
  },
  {
    title: "4. Base legal",
    text: "Execução de contrato ou de procedimentos preliminares a pedido do titular (art. 7º, V), cumprimento de obrigação legal ou regulatória (art. 7º, II), exercício regular de direitos (art. 7º, VI) e seu consentimento (art. 7º, I), conforme a Lei nº 13.709/2018.",
  },
  {
    title: "5. Com quem compartilhamos",
    text: "Com as demais partes da operação, apenas na medida necessária ao instrumento; com prestadores que viabilizam a assinatura eletrônica, o envio de comunicações e a verificação cadastral; e com autoridades, quando a lei exigir. Não vendemos seus dados.",
  },
  {
    title: "6. Por quanto tempo guardamos",
    text: "Por 36 (trinta e seis) meses contados do encerramento da operação, ou por prazo maior quando a lei ou uma obrigação regulatória exigir.",
  },
  {
    title: "7. Verificação de identidade",
    text: "Caso a V3 Partners venha a utilizar conferência facial, biometria ou comparação da foto do seu documento com imagem sua, isso será informado antes, com finalidade específica e pedido de consentimento próprio e destacado, nos termos do art. 11 da LGPD. Este aviso não autoriza esse tratamento.",
  },
  {
    title: "8. Seus direitos",
    text: "Você pode pedir confirmação do tratamento, acesso, correção, anonimização, portabilidade, informação sobre compartilhamento e revogação do consentimento, nos termos do art. 18 da LGPD, pelo e-mail privacidade@v3partners.com.br. A revogação não afeta o tratamento já realizado nem os que a lei nos obriga a manter.",
  },
  {
    title: "9. Segurança",
    text: "Seus documentos ficam em ambiente restrito, com acesso registrado e dados pessoais mascarados para a equipe, exibidos completos apenas mediante justificativa registrada.",
  },
  {
    title: "10. Quem pode aceitar",
    text: "Este aviso vale para pessoas maiores e capazes. A qualificação de menores e incapazes exige a declaração de ciência do representante legal, que este formulário ainda não registra.",
  },
];

// Versão 2: mesmos itens da versão 1, com os acréscimos de KYC e o item 11.
// Itens em V2_REPLACE_WHOLE têm o texto substituído por inteiro; nos demais o texto abaixo é
// acrescentado ao final do texto da versão 1.
const V2_OVERRIDES: Record<string, string> = {
  "2. Quais dados coletamos":
    " Quando a análise de KYC descrita no item 11 se aplica a você, tratamos ainda o resultado das consultas feitas em bases cadastrais, de processos judiciais, de restrições e de informações de crédito.",
  "3. Para que usamos":
    "Exclusivamente para (a) qualificar você como parte na operação identificada neste formulário, (b) verificar sua identidade e a regularidade do seu cadastro, (c) elaborar, enviar para assinatura e arquivar o respectivo instrumento contratual, (d) cumprir obrigações legais e regulatórias, inclusive de prevenção à lavagem de dinheiro, e (e) realizar a análise de conhecimento do cliente (KYC) e de due diligence descrita no item 11.",
  "4. Base legal":
    " Para a análise de KYC e de due diligence, o tratamento também se apoia na proteção do crédito (art. 7º, X) e no legítimo interesse da V3 Partners em prevenir fraudes e riscos na operação (art. 7º, IX), sempre com a finalidade e a minimização descritas neste aviso.",
  "5. Com quem compartilhamos":
    "Com as demais partes da operação, apenas na medida necessária ao instrumento; com prestadores que viabilizam a assinatura eletrônica, o envio de comunicações e a verificação cadastral; e com autoridades, quando a lei exigir. Para a análise de KYC e de due diligence, usamos prestadores de consulta cadastral, de processos judiciais e de informações de crédito, que recebem apenas o documento necessário à consulta. Não vendemos seus dados.",
  "6. Por quanto tempo guardamos":
    " O relatório de KYC e de due diligence e o resultado bruto das consultas ficam guardados por 12 (doze) meses e depois são descartados, salvo se a lei ou uma obrigação regulatória exigir prazo maior.",
  "9. Segurança":
    " O relatório de KYC e de due diligence só é aberto por pessoas autorizadas, e cada abertura fica registrada com quem abriu e quando, para auditoria.",
};

const V2_REPLACE_WHOLE = new Set(["3. Para que usamos", "5. Com quem compartilhamos"]);

export const LGPD_AVISO_QUALIFICACAO: { title: string; text: string }[] = [
  ...LGPD_AVISO_QUALIFICACAO_V1.map((item) => {
    const o = V2_OVERRIDES[item.title];
    if (!o) return item;
    return { title: item.title, text: V2_REPLACE_WHOLE.has(item.title) ? o : item.text + o };
  }),
  {
    title: "11. Análise de KYC e de due diligence",
    text: "As operações de intermediação e de fusões e aquisições conduzidas pela V3 Partners estão sujeitas à análise de KYC (conhecimento do cliente) e de due diligence dos cedentes e dos mandatários, como condição para a geração dos contratos. Para isso, a V3 Partners poderá consultar bases cadastrais, de processos judiciais, de restrições e de informações de crédito do Sistema de Informações de Crédito do Banco Central (SCR) a seu respeito. Essas consultas são feitas apenas quando você é cedente ou mandatário com poder de decisão na operação, ficam registradas com quem consultou e quando, e o resultado não é compartilhado com as demais partes.",
  },
];
