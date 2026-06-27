"use client";

import React, { useState } from "react";
import {
  Copy,
  CheckCheck,
  Share2,
  Users,
  UserCheck,
  Clock,
  Trophy,
  Star,
  Lock,
  TrendingUp,
  Gift,
  ExternalLink,
  BadgePercent,
  UserPlus,
} from "lucide-react";

interface Props {
  userId: string;
  partnerName: string;
  role: string;
  leadsLink: string;
  partnerLink: string;
  discountPercent: number;
  discountMonthsRemaining: number;
  partnersIndicados: number;
  stats: {
    totalIndicados: number;
    ativos: number;
    pendentes: number;
    ganhos: number;
  };
}

interface Milestone {
  label: string;
  icon: string;
  required: number;
  description: string;
}

const MILESTONES: Milestone[] = [
  { label: "Primeiro Indicado", icon: "🌱", required: 1, description: "Fez sua primeira indicação" },
  { label: "Trio de Ouro", icon: "⭐", required: 3, description: "3 indicações realizadas" },
  { label: "Embaixador V3", icon: "🏆", required: 5, description: "5 indicações realizadas" },
  { label: "Top Indicador", icon: "💎", required: 10, description: "10 indicações realizadas" },
  { label: "Lenda V3", icon: "👑", required: 25, description: "25 indicações realizadas" },
];

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* noop */ }
  };
  return (
    <button
      onClick={handle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
        copied
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/30"
      }`}
    >
      {copied ? (
        <><CheckCheck className="w-3.5 h-3.5" /> Copiado!</>
      ) : (
        <><Copy className="w-3.5 h-3.5" /> Copiar</>
      )}
    </button>
  );
}

export function IndicacoesDashboardClient({
  partnerName: _partnerName,
  leadsLink,
  partnerLink,
  discountPercent,
  discountMonthsRemaining,
  partnersIndicados,
  stats,
}: Props) {
  const whatsappLeads = encodeURIComponent(
    `Olá! Sou parceiro da V3 Partners, uma boutique institucional multiproduto.\n\nConheça nossos serviços de crédito estruturado, consórcio, split fiscal, M&A e muito mais.\n\nAcesse pelo meu link: ${leadsLink}`
  );
  const whatsappPartner = encodeURIComponent(
    `Olá! Estou te convidando para ser parceiro V3 Partners.\n\nAcesse pelo meu link e garanta condições especiais: ${partnerLink}`
  );

  const unlockedCount = MILESTONES.filter((m) => stats.totalIndicados >= m.required).length;
  const rankPlaceholder = stats.totalIndicados > 0 ? Math.max(1, 10 - stats.totalIndicados) : "—";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F0ECE4]">
          Indicações —{" "}
          <span className="bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] bg-clip-text text-transparent">
            Programa de Parceiros
          </span>
        </h1>
        <p className="text-[#7A8FA8] text-sm mt-1">
          Indique clientes ou novos parceiros e ganhe recompensas automáticas
        </p>
      </div>

      {/* Desconto ativo banner */}
      {discountPercent > 0 && discountMonthsRemaining > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-900/30 via-[#111F35] to-[#0D1B2E] p-5">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <BadgePercent className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-emerald-400">
                Desconto ativo: {discountPercent}% na mensalidade
              </p>
              <p className="text-sm text-[#7A8FA8] mt-0.5">
                Você tem{" "}
                <span className="text-[#F0ECE4] font-semibold">
                  {discountMonthsRemaining} {discountMonthsRemaining === 1 ? "mês" : "meses"} restantes
                </span>{" "}
                de desconto por indicação de parceiro convertida.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Incentive banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[#C9A84C]/30 bg-gradient-to-br from-[#162744] via-[#111F35] to-[#0D1B2E] p-5">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
            <Gift className="w-6 h-6 text-[#C9A84C]" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 flex-1">
            <div>
              <p className="text-sm font-bold text-[#E8C97A] mb-1">Indicar Clientes</p>
              <p className="text-xs text-[#7A8FA8]">
                Envie o link de leads. Quando o contato virar cliente V3, você ganha comissão da operação fechada.
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-[#E8C97A] mb-1">Indicar Parceiros</p>
              <p className="text-xs text-[#7A8FA8]">
                Convide alguém para assinar um plano V3. Quando ativar, você ganha{" "}
                <span className="text-[#F0ECE4]">10% de desconto na mensalidade por 6 meses</span>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Link cards — dois links */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Link de leads */}
        <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#C9A84C]" />
            <p className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide">
              Link de Clientes / Leads
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#0D1B2E] border border-[#243A66] rounded-xl px-3 py-2.5 mb-3">
            <span className="flex-1 text-xs text-[#F0ECE4] font-mono truncate">{leadsLink}</span>
            <CopyButton text={leadsLink} />
          </div>
          <div className="flex gap-2">
            <a
              href={`https://wa.me/?text=${whatsappLeads}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(leadsLink)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#243A66]/50 border border-[#3A5070] text-[#7A8FA8] text-xs font-semibold hover:text-[#F0ECE4] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> LinkedIn
            </a>
          </div>
        </div>

        {/* Link de parceiros */}
        <div className="bg-[#111F35] border border-[#C9A84C]/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-[#C9A84C]" />
            <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wide">
              Link de Parceiros — Desconto
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#0D1B2E] border border-[#243A66] rounded-xl px-3 py-2.5 mb-3">
            <span className="flex-1 text-xs text-[#F0ECE4] font-mono truncate">{partnerLink}</span>
            <CopyButton text={partnerLink} />
          </div>
          <div className="flex gap-2">
            <a
              href={`https://wa.me/?text=${whatsappPartner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(partnerLink)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#243A66]/50 border border-[#3A5070] text-[#7A8FA8] text-xs font-semibold hover:text-[#F0ECE4] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> LinkedIn
            </a>
          </div>
          <p className="text-[10px] text-[#7A8FA8] mt-3 leading-relaxed">
            Quando o convidado ativar um plano V3, você recebe <span className="text-[#E8C97A]">10% de desconto na mensalidade por 6 meses</span>.
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center mb-3">
            <Users className="w-4 h-4 text-[#C9A84C]" />
          </div>
          <p className="text-2xl font-bold text-[#C9A84C]">{stats.totalIndicados}</p>
          <p className="text-sm font-medium text-[#F0ECE4] mt-0.5">Leads</p>
          <p className="text-xs text-[#7A8FA8] mt-1">total indicados</p>
        </div>
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-3">
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{stats.ativos}</p>
          <p className="text-sm font-medium text-[#F0ECE4] mt-0.5">Ativos</p>
          <p className="text-xs text-[#7A8FA8] mt-1">leads convertidos</p>
        </div>
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{stats.pendentes}</p>
          <p className="text-sm font-medium text-[#F0ECE4] mt-0.5">Pendentes</p>
          <p className="text-xs text-[#7A8FA8] mt-1">aguardando ativação</p>
        </div>
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center mb-3">
            <UserPlus className="w-4 h-4 text-[#C9A84C]" />
          </div>
          <p className="text-2xl font-bold text-[#C9A84C]">{partnersIndicados}</p>
          <p className="text-sm font-medium text-[#F0ECE4] mt-0.5">Parceiros</p>
          <p className="text-xs text-[#7A8FA8] mt-1">indicados ativos</p>
        </div>
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-lg font-bold text-purple-400">
            {stats.ganhos > 0 ? fmtCurrency(stats.ganhos) : "R$ 0"}
          </p>
          <p className="text-sm font-medium text-[#F0ECE4] mt-0.5">Ganhos</p>
          <p className="text-xs text-[#7A8FA8] mt-1">comissões de indicação</p>
        </div>
      </div>

      {/* Leaderboard teaser */}
      <div className="bg-gradient-to-r from-[#162744] to-[#111F35] border border-[#243A66] rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
          <Trophy className="w-6 h-6 text-[#C9A84C]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-[#F0ECE4]">
            {stats.totalIndicados > 0
              ? `Você está em ${rankPlaceholder}º lugar em indicações este mês`
              : "Faça sua primeira indicação e entre no ranking!"}
          </p>
          <p className="text-xs text-[#7A8FA8] mt-0.5">
            {stats.totalIndicados > 0
              ? "Continue indicando para subir no ranking e ganhar bônus exclusivos"
              : "Os top 3 indicadores do mês ganham bônus de comissão"}
          </p>
        </div>
        <Star className="w-5 h-5 text-[#C9A84C] flex-shrink-0" />
      </div>

      {/* Milestones / badges */}
      <div>
        <p className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide mb-4">
          Conquistas & Marcos
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {MILESTONES.map((m) => {
            const unlocked = stats.totalIndicados >= m.required;
            return (
              <div
                key={m.label}
                className={`relative rounded-xl border p-4 text-center transition-all ${
                  unlocked
                    ? "bg-gradient-to-b from-[#162744] to-[#111F35] border-[#C9A84C]/40 shadow-[0_0_20px_rgba(201,168,76,0.08)]"
                    : "bg-[#0D1B2E] border-[#1E2E45] opacity-60"
                }`}
              >
                {!unlocked && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-3 h-3 text-[#3A5070]" />
                  </div>
                )}
                <div className="text-3xl mb-2">{m.icon}</div>
                <p className={`text-xs font-bold mb-1 ${unlocked ? "text-[#E8C97A]" : "text-[#3A5070]"}`}>
                  {m.label}
                </p>
                <p className={`text-[10px] ${unlocked ? "text-[#7A8FA8]" : "text-[#2A3A50]"}`}>
                  {m.description}
                </p>
                <div className="mt-2">
                  <div className="bg-[#111F35] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (stats.totalIndicados / m.required) * 100)}%`,
                        background: unlocked ? "linear-gradient(90deg,#C9A84C,#E8C97A)" : "#243A66",
                      }}
                    />
                  </div>
                  <p className="text-[9px] text-[#3A5070] mt-1">
                    {Math.min(stats.totalIndicados, m.required)}/{m.required}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-[#0D1B2E] border border-[#243A66] rounded-2xl p-5">
        <p className="text-sm font-bold text-[#F0ECE4] mb-4">Como Funciona</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wide mb-3">Indicação de Clientes</p>
            <div className="space-y-3">
              {[
                { step: "1", title: "Compartilhe o link de leads", desc: "Envie para contatos que podem precisar de crédito, consórcio ou M&A" },
                { step: "2", title: "Lead se cadastra", desc: "O contato acessa e se registra como lead de indicação na plataforma" },
                { step: "3", title: "Você ganha comissão", desc: "Quando a operação fechar, você recebe comissão sobre a transação" },
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center flex-shrink-0 text-[#C9A84C] text-xs font-bold">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#F0ECE4]">{item.title}</p>
                    <p className="text-xs text-[#7A8FA8] mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wide mb-3">Indicação de Parceiros</p>
            <div className="space-y-3">
              {[
                { step: "1", title: "Compartilhe o link de parceiros", desc: "Convide alguém para assinar um plano V3 Partner" },
                { step: "2", title: "Parceiro se cadastra e paga", desc: "O convidado usa seu link e ativa a assinatura" },
                { step: "3", title: "Você recebe desconto", desc: "10% de desconto na sua mensalidade pelos próximos 6 meses" },
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center flex-shrink-0 text-[#C9A84C] text-xs font-bold">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#F0ECE4]">{item.title}</p>
                    <p className="text-xs text-[#7A8FA8] mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
