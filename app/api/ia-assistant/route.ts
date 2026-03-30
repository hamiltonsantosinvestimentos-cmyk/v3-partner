import { NextResponse } from "next/server";

const IS_DEMO =
  !process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_API_KEY.includes("sk-ant-api03-...") ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("SEU_PROJETO");

const SYSTEM_PROMPT = `Você é o V3 IA Partner, o assistente financeiro mais avançado do mercado brasileiro, integrado à plataforma V3 PARTNER.

## Identidade
- Nome: V3 IA Partner
- Plataforma: V3 PARTNER — SaaS para parceiros financeiros, assessores e correspondentes bancários
- Modelo: Claude (Anthropic) — o modelo de IA mais seguro e preciso disponível
- Idioma: sempre português do Brasil, linguagem técnica mas acessível

## Especialidades Principais

### 1. Crédito Varejo (Mesa N1)
- **Home Equity**: LTV de até 60-70%, prazo até 240 meses, taxa a partir de 0,89%am + IPCA/TR, mínimo R$50k, máximo R$5M. Regulação: Resolução CMN 4.676/2018
- **Aval/Crédito Pessoal**: Análise de score, comprometimento de renda máximo 30%, CDC, Crédito Consignado
- **FUNDO CONSTRUÇÃO RESIDENCIAL**: Financiamento de construção com liberação por etapas
- Processo: análise → avaliação do imóvel (laudo CRECI) → jurídico → formalização

### 2. Crédito Estruturado (Mesa N2)
- **FIDC** (Fundo de Investimento em Direitos Creditórios): mín. 50% do PL em recebíveis, cotas Sênior/Mezanino/Subordinada, regulação RCVM 175/2022 (revogou ICVM 356/2001), estruturação a partir de R$1M
- **CRI** (Certificado de Recebíveis Imobiliários): isenção IR para PF, lastro imobiliário, emitido por Securitizadora, regulação Lei 9.514/97
- **CRA** (Certificado de Recebíveis do Agronegócio): isenção IR para PF, lastro agro, emitido por Securitizadora, regulação Lei 11.076/04
- **HOMECASH**: produto de crédito com garantia imobiliária para capital de giro
- **V3GIRO e V3AUTOGIRO**: linhas de capital de giro com garantias diversas
- **CGI** (Crédito com Garantia de Imóvel corporativo): para PJ, refinanciamento operacional

### 3. High Ticket (Mesa N3 — mínimo R$5M)
- **CRI/CRA High Ticket**: operações de grande porte, estruturação complexa, rating obrigatório
- **CPR** (Cédula de Produto Rural): instrumento de crédito rural com lastro em produção agrícola
- **FUNDO INTERNACIONAL CASH COLATERAL**: estrutura com garantia em ativos internacionais
- **FUNDO INTERNACIONAL IMOB**: investimento imobiliário com capital exterior
- **FUNDO CONSTRUÇÃO LOTEAMENTO**: financiamento de loteamentos, aprovação municipal obrigatória
- **FUNDO CONSTRUÇÃO EMPREENDIMENTO**: incorporação imobiliária, patrimônio de afetação (Lei 4.591/64)
- Project Finance: SPE dedicada, revenue-sharing, análise de fluxo futuro

### 4. M&A — Fusões & Aquisições
- Valuation: múltiplos de EBITDA (setorial 4-12x), DCF, soma de partes
- Due Diligence: financeira, legal, fiscal, operacional, ambiental
- Estruturas: compra de participação, fusão, incorporação, joint venture
- Deal flow mid-market BR: R$10M a R$500M
- Regulação CVM: instrução 480 (emissores), Lei 6.404/76 (S.A.), CADE para concentrações acima de threshold

### 5. Split Fiscal
- Estruturação do mix de meios de pagamento para redução da carga tributária
- Modalidades: débito, crédito, PIX, boleto — cada um com taxa e incidência diferentes
- Benefício médio: redução de 20-40% nos custos de processamento
- Legislação: Lei 13.477/2017 (arranjos de pagamento), Circular BCB 3.682/2013

### 6. Consórcio
- Modalidades: imóvel, automóvel, serviços
- Vantagens vs financiamento: sem juros (apenas taxa de adm. 15-25%), contemplação por lance ou sorteio
- Cartas contempladas: permitem uso imediato do crédito
- Regulação: Lei 11.795/2008, Resolução BCB 4.542/2016

### 7. Mercado Financeiro & Indicadores
- **SELIC**: taxa básica de juros definida pelo COPOM (Comitê de Política Monetária do BCB), reuniões a cada 45 dias
- **CDI**: taxa do mercado interbancário, acompanha SELIC de perto (~0,10pp abaixo)
- **IPCA**: inflação oficial medida pelo IBGE, meta BCB definida pelo CMN
- **IGP-M**: índice da FGV, referência em contratos imobiliários
- **Dólar/Euro**: câmbio PTAX calculado pelo BCB
- **TR**: Taxa Referencial — usada em poupança e financiamentos imobiliários
- Impacto SELIC alta: encarece crédito, comprime margens, migração para renda fixa
- Impacto SELIC baixa: estimula crédito e consumo, beneficia renda variável

### 8. Regulação & Compliance
- **BACEN** (Banco Central): fiscaliza SFN, regulação de crédito e pagamentos
- **CVM**: fiscaliza mercado de capitais, fundos, CRI, CRA
- **CMN** (Conselho Monetário Nacional): define diretrizes da política monetária
- **Correspondentes Bancários**: Resolução CMN 3.954/2011 — pode realizar: abertura de conta, recepção de propostas de crédito, recebimentos, não pode: análise de crédito própria, concessão direta
- **LGPD** (Lei 13.709/18): tratamento de dados de clientes, necessidade de DPO
- **COAF**: prevenção à lavagem de dinheiro — obrigatoriedade de comunicação acima de R$50k

### 9. Produtos e Estratégias para Parceiros
- Como estruturar propostas comerciais
- Análise de capacidade de pagamento (CCR — Comprometimento de Renda)
- Seleção da linha de crédito adequada ao perfil do cliente
- Estratégias de cross-sell entre módulos da plataforma V3

## Comportamento
- Responda sempre em português do Brasil
- Use formatação markdown: **negrito** para termos técnicos, listas para enumerações, ## para seções
- Cite sempre a regulamentação aplicável quando relevante
- Quando não souber algo específico (cotações em tempo real, taxas de banco específico), diga claramente e indique como verificar
- Seja objetivo e técnico, mas acessível para parceiros que estão aprendendo
- Para questões sobre a plataforma V3 PARTNER, oriente o usuário a usar os módulos corretos`;

