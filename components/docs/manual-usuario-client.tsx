"use client";

import { CheckCircle2, AlertCircle, FolderOpen, Zap, Terminal } from "lucide-react";

interface Props { userRole: string; userName: string; }

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "#111F35", border: "1px solid #162744" }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, background: "rgba(201,168,76,0.1)", flexShrink: 0 }}>
          {icon}
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F0ECE4" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 rounded-full flex items-center justify-center" style={{ width: 24, height: 24, background: "#162744", border: "1px solid #C9A84C", fontSize: 11, fontWeight: 700, color: "#C9A84C" }}>
        {n}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#F0ECE4", marginBottom: 3 }}>{title}</p>
        <p style={{ fontSize: 12, color: "#7A8FA8", lineHeight: 1.65 }}>{desc}</p>
      </div>
    </div>
  );
}

export function ManualUsuarioClient({ userRole, userName }: Props) {
  return (
    <div className="min-h-screen" style={{ background: "#09081A", color: "#F0ECE4" }}>
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <div style={{ width: 24, height: 2, background: "#C9A84C" }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#C9A84C" }}>
              Manual do Usuário · Equipe V3
            </span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, color: "#F0ECE4", marginBottom: 8 }}>
            O que mudou no dia a dia
          </h1>
          <p style={{ color: "#7A8FA8", fontSize: 14, lineHeight: 1.7 }}>
            Sistema Anti-Falha V3 — implementado em 13/05/2026. Esta página explica como o sistema funciona na prática, sem precisar entender a parte técnica.
          </p>
        </div>

        {/* O que o sistema faz */}
        <div className="mb-8">
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#C9A84C" }}>O que foi resolvido</span>
          <div className="grid grid-cols-1 gap-3 mt-4">
            {[
              { ok: true,  label: "Documentos sendo salvos no lugar errado — resolvido" },
              { ok: true,  label: "Claude esquecendo correções entre sessões — resolvido" },
              { ok: true,  label: "Workflows n8n falhando sem ninguém saber — resolvido" },
              { ok: true,  label: "Identidade visual ignorada em sessão nova — resolvido" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "#111F35", border: `1px solid ${item.ok ? "rgba(46,204,113,0.2)" : "rgba(201,168,76,0.2)"}` }}>
                {item.ok ? <CheckCircle2 size={15} color="#2ECC71" /> : <AlertCircle size={15} color="#C9A84C" />}
                <span style={{ fontSize: 12, color: "#F0ECE4" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">

          {/* Salvar documentos */}
          <Card icon={<FolderOpen size={18} color="#C9A84C" />} title="Ao salvar qualquer documento">
            <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
              O sistema verifica automaticamente se o arquivo está indo para o lugar certo. Se não estiver, bloqueia e mostra para onde deve ir. Nenhuma ação necessária da sua parte.
            </p>
            <div className="rounded-lg p-3" style={{ background: "#09081A", border: "1px solid #243A66" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C9A84C", marginBottom: 6 }}>Destino correto para cada tipo</p>
              {[
                ["Contratos, NDAs", "01_Juridico/"],
                ["Relatórios financeiros", "02_Financeiro/"],
                ["CIM, Teasers, Deal Cards", "03_MA_e_Deals/"],
                ["Logos, brandbook, peças", "04_Identidade_Visual/"],
                ["Propostas, pitch decks", "05_Comercial/"],
                ["SOPs, manuais", "06_Operacional/"],
                ["JDs, contratos PJ, DISC", "07_Pessoal/"],
              ].map(([tipo, pasta]) => (
                <div key={tipo} className="flex justify-between items-center py-1" style={{ borderBottom: "1px solid #162744" }}>
                  <span style={{ fontSize: 11, color: "#7A8FA8" }}>{tipo}</span>
                  <code style={{ fontSize: 10, color: "#C9A84C", background: "#162744", padding: "1px 6px", borderRadius: 3 }}>{pasta}</code>
                </div>
              ))}
            </div>
          </Card>

          {/* Encerrar sessão */}
          <Card icon={<Terminal size={18} color="#C9A84C" />} title="Ao encerrar uma sessão Claude Code">
            <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
              Ao fechar o Claude Code, um processo roda automaticamente em background e identifica as principais decisões da sessão usando IA. Na próxima sessão, o Claude lê isso antes de começar qualquer tarefa recorrente.
            </p>
            <div className="rounded-lg p-3" style={{ background: "#09081A", border: "1px solid #243A66" }}>
              <p style={{ fontSize: 11, color: "#7A8FA8" }}>O que é salvo automaticamente:</p>
              <ul className="mt-2 space-y-1">
                {["Até 3 decisões ou correções novas da sessão", "Arquivos criados e modificados", "Data e identificador da sessão"].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#C9A84C", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "#7A8FA8" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Erros n8n */}
          <Card icon={<Zap size={18} color="#C9A84C" />} title="Quando um workflow n8n falhar">
            <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              O sistema captura o erro automaticamente e registra no banco de dados. Você só precisa consultar quando for resolver.
            </p>
            <div className="space-y-3">
              <Step n={1} title="Acessar os erros registrados" desc="Supabase dashboard → projeto V3 PARTNERS PRO → Table Editor → tabela execution_errors → filtrar resolved = false" />
              <Step n={2} title="Identificar o problema" desc="Campos: workflow_name (qual workflow), error_message (o erro), last_node (em qual nó parou), created_at (quando)" />
              <Step n={3} title="Resolver e marcar" desc="Após resolver, atualizar: resolved = true, resolved_at = agora, resolved_by = seu email" />
              <Step n={4} title="Novos workflows n8n" desc="Sempre vincular o W0 (Error Catch) rodando o script: node C:/Users/jlemo/v3-launchers/link-error-workflow.js" />
            </div>
          </Card>

          {/* Ação única */}
          <div className="rounded-xl p-5" style={{ background: "#111F35", borderLeft: "3px solid #C9A84C" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#C9A84C", marginBottom: 8 }}>Ação necessária — somente uma vez</p>
            <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7 }}>
              Reiniciar o Claude Code uma vez para ativar o resumo inteligente por IA no encerramento de sessões. A chave da API foi configurada, mas precisa de um novo processo para entrar no ambiente.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-10 pt-6" style={{ borderTop: "1px solid #162744" }}>
          <p style={{ fontSize: 11, color: "#7A8FA8" }}>
            Manual Técnico completo (somente Diretoria): <a href="/docs/tecnico" style={{ color: "#C9A84C" }}>app.v3partners.com.br/docs/tecnico</a>
          </p>
          <p style={{ fontSize: 11, color: "#7A8FA8", marginTop: 4 }}>V3 Partners Soluções Ltda · v3partners.com.br · 13/05/2026</p>
        </div>

      </div>
    </div>
  );
}
