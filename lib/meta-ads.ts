// Cliente fino sobre a Graph Marketing API da Meta (Facebook/Instagram Ads).
// Usa as credenciais do system user (Business Manager) via env — nunca do
// lado do cliente. Versão da API fixada em GRAPH_API_VERSION; atualizar
// aqui quando a Meta depreciar a versão em uso (checar
// developers.facebook.com/docs/graph-api/changelog).

const GRAPH_API_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não configurado — preencha no .env.local antes de usar a Mesa de Tráfego.`);
  return v;
}

function accessToken(): string {
  return requireEnv("META_ADS_ACCESS_TOKEN");
}

function adAccountId(): string {
  // Aceita com ou sem o prefixo "act_" e normaliza.
  const raw = requireEnv("META_ADS_ACCOUNT_ID");
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

export class MetaAdsError extends Error {
  code?: number;
  subcode?: number;
  fbtraceId?: string;
  constructor(message: string, opts?: { code?: number; subcode?: number; fbtraceId?: string }) {
    super(message);
    this.name = "MetaAdsError";
    this.code = opts?.code;
    this.subcode = opts?.subcode;
    this.fbtraceId = opts?.fbtraceId;
  }
}

type MetaErrorBody = { error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string } };

async function graphRequest<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; params?: Record<string, string | number | undefined>; body?: Record<string, unknown> } = {}
): Promise<T> {
  const method = opts.method ?? "GET";
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", accessToken());
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const init: RequestInit = { method };
  if (method === "POST" && opts.body) {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.body)) {
      if (v === undefined) continue;
      form.set(k, typeof v === "string" ? v : JSON.stringify(v));
    }
    init.body = form;
  }

  const res = await fetch(url.toString(), init);
  const json = (await res.json()) as T & MetaErrorBody;

  if (!res.ok || json.error) {
    const err = json.error;
    throw new MetaAdsError(err?.message ?? `Erro HTTP ${res.status} na Graph API`, {
      code: err?.code,
      subcode: err?.error_subcode,
      fbtraceId: err?.fbtrace_id,
    });
  }
  return json;
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type CampaignObjective =
  | "OUTCOME_AWARENESS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_LEADS"
  | "OUTCOME_SALES"
  | "OUTCOME_APP_PROMOTION";

export type EntityStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";

export interface CampaignSummary {
  id: string;
  name: string;
  objective: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
}

export interface InsightsRow {
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
  date_start?: string;
  date_stop?: string;
}

// ─── Campanhas ──────────────────────────────────────────────────────────────

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const data = await graphRequest<{ data: CampaignSummary[] }>(`/${adAccountId()}/campaigns`, {
    params: { fields: "id,name,objective,status,daily_budget,lifetime_budget,created_time", limit: 100 },
  });
  return data.data;
}

export async function createCampaign(input: {
  name: string;
  objective: CampaignObjective;
  status?: EntityStatus;
  specialAdCategories?: string[];
}): Promise<{ id: string }> {
  return graphRequest(`/${adAccountId()}/campaigns`, {
    method: "POST",
    body: {
      name: input.name,
      objective: input.objective,
      status: input.status ?? "PAUSED",
      special_ad_categories: input.specialAdCategories ?? [],
    },
  });
}

// ─── Ad Sets ────────────────────────────────────────────────────────────────

export async function createAdSet(input: {
  campaignId: string;
  name: string;
  dailyBudgetCentavos: number;
  billingEvent?: "IMPRESSIONS" | "LINK_CLICKS";
  optimizationGoal?: string;
  targeting: Record<string, unknown>;
  status?: EntityStatus;
}): Promise<{ id: string }> {
  return graphRequest(`/${adAccountId()}/adsets`, {
    method: "POST",
    body: {
      name: input.name,
      campaign_id: input.campaignId,
      daily_budget: input.dailyBudgetCentavos,
      billing_event: input.billingEvent ?? "IMPRESSIONS",
      optimization_goal: input.optimizationGoal ?? "REACH",
      targeting: input.targeting,
      status: input.status ?? "PAUSED",
    },
  });
}

// ─── Criativos e anúncios ───────────────────────────────────────────────────

export async function createAdCreative(input: {
  name: string;
  pageId: string;
  message: string;
  link: string;
  linkTitle?: string;
  imageHash?: string;
}): Promise<{ id: string }> {
  return graphRequest(`/${adAccountId()}/adcreatives`, {
    method: "POST",
    body: {
      name: input.name,
      object_story_spec: {
        page_id: input.pageId,
        link_data: {
          message: input.message,
          link: input.link,
          name: input.linkTitle,
          image_hash: input.imageHash,
        },
      },
    },
  });
}

export async function createAd(input: {
  name: string;
  adSetId: string;
  creativeId: string;
  status?: EntityStatus;
}): Promise<{ id: string }> {
  return graphRequest(`/${adAccountId()}/ads`, {
    method: "POST",
    body: {
      name: input.name,
      adset_id: input.adSetId,
      creative: { creative_id: input.creativeId },
      status: input.status ?? "PAUSED",
    },
  });
}

// ─── Controles (pausar, ativar, orçamento) ─────────────────────────────────

export async function setStatus(objectId: string, status: EntityStatus): Promise<{ success: boolean }> {
  return graphRequest(`/${objectId}`, { method: "POST", body: { status } });
}

export async function setDailyBudget(objectId: string, dailyBudgetCentavos: number): Promise<{ success: boolean }> {
  return graphRequest(`/${objectId}`, { method: "POST", body: { daily_budget: dailyBudgetCentavos } });
}

// ─── Métricas ───────────────────────────────────────────────────────────────

export async function getInsights(
  objectId: string,
  opts: { datePreset?: string; since?: string; until?: string } = {}
): Promise<InsightsRow[]> {
  const params: Record<string, string> = {
    fields: "impressions,clicks,spend,ctr,cpc,reach,date_start,date_stop",
  };
  if (opts.since && opts.until) {
    params.time_range = JSON.stringify({ since: opts.since, until: opts.until });
  } else {
    params.date_preset = opts.datePreset ?? "last_7d";
  }
  const data = await graphRequest<{ data: InsightsRow[] }>(`/${objectId}/insights`, { params });
  return data.data;
}

// ─── Upload de imagem (pra usar em criativos) ──────────────────────────────

export async function uploadImageFromUrl(imageUrl: string): Promise<{ hash: string }> {
  const data = await graphRequest<{ images: Record<string, { hash: string }> }>(`/${adAccountId()}/adimages`, {
    method: "POST",
    body: { url: imageUrl },
  });
  const first = Object.values(data.images)[0];
  if (!first) throw new MetaAdsError("Upload de imagem não retornou hash.");
  return { hash: first.hash };
}
