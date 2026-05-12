"use client";

import React, { useState, useEffect } from "react";
import { BarChart2, TrendingUp, TrendingDown, Users, Award, Loader2 } from "lucide-react";

interface VideoStat {
  id: string;
  title: string;
  category: string;
  views: number;
  completed: number;
  avgProgress: number;
  completionRate: number;
}

interface CategoryStat {
  id: string;
  label: string;
  icon: string;
  color: string;
  certCount: number;
  avgCompletion: number;
  videoCount: number;
}

interface AnalyticsData {
  videoStats: VideoStat[];
  categoryStats: CategoryStat[];
  abandoned: VideoStat[];
  topVideos: VideoStat[];
  totalUsers: number;
  totalCompleted: number;
  totalCerts: number;
}

export function AcademyAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "videos" | "abandoned">("overview");

  useEffect(() => {
    fetch("/api/academy/analytics")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  if (!data) return <p className="text-center text-muted-foreground py-8">Erro ao carregar analytics.</p>;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0D1929] border border-[#243A66] rounded-xl p-4 text-center">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold text-white">{data.totalUsers}</p>
          <p className="text-xs text-muted-foreground">Usuários ativos</p>
        </div>
        <div className="bg-[#0D1929] border border-[#243A66] rounded-xl p-4 text-center">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400">{data.totalCompleted}</p>
          <p className="text-xs text-muted-foreground">Aulas concluídas</p>
        </div>
        <div className="bg-[#0D1929] border border-[#243A66] rounded-xl p-4 text-center">
          <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/20 flex items-center justify-center mx-auto mb-2">
            <Award className="w-4 h-4 text-[#C9A84C]" />
          </div>
          <p className="text-xl font-bold text-[#C9A84C]">{data.totalCerts}</p>
          <p className="text-xs text-muted-foreground">Certificados emitidos</p>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1 w-fit">
        {([
          { key: "overview", label: "Por Categoria" },
          { key: "videos", label: "Top Vídeos" },
          { key: "abandoned", label: "Baixo Engajamento" },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t.key ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-3">
          {data.categoryStats.map(cat => (
            <div key={cat.id} className="flex items-center gap-4 p-4 bg-[#0D1929] border border-[#243A66] rounded-xl">
              <span className="text-xl w-8 text-center">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-white">{cat.label}</p>
                  <p className="text-xs text-[#C9A84C] font-bold">{cat.avgCompletion}%</p>
                </div>
                <div className="h-1.5 bg-[#243A66] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${cat.avgCompletion}%`, backgroundColor: cat.color }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{cat.certCount} certificados emitidos · {cat.videoCount} aulas</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "videos" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">Vídeos com maior taxa de conclusão</p>
          {data.topVideos.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 p-3 bg-[#0D1929] border border-[#243A66] rounded-xl">
              <span className="text-lg w-6 text-center font-bold text-[#C9A84C]">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{v.title}</p>
                <p className="text-[10px] text-muted-foreground">{v.views} visualizações · {v.completed} completos</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-emerald-400">{v.completionRate}%</p>
                <p className="text-[10px] text-muted-foreground">conclusão</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "abandoned" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">Vídeos com maior taxa de abandono — considere revisar ou melhorar o conteúdo</p>
          {data.abandoned.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhum vídeo com baixo engajamento ainda.</p>
          ) : data.abandoned.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 p-3 bg-[#0D1929] border border-red-500/20 rounded-xl">
              <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{v.title}</p>
                <p className="text-[10px] text-muted-foreground">{v.views} visualizações · {v.avgProgress}% progresso médio</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-red-400">{v.completionRate}%</p>
                <p className="text-[10px] text-muted-foreground">conclusão</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
