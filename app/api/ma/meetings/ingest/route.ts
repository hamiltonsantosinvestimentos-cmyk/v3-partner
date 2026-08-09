import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { issueV3Code, resolveSectorCode as resolveSectorCodeV3 } from "@/lib/v3-codes";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO"];

const SECTOR_TO_CODE: Record<string, string> = {
  energia: "ENE",
  hidreletrica: "ENE",
  "real estate": "REA",
  imóveis: "REA",
  imoveis: "REA",
  "ma cross-border": "MAC",
  "cross-border": "MAC",
  "m&a": "MAC",
  mineração: "MIN",
  mineracao: "MIN",
  crédito: "CRE",
  credito: "CRE",
};

function resolveSectorCode(setor: string): string {
  const key = setor.toLowerCase().trim();
  for (const [k, v] of Object.entries(SECTOR_TO_CODE)) {
    if (key.includes(k)) return v;
  }
  return "OUT";
}

const EXTRACT_PROMPT = `Você é o analista de inteligência comercial da V3 Partners, boutique de securitização e M&A.
Dado o transcript de uma reunião comercial, extraia em JSON:

{
  "summary": "resumo executivo PT-BR, 3-5 frases, tom institucional",
  "key_decisions": ["decisão 1", "decisão 2"],
  "next_steps": "próximos passos narrativos em PT-BR",
  "sentiment": "positivo | neutro | negativo",
  "action_items": [
    {"assignee": "nome", "action": "ação específica", "due_date": "YYYY-MM-DD ou null"}
  ],
  "deal_context": {
    "empresa": "nome da empresa ou pessoa prospectada",
    "setor_v3": "Energia | Real Estate | MA Cross-Border | Mineracao | Credito | Outro",
    "ticket_estimado_r": 0,
    "etapa_sugerida": "PROSPECTING | QUALIFICATION | IOI | PROPOSAL | DUE_DILIGENCE",
    "solucoes_apresentadas": ["solução 1"],
    "proximos_passos": ["passo 1"]
  }
}

Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON.`;

const SERVICE_USER_ID = "d0af8eaa-9f3c-4e7a-b8c6-613736524317";

