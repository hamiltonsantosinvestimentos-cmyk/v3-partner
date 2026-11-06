// Servidor do "Encaminhar para Instituição": dados da tela, envio e reenvio.
// Dependências injetáveis (banco, e-mail, pausa) para os testes.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contatosPadrao, dividirEmPartes, emailValido, montarAssunto, montarCorpo, ordenarContatos, situacaoGeral,
  ufDaProposta, type Contato, type DocEnvio, type PropostaEnvio, type Situacao,
} from "@/lib/encaminhar-instituicao";
import { documentosDaLinha } from "@/lib/api-v1/visao-partner";
import type { PortfolioLinhaDocs } from "@/lib/credit-checklists";

export const BUCKET = "credit-documents";
export const PAPEIS_MESA = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export type Mailer = (o: { to: string; subject: string; html: string; attachments: { filename: string; content: Buffer }[]; replyTo?: string | null }) => Promise<string>;
export type Remetente = { id: string; nome: string | null; email: string | null };

type Prop = PropostaEnvio & { id: string; documents: unknown; instituicao_encaminhada: string | null };

export async function carregarProposta(db: SupabaseClient, id: string): Promise<Prop | null> {
  const { data } = await db.from("credit_desk_proposals")
    .select("id, code, credit_line, requested_value, client_name, metadata, documents, instituicao_encaminhada")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  return (data as Prop | null) ?? null;
}

/** Documentos da proposta que podem ir anexados, com nome do checklist e tamanho, na ordem do checklist. */
export async function documentosDaProposta(db: SupabaseClient, p: Prop): Promise<(DocEnvio & { uploaded_at: string | null })[]> {
  const docs = (Array.isArray(p.documents) ? p.documents : []) as Array<{ doc_id?: string; file_name?: string; storage_path?: string; uploaded_at?: string }>;
  const comArquivo = docs.filter((d) => d.storage_path && d.doc_id);
  const meta = p.metadata ?? {};
  const tipo: "PF" | "PJ" = meta.client_type === "PJ" ? "PJ" : "PF";
  const { data: portfolio } = await db.from("portfolio_linhas").select("nome, documentos_pf, documentos_pj").eq("ativo", true);
  const checklist = documentosDaLinha(p.credit_line, tipo, (portfolio ?? []) as PortfolioLinhaDocs[]);
  const ordem = new Map(checklist.map((c, i) => [c.id, i]));
  const nome = new Map(checklist.map((c) => [c.id, c.nome]));

  // Tamanhos pelo armazenamento, uma listagem por pasta.
  const tamanhos = new Map<string, number>();
  const pastas = [...new Set(comArquivo.map((d) => d.storage_path!.slice(0, d.storage_path!.lastIndexOf("/"))))];
  for (const pasta of pastas) {
    const { data } = await db.storage.from(BUCKET).list(pasta, { limit: 1000 });
    for (const o of (data ?? []) as Array<{ name: string; metadata?: { size?: number } }>) {
      if (typeof o.metadata?.size === "number") tamanhos.set(`${pasta}/${o.name}`, o.metadata.size);
    }
  }
  return comArquivo
    .map((d) => ({
      doc_id: d.doc_id!, nome_documento: nome.get(d.doc_id!) ?? d.doc_id!, file_name: d.file_name ?? d.storage_path!.split("/").pop()!,
      storage_path: d.storage_path!, bytes: tamanhos.get(d.storage_path!) ?? 0, uploaded_at: d.uploaded_at ?? null,
    }))
    .filter((d) => tamanhos.has(d.storage_path))
    .sort((a, b) => (ordem.get(a.doc_id) ?? 999) - (ordem.get(b.doc_id) ?? 999) || String(a.uploaded_at).localeCompare(String(b.uploaded_at)));
}

