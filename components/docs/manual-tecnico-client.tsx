"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

interface Props { userRole: string; userName: string; }

type Section = "overview" | "componentes" | "supabase" | "n8n" | "arquivos" | "usuario";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "overview",     label: "Visão Geral" },
  { id: "componentes",  label: "Hooks & Regras" },
  { id: "supabase",     label: "Supabase" },
  { id: "n8n",          label: "n8n Workflows" },
  { id: "arquivos",     label: "Referência de Arquivos" },
  { id: "usuario",      label: "Manual do Usuário" },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="relative rounded-lg overflow-hidden" style={{ background: "#09081A", border: "1px solid #243A66" }}>
      <button onClick={copy} className="absolute top-3 right-3 flex items-center gap-1 rounded px-2 py-1" style={{ background: "#162744", border: "1px solid #243A66", color: "#7A8FA8", fontSize: 10 }}>
        {copied ? <Check size={11} color="#C9A84C" /> : <Copy size={11} />}
        {copied ? "Copiado" : "Copiar"}
      </button>
      <pre className="p-4 overflow-x-auto" style={{ fontSize: 12, color: "#7A8FA8", lineHeight: 1.7 }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: "#111F35", border: `1px solid ${ok ? "rgba(46,204,113,0.3)" : "rgba(201,168,76,0.3)"}` }}>
      {ok
        ? <CheckCircle2 size={14} color="#2ECC71" />
        : <AlertCircle size={14} color="#C9A84C" />
      }
      <span style={{ fontSize: 12, color: ok ? "#2ECC71" : "#C9A84C", fontWeight: 600 }}>{label}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div style={{ width: 24, height: 2, background: "#C9A84C" }} />
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F0ECE4" }}>{children}</h2>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color: "#C9A84C" }}>{children}</span>;
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid #162744" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#111F35" }}>
            {headers.map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: "#C9A84C", borderBottom: "1px solid #162744" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #162744" : "none" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 14px", fontSize: 12, color: j === 0 ? "#F0ECE4" : "#7A8FA8", fontWeight: j === 0 ? 600 : 400 }}>
                  {cell.startsWith("`") ? <code style={{ background: "#162744", color: "#C9A84C", padding: "1px 6px", borderRadius: 3, fontSize: 11 }}>{cell.replace(/`/g, "")}</code> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ManualTecnicoClient({ userRole, userName }: Props) {
  const [active, setActive] = useState<Section>("overview");

  return (
    <div className="min-h-screen flex" style={{ background: "#09081A", color: "#F0ECE4" }}>

      {/* Sidebar nav */}
      <nav className="w-56 flex-shrink-0 py-10 px-4 border-r" style={{ borderColor: "#162744", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div className="mb-6">
          <Label>Manual Técnico</Label>
          <p style={{ fontSize: 10, color: "#7A8FA8", marginTop: 4 }}>Restrito · {userRole}</p>
        </div>
        <div className="flex flex-col gap-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className="text-left rounded-lg px-3 py-2 transition-colors"
              style={{
                fontSize: 12, fontWeight: active === s.id ? 600 : 400,
                color: active === s.id ? "#F0ECE4" : "#7A8FA8",
                background: active === s.id ? "#162744" : "transparent",
                borderLeft: active === s.id ? "2px solid #C9A84C" : "2px solid transparent",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-3xl px-10 py-10 overflow-y-auto">

        {/* VISÃO GERAL */}
        {active === "overview" && (
          <div>
            <SectionTitle>Visão Geral — Sistema Anti-Falha V3</SectionTitle>
            <p style={{ color: "#7A8FA8", fontSize: 14, lineHeight: 1.75, marginBottom: 24 }}>
              Implementado em 13/05/2026. Resolve o problema de regras escritas sem enforcement: correções feitas em uma sessão eram esquecidas na próxima, documentos iam para pastas erradas, workflows n8n falhavam silenciosamente.
            </p>

            <div className="mb-6">
              <Label>Status dos componentes</Label>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <StatusBadge ok label="write-path-guard v2 · Ativo" />
                <StatusBadge ok label="stop-logger v3 · Ativo" />
                <StatusBadge ok label="W0 Error Catch · Ativo" />
                <StatusBadge ok label="execution_errors · Ativo" />
              </div>
            </div>

            <div className="mb-6">
              <Label>Diagrama de fluxo</Label>
              <CodeBlock code={`SESSÃO ENCERRA
    │
    ▼
stop-logger.js → Claude Haiku → session-decisions.md
                                       │
                                       ▼
                              PRÓXIMA SESSÃO
                              CLAUDE.md lê decisions antes de começar

SALVAR ARQUIVO
    │
    ▼
write-path-guard.js
    ├── .html/.pdf em Downloads? → BLOQUEIA
    └── Arquivo v3 fora de V3 Central? → BLOQUEIA

N8N WORKFLOW FALHA
    │
    ▼
W0 → execution_errors (Supabase) → Portal ADMIN/GESTAO`} />
            </div>

            <div
              className="rounded-lg p-4"
              style={{ background: "#111F35", borderLeft: "3px solid #C9A84C" }}
            >
              <Label>Ação necessária — única vez</Label>
              <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>
                Reiniciar o Claude Code para o <code style={{ color: "#C9A84C", background: "#162744", padding: "1px 5px", borderRadius: 3 }}>ANTHROPIC_API_KEY</code> configurado via <code style={{ color: "#C9A84C", background: "#162744", padding: "1px 5px", borderRadius: 3 }}>setx</code> entrar no ambiente. Variáveis <code style={{ color: "#C9A84C" }}>setx</code> só valem em processos novos.
              </p>
            </div>
          </div>
        )}

        {/* HOOKS & REGRAS */}
        {active === "componentes" && (
          <div>
            <SectionTitle>Hooks & Regras</SectionTitle>

            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Label>write-path-guard.js v2</Label>
                <span style={{ fontSize: 10, color: "#2ECC71" }}>· Hook PreToolUse/Write</span>
              </div>
              <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
                Intercepts every Write tool call before execution. Blocks documents being saved to wrong paths.
              </p>
              <Table
                headers={["Condição", "Ação"]}
                rows={[
                  ["`.html/.pdf/.docx/.xlsx` em `Downloads/` ou `Documents/` avulso", "BLOQUEIA · mostra caminho correto"],
                  ["Arquivo com `v3` no path fora de V3 Central", "BLOQUEIA · redireciona"],
                  ["`.md` V3 fora do wiki (aviso)", "Permite · exibe warning no stderr"],
                  ["Extensões de código (`.js`, `.ts`, `.json`, etc.)", "Sempre permite"],
                  ["Caminhos internos (`.claude/`, repos, `node_modules/`)", "Sempre permite"],
                ]}
              />
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Label>stop-logger.js v3</Label>
                <span style={{ fontSize: 10, color: "#2ECC71" }}>· Hook Stop</span>
              </div>
              <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
                Roda ao encerrar cada sessão Claude Code. Lê o transcript JSONL, chama Claude Haiku, grava decisões.
              </p>
              <CodeBlock code={`Fluxo:
1. Lê data.transcript_path (JSONL)
2. Extrai últimas 16 mensagens de texto
3. POST → api.anthropic.com/v1/messages (claude-haiku-4-5)
   Prompt: "identifique ATÉ 3 decisões novas e importantes"
4. Grava em ~/.claude/rules/session-decisions.md
5. Lista arquivos Write + Edit da sessão
6. Fallback por regex se API indisponível

API Key: ANTHROPIC_API_KEY (env) || ~/.claude/hooks/.anthropic-key`} />
            </div>

            <div>
              <Label>CLAUDE.md — Regras Invioláveis (topo)</Label>
              <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7, margin: "8px 0 12px" }}>
                Bloco adicionado no início do CLAUDE.md. Visível imediatamente a qualquer agente novo. 7 regras mais violadas.
              </p>
              <Table
                headers={["#", "Regra", "Enforcement"]}
                rows={[
                  ["1", "Documentos → V3 Central de Documentos", "Hook write-path-guard"],
                  ["2", "HTML → logo + DM Sans + navy/ouro", "Visual review"],
                  ["3", "Revisão = Edit, nunca criar `-v2`", "Regra document-revision.md"],
                  ["4", "Email → @v3partners.com.br", "Bloxs-ban rule"],
                  ["5", "Wiki = OneDrive/V3partners-inteligencia apenas", "Regra cerebro"],
                  ["6", "Dados de mercado → WebSearch", "Anti-alucinação"],
                  ["7", "Ler session-decisions.md antes de tarefas recorrentes", "CLAUDE.md regra 7"],
                ]}
              />
            </div>
          </div>
        )}

        {/* SUPABASE */}
        {active === "supabase" && (
          <div>
            <SectionTitle>Supabase — execution_errors</SectionTitle>
            <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
              Projeto: <code style={{ color: "#C9A84C", background: "#162744", padding: "1px 6px", borderRadius: 3 }}>sbmuashewklfhdyyuezr</code> (V3 PARTNERS PRO)
            </p>

            <div className="mb-8">
              <Label>Schema completo</Label>
              <CodeBlock code={`CREATE TABLE public.execution_errors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text        NOT NULL,     -- 'n8n'|'claude'|'vercel'|'cron'|'hook'|'api'
  workflow_name text,                     -- nome do workflow/processo
  error_type    text,                     -- 'build'|'runtime'|'deploy'|'db'|'auth'|'timeout'
  error_message text,                     -- até 2000 chars recomendado
  context       jsonb,                    -- workflow_id, execution_id, last_node, stack
  resolved      boolean     DEFAULT false,
  resolved_at   timestamptz,
  resolved_by   text,                     -- email ou session_id
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now() -- via trigger set_updated_at()
);`} />
            </div>

            <div className="mb-8">
              <Label>Índices</Label>
              <CodeBlock code={`-- Queries mais comuns
CREATE INDEX ON execution_errors (source, created_at DESC);
CREATE INDEX ON execution_errors (resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX ON execution_errors (workflow_name, created_at DESC);`} />
            </div>

            <div className="mb-8">
              <Label>RLS Policies</Label>
              <Table
                headers={["Policy", "Roles", "Operação"]}
                rows={[
                  ["`admin_gestao_select`", "ADMIN, GESTAO", "SELECT — leitura total"],
                  ["`admin_gestao_update`", "ADMIN, GESTAO", "UPDATE — marcar resolvido"],
                  ["`authenticated_insert`", "ADMIN, GESTAO, MESA_OPERACIONAL", "INSERT — via portal"],
                  ["Service role (n8n)", "Bypass RLS", "INSERT — automático"],
                ]}
              />
            </div>

            <div>
              <Label>Marcar como resolvido (SQL)</Label>
              <CodeBlock code={`UPDATE public.execution_errors
SET
  resolved    = true,
  resolved_at = now(),
  resolved_by = 'joao@v3partners.com.br'
WHERE id = 'uuid-do-erro';

-- Ver todos os erros abertos
SELECT source, workflow_name, error_message, created_at
FROM public.execution_errors
WHERE resolved = false
ORDER BY created_at DESC;`} />
            </div>
          </div>
        )}

        {/* N8N */}
        {active === "n8n" && (
          <div>
            <SectionTitle>n8n — W0 Error Catch Universal</SectionTitle>

            <Table
              headers={["Workflow", "ID", "Status", "errorWorkflow"]}
              rows={[
                ["W0 — Error Catch Universal", "`dl0zrosKclEtFQZZ`", "Ativo", "— (é o handler)"],
                ["W2 — Intake de Deals V3", "`w110yBrYsFEgk0ZL`", "Ativo", "W0 vinculado"],
                ["W3 — Ingestão de Docs V3", "`aztqIQiL3omVvNQy`", "Ativo", "W0 vinculado"],
              ]}
            />

            <div className="mt-8 mb-6">
              <Label>Estrutura do W0</Label>
              <CodeBlock code={`Error Trigger
    │
    ▼
Formatar Erro (Set node)
    Extrai: workflow.name, workflow.id,
            execution.id, execution.lastNodeExecuted,
            execution.error.message (slice 0-2000),
            execution.error.stack (slice 0-1000)
    │
    ▼
Supabase — Gravar Erro (HTTP Request)
    POST https://sbmuashewklfhdyyuezr.supabase.co/rest/v1/execution_errors
    Auth: service_role key
    Body: { source, workflow_name, error_type, error_message, context }`} />
            </div>

            <div className="mb-6">
              <Label>Vincular W0 em novo workflow</Label>
              <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7, margin: "8px 0 12px" }}>
                Adicionar o novo workflow no script e rodar:
              </p>
              <CodeBlock code={`// Em C:/Users/jlemo/v3-launchers/link-error-workflow.js
// Adicionar ao array WORKFLOWS:
const WORKFLOWS = [
  { id: "w110yBrYsFEgk0ZL", name: "W2 — Intake de Deals V3" },
  { id: "aztqIQiL3omVvNQy", name: "W3 — Ingestao de Docs V3" },
  { id: "SEU-NOVO-ID",     name: "Wn — Nome do Workflow" }, // ← adicionar aqui
];

// Rodar:
node C:/Users/jlemo/v3-launchers/link-error-workflow.js`} />
            </div>
          </div>
        )}

        {/* ARQUIVOS */}
        {active === "arquivos" && (
          <div>
            <SectionTitle>Referência de Arquivos</SectionTitle>
            <Table
              headers={["Arquivo", "Caminho", "Função"]}
              rows={[
                ["`write-path-guard.js`", "`~/.claude/hooks/`", "Bloqueia paths incorretos (PreToolUse/Write)"],
                ["`stop-logger.js`", "`~/.claude/hooks/`", "Captura decisões ao encerrar sessão (Stop)"],
                ["`.anthropic-key`", "`~/.claude/hooks/`", "Fallback da API key para stop-logger"],
                ["`bash-guard.js`", "`~/.claude/hooks/`", "Bloqueia comandos shell destrutivos"],
                ["`pre-compact-backup.js`", "`~/.claude/hooks/`", "Backup antes de compactar contexto"],
                ["`session-decisions.md`", "`~/.claude/rules/`", "Log persistente de decisões entre sessões"],
                ["`failures-log.md`", "`wiki/questions/`", "Registro de falhas recorrentes com status"],
                ["`link-error-workflow.js`", "`~/v3-launchers/`", "Vincula W0 em workflows n8n"],
                ["`gerar-cadernos-disc.js`", "`~/v3-launchers/`", "Gera cadernos DISC de todos os assessments"],
                ["`CLAUDE.md`", "`~/`", "Contexto global — regras invioláveis no topo"],
              ]}
            />

            <div className="mt-8">
              <Label>settings.json — hooks configurados</Label>
              <CodeBlock code={`{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash",  "hooks": [{ "type": "command", "command": "node ...bash-guard.js" }] },
      { "matcher": "Write", "hooks": [{ "type": "command", "command": "node ...write-path-guard.js" }] }
    ],
    "PreCompact": [
      { "hooks": [{ "type": "command", "command": "node ...pre-compact-backup.js" }] }
    ],
    "Stop": [
      { "hooks": [
          { "type": "command", "command": "node ...stop-logger.js" },
          { "type": "command", "command": "node ...stop-jarvis.js" }
      ]}
    ]
  }
}`} />
            </div>
          </div>
        )}

        {/* MANUAL DO USUÁRIO (versão resumida) */}
        {active === "usuario" && (
          <div>
            <SectionTitle>Resumo — Manual do Usuário</SectionTitle>
            <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
              Versão completa disponível em <a href="/docs/usuario" style={{ color: "#C9A84C" }}>/docs/usuario</a>
            </p>

            <div className="space-y-4">
              {[
                { titulo: "Salvar documentos", desc: "O hook de path roda automaticamente. Se tentar salvar fora de V3 Central de Documentos, o Claude recebe mensagem de bloqueio e redireciona. Nenhuma ação necessária." },
                { titulo: "Encerrar sessão Claude Code", desc: "O stop-logger roda em background. Em segundos grava em session-decisions.md as decisões identificadas pela IA. Na próxima sessão, o agente lê isso antes de começar." },
                { titulo: "Workflow n8n falhou", desc: "Nenhuma ação imediata. O W0 já capturou e gravou em execution_errors no Supabase. Consultar: Table Editor → execution_errors → filtered by resolved=false." },
                { titulo: "Criar novo workflow n8n", desc: "Adicionar o ID em link-error-workflow.js e rodar o script para vincular W0 como error handler." },
                { titulo: "Primeira vez após setup", desc: "Reiniciar Claude Code uma vez para ANTHROPIC_API_KEY (configurado via setx) entrar no ambiente do processo." },
              ].map(item => (
                <div key={item.titulo} className="rounded-lg p-4" style={{ background: "#111F35", border: "1px solid #162744" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#F0ECE4", marginBottom: 6 }}>{item.titulo}</p>
                  <p style={{ fontSize: 12, color: "#7A8FA8", lineHeight: 1.65 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
