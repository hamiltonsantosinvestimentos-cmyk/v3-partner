import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Calculator, FileText, ArrowRight, FolderOpen } from "lucide-react";

export default function ConsorcioPage() {
  const sections = [
    {
      href: "/consorcio/simulacao",
      icon: Calculator,
      title: "Simulação de Consórcio",
      description: "Simule parcelas, prazo, taxa de administração e compare grupos de consórcio",
      color: "from-cyan-500 to-blue-600",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/20",
      textColor: "text-cyan-400",
      badge: "Simulador",
    },
    {
      href: "/consorcio/cartas-contempladas",
      icon: Trophy,
      title: "Cartas Contempladas",
      description: "Gerencie cartas de crédito contempladas disponíveis para venda ou uso imediato",
      color: "from-amber-500 to-orange-600",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      textColor: "text-amber-400",
      badge: "Gestão",
    },
    {
      href: "/consorcio/projetos",
      icon: FolderOpen,
      title: "Projetos",
      description: "Projetos de aquisição via consórcio — imóveis, veículos, serviços e mais",
      color: "from-violet-500 to-purple-600",
      bgColor: "bg-violet-500/10",
      borderColor: "border-violet-500/20",
      textColor: "text-violet-400",
      badge: "Portfólio",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Consórcio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Simulações, cartas contempladas e gestão de projetos de consórcio
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="h-full cursor-pointer group hover:border-opacity-50 transition-all duration-200">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center shadow-lg`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-md ${section.bgColor} ${section.textColor} border ${section.borderColor}`}
                    >
                      {section.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white">
                      {section.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {section.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-border/50">
                    <ArrowRight
                      className={`w-4 h-4 ${section.textColor} group-hover:translate-x-1 transition-transform`}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
