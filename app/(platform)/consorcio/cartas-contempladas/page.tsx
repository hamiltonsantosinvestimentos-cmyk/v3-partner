"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Trophy, Plus, Search, Home, Car, Wrench, TrendingUp } from "lucide-react";

type LetterType = "IMOVEL" | "VEICULO" | "SERVICO" | "OUTROS";
type LetterStatus = "DISPONIVEL" | "NEGOCIACAO" | "VENDIDA" | "UTILIZADA";

interface ContemplatedLetter {
  id: string;
  code: string;
  type: LetterType;
  creditValue: number;
  admin: string;
  group: string;
  quota: string;
  status: LetterStatus;
  askingPrice: number;
  discount: number;
}

const TYPE_LABELS: Record<LetterType, string> = {
  IMOVEL: "Imóvel",
  VEICULO: "Veículo",
  SERVICO: "Serviço",
  OUTROS: "Outros",
};

const TYPE_ICONS: Record<LetterType, React.ReactNode> = {
  IMOVEL: <Home className="w-4 h-4" />,
  VEICULO: <Car className="w-4 h-4" />,
  SERVICO: <Wrench className="w-4 h-4" />,
  OUTROS: <TrendingUp className="w-4 h-4" />,
};

const STATUS_COLORS: Record<LetterStatus, string> = {
  DISPONIVEL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  NEGOCIACAO: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  VENDIDA: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  UTILIZADA: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const STATUS_LABELS: Record<LetterStatus, string> = {
  DISPONIVEL: "Disponível",
  NEGOCIACAO: "Em Negociação",
  VENDIDA: "Vendida",
  UTILIZADA: "Utilizada",
};

// Sample data for demonstration
const SAMPLE_LETTERS: ContemplatedLetter[] = [
  {
    id: "1",
    code: "CARTA-26-001",
    type: "IMOVEL",
    creditValue: 500000,
    admin: "Porto Seguro",
    group: "G2847",
    quota: "Q-142",
    status: "DISPONIVEL",
    askingPrice: 430000,
    discount: 14,
  },
  {
    id: "2",
    code: "CARTA-26-002",
    type: "IMOVEL",
    creditValue: 350000,
    admin: "Embracon",
    group: "G1234",
    quota: "Q-89",
    status: "DISPONIVEL",
    askingPrice: 305000,
    discount: 12.8,
  },
  {
    id: "3",
    code: "CARTA-26-003",
    type: "VEICULO",
    creditValue: 120000,
    admin: "Caixa",
    group: "G5678",
    quota: "Q-33",
    status: "NEGOCIACAO",
    askingPrice: 108000,
    discount: 10,
  },
];

export default function CartasContempladasPage() {
  const [letters, setLetters] = useState(SAMPLE_LETTERS);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("DISPONIVEL");

  const filtered = letters.filter((l) => {
    const matchSearch = !search || l.code.includes(search) || l.admin.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || l.type === filterType;
    const matchStatus = !filterStatus || l.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const available = letters.filter((l) => l.status === "DISPONIVEL");
  const totalAvailableValue = available.reduce((s, l) => s + l.creditValue, 0);
  const avgDiscount = available.length > 0
    ? available.reduce((s, l) => s + l.discount, 0) / available.length
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Cartas Contempladas</h1>
            <p className="text-xs text-muted-foreground">
              Cartas disponíveis para venda ou uso imediato
            </p>
          </div>
        </div>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          Incluir Carta
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Cartas", value: letters.length, color: "text-white" },
          { label: "Disponíveis", value: available.length, color: "text-emerald-400" },
          { label: "Volume Disponível", value: formatCurrency(totalAvailableValue), color: "text-amber-400" },
          { label: "Desconto Médio", value: `${avgDiscount.toFixed(1)}%`, color: "text-blue-400" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, administradora..."
            className="w-full h-9 pl-9 pr-4 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((letter) => (
          <Card key={letter.id} className="cursor-pointer hover:border-amber-500/30 transition-all group">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                    {TYPE_ICONS[letter.type]}
                  </div>
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">{letter.code}</p>
                    <p className="text-sm font-medium text-foreground">{TYPE_LABELS[letter.type]}</p>
                  </div>
                </div>
                <Badge className={STATUS_COLORS[letter.status]}>
                  {STATUS_LABELS[letter.status]}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Crédito</span>
                  <span className="font-semibold text-white">{formatCurrency(letter.creditValue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Preço de Venda</span>
                  <span className="font-semibold text-amber-400">{formatCurrency(letter.askingPrice)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Desconto</span>
                  <span className="font-semibold text-emerald-400">{letter.discount}%</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
                <span>{letter.admin}</span>
                <span>Grupo {letter.group} · Cota {letter.quota}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Trophy className="w-10 h-10 text-amber-400/50 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma carta encontrada</p>
        </div>
      )}
    </div>
  );
}
