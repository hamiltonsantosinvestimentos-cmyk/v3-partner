"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO_CREATIVE_JOBS, DEMO_CREATIVE_FILES } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Image, Download, RefreshCw, Zap, CheckCircle,
  Clock, AlertCircle, Globe, Flag
} from "lucide-react";

type CreativeJob = {
  id: string;
  deal_id: string;
  status: "PENDING" | "PROCESSING" | "DONE" | "ERROR";
  progress: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type CreativeFile = {
  id: string;
  deal_id: string;
  job_id: string | null;
  file_type: "cim" | "teaser" | "linkedin_post" | "linkedin_story";
  language: "pt-br" | "en";
  format: "pdf" | "png" | "jpg";
  storage_path: string;
  public_url: string | null;
  file_size_kb: number | null;
  created_at: string;
};

const FILE_TYPE_LABELS: Record<string, string> = {
  cim: "CIM — Memorando Completo",
  teaser: "Teaser Cego",
  linkedin_post: "LinkedIn Post",
  linkedin_story: "LinkedIn Story",
};

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  cim: <FileText className="w-4 h-4" />,
  teaser: <FileText className="w-4 h-4" />,
  linkedin_post: <Image className="w-4 h-4" />,
  linkedin_story: <Image className="w-4 h-4" />,
};

