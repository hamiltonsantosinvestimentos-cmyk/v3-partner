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
      // Obrigatório desde a v26.0 quando o orçamento é definido no ad set (não
      // na campanha) — sem isso a API recusa com "Invalid parameter" (subcode
      // 4834011). false = cada ad set usa só o próprio orçamento, sem
      // compartilhar 20% com os outros ad sets da campanha (Advantage
      // campaign budget).
      is_adset_budget_sharing_enabled: false,
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
  bidStrategy?: "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP";
  // Click-to-WhatsApp: quando definido, o clique no anúncio abre uma conversa
  // no WhatsApp em vez de um link/site. whatsappPhoneNumber precisa estar
  // vinculado à Página nos Anúncios (Business Suite > Configurações >
  // Contas do WhatsApp) — senão a criação falha com erro de permissão.
  destinationType?: "WHATSAPP";
  promotedObject?: { pageId: string; whatsappPhoneNumber?: string };
}): Promise<{ id: string }> {
  const targeting = input.destinationType === "WHATSAPP" && input.targeting.targeting_automation === undefined
    // Obrigatório em CTWA (subcode 1870227) -- 0 = não deixa a Meta expandir
    // o público além do que foi definido em targeting.
    ? { ...input.targeting, targeting_automation: { advantage_audience: 0 } }
    : input.targeting;

  return graphRequest(`/${adAccountId()}/adsets`, {
    method: "POST",
    body: {
      name: input.name,
      campaign_id: input.campaignId,
      daily_budget: input.dailyBudgetCentavos,
      billing_event: input.billingEvent ?? "IMPRESSIONS",
      optimization_goal: input.optimizationGoal ?? (input.destinationType === "WHATSAPP" ? "CONVERSATIONS" : "REACH"),
      bid_strategy: input.bidStrategy ?? "LOWEST_COST_WITHOUT_CAP",
      targeting,
      status: input.status ?? "PAUSED",
      destination_type: input.destinationType,
      promoted_object: input.promotedObject
        ? { page_id: input.promotedObject.pageId, whatsapp_phone_number: input.promotedObject.whatsappPhoneNumber }
        : undefined,
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

// Upload de vídeo por URL remota (ex: media_url de um post do Instagram) —
// a Meta baixa o arquivo ela mesma, não precisa passar pelo nosso servidor.
// Usa graph-video.facebook.com (host separado do resto da Marketing API,
// dedicado a upload de mídia grande) em vez de graphRequest/GRAPH_BASE.
export async function uploadVideoFromUrl(input: { name: string; fileUrl: string }): Promise<{ id: string }> {
  const url = new URL(`https://graph-video.facebook.com/${GRAPH_API_VERSION}/${adAccountId()}/advideos`);
  url.searchParams.set("access_token", accessToken());
  const form = new URLSearchParams({ name: input.name, file_url: input.fileUrl });
  const res = await fetch(url.toString(), { method: "POST", body: form });
  const json = (await res.json()) as { id?: string } & MetaErrorBody;
  if (!res.ok || json.error || !json.id) {
    const err = json.error;
    throw new MetaAdsError(err?.message ?? `Erro HTTP ${res.status} no upload de vídeo`, { code: err?.code, subcode: err?.error_subcode, fbtraceId: err?.fbtrace_id });
  }
  return { id: json.id };
}

export type VideoProcessingStatus = "ready" | "processing" | "error" | "upload_failed" | string;

// Vídeo grande demora a processar depois do upload -- consultar antes de
// usar video_id num criativo, senão a Meta recusa (vídeo ainda não pronto).
export async function getVideoStatus(videoId: string): Promise<VideoProcessingStatus> {
  const data = await graphRequest<{ status?: { video_status?: string } }>(`/${videoId}`, {
    params: { fields: "status" },
  });
  return data.status?.video_status ?? "processing";
}

// Criativo "Clique para o WhatsApp" a partir de um vídeo (reaproveita um
// vídeo já enviado via uploadVideoFromUrl) -- o clique no anúncio abre uma
// conversa no WhatsApp em vez de um link. Detalhe que só se descobre na
// prática (erro subcode 1815630): o campo "link" NÃO pode ir dentro de
// call_to_action.value aqui (diferente de outros fluxos de CTWA que pedem
// esse link) -- só app_destination.
//
// Nota: reaproveitar diretamente um vídeo ORGÂNICO do Instagram como
// criativo (via source_instagram_media_id) falha com "O vídeo do Instagram
// deve ser carregado no Facebook" (subcode 1815279) -- por isso o vídeo
// precisa passar por uploadVideoFromUrl primeiro (pegando a media_url do
// post via Instagram Graph API) e só depois entrar aqui como video_id.
export async function createWhatsAppVideoAdCreative(input: {
  name: string;
  pageId: string;
  videoId: string;
  thumbnailUrl: string;
  message: string;
}): Promise<{ id: string }> {
  return graphRequest(`/${adAccountId()}/adcreatives`, {
    method: "POST",
    body: {
      name: input.name,
      object_story_spec: {
        page_id: input.pageId,
        video_data: {
          video_id: input.videoId,
          image_url: input.thumbnailUrl,
          message: input.message,
          call_to_action: { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } },
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
