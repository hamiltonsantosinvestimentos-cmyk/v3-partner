import Link from "next/link";
import {
  CreditCard,
  Home,
  Users,
  Building2,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function MesaCreditoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const role = (profileData as { role: string } | null)?.role || "PARTNER";

  const levels = [
    {
      href: "/mesa-credito/nivel-1",
      level: "Nível 1",
      title: "Crédito Varejo",
      description: "Home Equity e Aval — operações de varejo com garantias reais e pessoais",
      icon: Home,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      textColor: "text-blue-400",
      products: ["Home Equity", "Aval", "Crédito Pessoal", "CDC"],
      minValue: "A partir de R$ 10.000",
      allowed: true,
    },
    {
      href: "/mesa-credito/nivel-2",
      level: "Nível 2",
      title: "Crédito Estruturado",
      description: "Operações complexas com estrutura especializada, garantias e instrumentos de mercado de capitais",
      icon: TrendingUp,
      color: "from-amber-500 to-orange-600",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      textColor: "text-amber-400",
      products: ["FIDC", "CRI", "CRA", "Debêntures", "Capital de Giro Estruturado"],
      minValue: "A partir de R$ 500.000",
      allowed: ["ADMIN", "MESA_OPERACIONAL", "GESTAO"].includes(role),
    },
    {
      href: "/mesa-credito/nivel-3",
      level: "Nível 3",
      title: "High Ticket",
      description: "Operações de grande porte — project finance, M&A e real estate de alto valor",
      icon: Building2,
      color: "from-purple-500 to-violet-600",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
      textColor: "text-purple-400",
      products: ["Project Finance", "Infrastructure", "Real Estate", "Fusões & Aquisições"],
      minValue: "A partir de R$ 5.000.000",
      allowed: ["ADMIN", "GESTAO"].includes(role),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Mesa de Crédito</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestão de propostas de crédito em 3 níveis de complexidade
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {levels.map((level) => {
          const Icon = level.icon;
          return (
            <div key={level.href} className="relative">
              {!level.allowed && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
                  <div className="text-center">
                    <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Acesso restrito
                    </p>
                  </div>
                </div>
              )}
              <Link href={level.allowed ? level.href : "#"}>
                <Card className={`h-full hover:border-${level.textColor} transition-all duration-200 cursor-pointer group`}>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${level.color} flex items-center justify-center shadow-lg`}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-md ${level.bgColor} ${level.textColor} border ${level.borderColor}`}
                      >
                        {level.level}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white">
                        {level.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {level.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {level.products.map((product) => (
                        <span
                          key={product}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50"
                        >
                          {product}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {level.minValue}
                      </span>
                      <ArrowRight
                        className={`w-4 h-4 ${level.textColor} group-hover:translate-x-1 transition-transform`}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
