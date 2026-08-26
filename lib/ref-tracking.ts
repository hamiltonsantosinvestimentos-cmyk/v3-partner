"use client";

const REF_STORAGE_KEY = "v3_ref_partner_id";
const UTM_STORAGE_KEY = "v3_utm_params";
const PROP_STORAGE_KEY = "v3_prop_proposal_code";
const REF_TTL_DAYS = 30;

interface StoredRef {
  partnerId: string;
  capturedAt: number;
}

interface StoredUtm {
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  capturedAt: number;
}

export function captureRefFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref) return;

  const payload: StoredRef = { partnerId: ref, capturedAt: Date.now() };
  try {
    window.localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage indisponível (modo privado, etc): segue sem atribuição
  }
}

export function getStoredRefPartnerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRef;
    const ageMs = Date.now() - parsed.capturedAt;
    if (ageMs > REF_TTL_DAYS * 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(REF_STORAGE_KEY);
      return null;
    }
    return parsed.partnerId || null;
  } catch {
    return null;
  }
}

interface StoredProp {
  code: string;
  capturedAt: number;
}

// Link de Análise de Crédito gerado por proposta (?prop=<code> em /analise-v2),
// pra distinguir de ?ref= (identifica o partner, não a proposta). Mesmo TTL e
// storage local do ref -- se o pedido acabar sendo pago fora da mesma aba/sessão
// que abriu o link, cai no fluxo manual de vínculo em "Pedidos de Partners".
export function capturePropFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const prop = params.get("prop");
  if (!prop) return;

  const payload: StoredProp = { code: prop, capturedAt: Date.now() };
  try {
    window.localStorage.setItem(PROP_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage indisponível (modo privado, etc): segue sem o vínculo automático
  }
}

export function getStoredPropCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredProp;
    const ageMs = Date.now() - parsed.capturedAt;
    if (ageMs > REF_TTL_DAYS * 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(PROP_STORAGE_KEY);
      return null;
    }
    return parsed.code || null;
  } catch {
    return null;
  }
}

export function captureUtmFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const utm_source = params.get("utm_source");
  const utm_campaign = params.get("utm_campaign");
  const utm_medium = params.get("utm_medium");
  if (!utm_source && !utm_campaign && !utm_medium) return;

  const payload: StoredUtm = { utm_source, utm_campaign, utm_medium, capturedAt: Date.now() };
  try {
    window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage indisponível (modo privado, etc): segue sem os parâmetros de campanha
  }
}

export function getStoredUtm(): { utm_source: string | null; utm_campaign: string | null; utm_medium: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUtm;
    const ageMs = Date.now() - parsed.capturedAt;
    if (ageMs > REF_TTL_DAYS * 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(UTM_STORAGE_KEY);
      return null;
    }
    return { utm_source: parsed.utm_source, utm_campaign: parsed.utm_campaign, utm_medium: parsed.utm_medium };
  } catch {
    return null;
  }
}
