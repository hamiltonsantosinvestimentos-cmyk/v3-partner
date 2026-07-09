"use client";
import { useEffect, useState } from "react";
import { Video, Clock, Users, Calendar, Download, CheckCircle2, Loader2 } from "lucide-react";

interface LiveClass {
  id: string;
  title: string;
  description?: string | null;
  instructor?: string | null;
  category?: string | null;
  date: string; // ISO
  duration_min: number;
  level?: string | null;
  total_spots: number;
  zoom_link?: string | null;
  recording_url?: string | null;
  registered_count: number;
  is_registered: boolean;
}

function generateICS(cls: LiveClass): string {
  const start = new Date(cls.date);
  const end = new Date(start.getTime() + cls.duration_min * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//V3Partners//Academy//EN",
    "BEGIN:VEVENT",
    `UID:${cls.id}@v3partners`,
    `SUMMARY:${cls.title} — V3 Academy`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `DESCRIPTION:Instrutor: ${cls.instructor ?? ""}. Link: ${cls.zoom_link ?? ""}`,
    `LOCATION:${cls.zoom_link ?? ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
}

function downloadICS(cls: LiveClass) {
  const blob = new Blob([generateICS(cls)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `v3-academy-${cls.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

const LEVEL_COLORS: Record<string, string> = {
  Iniciante: "text-emerald-400",
  Intermediário: "text-amber-400",
  Avançado: "text-red-400",
};

export function LiveClasses() {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [registering, setRegistering] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/academy/live-classes")
      .then(r => r.json())
      .then(d => {
        if (d.classes) {
          const upcoming = (d.classes as LiveClass[]).filter(c => new Date(c.date) >= new Date());
          setClasses(upcoming);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleRegister(cls: LiveClass) {
    setRegistering(cls.id);
    try {
      const res = await fetch("/api/academy/live-classes/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ live_class_id: cls.id }),
      });
      if (res.ok) {
        setClasses(prev => prev.map(c => c.id === cls.id ? { ...c, is_registered: true, registered_count: c.registered_count + 1 } : c));
      }
    } finally {
      setRegistering(null);
    }
  }

  if (loading || classes.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <h3 className="text-sm font-bold text-[#F0ECE4]">Ao Vivo — Próximas aulas</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {classes.map((cls) => {
          const dt = new Date(cls.date);
          const dateStr = dt.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          const spotsLeft = Math.max(cls.total_spots - cls.registered_count, 0);
          const spotsP = Math.round((spotsLeft / cls.total_spots) * 100);
          return (
            <div
              key={cls.id}
              className="bg-[#0D1929] border border-[#1B3050] rounded-2xl p-4 flex flex-col gap-3 hover:border-[#C9A84C]/30 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-[#7A8FA8] bg-[#162744] border-[#243A66]">
                  {cls.category ?? "Geral"}
                </span>
                {cls.level && (
                  <span className={`text-[10px] font-semibold ${LEVEL_COLORS[cls.level] ?? "text-[#7A8FA8]"}`}>
                    {cls.level}
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#F0ECE4] leading-snug mb-1">{cls.title}</h4>
                {cls.instructor && <p className="text-[10px] text-[#7A8FA8]">com {cls.instructor}</p>}
              </div>
              <div className="space-y-1.5 text-[10px] text-[#7A8FA8]">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {dateStr}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {cls.duration_min} min
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  {spotsLeft} vagas restantes
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[9px] text-[#7A8FA8] mb-1">
                  <span>Vagas</span>
                  <span>{cls.registered_count}/{cls.total_spots}</span>
                </div>
                <div className="h-1 bg-[#162744] rounded-full">
                  <div className="h-full rounded-full bg-[#C9A84C]" style={{ width: `${spotsP}%` }} />
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                {cls.is_registered ? (
                  <a
                    href={cls.zoom_link ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Inscrito — Acessar
                  </a>
                ) : (
                  <button
                    onClick={() => handleRegister(cls)}
                    disabled={registering === cls.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
                  >
                    {registering === cls.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                    Inscrever-se
                  </button>
                )}
                <button
                  onClick={() => downloadICS(cls)}
                  className="p-2 border border-[#1B3050] rounded-xl text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#C9A84C]/40 transition-all"
                  title="Adicionar ao calendário"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
