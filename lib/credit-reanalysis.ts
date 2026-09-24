import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEffectiveSourceConfig, type SourceConfig } from "@/lib/credit-source-config";
import { consultarBacenScr } from "@/lib/credit-bacen";
import { corrigirNomeAnalisado } from "@/lib/credit-nome-oficial";
import { consultarSerasa } from "@/lib/serasa";
import { recalcularScoreComSerasa, restricoesSerasa } from "@/lib/credit-score";
import { generateAndStoreCreditReportPdf } from "@/lib/credit-report-generate";

// Botão "Reanalisar" (Pedidos de Partners): consulta SÓ as fontes pagas que ainda não foram
// consultadas de uma análise já existente e atualiza o MESMO perfil (não cria outro), refazendo
// o score quando o Serasa chega e regenerando o dossiê. Fontes já consultadas nunca são
// reconsultadas, então nunca geram cobrança repetida.
//
// Hoje cobre Serasa e BACEN/SCR, as duas que falhavam em silêncio: o motor (n8n) entrega o
// dossiê sem a fonte quando ela dá erro, sem avisar. Os motivos das falhas ficam gravados em
// credit_profiles.raw_result.fontes_status para a tela mostrar.

export type FonteReanalise = "serasa" | "bacen";

export const FONTE_LABEL: Record<FonteReanalise, string> = {
  serasa: "Serasa",
  bacen: "BACEN (SCR)",
};

export interface EstadoFonte {
  fonte: FonteReanalise;
  label: string;
  consultada: boolean;
  /** Ligada na config de fontes desta análise. Desligada = nem conta como pendente. */
  habilitada: boolean;
  ultimo_erro: string | null;
  /** Já consultada, mas antes de um campo novo existir (SCR sem a vencer/limites). */
  desatualizada?: boolean;
}

export interface EstadoAnalise {
  ok: true;
  proposal_id: string;
  profile_id: string;
  fontes: EstadoFonte[];
  pendentes: FonteReanalise[];
}

export type ErroReanalise = { ok: false; status: number; error: string };

interface PerfilRow {
  id: string;
  subject_type: string | null;
  subject_cpf_cnpj: string | null;
  score_identidade: number | null;
  score_judicial: number | null;
  score_comportamental: number | null;
  score_setorial: number | null;
  sources_paid: string[] | null;
  flags: Record<string, unknown> | null;
  raw_result: Record<string, unknown> | null;
  serasa_data: Record<string, unknown> | null;
  bacen_scr_data: Record<string, unknown> | null;
}

const PERFIL_COLS =
  "id, subject_type, subject_cpf_cnpj, score_identidade, score_judicial, score_comportamental, score_setorial, sources_paid, flags, raw_result, serasa_data, bacen_scr_data";

// Trava contra clique duplo: cada consulta Serasa em produção é cobrada.
const LOCK_SECONDS = 180;

