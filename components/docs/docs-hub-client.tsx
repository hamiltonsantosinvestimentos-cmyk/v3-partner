"use client";

import Link from "next/link";
import { FileText, Lock, BookOpen, ChevronRight, Shield, GitBranch } from "lucide-react";

interface Props {
  userRole: string;
  userName: string;
}

const TECH_ROLES = ["ADMIN", "GESTAO"];
const GOV_ROLES  = ["ADMIN", "GESTAO", "MESA"];

export function DocsHubClient({ userRole, userName }: Props) {
  const canSeeTech = TECH_ROLES.includes(userRole);
  const canSeeGov  = GOV_ROLES.includes(userRole);

  return (
    <div className="min-h-screen" style={{ background: "#09081A", color: "#F0ECE4" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <div style={{ width: 24, height: 2, background: "#C9A84C" }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#C9A84C" }}>
              Central de Documentação
            </span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#F0ECE4", marginBottom: 8 }}>
            Manuais V3 Partners
          </h1>
          <p style={{ color: "#7A8FA8", fontSize: 14, lineHeight: 1.7 }}>
            Documentação operacional, técnica e de uso da plataforma. Atualizado em 13/05/2026.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Manual do Usuário — todos os internos */}
          <Link href="/docs/usuario" className="block group">
            <div
              className="rounded-xl p-6 transition-all duration-200 group-hover:border-[#C9A84C]/40"
              style={{ background: "#111F35", border: "1px solid #162744", height: "100%" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="rounded-lg flex items-center justify-center"
                  style={{ width: 44, height: 44, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)" }}
                >
                  <BookOpen size={20} color="#C9A84C" />
                </div>
                <ChevronRight size={16} color="#7A8FA8" className="group-hover:translate-x-1 transition-transform" />
              </div>
              <div
                className="inline-block mb-3"
                style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C9A84C", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", padding: "3px 10px", borderRadius: 20 }}
              >
                Todos · Equipe interna
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F0ECE4", marginBottom: 8 }}>
                Manual do Usuário
              </h2>
              <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7 }}>
                O que mudou no dia a dia, como usar o sistema anti-falha, como consultar erros e fluxos operacionais da plataforma.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Hooks", "n8n", "Documentos", "Erros"].map(tag => (
                  <span key={tag} style={{ fontSize: 10, color: "#7A8FA8", background: "#162744", padding: "2px 8px", borderRadius: 4 }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Link>

          {/* Manual Técnico — ADMIN + GESTAO */}
          {canSeeTech ? (
            <Link href="/docs/tecnico" className="block group">
              <div
                className="rounded-xl p-6 transition-all duration-200 group-hover:border-[#C9A84C]/40"
                style={{ background: "#111F35", border: "1px solid #162744", height: "100%" }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="rounded-lg flex items-center justify-center"
                    style={{ width: 44, height: 44, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)" }}
                  >
                    <FileText size={20} color="#C9A84C" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#2ECC71", background: "rgba(46,204,113,0.1)", border: "1px solid rgba(46,204,113,0.2)", padding: "3px 8px", borderRadius: 20 }}>
                      Acesso liberado
                    </span>
                    <ChevronRight size={16} color="#7A8FA8" className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
                <div
                  className="inline-block mb-3"
                  style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C9A84C", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", padding: "3px 10px", borderRadius: 20 }}
                >
                  Diretoria · Pessoas-chave
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F0ECE4", marginBottom: 8 }}>
                  Manual Técnico
                </h2>
                <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7 }}>
                  Arquitetura completa do sistema anti-falha, referência de arquivos, schema Supabase, configuração de hooks e workflows n8n.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Arquitetura", "Supabase", "Hooks", "n8n", "Schema"].map(tag => (
                    <span key={tag} style={{ fontSize: 10, color: "#7A8FA8", background: "#162744", padding: "2px 8px", borderRadius: 4 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ) : (
            <div
              className="rounded-xl p-6 opacity-50"
              style={{ background: "#111F35", border: "1px solid #162744", height: "100%", cursor: "not-allowed" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="rounded-lg flex items-center justify-center"
                  style={{ width: 44, height: 44, background: "#162744" }}
                >
                  <Lock size={20} color="#7A8FA8" />
                </div>
                <Shield size={16} color="#7A8FA8" />
              </div>
              <div
                className="inline-block mb-3"
                style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#7A8FA8", background: "#162744", padding: "3px 10px", borderRadius: 20 }}
              >
                Restrito · Diretoria
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#7A8FA8", marginBottom: 8 }}>
                Manual Técnico
              </h2>
              <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7 }}>
                Acesso restrito a ADMIN e Gestão. Solicite acesso ao administrador da plataforma.
              </p>
            </div>
          )}
        </div>

        {/* Governança Corporativa — ADMIN/GESTAO/MESA */}
        {canSeeGov && (
          <div className="mt-6">
            <Link href="/docs/governanca" className="block group">
              <div
                className="rounded-xl p-6 transition-all duration-200 group-hover:border-[#C9A84C]/40"
                style={{ background: "#111F35", border: "1px solid #162744" }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="rounded-lg flex items-center justify-center"
                    style={{ width: 44, height: 44, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}
                  >
                    <GitBranch size={20} color="#4ade80" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#4ade80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", padding: "3px 8px", borderRadius: 20 }}>
                      Live
                    </span>
                    <ChevronRight size={16} color="#7A8FA8" className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
                <div
                  className="inline-block mb-3"
                  style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C9A84C", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", padding: "3px 10px", borderRadius: 20 }}
                >
                  Diretoria · Mesa · Gestão
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F0ECE4", marginBottom: 8 }}>
                  Governança & Roadmap
                </h2>
                <p style={{ color: "#7A8FA8", fontSize: 13, lineHeight: 1.7 }}>
                  Rastreabilidade completa do portal: features em produção, sprint ativo, decisões de arquitetura (ADRs), riscos operacionais e status de migrações Supabase.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Roadmap", "ADRs", "Riscos", "Migrações", "Sprint"].map(tag => (
                    <span key={tag} style={{ fontSize: 10, color: "#7A8FA8", background: "#162744", padding: "2px 8px", borderRadius: 4 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Info footer */}
        <div
          className="mt-10 rounded-lg px-5 py-4 flex items-start gap-3"
          style={{ background: "#111F35", border: "1px solid #162744" }}
        >
          <div style={{ width: 3, height: 40, background: "#C9A84C", borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C9A84C", marginBottom: 4 }}>
              Link direto para o Manual Técnico
            </p>
            <p style={{ fontSize: 12, color: "#7A8FA8", fontFamily: "monospace" }}>
              app.v3partners.com.br/docs/tecnico
            </p>
            <p style={{ fontSize: 11, color: "#7A8FA8", marginTop: 4 }}>
              Requer login com role ADMIN ou Gestão. Compartilhe apenas com pessoas autorizadas.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