export async function POST(req: NextRequest) {
  const db = svc();
  let userId: string;

  const serviceToken = req.headers.get("x-v3-service-token");
  const validToken = process.env.V3_INGEST_SECRET;

  if (validToken && serviceToken === validToken) {
    // Headless call from n8n — use João's user_id, no cookie auth needed
    userId = SERVICE_USER_ID;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
    if (!ALLOWED.includes(profile?.role ?? "")) {
      return NextResponse.json({ error: "Acesso restrito à Mesa M&A" }, { status: 403 });
    }
    userId = user.id;
  }

  const body = await req.json();
  const {
    source = "manual",
    fathom_url,
    title,
    transcript,
    meeting_date,
    duration_minutes,
    participants = [],
  } = body;

  if (!title || !transcript || !meeting_date) {
    return NextResponse.json({ error: "title, transcript e meeting_date são obrigatórios" }, { status: 422 });
  }

  // Duplicate check
  const { data: existing } = await db
    .from("meeting_summaries")
    .select("id")
    .eq("title", title)
    .eq("meeting_date", meeting_date)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Reunião com este título e data já existe" }, { status: 409 });
  }

  // Claude extraction
  let extracted: {
    summary: string;
    key_decisions: string[];
    next_steps: string;
    sentiment: string;
    action_items: { assignee: string; action: string; due_date: string | null }[];
    deal_context: {
      empresa: string;
      setor_v3: string;
      ticket_estimado_r: number;
      etapa_sugerida: string;
      solucoes_apresentadas: string[];
      proximos_passos: string[];
    };
  } | null = null;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const aiRes = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: EXTRACT_PROMPT,
      messages: [{ role: "user", content: `Título: "${title}"\nData: ${meeting_date}\nParticipantes: ${participants.join(", ")}\n\nTRANSCRIPT:\n${transcript.slice(0, 30000)}` }],
    });
    const raw = (aiRes.content[0] as { type: string; text: string }).text.trim();
    extracted = JSON.parse(raw);
  } catch {
    // continua sem extração Claude
  }

  const summary = extracted?.summary ?? title;
  const actionItems = extracted?.action_items ?? [];
  const dealCtx = extracted?.deal_context;

  // 1. Criar ou encontrar ma_deal
  let dealId: string | null = null;
  let dealCode: string | null = null;

  if (dealCtx?.empresa) {
    // Codigo emitido pelo banco (next_v3_code), atomico e validado contra o
    // dicionario deal_sector_codes.
    //
    // O calculo anterior tinha dois defeitos reais. O v3_code pegava o "maior"
    // codigo ordenando por STRING, o que quebra assim que o sequencial passa de
    // 099 (em ordem lexicografica "V3-...-100" vem antes de "V3-...-099"). E o
    // legacy MA-26 ordenava a mesma coluna que hoje contem MA-26-37682 junto de
    // MA-26-030, entao o "ultimo" lido era 37682 e o proximo sairia 37683.
    //
    // A sigla de setor passa pelo resolvedor central antes de virar codigo: era
    // sem essa validacao que MAC e CRE acabaram emitidos fora do dicionario.
    const sectorCode = await resolveSectorCodeV3(
      resolveSectorCode(dealCtx.setor_v3 ?? "") || dealCtx.setor_v3,
      db
    );
    const generatedCode = await issueV3Code("MA", sectorCode, db);
    const legacyCode = generatedCode;

    const { data: newDeal, error: dealErr } = await db
      .from("ma_deals")
      .insert({
        code: legacyCode,
        v3_code: generatedCode,
        title: `${dealCtx.empresa}`,
        target_company: dealCtx.empresa,
        sector: dealCtx.setor_v3,
        deal_value: dealCtx.ticket_estimado_r > 0 ? dealCtx.ticket_estimado_r : null,
        stage: (dealCtx.etapa_sugerida ?? "PROSPECTING") as "PROSPECTING",
        status: "DRAFT" as "DRAFT",
        created_by: userId,
        notes: `Criado automaticamente via reunião "${title}" em ${meeting_date}`,
        tags: ["originacao", "meeting-intel"],
        asset_data: {
          solucoes_apresentadas: dealCtx.solucoes_apresentadas ?? [],
          proximos_passos: dealCtx.proximos_passos ?? [],
          meeting_origin: title,
        },
        description: summary,
      })
      .select("id, v3_code")
      .single();

    if (!dealErr && newDeal) {
      dealId = newDeal.id as string;
      dealCode = newDeal.v3_code as string;
    }
  }

  // 2. Criar business_meeting
  const { data: bm } = await db
    .from("business_meetings")
    .insert({
      empresa_nome: dealCtx?.empresa ?? title,
      contato_nome: participants[0] ?? "Não informado",
      meeting_date,
      meeting_type: "remoto",
      status: "realizada",
      participantes_v3: [
        { nome: "João Lemos", role: "originacao" },
        { nome: "Hamilton Santos", role: "financeiro" },
      ],
      pauta: title,
      notas: summary,
      proximo_passo: (dealCtx?.proximos_passos ?? []).join(" | ") || null,
      ma_deal_id: dealId,
      conducted_by: userId,
    })
    .select("id")
    .single();

  const businessMeetingId = bm?.id as string | undefined;

  // 3. Criar meeting_summary
  const { data: ms } = await db
    .from("meeting_summaries")
    .insert({
      user_id: userId,
      title,
      transcript: transcript.slice(0, 50000),
      summary,
      action_items: actionItems.map((a) => `${a.assignee}: ${a.action}`),
      participants,
      duration_minutes: duration_minutes ?? null,
      meeting_date,
      source,
      fathom_url: fathom_url ?? null,
      ma_deal_id: dealId,
      business_meeting_id: businessMeetingId ?? null,
      processed_by: "api",
    })
    .select("id")
    .single();

  // 4. Criar meeting_action_items
  if (businessMeetingId && actionItems.length > 0) {
    await db.from("meeting_action_items").insert(
      actionItems.map((a) => ({
        meeting_id: businessMeetingId,
        assignee: a.assignee,
        action: a.action,
        due_date: a.due_date ?? null,
        source,
      }))
    );
  }

  // 5. Criar notificações de follow-up no portal
  const JOAO_ID = "d0af8eaa-9f3c-4e7a-b8c6-613736524317";
  const notifs: { user_id: string; title: string; message: string; type: string; action_url: string | null }[] = [];

  // Notificação de resumo da reunião
  notifs.push({
    user_id: userId === JOAO_ID ? JOAO_ID : userId,
    title: `Reunião ingerida: ${dealCtx?.empresa ?? title}`,
    message: `${meeting_date} · ${actionItems.length} action items · ${dealCode ? `Deal ${dealCode}` : "sem deal"}. ${summary.slice(0, 120)}...`,
    type: "meeting_intel",
    action_url: dealId ? `/mesa-ma?deal=${dealId}` : "/mesa-ma",
  });

  // Follow-up por action item com prazo
  for (const a of actionItems) {
    const isJoao = a.assignee.toLowerCase().includes("joão") || a.assignee.toLowerCase().includes("joao") || a.assignee.toLowerCase().includes("lemos");
    if (isJoao) {
      const prazoStr = a.due_date ? ` · prazo ${new Date(a.due_date).toLocaleDateString("pt-BR")}` : "";
      notifs.push({
        user_id: JOAO_ID,
        title: `Follow-up: ${a.action.slice(0, 60)}`,
        message: `De: ${title} (${meeting_date})${prazoStr}. ${a.action}`,
        type: "followup",
        action_url: dealId ? `/mesa-ma?deal=${dealId}` : "/mesa-ma",
      });
    }
  }

  if (notifs.length > 0) {
    await db.from("notifications").insert(notifs);
  }

  return NextResponse.json(
    {
      meeting_id: businessMeetingId,
      summary_id: ms?.id,
      deal_id: dealId,
      deal_code: dealCode,
      action_items_created: actionItems.length,
      summary,
      key_decisions: extracted?.key_decisions ?? [],
      next_steps: extracted?.next_steps ?? "",
      sentiment: extracted?.sentiment ?? "neutro",
      action_items: actionItems,
    },
    { status: 201 }
  );
}
