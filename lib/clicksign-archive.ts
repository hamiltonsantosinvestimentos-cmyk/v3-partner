import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import { createClient as sc } from "@supabase/supabase-js";

// Fase 2 do ciclo ClickSign (12-14/08/2026). A API v3 (envelopes) nao expoe
// nenhum endpoint de download do documento final assinado -- confirmado por
// pesquisa (ver comentario em lib/contract-render.ts para o mesmo achado
// aplicado ao posicionamento de assinatura, e migration
// 20260814_clicksign_signed_document_archive.sql). O unico canal real e o
// Observador de Assinatura (signature_watchers, attach_documents_enabled:
// true), que ENTREGA POR E-MAIL quando o envelope fecha, nunca por webhook
// ou URL de download. Este módulo le essa caixa via IMAP e arquiva o anexo.
//
// Mailbox: deal@v3partners.com.br (unica caixa Hostinger com IMAP ja
// testado neste projeto, ver cofre-credenciais-v3.md secao 11). Todos os
// pontos de envio ao ClickSign que registram watcherEmail (lib/clicksign.ts)
// devem apontar pra esta mesma caixa -- e a unica que este poller consegue
// ler.
//
// Correlacao contrato <-> e-mail: nao ha campo estruturado nenhum garantido
// no e-mail do Observador (nunca vimos um real, o envelope nunca fechou de
// verdade em producao ainda). A estrategia é pelo NOME DO ANEXO, que a
// ClickSign tende a preservar do upload original: sendToClickSignV3 sempre
// sobe o documento como `${documentLabel}.pdf`. Tentamos, em ordem:
//   1. anexo cujo nome comeca com "{contract_code} " (rotas que emitem
//      codigo via next_v3_code, ex: Central de Contratos)
//   2. anexo cujo nome bate com "{contract_title}.pdf" sanitizado (rotas
//      publicas de intake que ainda nao emitem contract_code -- achado
//      registrado, nao corrigido nesta sessao, ver relatorio)
// Se nenhuma regra bater, o e-mail fica marcado \Seen mas o anexo NAO e
// descartado: fica logado em orphaned_matches pra reconciliacao manual, e o
// primeiro evento real deve ser usado pra revisar/ajustar este parsing,
// mesmo padrao ja usado em app/api/ma/clicksign-webhook/route.ts pro
// payload do webhook v3.

const IMAP_HOST = "imap.hostinger.com";
const IMAP_PORT = 993;
const WATCHER_MAILBOX = "deal@v3partners.com.br";
const STORAGE_BUCKET = "documents";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function sanitizeForMatch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}

export interface ArchiveResult {
  ok: boolean;
  error?: string;
  messagesScanned: number;
  archived: Array<{ contractId: string; contractCode: string | null; storagePath: string }>;
  orphaned: Array<{ subject: string; attachmentNames: string[] }>;
}

export async function archiveClickSignSignedDocuments(): Promise<ArchiveResult> {
  const user = process.env.CLICKSIGN_ARCHIVE_IMAP_USER ?? WATCHER_MAILBOX;
  const pass = process.env.CLICKSIGN_ARCHIVE_IMAP_PASSWORD;

  if (!pass) {
    return { ok: false, error: "CLICKSIGN_ARCHIVE_IMAP_PASSWORD não configurado", messagesScanned: 0, archived: [], orphaned: [] };
  }

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const archived: ArchiveResult["archived"] = [];
  const orphaned: ArchiveResult["orphaned"] = [];
  let messagesScanned = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Só e-mails não lidos vindos do domínio clicksign.com — nunca varre a
      // caixa inteira (deal@v3partners.com.br recebe outros fluxos também,
      // ver upload-notify/W11).
      const uids = await client.search({ seen: false, from: "clicksign.com" }, { uid: true });
      if (!uids || uids.length === 0) {
        return { ok: true, messagesScanned: 0, archived, orphaned };
      }

      const db = svc();

      // Candidatos de correlação: contratos ainda não arquivados e já
      // enviados/assinados. Buscar uma vez fora do loop de mensagens.
      const { data: candidates } = await db
        .from("operation_contracts")
        .select("id, contract_code, contract_title")
        .is("signed_document_path", null)
        .not("external_envelope_id", "is", null);

      for await (const message of client.fetch(uids, { source: true, uid: true }) as AsyncIterable<FetchMessageObject>) {
        messagesScanned++;
        if (!message.source) continue;

        const parsed = await simpleParser(message.source);
        const attachments = parsed.attachments.filter((a) => a.contentType === "application/pdf");
        if (attachments.length === 0) {
          continue; // notificação sem PDF anexo (ex: convite pra assinar, não o fechamento) — deixa não-lida, próxima rodada reavalia
        }

        let matched: { id: string; contract_code: string | null; contract_title: string } | null = null;
        let matchedAttachment: (typeof attachments)[number] | null = null;

        for (const attachment of attachments) {
          const attachmentName = sanitizeForMatch(attachment.filename ?? "");
          for (const candidate of candidates ?? []) {
            const byCode = candidate.contract_code ? sanitizeForMatch(candidate.contract_code) : null;
            const byTitle = sanitizeForMatch(candidate.contract_title);
            if ((byCode && attachmentName.startsWith(byCode)) || attachmentName === byTitle || attachmentName.startsWith(byTitle)) {
              matched = candidate;
              matchedAttachment = attachment;
              break;
            }
          }
          if (matched) break;
        }

        if (!matched || !matchedAttachment) {
          const subject = parsed.subject ?? "(sem assunto)";
          const attachmentNames = attachments.map((a) => a.filename ?? "(sem nome)");
          orphaned.push({ subject, attachmentNames });
          // Achado no code review desta feature (14/08/2026): console.warn
          // dentro de função serverless não é visível pra ninguém no dia a
          // dia (mesma causa raiz já documentada na auditoria do Credit
          // Engine, 03/08/2026, que escondeu falhas reais por meses). Grava
          // em execution_errors, não resolvido por padrão, pra aparecer em
          // qualquer painel/consulta que já lê essa tabela.
          await db.from("execution_errors").insert({
            source: "clicksign-archive",
            error_type: "unmatched_signature_watcher_email",
            error_message: `PDF assinado recebido sem correlação a nenhum operation_contracts: assunto "${subject}", anexo(s) ${attachmentNames.join(", ")}`,
            context: { subject, attachmentNames },
            resolved: false,
          });
          await client.messageFlagsAdd({ uid: message.uid }, ["\\Seen"], { uid: true });
          continue;
        }

        const storagePath = `contratos-assinados/${matched.id}.pdf`;
        const { error: uploadErr } = await db.storage.from(STORAGE_BUCKET).upload(storagePath, matchedAttachment.content, {
          contentType: "application/pdf",
          upsert: true,
        });

        if (uploadErr) {
          await db.from("execution_errors").insert({
            source: "clicksign-archive",
            error_type: "storage_upload_failed",
            error_message: `Falha ao subir PDF assinado do contrato ${matched.id} para o Storage: ${uploadErr.message}`,
            context: { contractId: matched.id, storagePath },
            resolved: false,
          });
          continue; // não marca \Seen: tenta de novo na próxima execução
        }

        await db.from("operation_contracts").update({
          signed_document_path: storagePath,
          signed_document_archived_at: new Date().toISOString(),
        }).eq("id", matched.id);

        archived.push({ contractId: matched.id, contractCode: matched.contract_code, storagePath });
        await client.messageFlagsAdd({ uid: message.uid }, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, messagesScanned, archived, orphaned };
  }

  return { ok: true, messagesScanned, archived, orphaned };
}
