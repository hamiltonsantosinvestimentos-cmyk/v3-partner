import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { encryptSecret, secretHint } from "@/lib/crypto/secret";
import { AI_MODELS, isValidModel, type AiProvider } from "@/lib/ai/registry";

const ADMIN_ROLES = ["ADMIN", "GESTAO"];
const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"];
const SDR_INTERNO_OWNER = "00000000-0000-0000-0000-000000000000";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type Caller = { userId: string; role: string; isAdmin: boolean };

async function getCaller(): Promise<Caller | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  const role = (profile?.role as string) ?? "";
  return { userId: user.id, role, isAdmin: ADMIN_ROLES.includes(role) };
}

/** Resolve qual owner_partner_id o caller pode gerenciar. null = sem permissão. */
async function resolveOwner(caller: Caller, requested?: string | null): Promise<string | null> {
  if (caller.isAdmin) {
    // ADMIN/GESTAO: pode gerenciar o agente interno da V3 ou o de um partner específico.
    if (!requested || requested === "interno" || requested === SDR_INTERNO_OWNER) return SDR_INTERNO_OWNER;
    return requested;
  }
  if (!PARTNER_ROLES.includes(caller.role)) return null;
  // Partner: só o próprio, e só com add-on SDR ativo.
  const { data: conexao } = await svc()
    .from("partner_sdr_connections")
    .select("addon_ativo")
    .eq("partner_id", caller.userId)
    .maybeSingle();
  if (!conexao?.addon_ativo) return null;
  if (requested && requested !== caller.userId) return null;
  return caller.userId;
}

const SELECT_PUBLIC =
  "id, owner_partner_id, name, enabled, channels, provider, model, temperature, max_tokens, api_key_hint, system_prompt, smart_delay_min_ms, smart_delay_max_ms, fallback_to_human, created_at, updated_at";

function shape(row: Record<string, unknown>) {
  return { ...row, has_api_key: Boolean(row.api_key_hint) };
}

const createSchema = z.object({
  owner: z.string().optional().nullable(),
  name: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  channels: z.array(z.enum(["whatsapp", "instagram", "messenger", "telegram"])).min(1).optional(),
  provider: z.enum(["anthropic", "openai", "openrouter", "google"]).optional(),
  model: z.string().min(1).max(120).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(64).max(8192).optional(),
  api_key: z.string().min(8).max(400).optional().nullable(),
  system_prompt: z.string().max(20000).optional(),
  smart_delay_min_ms: z.number().int().min(0).max(60000).optional(),
  smart_delay_max_ms: z.number().int().min(0).max(60000).optional(),
  fallback_to_human: z.boolean().optional(),
});

const patchSchema = createSchema.extend({ id: z.string().uuid() });

// GET — lista os agentes que o caller pode ver. ?owner=interno|<partnerId>|all
export async function GET(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const requested = new URL(req.url).searchParams.get("owner");
  const db = svc();

  if (caller.isAdmin && requested === "all") {
    const { data, error } = await db.from("sdr_agents").select(SELECT_PUBLIC).order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ agents: (data ?? []).map(shape), models: AI_MODELS });
  }

  const owner = await resolveOwner(caller, requested);
  if (!owner) return NextResponse.json({ error: "Add-on SDR necessário" }, { status: 403 });

  const { data, error } = await db
    .from("sdr_agents").select(SELECT_PUBLIC)
    .eq("owner_partner_id", owner)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agents: (data ?? []).map(shape), models: AI_MODELS, owner });
}