const FORMAT_COLORS: Record<string, string> = {
  pdf: "bg-red-500/10 text-red-400 border-red-500/20",
  png: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  jpg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const STATUS_CONFIG = {
  PENDING:    { label: "Aguardando",    icon: <Clock className="w-3.5 h-3.5" />,       color: "text-muted-foreground" },
  PROCESSING: { label: "Gerando...",    icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, color: "text-[#C9A84C]" },
  DONE:       { label: "Concluído",     icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-emerald-400" },
  ERROR:      { label: "Erro",          icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-red-400" },
};

const LANG_FLAGS = { "pt-br": <Flag className="w-3 h-3" />, "en": <Globe className="w-3 h-3" /> };
const LANG_LABELS = { "pt-br": "PT-BR", "en": "EN" };

// Ordem de exibição dos arquivos
const FILE_ORDER = ["cim", "teaser", "linkedin_post", "linkedin_story"];
const LANG_ORDER = ["pt-br", "en"];

interface CriativosPanelProps {
  dealId: string;
  dealName: string;
  isDemo?: boolean;
}

export function CriativosPanel({ dealId, dealName, isDemo = false }: CriativosPanelProps) {
  const [latestJob, setLatestJob] = useState<CreativeJob | null>(null);
  const [files, setFiles] = useState<CreativeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadData = useCallback(async () => {
    if (isDemo) {
      const demoJob = DEMO_CREATIVE_JOBS.find(j => j.deal_id === dealId) ?? null;
      const demoFiles = DEMO_CREATIVE_FILES.filter(f => f.deal_id === dealId);
      setLatestJob(demoJob as CreativeJob | null);
      setFiles(demoFiles as CreativeFile[]);
      setLoading(false);
      return;
    }
    try {
      const supabase = createClient();

      const [jobsRes, filesRes] = await Promise.all([
        supabase.from("creative_jobs").select("*").eq("deal_id", dealId)
          .order("created_at", { ascending: false }).limit(1),
        supabase.from("creative_files").select("*").eq("deal_id", dealId)
          .order("created_at", { ascending: false }),
      ]);

      setLatestJob(jobsRes.data?.[0] ?? null);
      setFiles(filesRes.data ?? []);
    } catch (e) {
      console.error("CriativosPanel loadData error:", e);
    } finally {
      setLoading(false);
    }
  }, [dealId, isDemo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling quando status PROCESSING
  useEffect(() => {
    if (latestJob?.status !== "PROCESSING") return;
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [latestJob?.status, loadData]);

  const handleGenerate = async () => {
    if (isDemo) {
      alert("Modo demo — conecte o Supabase para disparar a geração real.");
      return;
    }
    setGenerating(true);
    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      const { data: job, error } = await supabase
        .from("creative_jobs")
        .insert({ deal_id: dealId, created_by: user?.id ?? null })
        .select()
        .single();

      if (error) throw error;

      // Notifica o Creative Engine (Railway) via fetch
      const engineUrl = process.env.NEXT_PUBLIC_CREATIVE_ENGINE_URL;
      if (engineUrl) {
        await fetch(`${engineUrl}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: job.id, deal_id: dealId }),
        });
      }

      setLatestJob(job as CreativeJob);
    } catch (e) {
      console.error("handleGenerate error:", e);
    } finally {
      setGenerating(false);
      await loadData();
    }
  };

  // Agrupar arquivos por tipo + idioma
  const groupedFiles: Record<string, Record<string, CreativeFile[]>> = {};
  for (const ft of FILE_ORDER) {
    groupedFiles[ft] = {};
    for (const lang of LANG_ORDER) {
      groupedFiles[ft][lang] = files.filter(f => f.file_type === ft && f.language === lang);
    }
  }

  const hasFiles = files.length > 0;
  const jobStatus = latestJob?.status;

  return (
    <div className="space-y-4">

      {/* Status + ação */}
      <Card className={jobStatus === "DONE" ? "border-emerald-500/20 bg-emerald-500/5" : jobStatus === "ERROR" ? "border-red-500/20 bg-red-500/5" : "border-[#C9A84C]/20 bg-[#C9A84C]/5"}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-1">
                Status da Geração
              </p>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : latestJob ? (
                <div className="flex items-center gap-2">
                  <span className={STATUS_CONFIG[latestJob.status].color}>
                    {STATUS_CONFIG[latestJob.status].icon}
                  </span>
                  <span className={`text-sm font-semibold ${STATUS_CONFIG[latestJob.status].color}`}>
                    {STATUS_CONFIG[latestJob.status].label}
                  </span>
                  {latestJob.status === "PROCESSING" && (
                    <span className="text-xs text-muted-foreground">{latestJob.progress}%</span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma geração iniciada</p>
              )}
              {latestJob?.error_message && (
                <p className="text-xs text-red-400 mt-1">{latestJob.error_message}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={loadData}
                className="border-[#C9A84C]/30 text-[#C9A84C]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={generating || jobStatus === "PROCESSING"}
                className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                {jobStatus === "DONE" ? "Regenerar Kit" : "Gerar Kit Completo"}
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          {latestJob?.status === "PROCESSING" && (
            <div className="mt-4 h-1.5 bg-[#243A66] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] rounded-full transition-all duration-500"
                style={{ width: `${latestJob.progress}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Arquivos gerados */}
      {hasFiles ? (
        <div className="space-y-3">
          {FILE_ORDER.map((ft) => {
            const hasAny = LANG_ORDER.some(l => groupedFiles[ft][l].length > 0);
            if (!hasAny) return null;
            return (
              <Card key={ft}>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C] flex items-center gap-2">
                    {FILE_TYPE_ICONS[ft]}
                    {FILE_TYPE_LABELS[ft]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {LANG_ORDER.map((lang) => {
                      const langFiles = groupedFiles[ft][lang];
                      if (langFiles.length === 0) return null;
                      return (
                        <div key={lang} className="border border-[#243A66] rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                            {LANG_FLAGS[lang as "pt-br" | "en"]}
                            {LANG_LABELS[lang as "pt-br" | "en"]}
                          </div>
                          {langFiles.map((f) => (
                            <div key={f.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-[#162744] last:border-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge className={`text-[9px] px-1.5 py-0 ${FORMAT_COLORS[f.format]}`}>
                                  {f.format.toUpperCase()}
                                </Badge>
                                <span className="text-xs text-muted-foreground truncate">
                                  {f.file_size_kb ? `${f.file_size_kb} KB` : "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`/api/ma/preview-criativo?dealId=${dealId}&type=${f.file_type}&lang=${f.language}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Button size="sm" variant="outline" className="h-7 text-xs border-[#243A66] text-muted-foreground hover:text-[#C9A84C] hover:border-[#C9A84C]/30">
                                    Preview
                                  </Button>
                                </a>
                                {f.public_url && (
                                  <a href={f.public_url} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="h-7 text-xs border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10">
                                      <Download className="w-3 h-3 mr-1" />Baixar
                                    </Button>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        !loading && (
          <Card className="border-dashed border-[#243A66]">
            <CardContent className="p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#162744] border border-[#243A66] flex items-center justify-center mx-auto mb-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Nenhum criativo gerado</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-5">
                Use o preview para visualizar o layout de cada peça com os dados deste deal.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {(["cim","teaser","linkedin_post","linkedin_story"] as const).map(type =>
                  (["pt-br","en"] as const).map(lang => (
                    <a
                      key={`${type}-${lang}`}
                      href={`/api/ma/preview-criativo?dealId=${dealId}&type=${type}&lang=${lang}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline" className="h-7 text-[10px] border-[#243A66] text-muted-foreground hover:text-[#C9A84C] hover:border-[#C9A84C]/30">
                        {type === "cim" ? "CIM" : type === "teaser" ? "Teaser" : type === "linkedin_post" ? "Post" : "Story"} · {lang.toUpperCase()}
                      </Button>
                    </a>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )
      )}

    </div>
  );
}
