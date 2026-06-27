export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface CategoryQuiz {
  categoryId: string;
  passingScore: number;
  questions: QuizQuestion[];
}

export const ACADEMY_QUIZZES: Record<string, CategoryQuiz> = {
  "home-equity": {
    categoryId: "home-equity",
    passingScore: 70,
    questions: [
      {
        id: "he-q1",
        question: "Qual resolução do CMN regulamenta o Home Equity no Brasil?",
        options: ["CMN 4.432/2015", "CMN 4.676/2018", "CMN 4.815/2020", "CMN 3.954/2011"],
        correct: 1,
        explanation: "A Resolução CMN 4.676/2018 regulamenta as condições do crédito imobiliário com garantia de imóvel (Home Equity) no Brasil.",
      },
      {
        id: "he-q2",
        question: "O que significa a sigla LTV no contexto de Home Equity?",
        options: ["Loan To Value — relação entre o crédito e o valor do imóvel", "Long Term Value — valor de longo prazo do imóvel", "Liquidez Total por Valor — índice de liquidez", "Low Tax Valuation — avaliação de baixa tributação"],
        correct: 0,
        explanation: "LTV (Loan To Value) é a proporção entre o valor do crédito solicitado e o valor de avaliação do imóvel dado em garantia.",
      },
      {
        id: "he-q3",
        question: "Qual é o prazo máximo típico para operações de Home Equity no mercado brasileiro?",
        options: ["10 anos", "15 anos", "20 anos", "35 anos"],
        correct: 3,
        explanation: "O prazo máximo para Home Equity pode chegar a 35 anos, o que permite parcelas menores e viabiliza operações de maior valor.",
      },
      {
        id: "he-q4",
        question: "Qual é o LTV máximo geralmente aceito pelo mercado para Home Equity?",
        options: ["40%", "50%", "60%", "80%"],
        correct: 2,
        explanation: "O LTV máximo mais comum no mercado é de 60%, ou seja, o crédito não pode superar 60% do valor de avaliação do imóvel.",
      },
      {
        id: "he-q5",
        question: "Qual é o principal diferencial do Home Equity em relação ao crédito pessoal?",
        options: ["Processo mais rápido de aprovação", "Taxa de juros significativamente menor devido à garantia real", "Maior valor liberado sem comprovação de renda", "Dispensa de avaliação do imóvel"],
        correct: 1,
        explanation: "A principal vantagem do Home Equity é a taxa de juros reduzida, pois o imóvel dado em garantia reduz o risco da operação para o credor.",
      },
    ],
  },
  "estruturado": {
    categoryId: "estruturado",
    passingScore: 70,
    questions: [
      {
        id: "est-q1",
        question: "O que é um FIDC (Fundo de Investimento em Direitos Creditórios)?",
        options: ["Um banco que financia empresas em recuperação judicial", "Um fundo que adquire direitos creditórios de empresas como ativo principal", "Um fundo imobiliário com garantia de recebíveis", "Uma cooperativa de crédito para pequenas empresas"],
        correct: 1,
        explanation: "FIDC é uma modalidade de fundo de investimento que aplica seus recursos predominantemente na aquisição de direitos creditórios (recebíveis) de empresas.",
      },
      {
        id: "est-q2",
        question: "Qual a diferença entre CRI e CRA?",
        options: ["CRI é emitido por bancos, CRA por seguradoras", "CRI é lastreado em créditos imobiliários, CRA em créditos do agronegócio", "CRI é de curto prazo, CRA de longo prazo", "Não há diferença relevante entre eles"],
        correct: 1,
        explanation: "CRI (Certificado de Recebíveis Imobiliários) é lastreado em créditos imobiliários, enquanto CRA é lastreado em créditos do agronegócio.",
      },
      {
        id: "est-q3",
        question: "Qual é o valor mínimo típico para operações de crédito estruturado?",
        options: ["R$ 100 mil", "R$ 500 mil", "R$ 1 milhão", "R$ 10 milhões"],
        correct: 2,
        explanation: "Operações de crédito estruturado geralmente têm ticket mínimo a partir de R$ 1 milhão, sendo mais comum a partir de R$ 5 milhões.",
      },
      {
        id: "est-q4",
        question: "O que são precatórios no contexto do crédito estruturado?",
        options: ["Dívidas de empresas em falência", "Direitos de crédito contra o poder público reconhecidos judicialmente", "Multas aplicadas pelo Banco Central", "Débitos tributários parcelados com o governo"],
        correct: 1,
        explanation: "Precatórios são requisições de pagamento expedidas pelo Judiciário para que entes públicos paguem débitos reconhecidos por sentença judicial.",
      },
      {
        id: "est-q5",
        question: "Qual instrumento a V3 Partners usa para estruturar a cessão de precatórios?",
        options: ["CDB", "LCA", "CCB (Cédula de Crédito Bancário)", "Securitização via FIDC ou CRI"],
        correct: 3,
        explanation: "A V3 Partners utiliza a estrutura de securitização via FIDC ou CRI para operacionalizar a cessão de precatórios, garantindo liquidez e segurança jurídica.",
      },
    ],
  },
  "high-ticket": {
    categoryId: "high-ticket",
    passingScore: 70,
    questions: [
      {
        id: "ht-q1",
        question: "Qual é o valor mínimo de uma operação High Ticket na plataforma V3 Partners?",
        options: ["R$ 1 milhão", "R$ 2 milhões", "R$ 5 milhões", "R$ 10 milhões"],
        correct: 2,
        explanation: "Na V3 Partners, operações High Ticket são definidas a partir de R$ 5 milhões, atendidas na Mesa de Crédito Nível 3.",
      },
      {
        id: "ht-q2",
        question: "Qual perfil de cliente é mais adequado para operações High Ticket?",
        options: ["Pessoa física assalariada com renda mensal até R$ 10 mil", "PMEs e empresas com faturamento acima de R$ 5 milhões/ano", "Micro empreendedores individuais (MEI)", "Pessoa física sem comprovação de renda"],
        correct: 1,
        explanation: "Operações High Ticket são direcionadas para PMEs, empresas sólidas e pessoas físicas de alta renda, com histórico e garantias compatíveis com o ticket.",
      },
      {
        id: "ht-q3",
        question: "Quais garantias são mais aceitas em operações High Ticket?",
        options: ["Apenas fiança pessoal", "Imóveis, recebíveis, ações e ativos de alta liquidez", "Veículos e equipamentos", "Apenas carta fiança bancária"],
        correct: 1,
        explanation: "Em operações High Ticket, as garantias mais aceitas são imóveis, recebíveis, participações societárias e outros ativos de alta liquidez e valor verificável.",
      },
      {
        id: "ht-q4",
        question: "Por que é importante qualificar o cliente antes de enviar uma proposta High Ticket?",
        options: ["Para reduzir o tempo de processamento interno", "Para evitar operações sem fit, preservando a relação com credores e a reputação do partner", "Porque o sistema bloqueia automaticamente clientes inadequados", "Apenas para cumprir exigência regulatória"],
        correct: 1,
        explanation: "A qualificação rigorosa protege a credibilidade do partner junto às mesas de crédito e aumenta significativamente a taxa de aprovação das operações.",
      },
      {
        id: "ht-q5",
        question: "Qual é a comissão do Partner PRO em operações High Ticket?",
        options: ["20%", "30%", "40%", "50%"],
        correct: 3,
        explanation: "O Partner PRO recebe 50% de comissão sobre o fee da V3 Partners em todas as operações, incluindo High Ticket.",
      },
    ],
  },
  "ma": {
    categoryId: "ma",
    passingScore: 70,
    questions: [
      {
        id: "ma-q1",
        question: "O que significa M&A no contexto de finanças corporativas?",
        options: ["Marketing & Advertising", "Mergers & Acquisitions (Fusões e Aquisições)", "Money & Assets", "Management & Audit"],
        correct: 1,
        explanation: "M&A (Mergers & Acquisitions) refere-se ao processo de fusões e aquisições de empresas, envolvendo negociação, due diligence, avaliação e integração.",
      },
      {
        id: "ma-q2",
        question: "O que é o EBITDA e por que é importante em processos de M&A?",
        options: ["É o lucro líquido após todos os impostos", "É o resultado operacional antes de juros, impostos, depreciação e amortização — base para valuation", "É o faturamento bruto da empresa", "É o fluxo de caixa distribuído aos acionistas"],
        correct: 1,
        explanation: "EBITDA é o principal indicador para valuation em M&A, pois representa a geração de caixa operacional da empresa independentemente de sua estrutura de capital.",
      },
      {
        id: "ma-q3",
        question: "O que é due diligence em um processo de M&A?",
        options: ["Negociação do preço de compra", "Investigação detalhada dos aspectos financeiros, jurídicos e operacionais da empresa-alvo", "Elaboração do contrato final", "Apresentação da empresa para compradores"],
        correct: 1,
        explanation: "Due diligence é o processo de investigação abrangente que precede o fechamento da transação, identificando riscos e confirmando as informações sobre a empresa-alvo.",
      },
      {
        id: "ma-q4",
        question: "Qual múltiplo de EBITDA é mais comum para PMEs brasileiras em M&A?",
        options: ["1x a 2x", "3x a 5x", "8x a 12x", "15x a 20x"],
        correct: 1,
        explanation: "Para PMEs brasileiras, o múltiplo de EBITDA mais comum situa-se entre 3x e 5x, podendo variar conforme setor, crescimento e margens da empresa.",
      },
      {
        id: "ma-q5",
        question: "Como a V3 Partners se posiciona no processo de M&A para o partner?",
        options: ["O partner fecha o deal sozinho sem suporte", "O partner origina a oportunidade; a V3 conduz o processo e paga comissão ao partner", "A V3 origina e o partner apenas assina documentos", "O partner é o comprador direto das empresas"],
        correct: 1,
        explanation: "Na V3, o partner origina o deal e a equipe V3 conduz o processo completo de M&A, dividindo o fee de sucesso com o partner.",
      },
    ],
  },
  "consorcio": {
    categoryId: "consorcio",
    passingScore: 70,
    questions: [
      {
        id: "con-q1",
        question: "O que é um consórcio e como se diferencia do financiamento?",
        options: ["São iguais, apenas com nomes diferentes", "Consórcio é uma poupança em grupo sem juros; financiamento tem juros e crédito imediato", "Consórcio garante crédito imediato igual ao financiamento", "Financiamento não tem custo; consórcio tem taxa de administração"],
        correct: 1,
        explanation: "No consórcio, um grupo poupa em conjunto sem juros. O crédito não é imediato — depende de sorteio ou lance. No financiamento há juros mas o crédito é imediato.",
      },
      {
        id: "con-q2",
        question: "O que é uma 'carta contemplada' no consórcio?",
        options: ["Uma carta de intenção de compra de imóvel", "Uma cota de consórcio já contemplada que pode ser adquirida no mercado secundário com acesso imediato ao crédito", "Um documento de garantia exigido pela administradora", "Um extrato do grupo de consórcio"],
        correct: 1,
        explanation: "Carta contemplada é uma cota que já foi sorteada ou dada por lance, cujo crédito está liberado e pode ser adquirida no mercado secundário, geralmente com desconto.",
      },
      {
        id: "con-q3",
        question: "Qual órgão regulamenta o consórcio no Brasil?",
        options: ["SUSEP", "Banco Central do Brasil (BACEN)", "CVM", "ANS"],
        correct: 1,
        explanation: "O Banco Central do Brasil (BACEN) regulamenta e fiscaliza as administradoras de consórcio.",
      },
      {
        id: "con-q4",
        question: "Qual a principal vantagem da carta contemplada em relação a um grupo novo?",
        options: ["Menor taxa de administração", "Acesso imediato ao crédito sem aguardar sorteio ou lance", "Isenção de imposto de renda", "Prazo de pagamento menor"],
        correct: 1,
        explanation: "A carta contemplada oferece acesso imediato ao crédito, eliminando a incerteza do sorteio e o tempo de espera.",
      },
      {
        id: "con-q5",
        question: "Como o Partner V3 pode usar o consórcio como estratégia de venda?",
        options: ["Apenas para clientes que querem comprar imóveis", "Como alternativa de crédito de baixo custo para bens, capital de giro via carta contemplada e diversificação de portfólio", "Exclusivamente para financiamentos imobiliários", "Apenas para clientes pessoa jurídica"],
        correct: 1,
        explanation: "O consórcio é versátil: imóveis, veículos, serviços e capital de giro via carta contemplada, ampliando as oportunidades do partner.",
      },
    ],
  },
  "compliance": {
    categoryId: "compliance",
    passingScore: 70,
    questions: [
      {
        id: "comp-q1",
        question: "O que é KYC no contexto financeiro e regulatório?",
        options: ["Keep Your Capital — manter reservas de capital", "Know Your Customer — processo de verificação e identificação do cliente", "Key Yield Certificate — certificado de rendimento", "Kinetic Yield Control — controle de retorno"],
        correct: 1,
        explanation: "KYC (Know Your Customer) é o processo obrigatório de identificação e verificação dos clientes, exigido pela regulamentação brasileira para prevenir lavagem de dinheiro.",
      },
      {
        id: "comp-q2",
        question: "O que é PLD e por que o partner deve conhecê-la?",
        options: ["Uma forma de otimizar o planejamento tributário", "Conjunto de regras obrigatórias para detectar e reportar operações suspeitas de lavagem de dinheiro ou financiamento ao terrorismo", "Um produto de seguro financeiro", "Uma modalidade de crédito para pequenas empresas"],
        correct: 1,
        explanation: "PLD é a estrutura regulatória para combater lavagem de dinheiro. O partner deve conhecê-la para identificar clientes suspeitos e não incorrer em responsabilidade.",
      },
      {
        id: "comp-q3",
        question: "Qual lei brasileira regulamenta a prevenção à lavagem de dinheiro?",
        options: ["Lei 8.078/1990", "Lei 9.613/1998 e alterações (Lei de Lavagem de Dinheiro)", "Lei 6.404/1976", "Lei 11.101/2005"],
        correct: 1,
        explanation: "A Lei 9.613/1998, com alterações pela Lei 12.683/2012, é o marco regulatório central da prevenção à lavagem de dinheiro no Brasil.",
      },
      {
        id: "comp-q4",
        question: "O que é uma PEP (Pessoa Exposta Politicamente)?",
        options: ["Uma pessoa com alto patrimônio que merece tratamento VIP", "Agentes políticos, seus familiares e associados que exigem diligência reforçada", "Estrangeiros que investem no Brasil", "Empresas listadas na bolsa de valores"],
        correct: 1,
        explanation: "PEP é qualquer pessoa que exerce ou exerceu função pública relevante. Operações envolvendo PEPs requerem Enhanced Due Diligence por maior risco de corrupção.",
      },
      {
        id: "comp-q5",
        question: "Quais são as responsabilidades do partner V3 em relação ao compliance?",
        options: ["Nenhuma — apenas a V3 é responsável", "Qualificar os clientes corretamente, não participar de operações suspeitas e reportar irregularidades à V3", "Apenas assinar contratos de confidencialidade", "Somente garantir que os documentos estejam completos"],
        correct: 1,
        explanation: "O partner tem responsabilidade compartilhada: deve qualificar clientes, identificar red flags e reportar qualquer suspeita à equipe V3.",
      },
    ],
  },
};

export function getQuiz(categoryId: string): CategoryQuiz | null {
  return ACADEMY_QUIZZES[categoryId] ?? null;
}