/** Dados da tela: instituições com contatos, documentos e histórico de envios da proposta. */
export async function dadosDaTela(db: SupabaseClient, proposalId: string) {
  const p = await carregarProposta(db, proposalId);
  if (!p) return null;
  const uf = ufDaProposta(p.metadata);
  const [{ data: insts }, { data: contatos }, documentos, { data: envios }] = await Promise.all([
    db.from("instituicoes").select("id, nome, status").order("nome"),
    db.from("instituicao_contatos").select("id, instituicao_id, nome, email, uf, cargo, telefone, principal, ativo").eq("ativo", true),
    documentosDaProposta(db, p),
    db.from("credit_proposal_envios")
      .select("id, instituicao_id, instituicao_nome, destinatarios, assunto, mensagem, documentos, partes, status, erro, enviado_por_nome, enviado_em, credit_proposal_envio_destinatarios(id, email, nome, fora_do_cadastro, parte, status, motivo, enviado_em, entregue_em, aberto_em, devolvido_em, substituido_por, atualizado_em)")
      .eq("proposal_id", proposalId).order("enviado_em", { ascending: false }),
  ]);
  const porInst = new Map<string, Contato[]>();
  for (const c of (contatos ?? []) as (Contato & { instituicao_id: string })[]) {
    if (!porInst.has(c.instituicao_id)) porInst.set(c.instituicao_id, []);
    porInst.get(c.instituicao_id)!.push(c);
  }
  const ultimoEnvio = new Map<string, string>();
  for (const e of (envios ?? []) as { instituicao_id: string | null; enviado_em: string; status: string }[]) {
    if (e.instituicao_id && e.status !== "falha" && !ultimoEnvio.has(e.instituicao_id)) ultimoEnvio.set(e.instituicao_id, e.enviado_em);
  }
  const instituicoes = ((insts ?? []) as { id: string; nome: string; status: string | null }[])
    .filter((i) => (i.status ?? "ativo") === "ativo")
    .sort((a, b) => a.nome.trim().localeCompare(b.nome.trim(), "pt-BR"))
    .map((i) => {
      const cs = ordenarContatos(porInst.get(i.id) ?? []);
      return { id: i.id, nome: i.nome.trim(), contatos: cs, contatos_padrao: contatosPadrao(cs, uf), ja_encaminhada_em: ultimoEnvio.get(i.id) ?? null };
    });
  return {
    proposta: { id: p.id, code: p.code, credit_line: p.credit_line },
    uf_proposta: uf,
    instituicoes,
    documentos: documentos.map(({ uploaded_at: _u, ...d }) => { void _u; return d; }),
    envios: (envios ?? []).map((e) => {
      const { credit_proposal_envio_destinatarios: dest, ...resto } = e as Record<string, unknown> & { credit_proposal_envio_destinatarios?: { status: Situacao }[] };
      const lista = (dest ?? []).filter((d) => !(d as { substituido_por?: string | null }).substituido_por);
      return { ...resto, destinatarios_situacao: lista, situacao_geral: situacaoGeral(lista.map((d) => d.status)) };
    }),
  };
}

/** Separa um campo de e-mail que pode ter vários endereços ou texto junto ("a@x.com/ b@x.com nome"). */
export function extrairEmails(campo: string | null | undefined): string[] {
  const vistos = new Set<string>();
  for (const tok of String(campo ?? "").split(/[\s;,/|]+/)) {
    const e = tok.trim().toLowerCase();
    if (emailValido(e)) vistos.add(e);
  }
  return [...vistos];
}

/**
 * Leva para a lista de contatos os e-mails digitados nos campos antigos do cadastro da instituição
 * (contato_email e email), ao criar ou editar. E-mail já cadastrado é ignorado (índice único); um
 * contato removido antes volta ativo. O primeiro vira principal só se a instituição não tiver nenhum.
 */
export async function sincronizarContatosDoCadastro(db: SupabaseClient, instituicaoId: string, campos: { contato_nome?: string | null; contato_email?: string | null; email?: string | null }): Promise<number> {
  const emails = [...extrairEmails(campos.contato_email), ...extrairEmails(campos.email)].filter((e, i, a) => a.indexOf(e) === i);
  if (!emails.length) return 0;
  const { data: atuais } = await db.from("instituicao_contatos").select("id, email, ativo, principal").eq("instituicao_id", instituicaoId);
  const lista = (atuais ?? []) as { id: string; email: string; ativo: boolean; principal: boolean }[];
  let temPrincipal = lista.some((c) => c.ativo && c.principal);
  let novos = 0;
  const primeiroDoContato = extrairEmails(campos.contato_email)[0];
  for (const email of emails) {
    const existente = lista.find((c) => c.email.toLowerCase() === email);
    if (existente) {
      if (!existente.ativo) await db.from("instituicao_contatos").update({ ativo: true, updated_at: new Date().toISOString() }).eq("id", existente.id);
      continue;
    }
    const principal = !temPrincipal;
    const { error } = await db.from("instituicao_contatos").insert({
      instituicao_id: instituicaoId, email, principal,
      nome: email === primeiroDoContato ? (campos.contato_nome?.trim() || null) : null,
    });
    if (!error) { novos++; if (principal) temPrincipal = true; }
  }
  return novos;
}

