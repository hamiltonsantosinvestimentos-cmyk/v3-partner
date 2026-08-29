// Camada de IA multi-provedor do Agente SDR.
// Adaptado da ideia do packages/ai do ChatbotX (registry de modelos + chamada
// unificada), mas enxuto pro stack da V3: o ramo Anthropic usa o SDK oficial
// (@anthropic-ai/sdk); OpenAI, OpenRouter e Google usam a REST API própria de
// cada um via fetch (OpenRouter é OpenAI-compatível de verdade — não é shim
// pra Claude). Nunca chamar Claude por endpoint OpenAI-compatível.

import Anthropic from "@anthropic-ai/sdk";

export type AiProvider = "anthropic" | "openai" | "openrouter" | "google";

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  google: "Google (Gemini)",
};

export interface AiModelInfo {
  id: string;
  label: string;
  /** dica de custo/velocidade pra UI */
  tier: "rápido" | "equilibrado" | "avançado";
}

// Catálogo curado. IDs Anthropic conferidos com a skill claude-api (sem sufixo
// de data). Ajustar aqui quando sair modelo novo — a UI lê deste objeto.
export const AI_MODELS: Record<AiProvider, AiModelInfo[]> = {
  anthropic: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", tier: "rápido" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", tier: "equilibrado" },
    { id: "claude-opus-5", label: "Claude Opus 5", tier: "avançado" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "rápido" },
    { id: "gpt-4o", label: "GPT-4o", tier: "equilibrado" },
    { id: "gpt-4.1", label: "GPT-4.1", tier: "avançado" },
  ],
  openrouter: [
    { id: "openai/gpt-4o-mini", label: "OpenRouter · GPT-4o mini", tier: "rápido" },
    { id: "anthropic/claude-3.5-sonnet", label: "OpenRouter · Claude 3.5 Sonnet", tier: "equilibrado" },
    { id: "meta-llama/llama-3.3-70b-instruct", label: "OpenRouter · Llama 3.3 70B", tier: "equilibrado" },
  ],
  google: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", tier: "rápido" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", tier: "avançado" },
  ],
};

export function isValidModel(provider: AiProvider, model: string): boolean {
  return (AI_MODELS[provider] ?? []).some((m) => m.id === model);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatParams {
  provider: AiProvider;
  model: string;
  apiKey: string;
  system?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** aborta a chamada se passar disso (ms) */
  timeoutMs?: number;
}

export interface ChatResult {
  text: string;
  provider: AiProvider;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly provider: AiProvider,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

/** Chamada unificada de chat completion. Lança AiProviderError em falha. */
export async function chatComplete(p: ChatParams): Promise<ChatResult> {
  const temperature = p.temperature ?? 0.6;
  const maxTokens = p.maxTokens ?? 1024;
  const timeoutMs = p.timeoutMs ?? 30_000;

  switch (p.provider) {
    case "anthropic":
      return chatAnthropic(p, temperature, maxTokens, timeoutMs);
    case "openai":
      return chatOpenAiCompatible(p, temperature, maxTokens, timeoutMs, "https://api.openai.com/v1");
    case "openrouter":
      return chatOpenAiCompatible(p, temperature, maxTokens, timeoutMs, "https://openrouter.ai/api/v1");
    case "google":
      return chatGoogle(p, temperature, maxTokens, timeoutMs);
    default:
      throw new AiProviderError(`Provedor não suportado: ${p.provider}`, p.provider);
  }
}

async function chatAnthropic(
  p: ChatParams,
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
): Promise<ChatResult> {
  const client = new Anthropic({ apiKey: p.apiKey, timeout: timeoutMs, maxRetries: 1 });
  try {
    const res = await client.messages.create({
      model: p.model,
      max_tokens: maxTokens,
      temperature,
      system: p.system,
      messages: p.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return {
      text,
      provider: "anthropic",
      model: p.model,
      usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
    };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new AiProviderError(err.message, "anthropic", err.status);
    }
    throw new AiProviderError(err instanceof Error ? err.message : "Falha na chamada Anthropic", "anthropic");
  }
}

async function chatOpenAiCompatible(
  p: ChatParams,
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
  baseUrl: string,
): Promise<ChatResult> {
  const messages: { role: string; content: string }[] = [];
  if (p.system) messages.push({ role: "system", content: p.system });
  for (const m of p.messages) messages.push({ role: m.role, content: m.content });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.apiKey}`,
        // OpenRouter recomenda estes headers; OpenAI ignora.
        "HTTP-Referer": "https://app.v3partners.com.br",
        "X-Title": "V3 Partners — Agente SDR",
      },
      body: JSON.stringify({ model: p.model, messages, temperature, max_tokens: maxTokens }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message ?? `HTTP ${res.status}`;
      throw new AiProviderError(msg, p.provider, res.status);
    }
    const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    return {
      text,
      provider: p.provider,
      model: p.model,
      usage: {
        inputTokens: data?.usage?.prompt_tokens,
        outputTokens: data?.usage?.completion_tokens,
      },
    };
  } catch (err) {
    if (err instanceof AiProviderError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiProviderError(`Timeout após ${timeoutMs}ms`, p.provider);
    }
    throw new AiProviderError(err instanceof Error ? err.message : "Falha na chamada", p.provider);
  } finally {
    clearTimeout(t);
  }
}

async function chatGoogle(
  p: ChatParams,
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
): Promise<ChatResult> {
  const contents = p.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (p.system) body.systemInstruction = { parts: [{ text: p.system }] };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message ?? `HTTP ${res.status}`;
      throw new AiProviderError(msg, "google", res.status);
    }
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((x: { text?: string }) => x.text ?? "").join("").trim();
    return {
      text,
      provider: "google",
      model: p.model,
      usage: {
        inputTokens: data?.usageMetadata?.promptTokenCount,
        outputTokens: data?.usageMetadata?.candidatesTokenCount,
      },
    };
  } catch (err) {
    if (err instanceof AiProviderError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiProviderError(`Timeout após ${timeoutMs}ms`, "google");
    }
    throw new AiProviderError(err instanceof Error ? err.message : "Falha na chamada Google", "google");
  } finally {
    clearTimeout(t);
  }
}