// POST — cria um agente
export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  const d = parsed.data;

  const owner = await resolveOwner(caller, d.owner);
  if (!owner) return NextResponse.json({ error: "Add-on SDR necessário" }, { status: 403 });

  const provider = (d.provider ?? "anthropic") as AiProvider;
  const model = d.model ?? AI_MODELS[provider][0].id;
  if (!isValidModel(provider, model)) {
    return NextResponse.json({ error: `Modelo inválido para ${provider}` }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    owner_partner_id: owner,
    name: d.name ?? "Agente SDR",
    enabled: d.enabled ?? true,
    channels: d.channels ?? ["whatsapp"],
    provider,
    model,
    temperature: d.temperature ?? 0.6,
    max_tokens: d.max_tokens ?? 1024,
    system_prompt: d.system_prompt ?? "",
    smart_delay_min_ms: d.smart_delay_min_ms ?? 1500,
    smart_delay_max_ms: d.smart_delay_max_ms ?? 6000,
    fallback_to_human: d.fallback_to_human ?? true,
    updated_by: caller.userId,
  };
  if (d.api_key) {
    row.api_key_encrypted = encryptSecret(d.api_key);
    row.api_key_hint = secretHint(d.api_key);
  }

  // enabled único por owner: desliga os outros se este nasce ativo
  const db = svc();
  if (row.enabled) {
    await db.from("sdr_agents").update({ enabled: false }).eq("owner_partner_id", owner).eq("enabled", true);
  }

  const { data, error } = await db.from("sdr_agents").insert(row).select(SELECT_PUBLIC).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agent: shape(data) });
}

// PATCH — atualiza um agente (por id, escopado ao owner do caller)
export async function PATCH(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  const d = parsed.data;
  const db = svc();

  const { data: existing } = await db.from("sdr_agents").select("id, owner_partner_id, provider, model").eq("id", d.id).single();
  if (!existing) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const owner = await resolveOwner(caller, existing.owner_partner_id as string);
  if (!owner || owner !== existing.owner_partner_id) {
    return NextResponse.json({ error: "Sem permissão sobre este agente" }, { status: 403 });
  }

  const provider = (d.provider ?? existing.provider) as AiProvider;
  const model = d.model ?? (d.provider ? AI_MODELS[provider][0].id : (existing.model as string));
  if (!isValidModel(provider, model)) {
    return NextResponse.json({ error: `Modelo inválido para ${provider}` }, { status: 400 });
  }

  const upd: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: caller.userId, provider, model };
  if (d.name !== undefined) upd.name = d.name;
  if (d.enabled !== undefined) upd.enabled = d.enabled;
  if (d.channels !== undefined) upd.channels = d.channels;
  if (d.temperature !== undefined) upd.temperature = d.temperature;
  if (d.max_tokens !== undefined) upd.max_tokens = d.max_tokens;
  if (d.system_prompt !== undefined) upd.system_prompt = d.system_prompt;
  if (d.smart_delay_min_ms !== undefined) upd.smart_delay_min_ms = d.smart_delay_min_ms;
  if (d.smart_delay_max_ms !== undefined) upd.smart_delay_max_ms = d.smart_delay_max_ms;
  if (d.fallback_to_human !== undefined) upd.fallback_to_human = d.fallback_to_human;
  if (d.api_key === null) { upd.api_key_encrypted = null; upd.api_key_hint = null; }
  else if (d.api_key) { upd.api_key_encrypted = encryptSecret(d.api_key); upd.api_key_hint = secretHint(d.api_key); }

  if (upd.enabled === true) {
    await db.from("sdr_agents").update({ enabled: false })
      .eq("owner_partner_id", owner).eq("enabled", true).neq("id", d.id);
  }

  const { data, error } = await db.from("sdr_agents").update(upd).eq("id", d.id).select(SELECT_PUBLIC).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agent: shape(data) });
}

// DELETE — remove um agente. ?id=<uuid>
export async function DELETE(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const db = svc();

  const { data: existing } = await db.from("sdr_agents").select("owner_partner_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const owner = await resolveOwner(caller, existing.owner_partner_id as string);
  if (!owner || owner !== existing.owner_partner_id) {
    return NextResponse.json({ error: "Sem permissão sobre este agente" }, { status: 403 });
  }

  const { error } = await db.from("sdr_agents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