export type PedidoEnvio = {
  instituicoes: { instituicao_id: string; destinatarios: { email: string; nome?: string | null }[] }[];
  documentos: string[]; // storage_path
  mensagem?: string | null;
};

export type ResultadoInstituicao = { instituicao_id: string; nome: string; envio_id: string | null; status: "enviado" | "parcial" | "falha"; partes: number; enviados: number; falhas: { email: string; parte: number; motivo: string }[] };

/** Valida o pedido contra o cadastro e a proposta. Devolve a mensagem de erro, ou null. */
export function validarPedido(p: PedidoEnvio): string | null {
  if (!Array.isArray(p.instituicoes) || p.instituicoes.length === 0) return "Escolha pelo menos uma instituição.";
  if (p.instituicoes.length > 20) return "No máximo 20 instituições por envio.";
  for (const i of p.instituicoes) {
    if (!i.destinatarios?.length) return "Cada instituição precisa de pelo menos um destinatário.";
    if (i.destinatarios.length > 15) return "No máximo 15 destinatários por instituição.";
    for (const d of i.destinatarios) if (!emailValido(d.email)) return `E-mail inválido: ${d.email}`;
  }
  if (p.mensagem && p.mensagem.length > 2000) return "A mensagem tem no máximo 2.000 caracteres.";
  return null;
}

