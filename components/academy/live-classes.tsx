"use client";
import { Video, Clock, Users, Calendar, Download } from "lucide-react";

interface LiveClass {
  id: string;
  title: string;
  instructor: string;
  date: string; // ISO
  durationMin: number;
  category: string;
  spotsLeft: number;
  totalSpots: number;
  zoomLink: string;
  isFree: boolean;
  priceLabel: string;
  level: "Iniciante" | "Intermediário" | "Avançado";
}

const UPCOMING: LiveClass[] = [
  {
    id: "1",
    title: "Estruturação de FIDC para Novos Assessores",
    instructor: "Hamilton Santos",
    date: "2026-07-15T19:00:00",
    durationMin: 90,
    category: "Crédito",
    spotsLeft: 47,
    totalSpots: 100,
    zoomLink: "https://zoom.us/j/v3partners",
    isFree: true,
    priceLabel: "Gratuito",
    level: "Iniciante",
  },
  {
    id: "2",
    title: "M&A Cross-Border: Oportunidades com Fundos Asiáticos",
    instructor: "João Lemos",
    date: "2026-07-22T18:00:00",
    durationMin: 60,
    category: "M&A",
    spotsLeft: 23,
    totalSpots: 50,
    zoomLink: "https://zoom.us/j/v3partners-ma",
    isFree: false,
    priceLabel: "Gratuito para PRO",
    level: "Avançado",
  },
  {
    id: "3",
    title: "Home Equity: Como fechar deals de alto ticket",
    instructor: "Robson Lino",
    date: "2026-07-29T19:00:00",
    durationMin: 75,
    category: "Crédito",
    spotsLeft: 65,
    totalSpots: 150,
    zoomLink: "https://zoom.us/j/v3partners-he",
    isFree: true,
    priceLabel: "Gratuito",
    level: "Intermediário",
  },
];

function generateICS(cls: LiveClass): string {
  const start = new Date(cls.date);
  const end = new Date(start.getTime() + cls.durationMin * 60000);
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
    `DESCRIPTION:Instrutor: ${cls.instructor}. Link: ${cls.zoomLink}`,
    `LOCATION:${cls.zoomLink}`,
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

const CAT_COLORS: Record<string, string> = {
  Crédito: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  "M&A": "text-purple-400 bg-purple-500/10 border-purple-500/30",
  Fundos: "text-amber-400 bg-amber-500/10 border-amber-500/30",
};

const LEVEL_COLORS: Record<string, string> = {
  Iniciante: "text-emerald-400",
  Intermediário: "text-amber-400",
  Avançado: "text-red-400",
};

export function LiveClasses() {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <h3 className="text-sm font-bold text-[#F0ECE4]">Ao Vivo — Próximas aulas</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {UPCOMING.map((cls) => {
          const dt = new Date(cls.date);
          const dateStr = dt.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          const spotsP = Math.round((cls.spotsLeft / cls.totalSpots) * 100);
          return (
            <div
              key={cls.id}
              className="bg-[#0D1929] border border-[#1B3050] rounded-2xl p-4 flex flex-col gap-3 hover:border-[#C9A84C]/30 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    CAT_COLORS[cls.category] ?? "text-[#7A8FA8] bg-[#162744] border-[#243A66]"
                  }`}
                >
                  {cls.category}
                </span>
                <span className={`text-[10px] font-semibold ${LEVEL_COLORS[cls.level]}`}>
                  {cls.level}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#F0ECE4] leading-snug mb-1">{cls.title}</h4>
                <p className="text-[10px] text-[#7A8FA8]">com {cls.instructor}</p>
              </div>
              <div className="space-y-1.5 text-[10px] text-[#7A8FA8]">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {dateStr}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {cls.durationMin} min
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  {cls.spotsLeft} vagas restantes
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[9px] text-[#7A8FA8] mb-1">
                  <span>Vagas</span>
                  <span>
                    {cls.spotsLeft}/{cls.totalSpots}
                  </span>
                </div>
                <div className="h-1 bg-[#162744] rounded-full">
                  <div
                    className="h-full rounded-full bg-[#C9A84C]"
                    style={{ width: `${spotsP}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <a
                  href={cls.zoomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold rounded-xl transition-colors"
                >
                  <Video className="w-3.5 h-3.5" /> Inscrever-se
                </a>
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
