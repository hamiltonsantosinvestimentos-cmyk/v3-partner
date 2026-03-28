"use client";

import { useState } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Users,
  FileText,
  CreditCard,
  TrendingUp,
  Zap,
  Building2,
  Trophy,
  PieChart,
  ChevronRight,
  Plus,
  Search,
  Printer,
  Filter,
  ArrowRight,
  Calendar,
  User,
  Briefcase,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

type Interaction = {
  id: string;
  date: string;
  type: "visita" | "ligacao" | "email" | "reuniao" | "proposta";
  notes: string;
  author: string;
};

type CRMLead = {
  id: string;
  code: string;
  name: string;
  document: string;
  personType: "PF" | "PJ";
  email: string;
  phone: string;
  segment: string;
  annualRevenue: number;
  city: string;
  state: string;
  status: "prospect" | "qualificado" | "proposta" | "negociacao" | "ganho" | "perdido";
  source: "indicacao" | "ativo" | "digital" | "evento" | "parceiro";
  visitDate: string;
  nextContact: string;
  notes: string;
  convertedTo: "" | "credito_varejo" | "credito_estruturado" | "high_ticket" | "ma" | "consorcio" | "split";
  convertedAt: string;
  productInterest?: string;
  creditLine?: string;
  partnerId: string;
  partnerName: string;
  createdAt: string;
  interactions: Interaction[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  if (v === 0) return "—";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v}`;
}

const CONVERTED_LABELS: Record<string, string> = {
  credito_varejo: "Crédito Varejo",
  credito_estruturado: "Crédito Estruturado",
  high_ticket: "High Ticket",
  ma: "M&A",
  consorcio: "Consórcio",
  split: "Split Fiscal",
};

const STATUS_LABELS: Record<string, string> = {
  prospect: "Prospecção",
  qualificado: "Qualificado",
  proposta: "Proposta",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

const SOURCE_LABELS: Record<string, string> = {
  indicacao: "Indicação",
  ativo: "Ativo",
  digital: "Digital",
  evento: "Evento",
  parceiro: "Parceiro",
};

function formatDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_LEADS: CRMLead[] = [
  {
    id: "crm-001",
    code: "CRM-26-001",
    name: "Construtora Horizonte Ltda",
    personType: "PJ",
    document: "12.345.678/0001-99",
    email: "contato@horizonte.com.br",
    phone: "(11) 98765-4321",
    segment: "Construção Civil",
    annualRevenue: 8500000,
    city: "São Paulo",
    state: "SP",
    status: "negociacao",
    source: "indicacao",
    visitDate: "2026-03-20",
    nextContact: "2026-04-05",
    notes: "Interesse em fundo de construção para empreendimento residencial 80 unidades.",
    convertedTo: "",
    convertedAt: "",
    partnerId: "partner-001",
    partnerName: "João Partner Silva",
    createdAt: "2026-03-01",
    interactions: [
      { id: "i1", date: "2026-03-01", type: "ligacao", notes: "Primeiro contato, cliente demonstrou interesse.", author: "João Partner Silva" },
      { id: "i2", date: "2026-03-15", type: "visita", notes: "Reunião presencial no escritório do cliente. Apresentação do fundo.", author: "João Partner Silva" },
    ],
  },
  {
    id: "crm-002",
    code: "CRM-26-002",
    name: "Dr. Ricardo Souza",
    personType: "PF",
    document: "123.456.789-00",
    email: "ricardo.souza@gmail.com",
    phone: "(21) 97654-3210",
    segment: "Médico / Profissional Liberal",
    annualRevenue: 0,
    city: "Rio de Janeiro",
    state: "RJ",
    status: "qualificado",
    source: "ativo",
    visitDate: "2026-03-18",
    nextContact: "2026-03-30",
    notes: "Cliente interessado em Home Equity para capital de giro do consultório.",
    convertedTo: "",
    convertedAt: "",
    partnerId: "partner-001",
    partnerName: "João Partner Silva",
    createdAt: "2026-03-10",
    interactions: [
      { id: "i3", date: "2026-03-10", type: "email", notes: "Envio de apresentação do produto Home Equity.", author: "João Partner Silva" },
      { id: "i4", date: "2026-03-18", type: "reuniao", notes: "Reunião por videoconferência, cliente comprometido.", author: "João Partner Silva" },
    ],
  },
  {
    id: "crm-003",
    code: "CRM-26-003",
    name: "Agropecuária Vale Verde S/A",
    personType: "PJ",
    document: "98.765.432/0001-11",
    email: "financeiro@valeverde.agr.br",
    phone: "(67) 3456-7890",
    segment: "Agronegócio",
    annualRevenue: 45000000,
    city: "Dourados",
    state: "MS",
    status: "proposta",
    source: "parceiro",
    visitDate: "2026-03-12",
    nextContact: "2026-03-28",
    notes: "Grande operação CPR para safra de soja 2026/2027. Alto potencial.",
    convertedTo: "",
    convertedAt: "",
    partnerId: "partner-002",
    partnerName: "Ana Ferreira",
    createdAt: "2026-02-15",
    interactions: [
      { id: "i5", date: "2026-02-20", type: "visita", notes: "Visita à fazenda, apresentação do CPR.", author: "Ana Ferreira" },
      { id: "i6", date: "2026-03-12", type: "proposta", notes: "Proposta formal enviada. Aguardando retorno do conselho.", author: "Ana Ferreira" },
    ],
  },
  {
    id: "crm-004",
    code: "CRM-26-004",
    name: "TechStart Soluções Digitais",
    personType: "PJ",
    document: "55.443.221/0001-44",
    email: "ceo@techstart.com.br",
    phone: "(11) 94321-8765",
    segment: "Tecnologia / SaaS",
    annualRevenue: 3200000,
    city: "São Paulo",
    state: "SP",
    status: "ganho",
    source: "digital",
    visitDate: "2026-02-28",
    nextContact: "",
    notes: "M&A concluído. Empresa adquirida por grupo de investimento.",
    convertedTo: "ma",
    convertedAt: "2026-03-15",
    partnerId: "partner-002",
    partnerName: "Ana Ferreira",
    createdAt: "2026-02-01",
    interactions: [
      { id: "i7", date: "2026-02-10", type: "ligacao", notes: "Chamada inicial, CEO aberto a conversa sobre M&A.", author: "Ana Ferreira" },
      { id: "i8", date: "2026-02-28", type: "visita", notes: "Reunião com board. Avaliação preliminar.", author: "Ana Ferreira" },
      { id: "i9", date: "2026-03-15", type: "reuniao", notes: "Fechamento. Operação de M&A iniciada.", author: "Ana Ferreira" },
    ],
  },
  {
    id: "crm-005",
    code: "CRM-26-005",
    name: "Grupo Imobiliário Nobre",
    personType: "PJ",
    document: "33.221.100/0001-55",
    email: "diretoria@gruponobre.com.br",
    phone: "(11) 3456-8900",
    segment: "Incorporadora / Imóveis",
    annualRevenue: 120000000,
    city: "São Paulo",
    state: "SP",
    status: "negociacao",
    source: "indicacao",
    visitDate: "2026-03-22",
    nextContact: "2026-04-10",
    notes: "Fundo de construção para empreendimento de alto padrão — 200 unidades.",
    convertedTo: "",
    convertedAt: "",
    partnerId: "partner-003",
    partnerName: "Bruno Alves",
    createdAt: "2026-03-05",
    interactions: [
      { id: "i10", date: "2026-03-05", type: "reuniao", notes: "Apresentação inicial. Grande interesse no fundo.", author: "Bruno Alves" },
      { id: "i11", date: "2026-03-22", type: "visita", notes: "Visita ao terreno e apresentação detalhada.", author: "Bruno Alves" },
    ],
  },
  {
    id: "crm-006",
    code: "CRM-26-006",
    name: "Farmácias Rede Saúde Ltda",
    personType: "PJ",
    document: "77.665.544/0001-33",
    email: "financeiro@redesaude.com.br",
    phone: "(31) 2345-6789",
    segment: "Varejo / Saúde",
    annualRevenue: 18000000,
    city: "Belo Horizonte",
    state: "MG",
    status: "qualificado",
    source: "evento",
    visitDate: "2026-03-08",
    nextContact: "2026-03-25",
    notes: "Interesse em V3Giro para capital de giro da rede. 45 lojas.",
    convertedTo: "credito_estruturado",
    convertedAt: "2026-03-20",
    partnerId: "partner-003",
    partnerName: "Bruno Alves",
    createdAt: "2026-03-08",
    interactions: [
      { id: "i12", date: "2026-03-08", type: "visita", notes: "Contato no evento FinTech Summit BH.", author: "Bruno Alves" },
    ],
  },
  {
    id: "crm-007",
    code: "CRM-26-007",
    name: "Carlos Eduardo Lima",
    personType: "PF",
    document: "987.654.321-00",
    email: "carlosedu@outlook.com",
    phone: "(51) 99876-5432",
    segment: "Empresário / Varejo",
    annualRevenue: 0,
    city: "Porto Alegre",
    state: "RS",
    status: "prospect",
    source: "ativo",
    visitDate: "",
    nextContact: "2026-03-30",
    notes: "Lead frio, aguardando retorno.",
    convertedTo: "",
    convertedAt: "",
    partnerId: "partner-001",
    partnerName: "João Partner Silva",
    createdAt: "2026-03-22",
    interactions: [],
  },
  {
    id: "crm-008",
    code: "CRM-26-008",
    name: "Transportadora Veloz S/A",
    personType: "PJ",
    document: "11.222.333/0001-44",
    email: "gerencia@veloz.com.br",
    phone: "(41) 3567-8901",
    segment: "Logística / Transportes",
    annualRevenue: 22000000,
    city: "Curitiba",
    state: "PR",
    status: "perdido",
    source: "digital",
    visitDate: "2026-02-10",
    nextContact: "",
    notes: "Cliente optou por outro banco. Recontatar em 6 meses.",
    convertedTo: "",
    convertedAt: "",
    partnerId: "partner-002",
    partnerName: "Ana Ferreira",
    createdAt: "2026-01-20",
    interactions: [
      { id: "i13", date: "2026-01-25", type: "ligacao", notes: "Interesse inicial no CGI.", author: "Ana Ferreira" },
      { id: "i14", date: "2026-02-10", type: "reuniao", notes: "Reunião final, cliente escolheu concorrente.", author: "Ana Ferreira" },
    ],
  },
  {
    id: "crm-009",
    code: "CRM-26-009",
    name: "Instituto Educacional Futuro",
    personType: "PJ",
    document: "44.555.666/0001-77",
    email: "financeiro@futuroedu.com.br",
    phone: "(62) 3456-7890",
    segment: "Educação",
    annualRevenue: 9500000,
    city: "Goiânia",
    state: "GO",
    status: "proposta",
    source: "indicacao",
    visitDate: "2026-03-15",
    nextContact: "2026-04-01",
    notes: "Split fiscal para rede de franquias educacionais. 12 unidades.",
    convertedTo: "",
    convertedAt: "",
    partnerId: "partner-001",
    partnerName: "João Partner Silva",
    createdAt: "2026-03-10",
    interactions: [
      { id: "i15", date: "2026-03-10", type: "reuniao", notes: "Reunião com o diretor financeiro.", author: "João Partner Silva" },
      { id: "i16", date: "2026-03-15", type: "visita", notes: "Apresentação detalhada do Split Fiscal.", author: "João Partner Silva" },
    ],
  },
  {
    id: "crm-010",
    code: "CRM-26-010",
    name: "Maria Fernanda Oliveira",
    personType: "PF",
    document: "456.789.123-00",
    email: "mfernanda@gmail.com",
    phone: "(85) 98765-1234",
    segment: "Investidora / Patrimônio",
    annualRevenue: 0,
    city: "Fortaleza",
    state: "CE",
    status: "qualificado",
    source: "digital",
    visitDate: "2026-03-20",
    nextContact: "2026-04-02",
    notes: "Interesse em consórcio imobiliário carta de 400K.",
    convertedTo: "consorcio",
    convertedAt: "2026-03-25",
    partnerId: "partner-003",
    partnerName: "Bruno Alves",
    createdAt: "2026-03-18",
    interactions: [
      { id: "i17", date: "2026-03-20", type: "reuniao", notes: "Videoconferência, cliente muito interessada no consórcio.", author: "Bruno Alves" },
    ],
  },
  {
    id: "crm-011",
    code: "CRM-26-011",
    name: "Holding Patrimonial Silva & Filhos",
    personType: "PJ",
    document: "66.778.899/0001-00",
    email: "holding@silvaefilhos.com.br",
    phone: "(11) 3456-7891",
    segment: "Holding / Patrimônio",
    annualRevenue: 250000000,
    city: "São Paulo",
    state: "SP",
    status: "negociacao",
    source: "indicacao",
    visitDate: "2026-03-25",
    nextContact: "2026-04-15",
    notes: "Operação High Ticket — CRI para portfólio imobiliário R$50M.",
    convertedTo: "",
    convertedAt: "",
    partnerId: "partner-002",
    partnerName: "Ana Ferreira",
    createdAt: "2026-03-01",
    interactions: [
      { id: "i18", date: "2026-03-01", type: "reuniao", notes: "Apresentação ao CFO e jurídico.", author: "Ana Ferreira" },
      { id: "i19", date: "2026-03-25", type: "visita", notes: "Due diligence preliminar iniciada.", author: "Ana Ferreira" },
    ],
  },
  {
    id: "crm-012",
    code: "CRM-26-012",
    name: "Supermercados Bom Preço",
    personType: "PJ",
    document: "22.334.455/0001-66",
    email: "expansao@bompreco.com.br",
    phone: "(82) 3456-7800",
    segment: "Varejo / Alimentação",
    annualRevenue: 35000000,
    city: "Maceió",
    state: "AL",
    status: "prospect",
    source: "ativo",
    visitDate: "",
    nextContact: "2026-04-05",
    notes: "Lead quente indicado. Interesse em Aval para expansão.",
    convertedTo: "",
    convertedAt: "",
    partnerId: "partner-003",
    partnerName: "Bruno Alves",
    createdAt: "2026-03-26",
    interactions: [],
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  { id: "prospect",    label: "Prospecção",  color: "#5A7490", bg: "rgba(90,116,144,0.1)" },
  { id: "qualificado", label: "Qualificado", color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
  { id: "proposta",    label: "Proposta",    color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  { id: "negociacao",  label: "Negociação",  color: "#C4922E", bg: "rgba(196,146,46,0.1)" },
  { id: "ganho",       label: "Ganho ✓",    color: "#10B981", bg: "rgba(16,185,129,0.1)" },
  { id: "perdido",     label: "Perdido ✗",  color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
];

const SEGMENTS = [
  "Construção Civil", "Agronegócio", "Tecnologia / SaaS", "Incorporadora / Imóveis",
  "Varejo / Saúde", "Logística / Transportes", "Educação", "Holding / Patrimônio",
  "Varejo / Alimentação", "Médico / Profissional Liberal", "Empresário / Varejo",
  "Investidora / Patrimônio", "Indústria", "Serviços", "Outro",
];

const PARTNERS = [
  { id: "partner-001", name: "João Partner Silva" },
  { id: "partner-002", name: "Ana Ferreira" },
  { id: "partner-003", name: "Bruno Alves" },
];

const CONVERT_OPTIONS = [
  { id: "credito_varejo",     label: "Crédito Varejo",     desc: "Home Equity, Aval, Fundo Construção", color: "#3B82F6", bg: "rgba(59,130,246,0.1)", icon: CreditCard },
  { id: "credito_estruturado",label: "Crédito Estruturado",desc: "HomeCash, V3Giro, CGI",               color: "#F59E0B", bg: "rgba(245,158,11,0.1)", icon: TrendingUp },
  { id: "high_ticket",        label: "High Ticket",         desc: "CRI, CRA, CPR, Fundos",               color: "#A855F7", bg: "rgba(168,85,247,0.1)", icon: Zap },
  { id: "ma",                 label: "M&A",                 desc: "Fusões e Aquisições",                 color: "#6366F1", bg: "rgba(99,102,241,0.1)", icon: Building2 },
  { id: "consorcio",          label: "Consórcio",           desc: "Imóvel e Veículos",                   color: "#10B981", bg: "rgba(16,185,129,0.1)", icon: Trophy },
  { id: "split",              label: "Split Fiscal",        desc: "Split de Receita",                    color: "#C4922E", bg: "rgba(196,146,46,0.1)", icon: PieChart },
];

function getStatusColor(status: string) {
  const s = STAGES.find((x) => x.id === status);
  return s ? s.color : "#5A7490";
}

function getInteractionIcon(type: string) {
  switch (type) {
    case "visita":   return <MapPin className="w-4 h-4" />;
    case "ligacao":  return <Phone className="w-4 h-4" />;
    case "email":    return <Mail className="w-4 h-4" />;
    case "reuniao":  return <Users className="w-4 h-4" />;
    case "proposta": return <FileText className="w-4 h-4" />;
    default:         return <Star className="w-4 h-4" />;
  }
}

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  visita: "Visita",
  ligacao: "Ligação",
  email: "E-mail",
  reuniao: "Reunião",
  proposta: "Proposta",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function CRMClient({ userRole, userName, userId }: { userRole: string; userName: string; userId: string }) {
  const isAdmin = userRole === "ADMIN";

  const [tab, setTab] = useState<"pipeline" | "leads" | "prospeccao" | "relatorios">("pipeline");
  const [leads, setLeads] = useState<CRMLead[]>(DEMO_LEADS);
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showConvert, setShowConvert] = useState<CRMLead | null>(null);
  const [filterPartner, setFilterPartner] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportPeriod, setReportPeriod] = useState<"semanal" | "mensal" | "anual">("mensal");
  const [reportPartner, setReportPartner] = useState("all");

  // New lead form state
  const [newLead, setNewLead] = useState({
    personType: "PJ" as "PF" | "PJ",
    name: "", document: "", email: "", phone: "", city: "", state: "",
    segment: "", annualRevenue: "", source: "ativo" as CRMLead["source"],
    notes: "", visitDate: "", nextContact: "",
    productInterest: "", creditLine: "",
  });

  // New interaction state (inside detail modal)
  const [newInteractionType, setNewInteractionType] = useState<Interaction["type"]>("ligacao");
  const [newInteractionNotes, setNewInteractionNotes] = useState("");

  // Convert lead selection
  const [selectedConvert, setSelectedConvert] = useState<string>("");

  // Filtered leads
  const visibleLeads = leads.filter((l) => {
    if (!isAdmin && l.partnerId !== userId) return false;
    if (isAdmin && filterPartner !== "all" && l.partnerId !== filterPartner) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterSource !== "all" && l.source !== filterSource) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.segment.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Report filtered leads
  const reportLeads = leads.filter((l) => {
    if (!isAdmin && l.partnerId !== userId) return false;
    if (isAdmin && reportPartner !== "all" && l.partnerId !== reportPartner) return false;
    return true;
  });

  function handleAddInteraction() {
    if (!selectedLead || !newInteractionNotes.trim()) return;
    const interaction: Interaction = {
      id: `i-${Date.now()}`,
      date: todayISO(),
      type: newInteractionType,
      notes: newInteractionNotes,
      author: userName,
    };
    const updated = leads.map((l) =>
      l.id === selectedLead.id
        ? { ...l, interactions: [...l.interactions, interaction] }
        : l
    );
    setLeads(updated);
    setSelectedLead({ ...selectedLead, interactions: [...selectedLead.interactions, interaction] });
    setNewInteractionNotes("");
  }

  function handleUpdateNotes(notes: string) {
    if (!selectedLead) return;
    setLeads(leads.map((l) => (l.id === selectedLead.id ? { ...l, notes } : l)));
    setSelectedLead({ ...selectedLead, notes });
  }

  function handleConvert() {
    if (!showConvert || !selectedConvert) return;
    const now = todayISO();
    const updated = leads.map((l) =>
      l.id === showConvert.id
        ? { ...l, convertedTo: selectedConvert as CRMLead["convertedTo"], convertedAt: now, status: "ganho" as const }
        : l
    );
    setLeads(updated);
    if (selectedLead?.id === showConvert.id) {
      setSelectedLead({ ...selectedLead, convertedTo: selectedConvert as CRMLead["convertedTo"], convertedAt: now, status: "ganho" });
    }
    setShowConvert(null);
    setSelectedConvert("");
  }

  function handleNewLeadSubmit() {
    if (!newLead.name || !newLead.email) return;
    const nextCode = `CRM-26-${String(leads.length + 1).padStart(3, "0")}`;
    const lead: CRMLead = {
      id: `crm-${Date.now()}`,
      code: nextCode,
      name: newLead.name,
      document: newLead.document,
      personType: newLead.personType,
      email: newLead.email,
      phone: newLead.phone,
      segment: newLead.segment,
      annualRevenue: newLead.personType === "PJ" ? Number(newLead.annualRevenue) || 0 : 0,
      city: newLead.city,
      state: newLead.state,
      status: "prospect",
      source: newLead.source,
      visitDate: newLead.visitDate,
      nextContact: newLead.nextContact,
      notes: newLead.notes,
      convertedTo: "",
      convertedAt: "",
      productInterest: newLead.productInterest,
      creditLine: newLead.creditLine,
      partnerId: userId,
      partnerName: userName,
      createdAt: todayISO(),
      interactions: [],
    };
    setLeads([...leads, lead]);
    setShowNewLead(false);
    setNewLead({
      personType: "PJ", name: "", document: "", email: "", phone: "", city: "", state: "",
      segment: "", annualRevenue: "", source: "ativo", notes: "", visitDate: "", nextContact: "",
      productInterest: "", creditLine: "",
    });
  }

  function handlePrint() {
    const el = document.getElementById("crm-report");
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head>
      <title>CRM Report - V3 Partners</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1a1a1a; padding: 24px; }
        h1 { color: #C4922E; } h2 { color: #0A1628; border-bottom: 2px solid #C4922E; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
        th { background: #0A1628; color: white; padding: 8px; text-align: left; }
        td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; }
        tr:nth-child(even) { background: #f5f5f5; }
        .stat { display: inline-block; background: #f0f0f0; border-left: 3px solid #C4922E; padding: 8px 16px; margin: 4px; border-radius: 4px; }
        .stat-label { font-size: 11px; color: #666; } .stat-value { font-size: 20px; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  }

  // KPIs
  const kpiLeads = visibleLeads;
  const kpiQualificados = kpiLeads.filter((l) => l.status === "qualificado").length;
  const kpiNegociacao = kpiLeads.filter((l) => l.status === "negociacao").length;
  const kpiGanhos = kpiLeads.filter((l) => l.status === "ganho").length;
  const kpiConversao = kpiLeads.length > 0 ? ((kpiGanhos / kpiLeads.length) * 100).toFixed(1) : "0.0";

  // Report stats
  const rTotal = reportLeads.length;
  const rQualificados = reportLeads.filter((l) => l.status === "qualificado").length;
  const rGanhos = reportLeads.filter((l) => l.status === "ganho").length;
  const rPerdidos = reportLeads.filter((l) => l.status === "perdido").length;
  const rConversao = rTotal > 0 ? ((rGanhos / rTotal) * 100).toFixed(1) : "0.0";
  const rVolumeConverted = reportLeads.filter((l) => l.annualRevenue > 0 && l.convertedTo !== "").reduce((acc, l) => acc + l.annualRevenue, 0);

  const destCounts = CONVERT_OPTIONS.map((o) => ({
    ...o,
    count: reportLeads.filter((l) => l.convertedTo === o.id).length,
  }));

  const statusCountsReport = STAGES.map((s) => ({
    ...s,
    count: reportLeads.filter((l) => l.status === s.id).length,
  }));

  const reportPartnerName =
    reportPartner === "all"
      ? "Todos os Partners"
      : PARTNERS.find((p) => p.id === reportPartner)?.name ?? reportPartner;

  const periodLabel =
    reportPeriod === "semanal" ? "Semanal" : reportPeriod === "mensal" ? "Mensal" : "Anual";

  return (
    <div style={{ background: "#050C18", minHeight: "100vh", color: "#E8EDF5" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #122036", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#E8EDF5", margin: 0 }}>CRM</h1>
            <p style={{ fontSize: 13, color: "#5A7490", margin: "2px 0 0" }}>
              Gestão de Relacionamento com Clientes
            </p>
          </div>
          <Button onClick={() => setShowNewLead(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Lead
          </Button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 16, flexWrap: "wrap" }}>
          {(["pipeline", "leads", "prospeccao", "relatorios"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 18px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                background: tab === t ? "#C4922E" : "transparent",
                color: tab === t ? "#050C18" : "#5A7490",
                transition: "all 0.15s",
              }}
            >
              {t === "pipeline" ? "Pipeline" : t === "leads" ? "Leads" : t === "prospeccao" ? "🔍 Prospecção" : "Relatórios"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "24px" }}>
        {/* ── TAB: PIPELINE ── */}
        {tab === "pipeline" && (
          <div>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total Leads", value: kpiLeads.length, color: "#5A7490" },
                { label: "Qualificados", value: kpiQualificados, color: "#3B82F6" },
                { label: "Em Negociação", value: kpiNegociacao, color: "#C4922E" },
                { label: "Taxa de Conversão", value: `${kpiConversao}%`, color: "#10B981" },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  style={{ background: "#091221", border: "1px solid #122036", borderRadius: 12, padding: "16px 20px" }}
                >
                  <div style={{ fontSize: 12, color: "#5A7490", marginBottom: 4 }}>{kpi.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Kanban */}
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16 }}>
              {STAGES.map((stage) => {
                const stageLeads = visibleLeads.filter((l) => l.status === stage.id);
                return (
                  <div
                    key={stage.id}
                    style={{
                      minWidth: 220,
                      flex: "0 0 220px",
                      background: "#091221",
                      border: `1px solid #122036`,
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    {/* Column header */}
                    <div
                      style={{
                        padding: "10px 14px",
                        background: stage.bg,
                        borderBottom: `1px solid ${stage.color}40`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 13, color: stage.color }}>{stage.label}</span>
                      <span
                        style={{
                          background: stage.color,
                          color: "#050C18",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "1px 8px",
                        }}
                      >
                        {stageLeads.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
                      {stageLeads.length === 0 && (
                        <div style={{ textAlign: "center", color: "#5A7490", fontSize: 12, padding: "20px 0" }}>
                          Nenhum lead
                        </div>
                      )}
                      {stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          style={{
                            background: "#0F1E35",
                            border: "1px solid #122036",
                            borderRadius: 8,
                            padding: "10px 12px",
                            cursor: "pointer",
                            transition: "border-color 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = stage.color)}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#122036")}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 12, color: "#E8EDF5", lineHeight: 1.3, flex: 1 }}>
                              {lead.name}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: lead.personType === "PJ" ? "rgba(59,130,246,0.2)" : "rgba(168,85,247,0.2)",
                                color: lead.personType === "PJ" ? "#3B82F6" : "#A855F7",
                                marginLeft: 4,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {lead.personType}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: "#5A7490", marginBottom: 4 }}>{lead.segment}</div>
                          <div style={{ fontSize: 11, color: "#5A7490", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                            <MapPin className="w-3 h-3" />
                            {lead.city}, {lead.state}
                          </div>
                          {lead.personType === "PJ" && lead.annualRevenue > 0 && (
                            <div style={{ fontSize: 11, color: "#C4922E", marginBottom: 4, fontWeight: 600 }}>
                              {formatCurrency(lead.annualRevenue)}
                            </div>
                          )}
                          <div style={{ fontSize: 10, color: "#5A7490", marginBottom: 4 }}>
                            Visita: {lead.visitDate ? formatDate(lead.visitDate) : "Sem visita"}
                          </div>
                          {isAdmin && (
                            <div style={{ fontSize: 10, color: "#5A7490", marginBottom: 4 }}>
                              {lead.partnerName}
                            </div>
                          )}
                          {lead.convertedTo && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                background: "rgba(196,146,46,0.15)",
                                color: "#E5B96A",
                                borderRadius: 4,
                                padding: "2px 6px",
                                display: "inline-block",
                                marginTop: 2,
                              }}
                            >
                              {CONVERTED_LABELS[lead.convertedTo]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: LEADS ── */}
        {tab === "leads" && (
          <div>
            {/* Filter bar */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
              <div style={{ position: "relative", flex: "1 1 220px" }}>
                <Search
                  className="w-4 h-4"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#5A7490" }}
                />
                <input
                  type="text"
                  placeholder="Buscar por nome, código, segmento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#091221",
                    border: "1px solid #122036",
                    borderRadius: 8,
                    padding: "8px 12px 8px 32px",
                    color: "#E8EDF5",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  background: "#091221",
                  border: "1px solid #122036",
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: filterStatus === "all" ? "#5A7490" : "#E8EDF5",
                  fontSize: 13,
                  outline: "none",
                }}
              >
                <option value="all">Todos os status</option>
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>

              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                style={{
                  background: "#091221",
                  border: "1px solid #122036",
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: filterSource === "all" ? "#5A7490" : "#E8EDF5",
                  fontSize: 13,
                  outline: "none",
                }}
              >
                <option value="all">Todas as origens</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              {isAdmin && (
                <select
                  value={filterPartner}
                  onChange={(e) => setFilterPartner(e.target.value)}
                  style={{
                    background: "#091221",
                    border: "1px solid #122036",
                    borderRadius: 8,
                    padding: "8px 12px",
                    color: filterPartner === "all" ? "#5A7490" : "#E8EDF5",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="all">Todos os partners</option>
                  {PARTNERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Table */}
            <div style={{ background: "#091221", border: "1px solid #122036", borderRadius: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #122036" }}>
                    {["Código", "Nome / Razão Social", "Tipo", "Segmento", "Faturamento", "Cidade/UF", "Última Visita", "Próx. Contato", "Status", "Convertido", ...(isAdmin ? ["Partner"] : []), "Ações"].map((col) => (
                      <th key={col} style={{ padding: "10px 12px", textAlign: "left", color: "#5A7490", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 12 : 11} style={{ textAlign: "center", padding: 32, color: "#5A7490" }}>
                        Nenhum lead encontrado.
                      </td>
                    </tr>
                  )}
                  {visibleLeads.map((lead, idx) => (
                    <tr
                      key={lead.id}
                      style={{
                        borderBottom: "1px solid #122036",
                        background: idx % 2 === 1 ? "rgba(15,30,53,0.4)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "10px 12px", color: "#5A7490", whiteSpace: "nowrap" }}>{lead.code}</td>
                      <td style={{ padding: "10px 12px", color: "#E8EDF5", fontWeight: 600, whiteSpace: "nowrap" }}>{lead.name}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: lead.personType === "PJ" ? "rgba(59,130,246,0.2)" : "rgba(168,85,247,0.2)",
                            color: lead.personType === "PJ" ? "#3B82F6" : "#A855F7",
                          }}
                        >
                          {lead.personType}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#5A7490", whiteSpace: "nowrap" }}>{lead.segment}</td>
                      <td style={{ padding: "10px 12px", color: "#C4922E", whiteSpace: "nowrap" }}>{formatCurrency(lead.annualRevenue)}</td>
                      <td style={{ padding: "10px 12px", color: "#5A7490", whiteSpace: "nowrap" }}>{lead.city}/{lead.state}</td>
                      <td style={{ padding: "10px 12px", color: "#5A7490", whiteSpace: "nowrap" }}>{formatDate(lead.visitDate)}</td>
                      <td style={{ padding: "10px 12px", color: lead.nextContact ? "#E5B96A" : "#5A7490", whiteSpace: "nowrap" }}>
                        {formatDate(lead.nextContact)}
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: `${getStatusColor(lead.status)}25`,
                            color: getStatusColor(lead.status),
                          }}
                        >
                          {STATUS_LABELS[lead.status]}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        {lead.convertedTo ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "rgba(196,146,46,0.15)",
                              color: "#E5B96A",
                            }}
                          >
                            {CONVERTED_LABELS[lead.convertedTo]}
                          </span>
                        ) : (
                          <span style={{ color: "#5A7490" }}>—</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={{ padding: "10px 12px", color: "#5A7490", whiteSpace: "nowrap" }}>{lead.partnerName}</td>
                      )}
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => setSelectedLead(lead)}
                            style={{
                              background: "rgba(90,116,144,0.2)",
                              border: "1px solid #122036",
                              borderRadius: 6,
                              padding: "4px 10px",
                              color: "#E8EDF5",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            Ver
                          </button>
                          {lead.status !== "ganho" && lead.status !== "perdido" && (
                            <button
                              onClick={() => { setShowConvert(lead); setSelectedConvert(""); }}
                              style={{
                                background: "rgba(196,146,46,0.15)",
                                border: "1px solid rgba(196,146,46,0.3)",
                                borderRadius: 6,
                                padding: "4px 10px",
                                color: "#E5B96A",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <ArrowRight className="w-3 h-3" />
                              Avançar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#5A7490" }}>
              {visibleLeads.length} lead{visibleLeads.length !== 1 ? "s" : ""} encontrado{visibleLeads.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}

        {/* ── TAB: PROSPECÇÃO ── */}
        {tab === "prospeccao" && (
          <ProspeccaoTab
            onAddLead={(prefill) => {
              setNewLead((prev) => ({ ...prev, ...prefill }));
              setShowNewLead(true);
            }}
          />
        )}

        {/* ── TAB: RELATÓRIOS ── */}
        {tab === "relatorios" && (
          <div>
            {/* Controls */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", background: "#091221", border: "1px solid #122036", borderRadius: 8, overflow: "hidden" }}>
                {(["semanal", "mensal", "anual"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setReportPeriod(p)}
                    style={{
                      padding: "8px 16px",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                      background: reportPeriod === p ? "#C4922E" : "transparent",
                      color: reportPeriod === p ? "#050C18" : "#5A7490",
                    }}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>

              {isAdmin && (
                <select
                  value={reportPartner}
                  onChange={(e) => setReportPartner(e.target.value)}
                  style={{
                    background: "#091221",
                    border: "1px solid #122036",
                    borderRadius: 8,
                    padding: "8px 12px",
                    color: reportPartner === "all" ? "#5A7490" : "#E8EDF5",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="all">Todos os partners</option>
                  {PARTNERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}

              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Gerar PDF
              </Button>
            </div>

            {/* Report preview */}
            <div style={{ background: "#091221", border: "1px solid #122036", borderRadius: 12, padding: 24 }}>
              {/* Header */}
              <div style={{ borderBottom: "2px solid #C4922E", paddingBottom: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#C4922E", letterSpacing: 1 }}>V3 PARTNERS</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#E8EDF5", marginTop: 2 }}>Relatório CRM</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#5A7490" }}>
                    <div>Período: <strong style={{ color: "#E8EDF5" }}>{periodLabel}</strong></div>
                    <div>Partner: <strong style={{ color: "#E8EDF5" }}>{reportPartnerName}</strong></div>
                    <div>Gerado em: <strong style={{ color: "#E8EDF5" }}>{formatDate(todayISO())}</strong></div>
                  </div>
                </div>
              </div>

              {/* Summary stats */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#C4922E", marginBottom: 12 }}>Resumo</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  {[
                    { label: "Total Leads", value: rTotal, color: "#5A7490" },
                    { label: "Qualificados", value: rQualificados, color: "#3B82F6" },
                    { label: "Ganhos", value: rGanhos, color: "#10B981" },
                    { label: "Perdidos", value: rPerdidos, color: "#EF4444" },
                    { label: "Taxa Conversão", value: `${rConversao}%`, color: "#C4922E" },
                    { label: "Vol. Convertido", value: formatCurrency(rVolumeConverted), color: "#E5B96A" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        background: "#0F1E35",
                        border: "1px solid #122036",
                        borderLeft: `3px solid ${s.color}`,
                        borderRadius: 8,
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#5A7490", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By status */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#C4922E", marginBottom: 12 }}>Por Status</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {statusCountsReport.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        background: s.bg,
                        border: `1px solid ${s.color}40`,
                        borderRadius: 8,
                        padding: "8px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</span>
                      <span
                        style={{
                          background: s.color,
                          color: "#050C18",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "1px 8px",
                        }}
                      >
                        {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By destination */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#C4922E", marginBottom: 12 }}>Por Destino</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                  {destCounts.map((d) => {
                    const Icon = d.icon;
                    return (
                      <div
                        key={d.id}
                        style={{
                          background: d.bg,
                          border: `1px solid ${d.color}40`,
                          borderRadius: 8,
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <Icon className="w-4 h-4" style={{ color: d.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 11, color: d.color, fontWeight: 600 }}>{d.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: d.color }}>{d.count}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leads table preview */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#C4922E", marginBottom: 12 }}>
                  Leads ({reportLeads.length})
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #122036" }}>
                        {["Código", "Nome", "Tipo", "Segmento", "Faturamento", "Visita", "Status", "Convertido p/", "Interações"].map((col) => (
                          <th key={col} style={{ padding: "8px 10px", textAlign: "left", color: "#5A7490", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportLeads.map((lead, idx) => (
                        <tr key={lead.id} style={{ borderBottom: "1px solid #122036", background: idx % 2 === 1 ? "rgba(15,30,53,0.4)" : "transparent" }}>
                          <td style={{ padding: "7px 10px", color: "#5A7490", whiteSpace: "nowrap" }}>{lead.code}</td>
                          <td style={{ padding: "7px 10px", color: "#E8EDF5", whiteSpace: "nowrap" }}>{lead.name}</td>
                          <td style={{ padding: "7px 10px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: lead.personType === "PJ" ? "rgba(59,130,246,0.2)" : "rgba(168,85,247,0.2)", color: lead.personType === "PJ" ? "#3B82F6" : "#A855F7" }}>
                              {lead.personType}
                            </span>
                          </td>
                          <td style={{ padding: "7px 10px", color: "#5A7490", whiteSpace: "nowrap" }}>{lead.segment}</td>
                          <td style={{ padding: "7px 10px", color: "#C4922E", whiteSpace: "nowrap" }}>{formatCurrency(lead.annualRevenue)}</td>
                          <td style={{ padding: "7px 10px", color: "#5A7490", whiteSpace: "nowrap" }}>{formatDate(lead.visitDate)}</td>
                          <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${getStatusColor(lead.status)}25`, color: getStatusColor(lead.status) }}>
                              {STATUS_LABELS[lead.status]}
                            </span>
                          </td>
                          <td style={{ padding: "7px 10px", color: "#E5B96A", whiteSpace: "nowrap" }}>
                            {lead.convertedTo ? CONVERTED_LABELS[lead.convertedTo] : "—"}
                          </td>
                          <td style={{ padding: "7px 10px", color: "#5A7490", textAlign: "center" }}>
                            {lead.interactions.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: "1px solid #122036", paddingTop: 12, fontSize: 11, color: "#5A7490", textAlign: "center" }}>
                Relatório gerado em {formatDate(todayISO())} — V3 Partners Plataforma
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── HIDDEN PDF REPORT ── */}
      <div id="crm-report" style={{ display: "none" }}>
        <h1>V3 PARTNERS — Relatório CRM</h1>
        <h2>Período: {periodLabel} | Partner: {reportPartnerName} | Gerado em: {formatDate(todayISO())}</h2>

        <h2>Resumo</h2>
        <div>
          <div className="stat"><div className="stat-label">Total Leads</div><div className="stat-value">{rTotal}</div></div>
          <div className="stat"><div className="stat-label">Qualificados</div><div className="stat-value">{rQualificados}</div></div>
          <div className="stat"><div className="stat-label">Ganhos</div><div className="stat-value">{rGanhos}</div></div>
          <div className="stat"><div className="stat-label">Perdidos</div><div className="stat-value">{rPerdidos}</div></div>
          <div className="stat"><div className="stat-label">Taxa de Conversão</div><div className="stat-value">{rConversao}%</div></div>
          <div className="stat"><div className="stat-label">Volume Convertido</div><div className="stat-value">{formatCurrency(rVolumeConverted)}</div></div>
        </div>

        <h2>Por Status</h2>
        <table>
          <thead><tr><th>Status</th><th>Quantidade</th></tr></thead>
          <tbody>
            {statusCountsReport.map((s) => (
              <tr key={s.id}><td>{s.label}</td><td>{s.count}</td></tr>
            ))}
          </tbody>
        </table>

        <h2>Por Destino</h2>
        <table>
          <thead><tr><th>Destino</th><th>Quantidade</th></tr></thead>
          <tbody>
            {destCounts.map((d) => (
              <tr key={d.id}><td>{d.label}</td><td>{d.count}</td></tr>
            ))}
          </tbody>
        </table>

        <h2>Leads do Período</h2>
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Nome</th><th>Tipo</th><th>Segmento</th>
              <th>Faturamento</th><th>Visita</th><th>Status</th><th>Convertido p/</th><th>Interações</th>
            </tr>
          </thead>
          <tbody>
            {reportLeads.map((lead) => (
              <tr key={lead.id}>
                <td>{lead.code}</td>
                <td>{lead.name}</td>
                <td>{lead.personType}</td>
                <td>{lead.segment}</td>
                <td>{formatCurrency(lead.annualRevenue)}</td>
                <td>{formatDate(lead.visitDate)}</td>
                <td>{STATUS_LABELS[lead.status]}</td>
                <td>{lead.convertedTo ? CONVERTED_LABELS[lead.convertedTo] : "—"}</td>
                <td>{lead.interactions.length}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Interações</h2>
        <table>
          <thead>
            <tr><th>Lead</th><th>Data</th><th>Tipo</th><th>Notas</th><th>Autor</th></tr>
          </thead>
          <tbody>
            {reportLeads.flatMap((lead) =>
              lead.interactions.map((i) => (
                <tr key={i.id}>
                  <td>{lead.name}</td>
                  <td>{formatDate(i.date)}</td>
                  <td>{INTERACTION_TYPE_LABELS[i.type] || i.type}</td>
                  <td>{i.notes}</td>
                  <td>{i.author}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <footer style={{ marginTop: 24, borderTop: "1px solid #ccc", paddingTop: 12, fontSize: 11, color: "#666" }}>
          Relatório gerado em {formatDate(todayISO())} — V3 Partners Plataforma
        </footer>
      </div>

      {/* ── MODAL: Lead Detail ── */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => { if (!open) setSelectedLead(null); }}>
        <DialogContent className="max-w-2xl" style={{ background: "#091221", border: "1px solid #122036", maxHeight: "90vh", overflowY: "auto" }}>
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle style={{ color: "#E8EDF5" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span>{selectedLead.name}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "2px 10px",
                        borderRadius: 20,
                        background: `${getStatusColor(selectedLead.status)}25`,
                        color: getStatusColor(selectedLead.status),
                      }}
                    >
                      {STATUS_LABELS[selectedLead.status]}
                    </span>
                  </div>
                </DialogTitle>
                <div style={{ fontSize: 12, color: "#5A7490", marginTop: 4 }}>
                  {selectedLead.code}
                  {isAdmin && ` · ${selectedLead.partnerName}`}
                </div>
              </DialogHeader>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 8 }}>
                {/* Left: Basic data */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#C4922E", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Dados Cadastrais
                  </div>
                  {[
                    { label: "Nome / Razão Social", value: selectedLead.name },
                    { label: "Documento", value: selectedLead.document },
                    { label: "Tipo", value: selectedLead.personType === "PF" ? "Pessoa Física" : "Pessoa Jurídica" },
                    { label: "E-mail", value: selectedLead.email },
                    { label: "Telefone", value: selectedLead.phone },
                    { label: "Segmento", value: selectedLead.segment },
                    ...(selectedLead.personType === "PJ" ? [{ label: "Faturamento Anual", value: formatCurrency(selectedLead.annualRevenue) }] : []),
                    { label: "Cidade / UF", value: `${selectedLead.city}, ${selectedLead.state}` },
                  ].map((row) => (
                    <div key={row.label} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: "#5A7490", marginBottom: 2 }}>{row.label}</div>
                      <div style={{ fontSize: 13, color: "#E8EDF5" }}>{row.value}</div>
                    </div>
                  ))}
                </div>

                {/* Right: CRM data */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#C4922E", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Dados CRM
                  </div>
                  {[
                    { label: "Origem", value: SOURCE_LABELS[selectedLead.source] },
                    { label: "Última Visita", value: formatDate(selectedLead.visitDate) },
                    { label: "Próximo Contato", value: formatDate(selectedLead.nextContact) },
                    { label: "Status", value: STATUS_LABELS[selectedLead.status] },
                    ...(selectedLead.productInterest ? [
                      { label: "Produto de Interesse", value: CONVERTED_LABELS[selectedLead.productInterest] || selectedLead.productInterest },
                      ...(selectedLead.creditLine ? [{ label: "Linha de Crédito", value: selectedLead.creditLine }] : []),
                    ] : []),
                    ...(selectedLead.convertedTo ? [
                      { label: "Convertido p/", value: CONVERTED_LABELS[selectedLead.convertedTo] },
                      { label: "Data Conversão", value: formatDate(selectedLead.convertedAt) },
                    ] : []),
                    { label: "Criado em", value: formatDate(selectedLead.createdAt) },
                  ].map((row) => (
                    <div key={row.label} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: "#5A7490", marginBottom: 2 }}>{row.label}</div>
                      <div style={{ fontSize: 13, color: "#E8EDF5" }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#C4922E", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Observações
                </div>
                <textarea
                  value={selectedLead.notes}
                  onChange={(e) => handleUpdateNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    background: "#0F1E35",
                    border: "1px solid #122036",
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "#E8EDF5",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Interactions */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#C4922E", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Histórico de Interações ({selectedLead.interactions.length})
                </div>

                {selectedLead.interactions.length === 0 && (
                  <div style={{ color: "#5A7490", fontSize: 13, marginBottom: 12 }}>Nenhuma interação registrada.</div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", marginBottom: 12 }}>
                  {selectedLead.interactions.map((inter) => (
                    <div
                      key={inter.id}
                      style={{
                        background: "#0F1E35",
                        border: "1px solid #122036",
                        borderRadius: 8,
                        padding: "10px 12px",
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "rgba(196,146,46,0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#C4922E",
                          flexShrink: 0,
                        }}
                      >
                        {getInteractionIcon(inter.type)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#E8EDF5" }}>
                            {INTERACTION_TYPE_LABELS[inter.type] || inter.type}
                          </span>
                          <span style={{ fontSize: 11, color: "#5A7490" }}>{formatDate(inter.date)}</span>
                          <span style={{ fontSize: 11, color: "#5A7490" }}>· {inter.author}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#E8EDF5" }}>{inter.notes}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add interaction */}
                <div style={{ background: "#0F1E35", border: "1px solid #122036", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#5A7490", marginBottom: 8 }}>Adicionar Interação</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <select
                      value={newInteractionType}
                      onChange={(e) => setNewInteractionType(e.target.value as Interaction["type"])}
                      style={{
                        background: "#091221",
                        border: "1px solid #122036",
                        borderRadius: 6,
                        padding: "6px 10px",
                        color: "#E8EDF5",
                        fontSize: 12,
                        outline: "none",
                      }}
                    >
                      {Object.entries(INTERACTION_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={newInteractionNotes}
                    onChange={(e) => setNewInteractionNotes(e.target.value)}
                    placeholder="Descreva a interação..."
                    rows={2}
                    style={{
                      width: "100%",
                      background: "#091221",
                      border: "1px solid #122036",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "#E8EDF5",
                      fontSize: 12,
                      outline: "none",
                      resize: "vertical",
                      boxSizing: "border-box",
                      marginBottom: 8,
                    }}
                  />
                  <Button size="sm" onClick={handleAddInteraction} disabled={!newInteractionNotes.trim()}>
                    <Plus className="w-3 h-3 mr-1" />
                    Registrar
                  </Button>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <Button variant="outline" onClick={() => setSelectedLead(null)}>
                  Fechar
                </Button>
                {selectedLead.productInterest === "split" && (
                  <Button
                    variant="outline"
                    onClick={() => { window.location.href = "/split-fiscal"; }}
                    style={{ borderColor: "#C4922E", color: "#E5B96A" }}
                  >
                    <PieChart className="w-4 h-4 mr-2" />
                    Simulador Split Fiscal
                  </Button>
                )}
                {selectedLead.productInterest === "consorcio" && (
                  <Button
                    variant="outline"
                    onClick={() => { window.location.href = "/consorcio/simulacao"; }}
                    style={{ borderColor: "#10B981", color: "#10B981" }}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Simulador Consórcio
                  </Button>
                )}
                {selectedLead.status !== "ganho" && selectedLead.status !== "perdido" && (
                  <Button
                    onClick={() => {
                      setShowConvert(selectedLead);
                      setSelectedConvert(selectedLead.productInterest || "");
                    }}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Avançar para Mesa
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODAL: Convert Lead ── */}
      <Dialog open={!!showConvert} onOpenChange={(open) => { if (!open) { setShowConvert(null); setSelectedConvert(""); } }}>
        <DialogContent className="max-w-md" style={{ background: "#091221", border: "1px solid #122036" }}>
          {showConvert && (
            <>
              <DialogHeader>
                <DialogTitle style={{ color: "#E8EDF5" }}>Avançar para qual produto?</DialogTitle>
              </DialogHeader>
              <div style={{ fontSize: 13, color: "#5A7490", marginBottom: 16 }}>
                {showConvert.name}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {CONVERT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedConvert === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedConvert(opt.id)}
                      style={{
                        background: isSelected ? opt.bg : "#0F1E35",
                        border: `2px solid ${isSelected ? opt.color : "#122036"}`,
                        borderRadius: 10,
                        padding: "12px 14px",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Icon className="w-4 h-4" style={{ color: opt.color }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? opt.color : "#E8EDF5" }}>
                          {opt.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#5A7490" }}>{opt.desc}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button variant="outline" onClick={() => { setShowConvert(null); setSelectedConvert(""); }}>
                  Cancelar
                </Button>
                <Button onClick={handleConvert} disabled={!selectedConvert}>
                  <ChevronRight className="w-4 h-4 mr-1" />
                  Confirmar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODAL: New Lead ── */}
      <Dialog open={showNewLead} onOpenChange={setShowNewLead}>
        <DialogContent className="max-w-lg" style={{ background: "#091221", border: "1px solid #122036", maxHeight: "90vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#E8EDF5" }}>Novo Lead</DialogTitle>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8 }}>
            {/* Section 1: Dados Pessoais */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#C4922E", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                1. Dados Pessoais
              </div>

              {/* PF / PJ toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {(["PJ", "PF"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewLead((p) => ({ ...p, personType: t }))}
                    style={{
                      padding: "6px 20px",
                      border: `2px solid ${newLead.personType === t ? "#C4922E" : "#122036"}`,
                      borderRadius: 8,
                      background: newLead.personType === t ? "rgba(196,146,46,0.15)" : "transparent",
                      color: newLead.personType === t ? "#E5B96A" : "#5A7490",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>
                    {newLead.personType === "PF" ? "Nome Completo" : "Razão Social"} *
                  </label>
                  <input
                    type="text"
                    value={newLead.name}
                    onChange={(e) => setNewLead((p) => ({ ...p, name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>
                    {newLead.personType === "PF" ? "CPF" : "CNPJ"}
                  </label>
                  <input
                    type="text"
                    value={newLead.document}
                    onChange={(e) => setNewLead((p) => ({ ...p, document: e.target.value }))}
                    placeholder={newLead.personType === "PF" ? "000.000.000-00" : "00.000.000/0001-00"}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>Telefone</label>
                  <input
                    type="text"
                    value={newLead.phone}
                    onChange={(e) => setNewLead((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    style={inputStyle}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>E-mail *</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead((p) => ({ ...p, email: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>Cidade</label>
                  <input
                    type="text"
                    value={newLead.city}
                    onChange={(e) => setNewLead((p) => ({ ...p, city: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>Estado (UF)</label>
                  <input
                    type="text"
                    value={newLead.state}
                    onChange={(e) => setNewLead((p) => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))}
                    placeholder="SP"
                    maxLength={2}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Dados Comerciais */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#C4922E", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                2. Dados Comerciais
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>Segmento</label>
                  <select
                    value={newLead.segment}
                    onChange={(e) => setNewLead((p) => ({ ...p, segment: e.target.value }))}
                    style={{ ...inputStyle, width: "100%" }}
                  >
                    <option value="">Selecionar...</option>
                    {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>Origem</label>
                  <select
                    value={newLead.source}
                    onChange={(e) => setNewLead((p) => ({ ...p, source: e.target.value as CRMLead["source"] }))}
                    style={{ ...inputStyle, width: "100%" }}
                  >
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {newLead.personType === "PJ" && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>
                      Faturamento Anual (R$)
                    </label>
                    <input
                      type="number"
                      value={newLead.annualRevenue}
                      onChange={(e) => setNewLead((p) => ({ ...p, annualRevenue: e.target.value }))}
                      placeholder="0"
                      style={inputStyle}
                    />
                  </div>
                )}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>Observações</label>
                  <textarea
                    value={newLead.notes}
                    onChange={(e) => setNewLead((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: CRM */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#C4922E", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                3. CRM
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>Data da Visita</label>
                  <input
                    type="date"
                    value={newLead.visitDate}
                    onChange={(e) => setNewLead((p) => ({ ...p, visitDate: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>Próximo Contato</label>
                  <input
                    type="date"
                    value={newLead.nextContact}
                    onChange={(e) => setNewLead((p) => ({ ...p, nextContact: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Produto de Interesse */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#C4922E", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                4. Produto de Interesse
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                {CONVERT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const sel = newLead.productInterest === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setNewLead((p) => ({ ...p, productInterest: sel ? "" : opt.id, creditLine: "" }))}
                      style={{
                        background: sel ? opt.bg : "#0F1E35",
                        border: `2px solid ${sel ? opt.color : "#122036"}`,
                        borderRadius: 8,
                        padding: "10px 12px",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: opt.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: sel ? opt.color : "#E8EDF5" }}>{opt.label}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#5A7490" }}>{opt.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Credit line sub-selector */}
              {(newLead.productInterest === "credito_varejo" || newLead.productInterest === "credito_estruturado" || newLead.productInterest === "high_ticket") && (
                <div>
                  <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 6 }}>Linha de Crédito Específica</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(newLead.productInterest === "credito_varejo"
                      ? ["HOME EQUITY", "AVAL", "FUNDO CONSTRUÇÃO RESIDENCIAL"]
                      : newLead.productInterest === "credito_estruturado"
                      ? ["HOMECASH", "V3GIRO E V3AUTOGIRO", "CGI"]
                      : ["CRI", "CRA", "CPR", "FUNDO INTERNACIONAL CASH COLATERAL", "FUNDO INTERNACIONAL IMOB", "FUNDO CONSTRUÇÃO LOTEAMENTO", "FUNDO CONSTRUÇÃO EMPREENDIMENTO"]
                    ).map((line) => (
                      <button
                        key={line}
                        type="button"
                        onClick={() => setNewLead((p) => ({ ...p, creditLine: p.creditLine === line ? "" : line }))}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 6,
                          border: `1px solid ${newLead.creditLine === line ? "#C4922E" : "#122036"}`,
                          background: newLead.creditLine === line ? "rgba(196,146,46,0.15)" : "#0F1E35",
                          color: newLead.creditLine === line ? "#E5B96A" : "#5A7490",
                          fontSize: 11,
                          cursor: "pointer",
                          fontWeight: newLead.creditLine === line ? 700 : 400,
                          transition: "all 0.15s",
                        }}
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Split note */}
              {newLead.productInterest === "split" && (
                <div style={{ background: "rgba(196,146,46,0.08)", border: "1px solid rgba(196,146,46,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#E5B96A" }}>
                  💡 Ao avançar este lead, você poderá acessar o <strong>Simulador Monetto</strong> para gerar uma proposta personalizada de Split Fiscal.
                </div>
              )}

              {/* Consórcio note */}
              {newLead.productInterest === "consorcio" && (
                <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#10B981" }}>
                  💡 Ao avançar este lead, você poderá acessar o <strong>Simulador de Consórcio</strong> para calcular parcelas e carta de crédito.
                </div>
              )}

              {/* M&A note */}
              {newLead.productInterest === "ma" && (
                <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#818CF8" }}>
                  💡 Lead será encaminhado para a <strong>Mesa M&A</strong> para avaliação e structuring da operação.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <Button variant="outline" onClick={() => setShowNewLead(false)}>
              Cancelar
            </Button>
            <Button onClick={handleNewLeadSubmit} disabled={!newLead.name || !newLead.email}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Lead
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Prospecção Tab ───────────────────────────────────────────────────────────

function ProspeccaoTab({ onAddLead }: { onAddLead: (prefill: Partial<{ personType: "PF"|"PJ"; name: string; document: string; email: string; phone: string; city: string; state: string; segment: string; }>) => void }) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [cnpjInput, setCnpjInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [capitalMin, setCapitalMin] = useState("");
  const [ufFilter, setUfFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<NormalizedCompany[]>([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

  function maskCnpj(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d
      .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, "$1.$2.$3/$4")
      .replace(/^(\d{2})(\d{3})(\d{3})$/, "$1.$2.$3")
      .replace(/^(\d{2})(\d{3})$/, "$1.$2")
      .replace(/^(\d{2})$/, "$1");
  }

  function fmtCnpj(c: string) {
    return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  async function fetchCnpj(cnpj: string): Promise<NormalizedCompany | null> {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) return null;
    const res = await fetch(`/api/cnpj-search?cnpj=${clean}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "CNPJ nao encontrado");
    return data as NormalizedCompany;
  }

  async function handleSingle() {
    const clean = cnpjInput.replace(/\D/g, "");
    if (clean.length !== 14) { setError("CNPJ invalido — 14 digitos."); return; }
    setLoading(true); setError(""); setResults([]); setExpanded(null);
    try {
      const c = await fetchCnpj(clean);
      if (c) { setResults([c]); setExpanded(c.cnpj); }
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao consultar."); }
    finally { setLoading(false); }
  }

  async function handleBatch() {
    const lines = batchInput.split(/[\n,;]/).map((l) => l.trim().replace(/\D/g, "")).filter((l) => l.length === 14);
    if (lines.length === 0) { setError("Nenhum CNPJ valido. Um por linha."); return; }
    if (lines.length > 20) { setError("Maximo 20 CNPJs."); return; }
    setLoading(true); setError(""); setResults([]); setExpanded(null);
    const found: NormalizedCompany[] = [];
    const errs: string[] = [];
    for (const cnpj of lines) {
      try {
        const c = await fetchCnpj(cnpj);
        if (c) found.push(c);
        await new Promise((r) => setTimeout(r, 400));
      } catch (e) { errs.push(`${cnpj}: ${e instanceof Error ? e.message : "erro"}`); }
    }
    setResults(found);
    if (errs.length) setError(`Erros: ${errs.slice(0, 3).join("; ")}`);
    setLoading(false);
  }

  function fmtCap(v?: number) {
    if (!v) return "—";
    if (v >= 1e9) return `R$ ${(v/1e9).toFixed(1)}B`;
    if (v >= 1e6) return `R$ ${(v/1e6).toFixed(1)}M`;
    if (v >= 1e3) return `R$ ${(v/1e3).toFixed(0)}K`;
    return `R$ ${v.toLocaleString("pt-BR")}`;
  }

  const filtered = results.filter((c) => {
    const cap = Number(capitalMin.replace(/\D/g, "")) || 0;
    return (cap === 0 || (c.capital_social ?? 0) >= cap) && (!ufFilter || c.uf === ufFilter);
  });

  const btnBase: React.CSSProperties = { border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 };

  return (
    <div>
      <div style={{ background: "#091221", border: "1px solid #122036", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#C4922E", marginBottom: 4 }}>Prospeccao — Consulta CNPJ</div>
        <div style={{ fontSize: 12, color: "#5A7490", marginBottom: 16 }}>Dados publicos BrasilAPI · Razao social, socios, telefone, e-mail, capital social.</div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["single", "batch"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setResults([]); setError(""); }}
              style={{ ...btnBase, padding: "6px 16px", fontSize: 12,
                background: mode === m ? "#C4922E" : "#0F1E35", color: mode === m ? "#050C18" : "#5A7490" }}>
              {m === "single" ? "Busca por CNPJ" : "Importar Lista de CNPJs"}
            </button>
          ))}
        </div>

        {mode === "single" ? (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>CNPJ da Empresa</label>
              <input type="text" value={cnpjInput}
                onChange={(e) => setCnpjInput(maskCnpj(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleSingle()}
                placeholder="00.000.000/0000-00" maxLength={18}
                style={{ ...pInputStyle, letterSpacing: "0.08em", fontSize: 15 }} />
            </div>
            <button onClick={handleSingle} disabled={loading}
              style={{ ...btnBase, background: loading ? "#5A7490" : "#C4922E", color: "#050C18", padding: "9px 22px", fontSize: 13, cursor: loading ? "not-allowed" : "pointer" }}>
              <Search className="w-4 h-4" />{loading ? "Consultando..." : "Consultar"}
            </button>
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 11, color: "#5A7490", display: "block", marginBottom: 4 }}>Lista de CNPJs — um por linha (max. 20)</label>
            <textarea value={batchInput} onChange={(e) => setBatchInput(e.target.value)}
              placeholder={"11.222.333/0001-81\n44.555.666/0001-22"} rows={5}
              style={{ ...pInputStyle, resize: "vertical", fontFamily: "monospace", lineHeight: 1.6 }} />
            <button onClick={handleBatch} disabled={loading}
              style={{ ...btnBase, background: loading ? "#5A7490" : "#C4922E", color: "#050C18", padding: "9px 22px", fontSize: 13, cursor: loading ? "not-allowed" : "pointer", marginTop: 10 }}>
              <Search className="w-4 h-4" />{loading ? `Consultando... (${results.length} ok)` : "Consultar todos"}
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#EF4444", fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(196,146,46,0.06)", border: "1px solid rgba(196,146,46,0.15)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "#C4922E", fontWeight: 700, marginBottom: 3 }}>Como prospectar por cidade/segmento?</div>
          <div style={{ fontSize: 11, color: "#5A7490", lineHeight: 1.6 }}>
            A Receita Federal nao disponibiliza busca gratuita por nome/cidade. Pesquise em{" "}
            <a href="https://casadosdados.com.br" target="_blank" rel="noreferrer" style={{ color: "#C4922E" }}>casadosdados.com.br</a>
            {" ou "}<a href="https://cnpja.com.br" target="_blank" rel="noreferrer" style={{ color: "#C4922E" }}>cnpja.com.br</a>
            {", copie os CNPJs e importe aqui em lote para buscar socios, telefone e e-mail."}
          </div>
        </div>
      </div>

      {results.length > 1 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#5A7490" }}>Filtrar:</span>
          <select value={ufFilter} onChange={(e) => setUfFilter(e.target.value)}
            style={{ ...pInputStyle, width: 80, padding: "5px 8px", fontSize: 12 }}>
            <option value="">Todos UF</option>
            {UF_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="text" value={capitalMin} onChange={(e) => setCapitalMin(e.target.value)}
            placeholder="Capital min. R$" style={{ ...pInputStyle, width: 150, padding: "5px 10px", fontSize: 12 }} />
          <span style={{ fontSize: 12, color: "#5A7490" }}>{filtered.length}/{results.length} empresa(s)</span>
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ background: "#091221", border: "1px solid #122036", borderRadius: 12, overflow: "hidden" }}>
          {filtered.map((c) => {
            const isOpen = expanded === c.cnpj;
            return (
              <div key={c.cnpj} style={{ borderBottom: "1px solid #122036" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EDF5" }}>{c.razao_social}</div>
                    {c.nome_fantasia && c.nome_fantasia !== c.razao_social && (
                      <div style={{ fontSize: 11, color: "#5A7490" }}>{c.nome_fantasia}</div>
                    )}
                    <div style={{ fontSize: 10, color: "#5A7490", marginTop: 2, fontFamily: "monospace" }}>{fmtCnpj(c.cnpj)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#5A7490" }}>{c.municipio || "—"}{c.uf ? ` / ${c.uf}` : ""}</div>
                  <div style={{ fontSize: 13, color: "#C4922E", fontWeight: 700 }}>{fmtCap(c.capital_social)}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: c.situacao_cadastral === "ATIVA" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                    color: c.situacao_cadastral === "ATIVA" ? "#10B981" : "#EF4444" }}>
                    {c.situacao_cadastral || "—"}
                  </span>
                  <button onClick={() => setExpanded(isOpen ? null : c.cnpj)}
                    style={{ background: "transparent", border: "1px solid #122036", borderRadius: 6, padding: "5px 12px", color: "#5A7490", fontSize: 11, cursor: "pointer" }}>
                    {isOpen ? "Ocultar" : "Detalhes"}
                  </button>
                  <button onClick={() => onAddLead({ personType: "PJ", name: c.razao_social,
                    document: fmtCnpj(c.cnpj), email: c.email || "", phone: c.telefone || "",
                    city: c.municipio || "", state: c.uf || "", segment: (c.cnae || "").slice(0, 50) })}
                    style={{ ...btnBase, background: "rgba(196,146,46,0.15)", border: "1px solid rgba(196,146,46,0.3)", padding: "5px 14px", color: "#E5B96A", fontSize: 11 }}>
                    + Lead
                  </button>
                </div>

                {isOpen && (
                  <div style={{ padding: "14px 16px 18px", background: "#050C18", borderTop: "1px solid #122036" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#C4922E", marginBottom: 10, textTransform: "uppercase" }}>Contato</div>
                        {([["Telefone", c.telefone], ["Telefone 2", c.telefone2], ["E-mail", c.email], ["Logradouro", c.logradouro], ["Bairro", c.bairro], ["CEP", c.cep]] as [string,string][]).map(([l, v]) => (
                          <div key={l} style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 10, color: "#5A7490" }}>{l}</div>
                            <div style={{ fontSize: 12, color: "#E8EDF5" }}>{v || "—"}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#C4922E", marginBottom: 10, textTransform: "uppercase" }}>Empresa</div>
                        {([["Porte", c.porte], ["Capital Social", fmtCap(c.capital_social)], ["CNAE", (c.cnae || "").slice(0, 60)], ["Abertura", c.data_abertura ? new Date(c.data_abertura).toLocaleDateString("pt-BR") : "—"]] as [string,string][]).map(([l, v]) => (
                          <div key={l} style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 10, color: "#5A7490" }}>{l}</div>
                            <div style={{ fontSize: 12, color: l === "Capital Social" ? "#C4922E" : "#E8EDF5", fontWeight: l === "Capital Social" ? 700 : 400 }}>{v || "—"}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#C4922E", marginBottom: 10, textTransform: "uppercase" }}>Socios ({c.socios?.length || 0})</div>
                        {c.socios && c.socios.length > 0 ? c.socios.slice(0, 6).map((s, i) => (
                          <div key={i} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: "#E8EDF5" }}>{s.nome}</div>
                            <div style={{ fontSize: 10, color: "#5A7490" }}>{s.qualificacao}{s.entrada ? ` · desde ${new Date(s.entrada).toLocaleDateString("pt-BR")}` : ""}</div>
                          </div>
                        )) : <div style={{ fontSize: 12, color: "#5A7490" }}>Sem socios registrados</div>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface NormalizedCompany {
  cnpj: string; razao_social: string; nome_fantasia: string;
  situacao_cadastral: string; capital_social: number; email: string;
  telefone: string; telefone2: string; municipio: string; uf: string;
  logradouro: string; bairro: string; cep: string; porte: string;
  cnae: string; data_abertura: string;
  socios: Array<{ nome: string; qualificacao: string; entrada: string; faixa_etaria: string }>;
}


const pInputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0F1E35",
  border: "1px solid #122036",
  borderRadius: 8,
  padding: "8px 12px",
  color: "#E8EDF5",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0F1E35",
  border: "1px solid #122036",
  borderRadius: 8,
  padding: "8px 12px",
  color: "#E8EDF5",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};
