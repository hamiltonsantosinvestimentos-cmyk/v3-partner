import type { Alerta } from "@/lib/analise-estruturada/calculo";

// Plano de ação do parecer (entrega 4): cada ponto de atenção do motor de cálculo vira uma
// ação com prazo. Regra fixa por tema, sem IA; a Mesa complementa no comentário do analista.

export interface AcaoPlano { tema: string; achado: string; acao: string; prazo: string; nivel: Alerta["nivel"] }

const POR_TEMA: Record<string, { acao: string; prazo: string }> = {
  Capacidade: { acao: "Reduzir o serviço da dívida antes de nova operação: alongar prazos ou consolidar dívidas caras em uma linha com carência e garantia.", prazo: "30 a 90 dias" },
  Estresse: { acao: "Montar reserva de caixa e preferir operação com carência e parcelas ajustadas à sazonalidade, para suportar queda de receita.", prazo: "30 a 90 dias" },
  Caixa: { acao: "Reduzir o capital de giro preso: renegociar prazo com fornecedores, encurtar o prazo de recebimento e girar estoque mais rápido.", prazo: "30 a 90 dias" },
  Consistência: { acao: "Concentrar todo o faturamento nas contas da empresa e alinhar demonstrativos, declarações ao Fisco e extratos com o contador.", prazo: "90 a 180 dias" },
  Governança: { acao: "Separar as contas da empresa e dos sócios, fixar pró-labore e limitar a distribuição de lucros ao lucro gerado.", prazo: "30 a 90 dias" },
  Liquidez: { acao: "Reforçar o capital de giro trocando dívida de curto prazo por longo prazo.", prazo: "30 a 90 dias" },
  Endividamento: { acao: "Reduzir a alavancagem antes de novas dívidas: amortizar com sobra de caixa ou alongar o perfil da dívida.", prazo: "90 a 180 dias" },
  "Capital de giro": { acao: "Financiar o capital de giro com recursos de longo prazo (linha com garantia ou recebíveis) e não com cheque especial.", prazo: "30 a 90 dias" },
  Resultado: { acao: "Revisar preço, mix e estrutura de custos com metas trimestrais para voltar a gerar EBITDA positivo.", prazo: "90 a 180 dias" },
  Fiscal: { acao: "Regularizar tributos em atraso por parcelamento e emitir as certidões negativas (ou positivas com efeito de negativa).", prazo: "0 a 30 dias" },
  Receita: { acao: "Entender a causa da queda de receita e apresentar plano comercial; o financiador vai perguntar.", prazo: "30 a 90 dias" },
  Documentos: { acao: "Enviar os documentos que faltam para a análise ficar completa e o parecer ganhar confiança.", prazo: "Imediato" },
  Custos: { acao: "Levar ao gerente de cada banco a lista do raio-X de custos e negociar ou cancelar o que não é necessário.", prazo: "0 a 30 dias" },
};

export function planoDeAcao(alertas: Alerta[]): AcaoPlano[] {
  const vistos = new Set<string>();
  const plano: AcaoPlano[] = [];
  for (const a of alertas) {
    const regra = POR_TEMA[a.tema];
    if (!regra) continue;
    const chave = `${a.tema}|${regra.acao}`;
    if (vistos.has(chave)) { plano.find((p) => `${p.tema}|${p.acao}` === chave)!.achado += ` ${a.texto}`; continue; }
    vistos.add(chave);
    plano.push({ tema: a.tema, achado: a.texto, acao: regra.acao, prazo: regra.prazo, nivel: a.nivel });
  }
  const ordemPrazo = (p: string) => (p === "Imediato" ? 0 : p.startsWith("0") ? 1 : p.startsWith("30") ? 2 : 3);
  return plano.sort((a, b) => ordemPrazo(a.prazo) - ordemPrazo(b.prazo));
}