async function carregar(db: SupabaseClient, proposalId: string) {
  const { data: proposal } = await db
    .from("credit_desk_proposals")
    .select("id, client_cpf_cnpj, credit_profile_id")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { ok: false as const, status: 404, error: "Proposta não encontrada" };

  let profileId: string | null = proposal.credit_profile_id;
  if (!profileId) {
    const { data: latest } = await db
      .from("credit_profiles")
      .select("id")
      .eq("deal_proposal_id", proposalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    profileId = latest?.id ?? null;
  }
  if (!profileId) {
    return { ok: false as const, status: 409, error: "Esta proposta ainda não tem análise. Use \"Rodar análise\" primeiro." };
  }

  const { data: perfil } = await db.from("credit_profiles").select(PERFIL_COLS).eq("id", profileId).single();
  if (!perfil) return { ok: false as const, status: 404, error: "Perfil de crédito não encontrado" };

  const cfg = await resolveEffectiveSourceConfig(db, proposal.client_cpf_cnpj);
  return { ok: true as const, proposal, perfil: perfil as PerfilRow, ...cfg };
}

function montarFontes(perfil: PerfilRow, cfg: SourceConfig, isPj: boolean): EstadoFonte[] {
  const status = (perfil.raw_result?.fontes_status ?? {}) as Record<string, { ok?: boolean; erro?: string }>;
  const serasaOk = !!perfil.serasa_data && !(perfil.serasa_data as { error?: unknown }).error;
  // 23/09/2026: SCR consultado antes da leitura de "crédito a vencer" e "limites" não tem
  // consolidado_bruto — conta como pendente pra o Reanalisar buscar de novo (uma vez só:
  // depois disso o consolidado_bruto existe, mesmo que o CheckTudo não traga os campos).
  const bacenOk = !!perfil.bacen_scr_data && "consolidado_bruto" in perfil.bacen_scr_data;
  return [
    {
      fonte: "serasa",
      label: FONTE_LABEL.serasa,
      consultada: serasaOk,
      habilitada: !!cfg.serasa && (isPj ? !!cfg.serasa_cnpj : true),
      ultimo_erro: !serasaOk && status.serasa?.ok === false ? status.serasa.erro ?? null : null,
    },
    {
      fonte: "bacen",
      label: FONTE_LABEL.bacen,
      consultada: bacenOk,
      desatualizada: !!perfil.bacen_scr_data && !bacenOk,
      habilitada: !!cfg.registrato_bacen,
      ultimo_erro: !bacenOk && status.bacen?.ok === false ? status.bacen.erro ?? null : null,
    },
  ];
}

/** Diz o que já foi consultado e o que falta, sem consultar nada. */
export async function estadoDaAnalise(db: SupabaseClient, proposalId: string): Promise<EstadoAnalise | ErroReanalise> {
  const c = await carregar(db, proposalId);
  if (!c.ok) return c;
  const fontes = montarFontes(c.perfil, c.effectiveSourceConfig, c.subject_type === "PJ");
  return {
    ok: true,
    proposal_id: proposalId,
    profile_id: c.perfil.id,
    fontes,
    pendentes: fontes.filter((f) => f.habilitada && !f.consultada).map((f) => f.fonte),
  };
}

export interface ResultadoReanalise {
  ok: true;
  profile_id: string;
  atualizadas: { fonte: FonteReanalise; label: string }[];
  falhas: { fonte: FonteReanalise; label: string; erro: string }[];
  pendentes_restantes: FonteReanalise[];
  score_total: number | null;
  tier: string | null;
  pdf_regenerado: boolean;
  pdf_url: string | null;
  mensagem: string;
}

/** Dependências externas injetáveis (só para teste: as reais são o padrão). */
export interface ReanaliseDeps {
  serasa?: typeof consultarSerasa;
  bacen?: typeof consultarBacenScr;
  gerarPdf?: typeof generateAndStoreCreditReportPdf;
}

/** Consulta só o que falta, atualiza o mesmo perfil e regenera o dossiê. */
export async function reanalisarPendentes(
  db: SupabaseClient,
  proposalId: string,
  deps: ReanaliseDeps = {}
): Promise<ResultadoReanalise | ErroReanalise> {
  const fSerasa = deps.serasa ?? consultarSerasa;
  const fBacen = deps.bacen ?? consultarBacenScr;
  const fPdf = deps.gerarPdf ?? generateAndStoreCreditReportPdf;
  const c = await carregar(db, proposalId);
  if (!c.ok) return c;
  const { perfil, rawDoc, effectiveSourceConfig: cfg } = c;
  const isPj = c.subject_type === "PJ";

  const fontes = montarFontes(perfil, cfg, isPj);
  const pendentes = fontes.filter((f) => f.habilitada && !f.consultada);
  if (pendentes.length === 0) {
    return {
      ok: true, profile_id: perfil.id, atualizadas: [], falhas: [], pendentes_restantes: [],
      score_total: null, tier: null, pdf_regenerado: false, pdf_url: null,
      mensagem: "Todas as fontes já foram consultadas. Nada a reanalisar.",
    };
  }

  // Trava (a consulta do Serasa é cobrada em produção)
  const lockAt = perfil.raw_result?.reanalise_lock as string | undefined;
  if (lockAt && Date.now() - new Date(lockAt).getTime() < LOCK_SECONDS * 1000) {
    return { ok: false, status: 409, error: "Já existe uma reanálise em andamento para esta análise. Aguarde alguns instantes." };
  }
  await db.from("credit_profiles")
    .update({ raw_result: { ...(perfil.raw_result ?? {}), reanalise_lock: new Date().toISOString() } })
    .eq("id", perfil.id);

  const executar = async (): Promise<ResultadoReanalise> => {
  const now = new Date().toISOString();
  const statusNovo: Record<string, { ok: boolean; erro?: string; em: string }> = {};
  const atualizadas: ResultadoReanalise["atualizadas"] = [];
  const falhas: ResultadoReanalise["falhas"] = [];
  const update: Record<string, unknown> = {};
  let raw: Record<string, unknown> = { ...(perfil.raw_result ?? {}) };
  let sourcesPaid = [...(perfil.sources_paid ?? [])];
  let flags = { ...(perfil.flags ?? {}) };

  // As duas fontes são independentes: consulta em paralelo.
  const consultas = await Promise.all(
    pendentes.map(async (f) => {
      if (f.fonte === "serasa") {
        return { fonte: f.fonte, r: await fSerasa({ doc: rawDoc, isPj, modalidade: cfg.serasa_modalidade }) };
      }
      return { fonte: f.fonte, r: await fBacen(isPj ? "cnpj" : "cpf", rawDoc) };
    })
  );

  for (const { fonte, r } of consultas) {
    const label = FONTE_LABEL[fonte];
    if (!r.ok) {
      falhas.push({ fonte, label, erro: r.error });
      statusNovo[fonte] = { ok: false, erro: r.error.slice(0, 500), em: now };
      continue;
    }
    statusNovo[fonte] = { ok: true, em: now };
    atualizadas.push({ fonte, label });

    if (fonte === "bacen") {
      // Referência apenas: nunca entra no Tier/score (decisão de João, 01/09/2026).
      update.bacen_scr_data = r.data;
    } else {
      const serasa = r.data;
      const rec = recalcularScoreComSerasa(
        {
          score_identidade: perfil.score_identidade ?? 0,
          score_judicial: perfil.score_judicial ?? 0,
          score_comportamental: perfil.score_comportamental ?? 0,
          score_setorial: perfil.score_setorial ?? 0,
        },
        serasa
      );
      // Restrições do Serasa: troca as do Serasa desta análise pelas novas (sem duplicar).
      await db.from("asset_restrictions").delete().eq("credit_profile_id", perfil.id).eq("fonte", "serasa");
      const novas = restricoesSerasa(perfil.subject_cpf_cnpj ?? rawDoc, serasa);
      if (novas.length) {
        await db.from("asset_restrictions").insert(novas.map((n) => ({ ...n, credit_profile_id: perfil.id })));
      }
      const { count } = await db.from("asset_restrictions").select("id", { count: "exact", head: true }).eq("credit_profile_id", perfil.id);

      Object.assign(update, { serasa_data: serasa, ...rec });
      if (!sourcesPaid.includes("serasa")) sourcesPaid = [...sourcesPaid, "serasa"];
      flags = { ...flags, has_restrictions: (count ?? 0) > 0, apis_stubbed: false };
      raw = { ...raw, serasa_report_used: serasa.report_used };
    }
  }

  raw = {
    ...raw,
    reanalise_lock: null,
    fontes_status: { ...((raw.fontes_status as object | undefined) ?? {}), ...statusNovo },
  };
  await db.from("credit_profiles")
    .update({ ...update, sources_paid: sourcesPaid, flags, raw_result: raw })
    .eq("id", perfil.id);

  // Serasa novo pode trazer o nome oficial (CPF/CNPJ): troca o digitado antes do dossiê.
  const nome = atualizadas.length ? await corrigirNomeAnalisado(db, perfil.id).catch(() => ({ corrigido: false })) : { corrigido: false };

  // Dossiê refeito só se algo novo entrou
  let pdf: Awaited<ReturnType<typeof fPdf>> | null = null;
  if (atualizadas.length || nome.corrigido) {
    pdf = await fPdf(perfil.id).catch((e) => ({ ok: false as const, error: (e as Error).message }));
  }

  const restantes = falhas.map((f) => f.fonte);
  const nomes = (xs: { label: string }[]) => xs.map((x) => x.label).join(" e ");
  let mensagem: string;
  if (atualizadas.length && !falhas.length) mensagem = `${nomes(atualizadas)} consultado(s) e adicionado(s) à análise.`;
  else if (atualizadas.length) mensagem = `${nomes(atualizadas)} atualizado(s); ${nomes(falhas)} não pôde ser consultado.`;
  else mensagem = `Não foi possível consultar ${nomes(falhas)}. Veja o motivo abaixo e tente novamente.`;

  return {
    ok: true,
    profile_id: perfil.id,
    atualizadas,
    falhas,
    pendentes_restantes: restantes,
    score_total: (update.score_total as number | undefined) ?? null,
    tier: (update.tier as string | undefined) ?? null,
    pdf_regenerado: !!pdf && pdf.ok,
    pdf_url: pdf && pdf.ok ? pdf.pdf_url : null,
    mensagem,
  };
  };

  // Qualquer exceção inesperada libera a trava, para não bloquear o botão por 3 minutos.
  try {
    return await executar();
  } catch (e) {
    await db.from("credit_profiles")
      .update({ raw_result: { ...(perfil.raw_result ?? {}), reanalise_lock: null } })
      .eq("id", perfil.id);
    throw e;
  }
}