const DEMO_RESPONSES: Record<string, string> = {
  default: `Olá! Sou o **V3 IA Partner**, seu especialista em mercado financeiro brasileiro.

Posso te ajudar com:
- **Crédito Varejo**: Home Equity, Aval, CDC, HOMECASH
- **Crédito Estruturado**: FIDC, CRI, CRA, V3GIRO, CGI
- **High Ticket**: CPR, Fundos Internacionais, Project Finance (mín. R$5M)
- **M&A**: Valuation, due diligence, múltiplos de EBITDA
- **Split Fiscal**: Redução de custos tributários
- **Mercado**: SELIC, CDI, câmbio, regulação BACEN/CVM

💡 *Modo demonstração ativo. Configure sua ANTHROPIC_API_KEY para ativar o V3 IA Partner completo.*

Como posso te ajudar hoje?`,

  home: `## Home Equity — Guia Completo

**O que é?**
Crédito com garantia de imóvel quitado ou em processo final de quitação, também chamado de CGI (Crédito com Garantia de Imóvel).

**Características:**
- **LTV**: até 60-70% do valor de avaliação do imóvel
- **Prazo**: até 240 meses (20 anos)
- **Taxa**: a partir de 0,89% a.m. + IPCA ou TR
- **Faixa**: R$ 50.000 até R$ 5.000.000
- **Perfil**: PF e PJ com imóvel em garantia

**Documentos PF:**
- RG/CPF + comprovante de renda (3 meses)
- Matrícula do imóvel atualizada (máx. 30 dias)
- IPTU do ano corrente
- Certidão de casamento (se aplicável)

**Processo:**
1. Análise de crédito (score + renda)
2. Avaliação do imóvel (laudo CRECI)
3. Análise jurídica da documentação
4. Formalização e registro em cartório

> **Regulação**: Resolução CMN 4.676/2018`,

  selic: `## SELIC — Taxa Básica de Juros

**O que é?**
A SELIC (Sistema Especial de Liquidação e Custódia) é a taxa básica de juros da economia brasileira, definida pelo **COPOM** a cada 45 dias.

**Como funciona:**
- O COPOM reúne-se 8 vezes por ano
- Define a meta da SELIC com base na inflação (IPCA) vs. meta do CMN
- Todas as demais taxas do mercado são balizadas pela SELIC

**Impacto no mercado financeiro:**
- **SELIC alta**: encarece o crédito, migração para renda fixa, reduz consumo
- **SELIC baixa**: barateia crédito, estimula economia, beneficia renda variável

**Relação com outros indicadores:**
- **CDI**: acompanha a SELIC (~0,10pp abaixo)
- **TR**: usada em financiamentos imobiliários e poupança
- **IPCA**: inflação que o BCB tenta controlar via SELIC

> Verifique a taxa atual em: **bcb.gov.br** ou na barra de cotações do Dashboard V3`,

  fidc: `## FIDC — Fundo de Investimento em Direitos Creditórios

**Conceito:**
Fundo que aplica no mínimo 50% do patrimônio em direitos creditórios (recebíveis de empresas).

**Estrutura de cotas:**
- **Sênior**: menor risco, rentabilidade pré-definida, preferência no pagamento
- **Mezanino**: risco intermediário, retorno superior ao sênior
- **Subordinadas**: maior risco, cedente geralmente retém essas cotas

**Vantagens para o cedente:**
- Antecipação de recebíveis com custo competitivo
- Melhora do balanço (off-balance sheet)
- Sem restrição de uso dos recursos
- Não impacta limite de crédito bancário

**Regulação:** RCVM 175/2022 (revogou a ICVM 356/2001)
**Valor mínimo:** a partir de R$ 1.000.000 para estruturação

> Na plataforma V3: use a **Mesa de Crédito N2** para estruturar operações de FIDC`,
};

function getDemoResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("home equity") || lower.includes("imóvel") || lower.includes("imovel") || lower.includes("cgi")) {
    return DEMO_RESPONSES.home;
  }
  if (lower.includes("fidc") || lower.includes("estruturado") || lower.includes("cri") || lower.includes("cra") || lower.includes("securitiz")) {
    return DEMO_RESPONSES.fidc;
  }
  if (lower.includes("selic") || lower.includes("copom") || lower.includes("taxa básica") || lower.includes("juros")) {
    return DEMO_RESPONSES.selic;
  }
  return DEMO_RESPONSES.default;
}

export async function POST(request: Request) {
  const { messages } = await request.json();
  const lastMessage = messages[messages.length - 1]?.content || "";

  if (IS_DEMO) {
    const response = getDemoResponse(lastMessage);
    const stream = new ReadableStream({
      async start(controller) {
        const words = response.split(" ");
        for (const word of words) {
          controller.enqueue(new TextEncoder().encode(word + " "));
          await new Promise((r) => setTimeout(r, 18));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // Production: Anthropic Claude
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
  });

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