/** Executa o envio: um e-mail por destinatário e por parte, gravando tudo. */
export async function executarEnvio(deps: { db: SupabaseClient; mailer: Mailer; pausa?: (ms: number) => Promise<void> }, proposalId: string, pedido: PedidoEnvio, remetente: Remetente) {
  const { db, mailer } = deps;
  const pausa = deps.pausa ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const erro = validarPedido(pedido);
  if (erro) return { ok: false as const, status: 400, error: erro };
  const p = await carregarProposta(db, proposalId);
  if (!p) return { ok: false as const, status: 404, error: "Proposta não encontrada." };

  const todos = await documentosDaProposta(db, p);
  const escolhidos = todos.filter((d) => pedido.documentos.includes(d.storage_path));
  if (escolhidos.length !== new Set(pedido.documentos).size) return { ok: false as const, status: 400, error: "Algum documento escolhido não pertence a esta proposta." };
  const { partes, fora } = dividirEmPartes(escolhidos);
  if (fora.length) return { ok: false as const, status: 400, error: `Arquivo grande demais para e-mail: ${fora.map((f) => f.file_name).join(", ")}. Desmarque para continuar.` };
  const totalPartes = Math.max(1, partes.length);

  const ids = pedido.instituicoes.map((i) => i.instituicao_id);
  const { data: insts } = await db.from("instituicoes").select("id, nome, status").in("id", ids);
  const instPorId = new Map(((insts ?? []) as { id: string; nome: string; status: string | null }[]).map((i) => [i.id, i]));
  for (const id of ids) if (!instPorId.has(id) || (instPorId.get(id)!.status ?? "ativo") !== "ativo") return { ok: false as const, status: 400, error: "Instituição inexistente ou inativa." };
  const { data: contatos } = await db.from("instituicao_contatos").select("instituicao_id, email").in("instituicao_id", ids);
  const doCadastro = new Set(((contatos ?? []) as { instituicao_id: string; email: string }[]).map((c) => `${c.instituicao_id}|${c.email.toLowerCase()}`));

  // Baixa cada arquivo uma vez só.
  const arquivos = new Map<string, Buffer>();
  for (const d of escolhidos) {
    const { data, error } = await db.storage.from(BUCKET).download(d.storage_path);
    if (error || !data) return { ok: false as const, status: 500, error: `Não foi possível ler o arquivo ${d.file_name}.` };
    arquivos.set(d.storage_path, Buffer.from(await data.arrayBuffer()));
  }

  const resultados: ResultadoInstituicao[] = [];
  const nomesEncaminhados: string[] = [];
  for (const pedidoInst of pedido.instituicoes) {
    const inst = instPorId.get(pedidoInst.instituicao_id)!;
    const nomeInst = inst.nome.trim();
    const destinatarios = [...new Map(pedidoInst.destinatarios.map((d) => [d.email.trim().toLowerCase(), { email: d.email.trim().toLowerCase(), nome: d.nome ?? null }])).values()];
    const { data: envio, error: eEnvio } = await db.from("credit_proposal_envios").insert({
      proposal_id: proposalId, instituicao_id: inst.id, instituicao_nome: nomeInst,
      destinatarios: destinatarios.map((d) => d.email), assunto: montarAssunto(p, 1, totalPartes),
      mensagem: pedido.mensagem?.trim() || null,
      documentos: escolhidos.map((d) => ({ doc_id: d.doc_id, nome_documento: d.nome_documento, file_name: d.file_name, bytes: d.bytes })),
      partes: totalPartes, status: "enviando", enviado_por: remetente.id, enviado_por_nome: remetente.nome,
    }).select("id").single();
    if (eEnvio || !envio) { resultados.push({ instituicao_id: inst.id, nome: nomeInst, envio_id: null, status: "falha", partes: totalPartes, enviados: 0, falhas: [{ email: "-", parte: 0, motivo: "Não foi possível registrar o envio." }] }); continue; }

    const falhas: ResultadoInstituicao["falhas"] = [];
    const resendIds: string[] = [];
    let enviados = 0;
    for (const dest of destinatarios) {
      for (let n = 0; n < totalPartes; n++) {
        const docsParte = partes[n] ?? [];
        const linha: Record<string, unknown> = {
          envio_id: envio.id, email: dest.email, nome: dest.nome, parte: n + 1,
          fora_do_cadastro: !doCadastro.has(`${inst.id}|${dest.email}`),
        };
        try {
          const id = await mailer({
            to: dest.email,
            subject: montarAssunto(p, n + 1, totalPartes),
            html: montarCorpo({ proposta: p, documentos: docsParte, mensagem: pedido.mensagem, parte: n + 1, total: totalPartes, remetenteNome: remetente.nome }),
            attachments: docsParte.map((d) => ({ filename: d.file_name, content: arquivos.get(d.storage_path)! })),
            replyTo: remetente.email,
          });
          resendIds.push(id);
          enviados++;
          await db.from("credit_proposal_envio_destinatarios").insert({ ...linha, resend_id: id, status: "enviado", enviado_em: new Date().toISOString() });
        } catch (e) {
          const motivo = e instanceof Error ? e.message.slice(0, 300) : "Falha no envio";
          falhas.push({ email: dest.email, parte: n + 1, motivo });
          await db.from("credit_proposal_envio_destinatarios").insert({ ...linha, status: "falha", motivo });
        }
        await pausa(300);
      }
    }
    const total = destinatarios.length * totalPartes;
    const status: ResultadoInstituicao["status"] = enviados === total ? "enviado" : enviados === 0 ? "falha" : "parcial";
    await db.from("credit_proposal_envios").update({ status, resend_ids: resendIds, erro: falhas.length ? falhas.map((f) => `${f.email} (parte ${f.parte}): ${f.motivo}`).join("; ").slice(0, 2000) : null }).eq("id", envio.id);
    if (status !== "falha") nomesEncaminhados.push(nomeInst);
    resultados.push({ instituicao_id: inst.id, nome: nomeInst, envio_id: envio.id, status, partes: totalPartes, enviados, falhas });
  }

  // "Instituições Encaminhadas" (coluna que já existe): acrescenta sem repetir.
  if (nomesEncaminhados.length) {
    let lista: string[] = [];
    try { const v = JSON.parse(p.instituicao_encaminhada ?? "[]"); lista = Array.isArray(v) ? v : [String(v)]; } catch { lista = p.instituicao_encaminhada ? [p.instituicao_encaminhada] : []; }
    for (const n of nomesEncaminhados) if (!lista.includes(n)) lista.push(n);
    await db.from("credit_desk_proposals").update({ instituicao_encaminhada: JSON.stringify(lista) }).eq("id", proposalId);
  }
  return { ok: true as const, resultados, partes: totalPartes };
}

