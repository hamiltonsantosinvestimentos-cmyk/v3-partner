// Recálculo do score V3 quando o Serasa chega DEPOIS da análise (botão "Reanalisar").
// Porte exato das funções sCr / sPa / total / tier / spread do node "Calcular Score V3" do W-CREDIT
// (n8n). Os outros pilares (identidade, judicial, comportamental, setorial) já estão gravados no
// perfil e não dependem do Serasa, então só crédito e patrimonial são refeitos.
//
// Sem imports de alias de propósito: dá para rodar/validar este arquivo isolado contra um perfil
// que o próprio n8n calculou com Serasa (ver PR), garantindo que os dois caminhos batem.

export interface SerasaScoreInput {
  error?: unknown;
  disabled?: unknown;
  score_positivo?: number | null;
  pefin_count?: number;
  refin_count?: number;
  divida_vencida_count?: number;
  protesto_count?: number;
  cheque_sem_fundo_count?: number;
  acao_judicial_count?: number;
  falencia_count?: number;
}

export interface PilaresFixos {
  score_identidade: number;
  score_judicial: number;
  score_comportamental: number;
  score_setorial: number;
}

export interface ScoreRecalculado {
  score_credito: number;
  score_patrimonial: number;
  score_total: number;
  tier: "A" | "B" | "C" | "D" | "E";
  spread_min: number;
  spread_max: number;
}

export function serasaUsavel(ser: SerasaScoreInput | null | undefined): boolean {
  return !!ser && !ser.error && !ser.disabled;
}

/** Pilar crédito só com Serasa (SPC é stub no motor, então p === 1 quando o Serasa existe). */
function scoreCredito(ser: SerasaScoreInput | null | undefined): number {
  if (!serasaUsavel(ser)) return 65;
  const s = ser as SerasaScoreInput;
  let v = s.score_positivo != null ? Math.min(100, Math.max(0, s.score_positivo / 10)) : 60;
  const nd = (s.pefin_count || 0) + (s.refin_count || 0) + (s.divida_vencida_count || 0);
  if (nd > 10) v -= 30; else if (nd > 5) v -= 15; else if (nd > 0) v -= 5;
  const t = Math.max(0, v);
  return Math.min(100, Math.max(0, Math.round(t / 1)));
}

function scorePatrimonial(ser: SerasaScoreInput | null | undefined): number {
  let s = 100;
  if (serasaUsavel(ser)) {
    const x = ser as SerasaScoreInput;
    s -= (x.protesto_count || 0) * 15;
    s -= (x.cheque_sem_fundo_count || 0) * 10;
    s -= (x.acao_judicial_count || 0) * 10;
    s -= (x.falencia_count || 0) * 30;
  }
  return Math.min(100, Math.max(0, s));
}

export function recalcularScoreComSerasa(p: PilaresFixos, ser: SerasaScoreInput): ScoreRecalculado {
  const sc = scoreCredito(ser);
  const sp = scorePatrimonial(ser);
  const total = Math.round((p.score_identidade + sc + p.score_judicial + sp + p.score_comportamental + p.score_setorial) * 1000 / 600);
  const tier = total >= 800 ? "A" : total >= 650 ? "B" : total >= 500 ? "C" : total >= 350 ? "D" : "E";
  const sm = { A: [3.0, 5.0], B: [5.0, 7.5], C: [7.5, 10.0], D: [10.0, 15.0], E: [15.0, 25.0] }[tier];
  return { score_credito: sc, score_patrimonial: sp, score_total: total, tier, spread_min: sm[0], spread_max: sm[1] };
}

export interface RestricaoSerasa {
  subject_cpf_cnpj: string;
  restriction_type: string;
  descricao?: string;
  fonte: "serasa";
  score_impact: number;
}

/** Restrições que o n8n grava em asset_restrictions a partir do Serasa. */
export function restricoesSerasa(subjectCpfCnpj: string, ser: SerasaScoreInput): RestricaoSerasa[] {
  const out: RestricaoSerasa[] = [];
  if (!serasaUsavel(ser)) return out;
  const c = (v: number | undefined) => v || 0;
  if (c(ser.protesto_count) > 0) out.push({ subject_cpf_cnpj: subjectCpfCnpj, restriction_type: "protesto", fonte: "serasa", score_impact: -(c(ser.protesto_count) * 15) });
  if (c(ser.cheque_sem_fundo_count) > 0) out.push({ subject_cpf_cnpj: subjectCpfCnpj, restriction_type: "cheque_sem_fundo", fonte: "serasa", score_impact: -(c(ser.cheque_sem_fundo_count) * 10) });
  if (c(ser.divida_vencida_count) > 0) out.push({ subject_cpf_cnpj: subjectCpfCnpj, restriction_type: "outro", descricao: "Divida vencida (Serasa)", fonte: "serasa", score_impact: -(c(ser.divida_vencida_count) * 10) });
  if (c(ser.pefin_count) + c(ser.refin_count) > 0) out.push({ subject_cpf_cnpj: subjectCpfCnpj, restriction_type: "outro", descricao: "Pendencia/restricao financeira (Serasa)", fonte: "serasa", score_impact: -((c(ser.pefin_count) + c(ser.refin_count)) * 8) });
  return out;
}
