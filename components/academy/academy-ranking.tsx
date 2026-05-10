"use client";

import { useState, useEffect } from "react";
import { Trophy, Crown, Loader2, RefreshCw, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROLE_COLORS, ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

interface RankingEntry {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  completed_videos: number;
  in_progress_videos: number;
  watched_hours: number;
  certificates: number;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export function AcademyRanking() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  function fetchRanking() {
    setLoading(true);
    fetch("/api/academy/ranking")
      .then((r) => r.json())
      .then((d) => { setRanking(d.ranking ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchRanking(); }, []);

  const totalCompleted = ranking.reduce((s, r) => s + r.completed_videos, 0);
  const totalHours = ranking.reduce((s, r) => s + r.watched_hours, 0);
  const totalCerts = ranking.reduce((s, r) => s + r.certificates, 0);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Aulas Concluídas", value: totalCompleted, icon: "✅", color: "text-emerald-400" },
          { label: "Horas Assistidas", value: `${Math.round(totalHours)}h`, icon: "⏱", color: "text-[#C9A84C]" },
          { label: "Certificados Emitidos", value: totalCerts, icon: "🎓", color: "text-blue-400" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[#243A66] p-4" style={{ background: "#0D1929" }}>
            <p className="text-2xl mb-1">{k.icon}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-[#7A8FA8] mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-[#243A66] overflow-hidden" style={{ background: "#0D1929" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1B3050]">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#C9A84C]" />
            <span className="text-sm font-bold text-[#F0ECE4]">Ranking de Engajamento</span>
          </div>
          <button
            onClick={fetchRanking}
            className="flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-[#C9A84C]" />
          </div>
        ) : ranking.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#7A8FA8]">Nenhum dado disponível ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1B3050]">
                  {["#", "Partner", "Plano", "Aulas Concluídas", "Em Progresso", "Horas", "Certificados"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#7A8FA8] tracking-wider uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.id} className="border-b border-[#1B3050]/50 hover:bg-white/[0.02] transition-colors">
                    {/* Posição */}
                    <td className="px-4 py-3 text-center">
                      {i < 3 ? (
                        <span className="text-lg">{MEDAL[i]}</span>
                      ) : (
                        <span className="text-sm font-bold text-[#7A8FA8]">{i + 1}</span>
                      )}
                    </td>
                    {/* Partner */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#243A66] flex items-center justify-center text-xs font-bold text-[#C9A84C] flex-shrink-0">
                          {(r.full_name || r.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#F0ECE4]">{r.full_name || "Sem nome"}</p>
                          <p className="text-xs text-[#7A8FA8]">{r.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Plano */}
                    <td className="px-4 py-3">
                      {r.role === "PARTNER_PRO" ? (
                        <Badge className="bg-[#C9A84C]/20 text-[#E8C97A] border-[#C9A84C]/30 flex items-center gap-1 w-fit">
                          <Crown className="w-3 h-3" /> PRO
                        </Badge>
                      ) : (
                        <Badge className={ROLE_COLORS[r.role as UserRole] ?? "bg-blue-500/20 text-blue-300 border-blue-500/30"}>
                          {ROLE_LABELS[r.role as UserRole] ?? r.role}
                        </Badge>
                      )}
                    </td>
                    {/* Concluídas */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${r.completed_videos > 0 ? "text-emerald-400" : "text-[#7A8FA8]"}`}>
                          {r.completed_videos}
                        </span>
                        {r.completed_videos > 0 && (
                          <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, (r.completed_videos / 27) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Em progresso */}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${r.in_progress_videos > 0 ? "text-amber-400" : "text-[#7A8FA8]"}`}>
                        {r.in_progress_videos}
                      </span>
                    </td>
                    {/* Horas */}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${r.watched_hours > 0 ? "text-[#C9A84C]" : "text-[#7A8FA8]"}`}>
                        {r.watched_hours}h
                      </span>
                    </td>
                    {/* Certificados */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {r.certificates > 0 ? (
                          <>
                            <Award className="w-3.5 h-3.5 text-[#C9A84C]" />
                            <span className="text-sm font-bold text-[#C9A84C]">{r.certificates}</span>
                          </>
                        ) : (
                          <span className="text-sm text-[#7A8FA8]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