/** Reenvia uma parte para um destinatário (corrigido ou não). Cria uma linha nova; a antiga fica no histórico. */
export async function reenviar(deps: { db: SupabaseClient; mailer: Mailer }, proposalId: string, destinatarioId: string, emailNovo: string, remetente: Remetente) {
  const { db, mailer } = deps;
  if (!emailValido(emailNovo)) return { ok: false as const, status: 400, error: `E-mail inválido: ${emailNovo}` };
  const { data: dest } = await db.from("credit_proposal_envio_destinatarios").select("id, envio_id, parte, nome").eq("id", destinatarioId).maybeSingle();
  if (!dest) return { ok: false as const, status: 404, error: "Destinatário não encontrado." };
  const { data: envio } = await db.from("credit_proposal_envios").select("id, proposal_id, instituicao_id, mensagem, documentos, partes, destinatarios").eq("id", dest.envio_id).maybeSingle();
  if (!envio || envio.proposal_id !== proposalId) return { ok: false as const, status: 404, error: "Envio não encontrado nesta proposta." };
  const p = await carregarProposta(db, proposalId);
  if (!p) return { ok: false as const, status: 404, error: "Proposta não encontrada." };

  const registrados = (envio.documentos ?? []) as { file_name: string; doc_id: string }[];
  const todos = await documentosDaProposta(db, p);
  const escolhidos = todos.filter((d) => registrados.some((r) => r.file_name === d.file_name && r.doc_id === d.doc_id));
  const { partes } = dividirEmPartes(escolhidos);
  const docsParte = partes[(dest.parte as number) - 1] ?? [];
  const anexos: { filename: string; content: Buffer }[] = [];
  for (const d of docsParte) {
    const { data, error } = await db.storage.from(BUCKET).download(d.storage_path);
    if (error || !data) return { ok: false as const, status: 500, error: `Não foi possível ler o arquivo ${d.file_name}.` };
    anexos.push({ filename: d.file_name, content: Buffer.from(await data.arrayBuffer()) });
  }
  const email = emailNovo.trim().toLowerCase();
  const { data: cad } = await db.from("instituicao_contatos").select("id").eq("instituicao_id", envio.instituicao_id).ilike("email", email).limit(1).maybeSingle();
  const total = Math.max(1, partes.length);
  const linha = { envio_id: envio.id, email, nome: dest.nome, parte: dest.parte, fora_do_cadastro: !cad };
  try {
    const id = await mailer({
      to: email, subject: montarAssunto(p, dest.parte as number, total),
      html: montarCorpo({ proposta: p, documentos: docsParte, mensagem: envio.mensagem as string | null, parte: dest.parte as number, total, remetenteNome: remetente.nome }),
      attachments: anexos, replyTo: remetente.email,
    });
    const { data: nova } = await db.from("credit_proposal_envio_destinatarios").insert({ ...linha, resend_id: id, status: "enviado", enviado_em: new Date().toISOString() }).select("id").single();
    if (nova?.id) await db.from("credit_proposal_envio_destinatarios").update({ substituido_por: nova.id }).eq("id", destinatarioId);
    const lista = new Set([...(envio.destinatarios as string[] ?? []), email]);
    await db.from("credit_proposal_envios").update({ destinatarios: [...lista] }).eq("id", envio.id);
    await recalcularStatusEnvio(db, envio.id as string);
    return { ok: true as const, resend_id: id };
  } catch (e) {
    const motivo = e instanceof Error ? e.message.slice(0, 300) : "Falha no envio";
    await db.from("credit_proposal_envio_destinatarios").insert({ ...linha, status: "falha", motivo });
    return { ok: false as const, status: 502, error: `O e-mail não saiu: ${motivo}` };
  }
}

/** Status do envio: considera só as tentativas que não foram substituídas por um reenvio. */
export async function recalcularStatusEnvio(db: SupabaseClient, envioId: string): Promise<void> {
  const { data } = await db.from("credit_proposal_envio_destinatarios").select("status, substituido_por").eq("envio_id", envioId);
  const st = ((data ?? []) as { status: string; substituido_por: string | null }[]).filter((d) => !d.substituido_por).map((d) => d.status);
  if (!st.length) return;
  const ok = st.filter((s) => s !== "falha").length;
  await db.from("credit_proposal_envios").update({ status: ok === st.length ? "enviado" : ok === 0 ? "falha" : "parcial" }).eq("id", envioId);
}
