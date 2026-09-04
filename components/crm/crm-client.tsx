"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Link2,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Trash2,
  CalendarPlus,
  Share2,
  Paperclip,
  Home,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NovaPropostaModal } from "@/components/mesa-credito/nova-proposta-modal";
import { PropostaDetailModal, type ProposalFull } from "@/components/mesa-credito/proposta-detail-modal";
import { NovoDealForm } from "@/components/ma/novo-deal-form";
import { ColdLeadAlert } from "@/components/crm/cold-lead-alert";

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
  metadata?: Record<string, unknown>;
  clientToken?: string | null;
  creditProposalId?: string | null;
};

type CaptacaoLink = {
  id: string;
  token: string;
  partner_name: string;
  active: boolean;
  uses_count: number;
  created_at: string;
};

type MaCaptacaoLink = {
  id: string;
  token: string;
  partner_name: string;
  active: boolean;
  uses_count: number;
  created_at: string;
};

// ─── Lead Score ──────────────────────────────────────────────────────────────

function calcLeadScore(lead: CRMLead): { score: number; label: string; colorClass: string } {
  let score = 0;
  const statusScore: Record<string, number> = { prospect: 10, qualificado: 25, proposta: 45, negociacao: 65, ganho: 100, perdido: 0 };
  score += statusScore[lead.status] ?? 10;
  if (lead.email && lead.phone) score += 10;
  if (lead.productInterest) score += 15;
  const updatedAt = (lead as unknown as Record<string, string>).updatedAt ?? lead.createdAt;
  if (updatedAt) {
    const days = (Date.now() - new Date(updatedAt).getTime()) / 86400000;
    if (days < 7) score += 10;
  }
  if (lead.document) score += 5;
  score = Math.min(100, score);
  if (score >= 70) return { score, label: "Quente 🔥", colorClass: "text-red-400 bg-red-500/10 border-red-500/30" };
  if (score >= 40) return { score, label: "Morno", colorClass: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
  return { score, label: "Frio", colorClass: "text-blue-400 bg-blue-500/10 border-blue-500/30" };
}

// ─── CSV Import helpers ───────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  return text.trim().split('\n').map(row =>
    row.split(',').map(cell => cell.trim().replace(/^["']|["']$/g, ''))
  );
}

// ─── Kanban columns ───────────────────────────────────────────────────────────

const KANBAN_COLUMNS = [
  { id: "prospect",    label: "Prospect",    color: "border-blue-500/40",    bg: "bg-blue-500/5",    count_color: "text-blue-400",    hex: "#3B82F6" },
  { id: "qualificado", label: "Qualificado", color: "border-amber-500/40",   bg: "bg-amber-500/5",   count_color: "text-amber-400",   hex: "#F59E0B" },
  { id: "proposta",    label: "Proposta",    color: "border-purple-500/40",  bg: "bg-purple-500/5",  count_color: "text-purple-400",  hex: "#A855F7" },
  { id: "negociacao",  label: "Negociação",  color: "border-orange-500/40",  bg: "bg-orange-500/5",  count_color: "text-orange-400",  hex: "#F97316" },
  { id: "ganho",       label: "Ganho ✓",     color: "border-emerald-500/40", bg: "bg-emerald-500/5", count_color: "text-emerald-400", hex: "#10B981" },
  { id: "perdido",     label: "Perdido",     color: "border-gray-500/40",    bg: "bg-gray-500/5",    count_color: "text-gray-400",    hex: "#6B7280" },
];

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
  marketplace: "Marketplace",
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
  { id: "prospect",    label: "Prospecção",  color: "#7A8FA8", bg: "rgba(90,116,144,0.1)" },
  { id: "qualificado", label: "Qualificado", color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
  { id: "proposta",    label: "Proposta",    color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  { id: "negociacao",  label: "Negociação",  color: "#C9A84C", bg: "rgba(196,146,46,0.1)" },
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
];

// Linhas de crédito por produto (igual ao nova-proposta-modal)
const CREDIT_LINES_BY_PRODUCT: Record<string, { line: string; desc: string }[]> = {
  credito_varejo: [
    { line: "HOME EQUITY",                desc: "Imóvel em garantia para crédito pessoal/empresarial" },
    { line: "HOME EQUITY ESTRESSADO",      desc: "Home Equity com imóvel em situação estressada / dívida ativa (garantia de imóvel)" },
    { line: "AVAL",                       desc: "Crédito com aval de sócio ou fiador" },
    { line: "FUNDO CONSTRUÇÃO RESIDENCIAL", desc: "Fundo para construção de imóveis residenciais" },
  ],
  credito_estruturado: [
    { line: "HOMECASH",         desc: "Crédito estruturado com garantia imobiliária" },
    { line: "V3GIRO E V3AUTOGIRO", desc: "Capital de giro e financiamento de frota" },
    { line: "CGI",              desc: "Crédito com garantia de imóvel empresarial" },
  ],
  high_ticket: [
    { line: "CRI",                              desc: "Certificado de Recebíveis Imobiliários" },
    { line: "CRA",                              desc: "Certificado de Recebíveis do Agronegócio" },
    { line: "CPR",                              desc: "Cédula de Produto Rural" },
    { line: "FUNDO INTERNACIONAL CASH COLATERAL", desc: "Fundo com colateral em ativos internacionais" },
    { line: "FUNDO INTERNACIONAL IMOB",          desc: "Fundo imobiliário internacional" },
    { line: "FUNDO CONSTRUÇÃO LOTEAMENTO",       desc: "Fundo para loteamentos e parcelamentos" },
    { line: "FUNDO CONSTRUÇÃO EMPREENDIMENTO",   desc: "Fundo para grandes empreendimentos" },
  ],
};

function getStatusColor(status: string) {
  const s = STAGES.find((x) => x.id === status);
  return s ? s.color : "#7A8FA8";
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

export function CRMClient({ userRole, userName, userId, initialLeads = [] }: { userRole: string; userName: string; userId: string; initialLeads?: CRMLead[] }) {
  const router = useRouter();
  const isAdmin = ["ADMIN", "GESTAO"].includes(userRole);

  const [tab, setTab] = useState<"pipeline" | "leads" | "prospeccao" | "relatorios" | "captacao">("pipeline");
  const [leads, setLeads] = useState<CRMLead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [crmProposal, setCrmProposal] = useState<ProposalFull | null>(null);
  const [proposalDocCounts, setProposalDocCounts] = useState<Record<string, number>>({});
  const canChangeStageInCrm = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(userRole);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showConvert, setShowConvert] = useState<CRMLead | null>(null);
  const [mesaSuccess, setMesaSuccess] = useState<string | null>(null);
  const [mesaError, setMesaError] = useState<string | null>(null);
  const [filterPartner, setFilterPartner] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterCold, setFilterCold] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reportPeriod, setReportPeriod] = useState<"semanal" | "mensal" | "anual">("mensal");
  const [reportPartner, setReportPartner] = useState("all");

  // Estados para formulários especializados via CRM
  const [showCreditoForm, setShowCreditoForm] = useState(false);
  const [creditoFormLevel, setCreditoFormLevel] = useState<"NIVEL_1" | "NIVEL_2" | "NIVEL_3">("NIVEL_1");
  const [showMaForm, setShowMaForm] = useState(false);
  const [maDealSuccessMsg, setMaDealSuccessMsg] = useState<string | null>(null);

  // Captacao links state
  const [captacaoLinks, setCaptacaoLinks] = useState<CaptacaoLink[]>([]);
  const [captacaoLoading, setCaptacaoLoading] = useState(false);
  const [captacaoGenerating, setCaptacaoGenerating] = useState(false);

  async function refreshLeads() {
    try {
      const r = await fetch("/api/crm");
      const j = await r.json();
      if (Array.isArray(j.leads)) {
        const mapped: CRMLead[] = j.leads.map((l: Record<string, unknown>) => ({
          id: l.id as string, code: l.code as string, name: l.name as string,
          document: (l.document as string) ?? "", personType: (l.person_type as "PF" | "PJ") ?? "PJ",
          email: (l.email as string) ?? "", phone: (l.phone as string) ?? "",
          segment: (l.segment as string) ?? "", annualRevenue: Number(l.annual_revenue ?? 0),
          city: (l.city as string) ?? "", state: (l.state as string) ?? "",
          status: (l.status as CRMLead["status"]) ?? "prospect",
          source: (l.source as CRMLead["source"]) ?? "ativo",
          visitDate: (l.visit_date as string) ?? "", nextContact: (l.next_contact as string) ?? "",
          notes: (l.notes as string) ?? "", convertedTo: "" as const, convertedAt: "",
          productInterest: (l.product_interest as string) ?? "", creditLine: (l.credit_line as string) ?? "",
          partnerId: (l.partner_id as string) ?? userId, partnerName: (l.partner_name as string) ?? userName,
          createdAt: ((l.created_at as string) ?? "").split("T")[0] ?? todayISO(),
          interactions: [], metadata: (l.metadata as Record<string, unknown>) ?? {},
        }));
        setLeads(mapped);
      }
    } catch { /* silent */ }
  }

  // Re-agendamento rápido
  const [reagendandoId, setReagendandoId] = useState<string | null>(null);
  const [reagendandoData, setReagendandoData] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // M&A Captacao links state
  const [maCaptacaoLinks, setMaCaptacaoLinks] = useState<MaCaptacaoLink[]>([]);
  const [maCaptacaoLoading, setMaCaptacaoLoading] = useState(false);
  const [maCaptacaoGenerating, setMaCaptacaoGenerating] = useState(false);
  const [maCopiedToken, setMaCopiedToken] = useState<string | null>(null);

  // ── Feature 1: Lead Score (sort) ─────────────────────────────────────────
  const [sortByScore, setSortByScore] = useState(false);

  // ── Feature 2: AI Next Action ─────────────────────────────────────────────
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  // ── Feature 3: CSV Import ─────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importRawRows, setImportRawRows] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState<Record<number, string>>({});
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // ── Proposta share ───────────────────────────────────────────────────────
  const [copiedPropostaId, setCopiedPropostaId] = useState<string | null>(null);
  const [propostaLinkMsg, setPropostaLinkMsg] = useState<string | null>(null);

  // ── Simulador Home Equity share (link público, ?ref=<partner>) ─────────────
  const [copiedHomeEquity, setCopiedHomeEquity] = useState(false);

  // ── Feature 4: Kanban view ────────────────────────────────────────────────
  const [crmView, setCrmView] = useState<"list" | "kanban">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("crm-view") as "list" | "kanban") ?? "list";
    }
    return "list";
  });

  const loadCaptacaoLinks = useCallback(async () => {
    setCaptacaoLoading(true);
    try {
      const res = await fetch("/api/captacao/links");
      const json = await res.json();
      if (json.links) setCaptacaoLinks(json.links);
    } catch {}
    setCaptacaoLoading(false);
  }, []);

  const loadMaCaptacaoLinks = useCallback(async () => {
    setMaCaptacaoLoading(true);
    try {
      const res = await fetch("/api/ma-captacao/links");
      const json = await res.json();
      if (json.links) setMaCaptacaoLinks(json.links);
    } catch {}
    setMaCaptacaoLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "captacao") {
      loadCaptacaoLinks();
      loadMaCaptacaoLinks();
    }
  }, [tab, loadCaptacaoLinks, loadMaCaptacaoLinks]);

  // Escuta evento do ColdLeadAlert para ativar filtro de leads frios
  useEffect(() => {
    function handleColdLeadFilter() {
      setFilterCold(true);
      setTab("leads");
    }
    // Verifica se ColdLeadAlert pediu filtro via localStorage (redirect externo)
    if (typeof window !== "undefined" && localStorage.getItem("crm-filter-cold") === "true") {
      localStorage.removeItem("crm-filter-cold");
      setFilterCold(true);
      setTab("leads");
    }
    window.addEventListener("crm:filter-cold-leads", handleColdLeadFilter);
    return () => window.removeEventListener("crm:filter-cold-leads", handleColdLeadFilter);
  }, []);

  // Carrega contagem de documentos das propostas vinculadas aos leads de
  // captação, pra mostrar o badge de anexos direto no card do pipe.
  useEffect(() => {
    const proposalIds = new Set(leads.map(l => l.creditProposalId).filter(Boolean) as string[]);
    if (proposalIds.size === 0) return;
    fetch("/api/credit-proposals?include_pending=1")
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d.proposals)) return;
        const counts: Record<string, number> = {};
        for (const p of d.proposals as { id: string; documents?: unknown[] }[]) {
          if (proposalIds.has(p.id)) counts[p.id] = Array.isArray(p.documents) ? p.documents.length : 0;
        }
        setProposalDocCounts(counts);
      })
      .catch(() => {});
  }, [leads]);

  async function handleGerarLink() {
    setCaptacaoGenerating(true);
    try {
      const res = await fetch("/api/captacao", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        await loadCaptacaoLinks();
      }
    } catch {}
    setCaptacaoGenerating(false);
  }

  async function handleGerarMaLink() {
    setMaCaptacaoGenerating(true);
    try {
      const res = await fetch("/api/ma-captacao", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        await loadMaCaptacaoLinks();
      }
    } catch {}
    setMaCaptacaoGenerating(false);
  }

  async function handleToggleLink(id: string, active: boolean) {
    try {
      await fetch("/api/captacao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      setCaptacaoLinks(prev => prev.map(l => l.id === id ? { ...l, active } : l));
    } catch {}
  }

  async function handleToggleMaLink(id: string, active: boolean) {
    try {
      await fetch("/api/ma-captacao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      setMaCaptacaoLinks(prev => prev.map(l => l.id === id ? { ...l, active } : l));
    } catch {}
  }

  function handleCopyLink(token: string) {
    const url = `${window.location.origin}/c/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  function handleCopyMaLink(token: string) {
    const url = `${window.location.origin}/mf/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setMaCopiedToken(token);
      setTimeout(() => setMaCopiedToken(null), 2000);
    });
  }

  function handleCopyPropostaLink(lead: CRMLead) {
    const token = lead.clientToken;
    if (!token) {
      setPropostaLinkMsg("Token não disponível. Execute o SQL de migração no Supabase.");
      setTimeout(() => setPropostaLinkMsg(null), 4000);
      return;
    }
    const url = `https://app.v3partners.com.br/proposta/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedPropostaId(lead.id);
      setPropostaLinkMsg("Link copiado! Envie ao cliente.");
      setTimeout(() => { setCopiedPropostaId(null); setPropostaLinkMsg(null); }, 3000);
    }).catch(() => {
      setPropostaLinkMsg("Erro ao copiar. Tente novamente.");
      setTimeout(() => setPropostaLinkMsg(null), 3000);
    });
  }

  function handleCopyHomeEquityLink() {
    const url = `${window.location.origin}/simulador-home-equity-v3?ref=${userId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedHomeEquity(true);
      setTimeout(() => setCopiedHomeEquity(false), 2000);
    });
  }

  async function handleEnviarMesaMA(lead: CRMLead) {
    const meta = lead.metadata ?? {};
    const empresa = lead.name;
    const setor = (meta.setor as string) || lead.segment || "M&A";
    const faturamento = lead.annualRevenue || 0;
    const parseMoney = (v: string) => parseFloat(v.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    const valorPretendido = parseMoney((meta.valorPretendido as string) ?? "");
    const faturamentoNum = parseMoney((meta.faturamento as string) ?? "") || faturamento;
    const descricao = (meta.descricao as string) || lead.notes || null;

    // Monta asset_data compatível com o formulário interno M&A (novo-deal-form.tsx)
    const assetData = {
      // Rastreabilidade
      crm_lead_id:       lead.id,
      crm_lead_code:     lead.code,
      captacao_origin:   true,
      tipo_participante: "Vendedor",
      // Identificação
      cnpj:              lead.document || (meta.cnpj as string) || "",
      cidade:            lead.city  || (meta.cidade as string) || "",
      estado:            lead.state || (meta.estado as string) || "",
      cargo:             (meta.cargo as string) || "",
      tipoOperacao:      (meta.tipoOperacao as string) || "",
      // Sobre o negócio
      descricao_ptbr:    descricao ?? "",
      diferenciais:      typeof meta.diferenciais === "string"
                           ? (meta.diferenciais as string).split("\n").filter(Boolean)
                           : [],
      tese_investimento: (meta.diferenciais as string) ?? "",
      mercado_atendido:  "",
      produtos_servicos: "",
      // Financeiro — mesmo padrão do novo-deal-form (receita/ebitda/lucro por ano)
      financeiro: {
        receita: { "2025": (meta.faturamento as string) ?? "" },
        ebitda:  { "2025": (meta.ebitda as string) ?? "" },
        lucro:   {},
      },
      // Contato
      contato: {
        nome:     (meta.nome as string) || "",
        email:    lead.email || (meta.email as string) || "",
        telefone: lead.phone || (meta.telefone as string) || "",
      },
      // Métricas visuais no card
      metricas: [
        ...((meta.faturamento as string) ? [{ label: "Faturamento", value: meta.faturamento as string, sub: "Faturamento anual" }] : []),
        ...((meta.ebitda as string)      ? [{ label: "EBITDA",      value: meta.ebitda as string,      sub: "Margem operacional" }] : []),
        ...((meta.valorPretendido as string) ? [{ label: "Valor Pretendido", value: meta.valorPretendido as string, sub: "Expectativa do vendedor" }] : []),
      ],
    };

    try {
      const res = await fetch("/api/ma-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company:     empresa,
          sector:      setor,
          value:       valorPretendido || (faturamentoNum > 0 ? Math.round(faturamentoNum * 0.8) : null),
          notes:       descricao,
          location:    lead.city && lead.state ? `${lead.city} · ${lead.state}` : (lead.city || lead.state || null),
          asset_data:  assetData,
          // Deal vinculado ao partner dono do lead (fallback para userId do usuário logado)
          assigned_to: lead.partnerId || userId || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const now = todayISO();
        const convertedLead = { ...lead, convertedTo: "ma" as CRMLead["convertedTo"], convertedAt: now, status: "ganho" as const };
        setLeads(prev => prev.map(l => l.id === lead.id ? convertedLead : l));
        if (selectedLead?.id === lead.id) setSelectedLead(convertedLead);
        await fetch("/api/crm", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: lead.id, status: "ganho", converted_to: "ma", converted_at: now }),
        });
        // Invalida cache do Next.js para que /ma e /mesa-ma mostrem o deal recém-criado
        router.refresh();
        setMesaSuccess(`✅ Deal ${json.card?.code ?? ""} criado! Acesse a aba M&A ou Mesa M&A para visualizar.`);
        setTimeout(() => setMesaSuccess(null), 8000);
        return;
      }
      setMesaSuccess(`❌ Erro: ${json.error ?? "Tente novamente."}`);
      setTimeout(() => setMesaSuccess(null), 12000);
    } catch {
      setMesaSuccess("❌ Erro de conexão ao encaminhar para Mesa M&A.");
      setTimeout(() => setMesaSuccess(null), 5000);
    }
  }

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
  const [selectedCreditLine, setSelectedCreditLine] = useState<string>("");

  // Filtered leads
  const COLD_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // 15 dias

  const visibleLeads = leads.filter((l) => {
    if (!isAdmin && l.partnerId !== userId) return false;
    if (isAdmin && filterPartner !== "all" && l.partnerId !== filterPartner) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterSource !== "all" && l.source !== filterSource) return false;
    if (filterCold) {
      const activeSt = !["ganho", "perdido", "won", "lost"].includes(l.status);
      const updatedAt = (l as unknown as Record<string, string>).updatedAt ?? l.createdAt;
      const isCold = activeSt && updatedAt && (Date.now() - new Date(updatedAt).getTime()) > COLD_THRESHOLD_MS;
      if (!isCold) return false;
    }
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
  }).sort((a, b) => sortByScore ? calcLeadScore(b).score - calcLeadScore(a).score : 0);

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

  async function handleMoveToStage(leadId: string, newStatus: CRMLead["status"]) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    setSelectedLead(prev => prev ? { ...prev, status: newStatus } : prev);
    try {
      await fetch("/api/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
    } catch {}
  }

  async function handleConvert() {
    if (!showConvert || !selectedConvert) return;
    const now = todayISO();
    const creditLine = selectedCreditLine || showConvert.creditLine || "";
    const convertedLead = {
      ...showConvert,
      convertedTo: selectedConvert as CRMLead["convertedTo"],
      convertedAt: now,
      status: "ganho" as const,
      creditLine,
    };

    // Atualiza UI imediatamente
    setLeads(prev => prev.map((l) => l.id === showConvert.id ? convertedLead : l));
    if (selectedLead?.id === showConvert.id) setSelectedLead(convertedLead);

    // Persiste status "ganho" no Supabase
    try {
      await fetch("/api/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:           showConvert.id,
          status:       "ganho",
          converted_to: selectedConvert,
          converted_at: now,
          credit_line:  creditLine,
        }),
      });
    } catch {}

    // ── Encaminha para Mesa de Crédito ────────────────────────────────────
    if (["credito_varejo", "credito_estruturado", "high_ticket"].includes(selectedConvert)) {
      const levelMap: Record<string, string> = {
        credito_varejo: "NIVEL_1",
        credito_estruturado: "NIVEL_2",
        high_ticket: "NIVEL_3",
      };
      const line = creditLine || (selectedConvert === "credito_varejo" ? "HOME EQUITY" : selectedConvert === "credito_estruturado" ? "HOMECASH" : "CRI");
      // Código emitido pelo servidor (ver app/api/credit-proposals/route.ts).
      // Date.now() produzia CRED-26-974417 convivendo com CRED-26-0086, que é
      // o que tornou impossível ordenar ou auditar a série de crédito.
      const meta = showConvert.metadata ?? {};
      const parseMeta = (v: unknown) => {
        if (typeof v === "number") return v;
        if (typeof v === "string") return parseFloat(v.replace(/\D/g, "")) || 0;
        return 0;
      };
      const baseValue = parseMeta(meta.valorSolicitado) || (showConvert.annualRevenue > 0 ? Math.round(showConvert.annualRevenue * 0.3) : 100000);
      // NIVEL_3 exige mínimo de R$ 5.000.000
      const requestedValue = levelMap[selectedConvert] === "NIVEL_3" ? Math.max(baseValue, 5_000_000) : baseValue;
      const proposalPayload = {
        title:           `${line} — ${showConvert.name}`,
        client_name:     showConvert.name,
        client_cpf_cnpj: showConvert.document || (meta.cpfCnpj as string) || null,
        credit_line:     line,
        requested_value: requestedValue,
        current_level:   levelMap[selectedConvert],
        status:          "PENDING",
        partner_id:      showConvert.partnerId,
        partner_name:    showConvert.partnerName,
        created_by:      showConvert.partnerId,
        metadata: {
          ...meta,
          crm_lead_id:       showConvert.id,
          crm_lead_code:     showConvert.code,
          client_type:       showConvert.personType,
          email:             showConvert.email || (meta.email as string),
          telefone:          showConvert.phone || (meta.phone as string),
          cidade:            showConvert.city  || (meta.city  as string),
          estado:            showConvert.state || (meta.state as string),
          restricao_cliente: meta.restricao,
          prazo:             meta.prazo,
          finalidade:        meta.finalidade,
          imoveis:           meta.imoveis,
          documentos:        (meta.documentos as unknown[]) ?? [],
          captacao_origin:   !!(meta.captacao_token),
        },
      };

      // Salva via API no Supabase. O código da proposta vem na resposta:
      // quem emite é o servidor, não a tela.
      let createdProposalCode = "";
      try {
        const res = await fetch("/api/credit-proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(proposalPayload),
        });
        const json = await res.json();
        createdProposalCode = (json?.proposal?.code as string) ?? "";
        if (!json.ok) {
          const errMsg = typeof json.error === "string"
            ? json.error
            : typeof json.error === "object" && json.error !== null
              ? Object.values(json.error as Record<string, string[]>).flat().join(" | ")
              : "Tente novamente.";
          setMesaError(`Erro ao criar proposta na Mesa de Crédito: ${errMsg}`);
          setTimeout(() => setMesaError(null), 10000);
          return;
        }
      } catch {
        setMesaError("Erro de conexão ao salvar proposta. Verifique sua internet e tente novamente.");
        setTimeout(() => setMesaError(null), 10000);
        return;
      }

      setMesaSuccess(`✅ Lead encaminhado como "Ganho"! Proposta ${createdProposalCode} criada na Mesa de Crédito — ${line}.`);
      setTimeout(() => setMesaSuccess(null), 7000);
    } else {
      setMesaSuccess(`✅ Lead encaminhado para ${CONVERT_OPTIONS.find(o => o.id === selectedConvert)?.label ?? selectedConvert} e marcado como Ganho.`);
      setTimeout(() => setMesaSuccess(null), 5000);
    }

    setShowConvert(null);
    setSelectedConvert("");
    setSelectedCreditLine("");
  }

  async function handleReagendar(leadId: string, novaData: string) {
    if (!novaData) return;
    try {
      await fetch("/api/crm/reagendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, next_contact: novaData }),
      });
      setLeads((prev) =>
        prev.map((l) => l.id === leadId ? { ...l, nextContact: novaData } : l)
      );
      setReagendandoId(null);
      setReagendandoData("");
    } catch { /* silent */ }
  }

  // ── Feature 2: AI Next Action handler ────────────────────────────────────
  async function handleAiSuggest(lead: CRMLead) {
    setAiLoading(prev => ({ ...prev, [lead.id]: true }));
    try {
      const res = await fetch("/api/crm/next-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      const json = await res.json();
      if (json.suggestion) {
        setAiSuggestions(prev => ({ ...prev, [lead.id]: json.suggestion }));
        setTimeout(() => {
          setAiSuggestions(prev => { const n = { ...prev }; delete n[lead.id]; return n; });
        }, 30000);
      }
    } catch { /* silent */ }
    setAiLoading(prev => ({ ...prev, [lead.id]: false }));
  }

  // ── Feature 3: CSV import handler ─────────────────────────────────────────
  function handleCSVFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) return;
      setImportRawRows(rows);
      // Auto-map by header name
      const headers = rows[0];
      const autoMap: Record<number, string> = {};
      const fieldMap: Record<string, string> = {
        nome: "nome", name: "nome", "razão social": "nome", "razao social": "nome",
        email: "email",
        telefone: "telefone", phone: "telefone", celular: "telefone",
        cidade: "cidade", city: "cidade",
        estado: "estado", state: "estado", uf: "estado",
        observacoes: "observacoes", "observações": "observacoes", notes: "observacoes",
      };
      headers.forEach((h, i) => {
        const key = h.toLowerCase().trim();
        autoMap[i] = fieldMap[key] ?? "ignorar";
      });
      setImportMapping(autoMap);
      setImportStep(2);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImportSubmit() {
    const headers = importRawRows[0];
    const dataRows = importRawRows.slice(1);
    const leads = dataRows.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((_, i) => {
        const field = importMapping[i];
        if (field && field !== "ignorar" && row[i]) obj[field] = row[i];
      });
      return obj as { nome: string; email?: string; telefone?: string; cidade?: string; estado?: string; observacoes?: string };
    }).filter(l => l.nome?.trim());

    setImportLoading(true);
    try {
      const res = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads }),
      });
      const json = await res.json();
      if (res.ok) {
        setImportResult(`✅ ${json.imported} contato(s) importado(s) com sucesso!`);
        setImportStep(3);
        // Reload leads
        try {
          const r2 = await fetch("/api/crm");
          const j2 = await r2.json();
          if (j2.leads) {
            const mapped: CRMLead[] = j2.leads.map((l: Record<string, unknown>) => ({
              id: l.id as string, code: l.code as string, name: l.name as string,
              document: (l.document as string) ?? "", personType: (l.person_type as "PF" | "PJ") ?? "PJ",
              email: (l.email as string) ?? "", phone: (l.phone as string) ?? "",
              segment: (l.segment as string) ?? "", annualRevenue: Number(l.annual_revenue ?? 0),
              city: (l.city as string) ?? "", state: (l.state as string) ?? "",
              status: (l.status as CRMLead["status"]) ?? "prospect",
              source: (l.source as CRMLead["source"]) ?? "ativo",
              visitDate: (l.visit_date as string) ?? "", nextContact: (l.next_contact as string) ?? "",
              notes: (l.notes as string) ?? "", convertedTo: "" as const, convertedAt: "",
              productInterest: (l.product_interest as string) ?? "", creditLine: (l.credit_line as string) ?? "",
              partnerId: (l.partner_id as string) ?? userId, partnerName: (l.partner_name as string) ?? userName,
              createdAt: ((l.created_at as string) ?? "").split("T")[0] ?? todayISO(),
              interactions: [], metadata: (l.metadata as Record<string, unknown>) ?? {},
            }));
            setLeads(mapped);
          }
        } catch { /* silent */ }
      } else {
        setImportResult(`❌ Erro: ${json.error}`);
        setImportStep(3);
      }
    } catch {
      setImportResult("❌ Erro de conexão ao importar.");
      setImportStep(3);
    }
    setImportLoading(false);
  }

  // ── Feature 4: Kanban move handler ────────────────────────────────────────
  async function handleMoveKanban(leadId: string, newStatus: CRMLead["status"]) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    try {
      await fetch("/api/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
    } catch { /* silent */ }
  }

  function handleCrmViewChange(v: "list" | "kanban") {
    setCrmView(v);
    if (typeof window !== "undefined") localStorage.setItem("crm-view", v);
  }

  // Leads vindos do link de captação já têm uma proposta de crédito vinculada
  // (criada no submit do formulário) — abrem o mesmo modal da Mesa de Crédito,
  // com perfil do cliente, documentos e checklist. Leads sem proposta vinculada
  // (criados manualmente) continuam abrindo o modal simples de sempre.
  async function openLead(lead: CRMLead) {
    if (lead.creditProposalId) {
      try {
        const res = await fetch(`/api/credit-proposals?id=${lead.creditProposalId}`);
        const json = await res.json();
        if (res.ok && json.proposal) {
          const p = json.proposal as ProposalFull & { partner?: { full_name?: string; role?: string } | null };
          setCrmProposal({ ...p, partner_name: p.partner?.full_name, partner_role: p.partner?.role });
          return;
        }
      } catch { /* cai no fallback abaixo */ }
    }
    setSelectedLead(lead);
  }

  const handleCrmProposalUpdate = useCallback((proposalId: string, updates: Partial<ProposalFull>) => {
    setCrmProposal(prev => prev && prev.id === proposalId ? { ...prev, ...updates } : prev);
  }, []);

  const handleCrmStageChange = useCallback((proposalId: string, newStage: string) => {
    setCrmProposal(prev => prev && prev.id === proposalId ? { ...prev, stage: newStage } : prev);
    fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposalId, stage: newStage }),
    }).catch(() => {});
  }, []);

  async function handleConfirmCrmSendToMesa() {
    if (!crmProposal) return;
    try {
      const res = await fetch(`/api/credit-proposals/${crmProposal.id}/confirm-crm-review`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao confirmar envio");
      setCrmProposal(prev => prev ? { ...prev, metadata: { ...(prev.metadata ?? {}), crm_pending_review: false } } : prev);
      setMesaSuccess(`Proposta ${crmProposal.code} enviada para a Mesa de Crédito com sucesso!`);
      setTimeout(() => setMesaSuccess(null), 5000);
    } catch (e) {
      setMesaError(e instanceof Error ? e.message : "Erro ao confirmar envio");
      setTimeout(() => setMesaError(null), 5000);
    }
  }

  async function handleEnviarMesa(lead: CRMLead) {
    const meta = lead.metadata ?? {};
    const creditLine =
      lead.creditLine ||
      (meta.creditLine as string) ||
      (lead.productInterest === "credito_estruturado" ? "AVAL" :
       lead.productInterest === "high_ticket" ? "HIGH TICKET" :
       "HOME EQUITY");

    // Valor: prefere valorSolicitado do metadata, senão 30% do faturamento anual
    // Formato BRL ("5.000,00") — não confundir com dígitos crus.
    const parseMeta = (v: unknown) => {
      if (typeof v === "number") return v;
      if (typeof v === "string") return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
      return 0;
    };
    const baseVal = parseMeta(meta.valorSolicitado) || (lead.annualRevenue > 0 ? Math.round(lead.annualRevenue * 0.3) : 100000);
    const level = baseVal >= 5_000_000 ? "NIVEL_3" : baseVal >= 500_000 ? "NIVEL_2" : "NIVEL_1";
    // NIVEL_3 exige mínimo de R$ 5.000.000
    const requestedValue = level === "NIVEL_3" ? Math.max(baseVal, 5_000_000) : baseVal;

    try {
      const res = await fetch("/api/credit-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${creditLine} - ${lead.name}`,
          client_name: lead.name,
          client_cpf_cnpj: lead.document || (meta.cpfCnpj as string) || null,
          credit_line: creditLine,
          requested_value: requestedValue,
          current_level: level,
          notes: lead.notes || (meta.observacoes as string) || null,
          metadata: {
            ...meta,
            crm_lead_id: lead.id,
            crm_lead_code: lead.code,
            client_type: lead.personType,
            email: lead.email || (meta.email as string),
            telefone: lead.phone || (meta.phone as string),
            endereco: meta.enderecoRua,
            cep: meta.cep,
            cidade: lead.city || (meta.city as string),
            estado: lead.state || (meta.state as string),
            restricao_cliente: meta.restricao,
            prazo: meta.prazo,
            finalidade: meta.finalidade,
            imoveis: meta.imoveis,
            documentos: meta.documentos,
            captacao_origin: true,
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.proposal) {
        setMesaSuccess(`Proposta ${json.proposal.code} enviada para a Mesa de Crédito com sucesso!`);
        setTimeout(() => setMesaSuccess(null), 5000);
        return;
      }
    } catch {}

    // Fallback demo: salva no localStorage
    const code = `CRED-26-${String(Date.now()).slice(-6)}`;
    try {
      const existing: { id: string; title: string }[] = JSON.parse(localStorage.getItem("v3_demo_proposals") ?? "[]");
      const title = `${creditLine} - ${lead.name}`;
      if (!existing.some((p) => p.title === title)) {
        localStorage.setItem("v3_demo_proposals", JSON.stringify([{ id: `prop-crm-${Date.now()}`, code, title }, ...existing]));
      }
    } catch {}
    setMesaSuccess(`Proposta ${code} enviada para a Mesa de Crédito com sucesso!`);
    setTimeout(() => setMesaSuccess(null), 5000);
  }

  async function handleNewLeadSubmit() {
    if (!newLead.name || !newLead.email) return;
    // O código do lead é emitido pelo servidor (ver app/api/crm/route.ts).
    // Calcular aqui a partir de leads.length lia apenas o que estava na tela.
    const leadPayload = {
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

    // Tenta salvar via API (Supabase). Se falhar (demo), salva só em state.
    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayload),
      });
      const json = await res.json();
      if (json.lead) {
        // Normaliza resposta do servidor
        const saved: CRMLead = {
          id:              json.lead.id,
          code:            json.lead.code,
          name:            json.lead.name,
          document:        json.lead.document ?? "",
          personType:      json.lead.person_type as "PF" | "PJ",
          email:           json.lead.email ?? "",
          phone:           json.lead.phone ?? "",
          segment:         json.lead.segment ?? "",
          annualRevenue:   Number(json.lead.annual_revenue ?? 0),
          city:            json.lead.city ?? "",
          state:           json.lead.state ?? "",
          status:          json.lead.status as CRMLead["status"],
          source:          json.lead.source as CRMLead["source"],
          visitDate:       json.lead.visit_date ?? "",
          nextContact:     json.lead.next_contact ?? "",
          notes:           json.lead.notes ?? "",
          convertedTo:     "" as const,
          convertedAt:     "",
          productInterest: json.lead.product_interest ?? "",
          creditLine:      json.lead.credit_line ?? "",
          partnerId:       json.lead.partner_id ?? userId,
          partnerName:     json.lead.partner_name ?? userName,
          createdAt:       json.lead.created_at?.split("T")[0] ?? todayISO(),
          interactions:    [],
          metadata:        (json.lead.metadata ?? {}) as Record<string, unknown>,
        };
        setLeads(prev => [saved, ...prev]);
        setShowNewLead(false);
        setNewLead({ personType: "PJ", name: "", document: "", email: "", phone: "", city: "", state: "", segment: "", annualRevenue: "", source: "ativo", notes: "", visitDate: "", nextContact: "", productInterest: "", creditLine: "" });
        return;
      }
    } catch {}

    // Fallback local (modo demo). O código aqui é só rótulo de tela: este
    // caminho não grava no banco, então não consome numeração real.
    const lead: CRMLead = {
      ...leadPayload,
      id: `crm-${Date.now()}`,
      code: `CRM-DEMO-${String(Date.now()).slice(-4)}`,
    } as CRMLead;
    setLeads(prev => [lead, ...prev]);
    setShowNewLead(false);
    setNewLead({ personType: "PJ", name: "", document: "", email: "", phone: "", city: "", state: "", segment: "", annualRevenue: "", source: "ativo", notes: "", visitDate: "", nextContact: "", productInterest: "", creditLine: "" });
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
        h1 { color: #C9A84C; } h2 { color: #0A1628; border-bottom: 2px solid #C9A84C; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
        th { background: #0A1628; color: white; padding: 8px; text-align: left; }
        td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; }
        tr:nth-child(even) { background: #f5f5f5; }
        .stat { display: inline-block; background: #f0f0f0; border-left: 3px solid #C9A84C; padding: 8px 16px; margin: 4px; border-radius: 4px; }
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
    <div style={{ background: "#09081A", minHeight: "100vh", color: "#E8EDF5" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #122036", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#E8EDF5", margin: 0 }}>CRM</h1>
            <p style={{ fontSize: 13, color: "#7A8FA8", margin: "2px 0 0" }}>
              Gestão de Relacionamento com Clientes
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => { setShowImport(true); setImportStep(1); setImportRawRows([]); setImportResult(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8,
                border: "1px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.08)",
                color: "#C9A84C", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              ⬆ Importar CSV
            </button>
            <Button onClick={() => setShowNewLead(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 16, flexWrap: "wrap" }}>
          {(["pipeline", "leads", "prospeccao", "relatorios", "captacao"] as const).map((t) => (
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
                background: tab === t ? "#C9A84C" : "transparent",
                color: tab === t ? "#09081A" : "#7A8FA8",
                transition: "all 0.15s",
              }}
            >
              {t === "pipeline" ? "Pipeline" : t === "leads" ? "Leads" : t === "prospeccao" ? "🔍 Prospecção" : t === "relatorios" ? "Relatórios" : "🔗 Link de Captação"}
            </button>
          ))}
        </div>
      </div>

      {/* Error toast */}
      {mesaError && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "#2A0F0F", border: "1px solid #EF4444", borderRadius: 10,
          padding: "14px 20px", color: "#EF4444", fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)", maxWidth: 380,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>✗</span>
          <span>{mesaError}</span>
          <button
            onClick={() => setMesaError(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Proposta link toast */}
      {propostaLinkMsg && (
        <div style={{
          position: "fixed", bottom: 72, right: 24, zIndex: 9999,
          background: "#1A1506", border: "1px solid #C9A84C", borderRadius: 10,
          padding: "14px 20px", color: "#E8C97A", fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)", maxWidth: 380,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <Share2 size={16} />
          <span>{propostaLinkMsg}</span>
          <button
            onClick={() => setPropostaLinkMsg(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#C9A84C", cursor: "pointer", fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Success toast */}
      {mesaSuccess && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "#0F2A1A", border: "1px solid #10B981", borderRadius: 10,
          padding: "14px 20px", color: "#10B981", fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)", maxWidth: 380,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>✓</span>
          <span>{mesaSuccess}</span>
          <button
            onClick={() => setMesaSuccess(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#10B981", cursor: "pointer", fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: "24px" }}>
        {/* ── Banner: Leads Frios ── */}
        <ColdLeadAlert onShowColdLeads={() => { setFilterCold(true); setTab("leads"); }} />

        {/* ── TAB: PIPELINE ── */}
        {tab === "pipeline" && (
          <div>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total Leads", value: kpiLeads.length, color: "#7A8FA8" },
                { label: "Qualificados", value: kpiQualificados, color: "#3B82F6" },
                { label: "Em Negociação", value: kpiNegociacao, color: "#C9A84C" },
                { label: "Taxa de Conversão", value: `${kpiConversao}%`, color: "#10B981" },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  style={{ background: "#091221", border: "1px solid #122036", borderRadius: 12, padding: "16px 20px" }}
                >
                  <div style={{ fontSize: 12, color: "#7A8FA8", marginBottom: 4 }}>{kpi.label}</div>
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
                          color: "#09081A",
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
                        <div style={{ textAlign: "center", color: "#7A8FA8", fontSize: 12, padding: "20px 0" }}>
                          Nenhum lead
                        </div>
                      )}
                      {stageLeads.map((lead) => {
                        const ls = calcLeadScore(lead);
                        return (
                        <div
                          key={lead.id}
                          onClick={() => openLead(lead)}
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
                            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                              {lead.source === "digital" && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(59,130,246,0.15)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.25)", whiteSpace: "nowrap" }}>
                                  🔗 Digital
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: lead.personType === "PJ" ? "rgba(59,130,246,0.2)" : "rgba(168,85,247,0.2)",
                                  color: lead.personType === "PJ" ? "#3B82F6" : "#A855F7",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {lead.personType}
                              </span>
                            </div>
                          </div>
                          {/* Score badge + AI */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5, flexWrap: "wrap" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, border: "1px solid",
                              borderColor: ls.score >= 70 ? "rgba(239,68,68,0.3)" : ls.score >= 40 ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.3)",
                              background: ls.score >= 70 ? "rgba(239,68,68,0.1)" : ls.score >= 40 ? "rgba(245,158,11,0.1)" : "rgba(59,130,246,0.1)",
                              color: ls.score >= 70 ? "#F87171" : ls.score >= 40 ? "#FBBF24" : "#60A5FA",
                            }}>
                              {ls.label} · {ls.score}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); handleAiSuggest(lead); }} disabled={aiLoading[lead.id]}
                              style={{ background: "transparent", border: "none", cursor: aiLoading[lead.id] ? "not-allowed" : "pointer", color: "#7A8FA8", fontSize: 11, padding: 0 }}
                              title="Sugestão IA">
                              {aiLoading[lead.id] ? "⏳" : "⚡"}
                            </button>
                          </div>
                          {aiSuggestions[lead.id] && (
                            <div style={{ fontSize: 10, color: "#E8C97A", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 6, padding: "3px 7px", marginBottom: 5, lineHeight: 1.4 }}>
                              {aiSuggestions[lead.id]}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: "#7A8FA8", marginBottom: 4 }}>{lead.segment}</div>
                          <div style={{ fontSize: 11, color: "#7A8FA8", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                            <MapPin className="w-3 h-3" />
                            {lead.city}, {lead.state}
                          </div>
                          {lead.personType === "PJ" && lead.annualRevenue > 0 && (
                            <div style={{ fontSize: 11, color: "#C9A84C", marginBottom: 4, fontWeight: 600 }}>
                              {formatCurrency(lead.annualRevenue)}
                            </div>
                          )}
                          <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 4 }}>
                            Visita: {lead.visitDate ? formatDate(lead.visitDate) : "Sem visita"}
                          </div>
                          {isAdmin && (
                            <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 4 }}>
                              {lead.partnerName}
                            </div>
                          )}
                          {lead.convertedTo && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                background: "rgba(196,146,46,0.15)",
                                color: "#E8C97A",
                                borderRadius: 4,
                                padding: "2px 6px",
                                display: "inline-block",
                                marginTop: 2,
                              }}
                            >
                              {CONVERTED_LABELS[lead.convertedTo]}
                            </div>
                          )}
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!confirm(`Excluir lead "${lead.name}"? Esta ação não pode ser desfeita.`)) return;
                                fetch(`/api/crm?id=${lead.id}`, { method: "DELETE" })
                                  .then(() => setLeads(prev => prev.filter(x => x.id !== lead.id)))
                                  .catch(() => alert("Erro ao excluir lead."));
                              }}
                              style={{
                                marginTop: 8,
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                                background: "rgba(239,68,68,0.1)",
                                border: "1px solid rgba(239,68,68,0.25)",
                                borderRadius: 6,
                                padding: "4px 0",
                                color: "#F87171",
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              <Trash2 style={{ width: 11, height: 11 }} /> Excluir
                            </button>
                          )}
                        </div>
                      ); })}
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
            {/* View toggle + Filter bar */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
              {/* View toggle */}
              <div style={{ display: "flex", background: "#091221", border: "1px solid #122036", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                {(["list", "kanban"] as const).map((v) => (
                  <button key={v} onClick={() => handleCrmViewChange(v)}
                    style={{
                      padding: "7px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                      background: crmView === v ? "#243A66" : "transparent",
                      color: crmView === v ? "#E8C97A" : "#7A8FA8",
                    }}
                  >
                    {v === "list" ? "☰ Lista" : "▦ Kanban"}
                  </button>
                ))}
              </div>
              {/* Score sort toggle */}
              <button
                onClick={() => setSortByScore(s => !s)}
                style={{
                  padding: "7px 14px", borderRadius: 8, border: "1px solid #122036", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: sortByScore ? "rgba(201,168,76,0.15)" : "#091221",
                  color: sortByScore ? "#E8C97A" : "#7A8FA8",
                  flexShrink: 0,
                }}
              >
                🔥 Score
              </button>
              {/* Cold leads filter toggle */}
              <button
                onClick={() => setFilterCold(f => !f)}
                style={{
                  padding: "7px 14px", borderRadius: 8, border: "1px solid #122036", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: filterCold ? "rgba(201,168,76,0.15)" : "#091221",
                  color: filterCold ? "#E8C97A" : "#7A8FA8",
                  flexShrink: 0,
                }}
              >
                🧊 Leads frios
              </button>
              <div style={{ position: "relative", flex: "1 1 220px" }}>
                <Search
                  className="w-4 h-4"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#7A8FA8" }}
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
                  color: filterStatus === "all" ? "#7A8FA8" : "#E8EDF5",
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
                  color: filterSource === "all" ? "#7A8FA8" : "#E8EDF5",
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
                    color: filterPartner === "all" ? "#7A8FA8" : "#E8EDF5",
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
            {crmView === "list" && <div style={{ background: "#091221", border: "1px solid #122036", borderRadius: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #122036" }}>
                    {["Código", "Nome / Razão Social", "Score", "Tipo", "Segmento", "Faturamento", "Cidade/UF", "Última Visita", "Próx. Contato", "Status", "Convertido", ...(isAdmin ? ["Partner"] : []), "Ações"].map((col) => (
                      <th key={col} style={{ padding: "10px 12px", textAlign: "left", color: "#7A8FA8", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 13 : 12} style={{ textAlign: "center", padding: 32, color: "#7A8FA8" }}>
                        Nenhum lead encontrado.
                      </td>
                    </tr>
                  )}
                  {visibleLeads.map((lead, idx) => {
                    const ls = calcLeadScore(lead);
                    return (
                    <tr
                      key={lead.id}
                      style={{
                        borderBottom: "1px solid #122036",
                        background: idx % 2 === 1 ? "rgba(15,30,53,0.4)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "10px 12px", color: "#7A8FA8", whiteSpace: "nowrap" }}>{lead.code}</td>
                      <td style={{ padding: "10px 12px", color: "#E8EDF5", fontWeight: 600, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {lead.name}
                          {lead.source === "digital" && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(59,130,246,0.15)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.25)", whiteSpace: "nowrap" }}>
                              🔗 Digital
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                            border: `1px solid`,
                            borderColor: ls.score >= 70 ? "rgba(239,68,68,0.3)" : ls.score >= 40 ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.3)",
                            background: ls.score >= 70 ? "rgba(239,68,68,0.1)" : ls.score >= 40 ? "rgba(245,158,11,0.1)" : "rgba(59,130,246,0.1)",
                            color: ls.score >= 70 ? "#F87171" : ls.score >= 40 ? "#FBBF24" : "#60A5FA",
                            whiteSpace: "nowrap",
                          }}>
                            {ls.label} · {ls.score}
                          </span>
                          {aiSuggestions[lead.id] && (
                            <span style={{ fontSize: 10, color: "#E8C97A", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 6, padding: "2px 6px", maxWidth: 160, whiteSpace: "normal", lineHeight: 1.3 }}>
                              ⚡ {aiSuggestions[lead.id]}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAiSuggest(lead); }}
                            disabled={aiLoading[lead.id]}
                            title="Sugestão de próxima ação (IA)"
                            style={{ background: "transparent", border: "none", cursor: aiLoading[lead.id] ? "not-allowed" : "pointer", color: "#7A8FA8", fontSize: 11, padding: 0, textAlign: "left" }}
                          >
                            {aiLoading[lead.id] ? "⏳..." : "⚡ IA"}
                          </button>
                        </div>
                      </td>
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
                      <td style={{ padding: "10px 12px", color: "#7A8FA8", whiteSpace: "nowrap" }}>{lead.segment}</td>
                      <td style={{ padding: "10px 12px", color: "#C9A84C", whiteSpace: "nowrap" }}>{formatCurrency(lead.annualRevenue)}</td>
                      <td style={{ padding: "10px 12px", color: "#7A8FA8", whiteSpace: "nowrap" }}>{lead.city}/{lead.state}</td>
                      <td style={{ padding: "10px 12px", color: "#7A8FA8", whiteSpace: "nowrap" }}>{formatDate(lead.visitDate)}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        {reagendandoId === lead.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="date"
                              value={reagendandoData}
                              onChange={(e) => setReagendandoData(e.target.value)}
                              style={{
                                background: "#0D1929", border: "1px solid #243A66",
                                borderRadius: 6, padding: "3px 6px", color: "#F0ECE4",
                                fontSize: 11, outline: "none",
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleReagendar(lead.id, reagendandoData)}
                              style={{ background: "rgba(201,168,76,0.2)", border: "1px solid rgba(201,168,76,0.4)", borderRadius: 5, padding: "3px 8px", color: "#C9A84C", cursor: "pointer", fontSize: 11 }}
                            >✓</button>
                            <button
                              onClick={() => { setReagendandoId(null); setReagendandoData(""); }}
                              style={{ background: "transparent", border: "none", color: "#7A8FA8", cursor: "pointer", fontSize: 13 }}
                            >✕</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: lead.nextContact ? "#E8C97A" : "#7A8FA8" }}>
                              {formatDate(lead.nextContact) || "—"}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReagendandoId(lead.id);
                                setReagendandoData(lead.nextContact ?? "");
                              }}
                              title="Reagendar contato"
                              style={{ background: "transparent", border: "none", color: "#7A8FA8", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", opacity: 0.6 }}
                            >
                              <CalendarPlus size={13} />
                            </button>
                          </div>
                        )}
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
                              color: "#E8C97A",
                            }}
                          >
                            {CONVERTED_LABELS[lead.convertedTo]}
                          </span>
                        ) : (
                          <span style={{ color: "#7A8FA8" }}>—</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={{ padding: "10px 12px", color: "#7A8FA8", whiteSpace: "nowrap" }}>{lead.partnerName}</td>
                      )}
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => openLead(lead)}
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
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyPropostaLink(lead); }}
                            title="Copiar link da proposta para o cliente"
                            style={{
                              background: copiedPropostaId === lead.id ? "rgba(201,168,76,0.2)" : "rgba(201,168,76,0.1)",
                              border: `1px solid ${copiedPropostaId === lead.id ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.25)"}`,
                              borderRadius: 6,
                              padding: "4px 8px",
                              color: "#C9A84C",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {copiedPropostaId === lead.id
                              ? <Check className="w-3 h-3" />
                              : <Share2 className="w-3 h-3" />
                            }
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyHomeEquityLink(); }}
                            title="Copiar link do Simulador Home Equity (com sua identificação) para enviar ao lead"
                            style={{
                              background: copiedHomeEquity ? "rgba(201,168,76,0.2)" : "rgba(201,168,76,0.1)",
                              border: `1px solid ${copiedHomeEquity ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.25)"}`,
                              borderRadius: 6,
                              padding: "4px 8px",
                              color: "#C9A84C",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {copiedHomeEquity
                              ? <Check className="w-3 h-3" />
                              : <Home className="w-3 h-3" />
                            }
                          </button>
                          {(lead.status === "proposta" || lead.status === "negociacao") && lead.creditLine !== "M&A" && (lead.metadata as Record<string, unknown>)?.form_type !== "ma" && (
                            <button
                              onClick={() => handleEnviarMesa(lead)}
                              style={{
                                background: "rgba(16,185,129,0.15)",
                                border: "1px solid rgba(16,185,129,0.4)",
                                borderRadius: 6,
                                padding: "4px 10px",
                                color: "#10B981",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                whiteSpace: "nowrap",
                              }}
                              title="Enviar para Mesa de Crédito"
                            >
                              <CreditCard className="w-3 h-3" />
                              Mesa
                            </button>
                          )}
                          {(lead.creditLine === "M&A" || (lead.metadata as Record<string, unknown>)?.form_type === "ma") && lead.status !== "ganho" && lead.status !== "perdido" && (
                            <button
                              onClick={() => handleEnviarMesaMA(lead)}
                              style={{
                                background: "rgba(99,102,241,0.15)",
                                border: "1px solid rgba(99,102,241,0.4)",
                                borderRadius: 6,
                                padding: "4px 10px",
                                color: "#818CF8",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                whiteSpace: "nowrap",
                              }}
                              title="Enviar para Mesa M&A"
                            >
                              <Building2 className="w-3 h-3" />
                              Mesa M&A
                            </button>
                          )}
                          {lead.status !== "ganho" && lead.status !== "perdido" && (
                            <button
                              onClick={() => { setShowConvert(lead); setSelectedConvert(""); }}
                              style={{
                                background: "rgba(196,146,46,0.15)",
                                border: "1px solid rgba(196,146,46,0.3)",
                                borderRadius: 6,
                                padding: "4px 10px",
                                color: "#E8C97A",
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
                          {isAdmin && (
                            <button
                              onClick={() => {
                                if (!confirm(`Excluir lead "${lead.name}"? Esta ação não pode ser desfeita.`)) return;
                                fetch(`/api/crm?id=${lead.id}`, { method: "DELETE" })
                                  .then(() => setLeads(prev => prev.filter(x => x.id !== lead.id)))
                                  .catch(() => alert("Erro ao excluir lead."));
                              }}
                              style={{
                                background: "rgba(239,68,68,0.1)",
                                border: "1px solid rgba(239,68,68,0.25)",
                                borderRadius: 6,
                                padding: "4px 8px",
                                color: "#F87171",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                              title="Excluir lead"
                            >
                              <Trash2 className="w-3 h-3" />
                              Excluir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>}
            {crmView === "list" && <div style={{ marginTop: 10, fontSize: 12, color: "#7A8FA8" }}>
              {visibleLeads.length} lead{visibleLeads.length !== 1 ? "s" : ""} encontrado{visibleLeads.length !== 1 ? "s" : ""}
            </div>}

            {/* ── KANBAN VIEW ── */}
            {crmView === "kanban" && (
              <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16 }}>
                {KANBAN_COLUMNS.map((col) => {
                  const colLeads = visibleLeads.filter(l => l.status === col.id);
                  const totalValue = colLeads.reduce((acc, l) => acc + (l.annualRevenue || 0), 0);
                  return (
                    <div key={col.id} style={{ minWidth: 230, flex: "0 0 230px", background: "#091221", border: `1px solid ${col.hex}30`, borderRadius: 12, overflow: "hidden" }}>
                      {/* Column header */}
                      <div style={{ padding: "10px 14px", background: `${col.hex}08`, borderBottom: `1px solid ${col.hex}30`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: col.hex }}>{col.label}</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {totalValue > 0 && <span style={{ fontSize: 9, color: "#C9A84C", fontWeight: 600 }}>{formatCurrency(totalValue)}</span>}
                          <span style={{ background: col.hex, color: "#09081A", borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "1px 8px" }}>{colLeads.length}</span>
                        </div>
                      </div>
                      {/* Cards */}
                      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8, maxHeight: 560, overflowY: "auto" }}>
                        {colLeads.length === 0 && <div style={{ textAlign: "center", color: "#7A8FA8", fontSize: 12, padding: "20px 0" }}>Nenhum lead</div>}
                        {colLeads.map((lead) => {
                          const ls = calcLeadScore(lead);
                          return (
                            <div key={lead.id} style={{ background: "#0F1E35", border: "1px solid #122036", borderRadius: 8, padding: "10px 12px", cursor: "pointer", transition: "border-color 0.15s" }}
                              onClick={() => openLead(lead)}
                              onMouseEnter={(e) => (e.currentTarget.style.borderColor = col.hex)}
                              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#122036")}
                            >
                              <div style={{ fontWeight: 700, fontSize: 12, color: "#E8EDF5", marginBottom: 4 }}>{lead.name}</div>
                              {/* Score badge */}
                              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, border: "1px solid",
                                  borderColor: ls.score >= 70 ? "rgba(239,68,68,0.3)" : ls.score >= 40 ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.3)",
                                  background: ls.score >= 70 ? "rgba(239,68,68,0.1)" : ls.score >= 40 ? "rgba(245,158,11,0.1)" : "rgba(59,130,246,0.1)",
                                  color: ls.score >= 70 ? "#F87171" : ls.score >= 40 ? "#FBBF24" : "#60A5FA",
                                }}>
                                  {ls.label} · {ls.score}
                                </span>
                                <button onClick={(e) => { e.stopPropagation(); handleAiSuggest(lead); }} disabled={aiLoading[lead.id]}
                                  style={{ background: "transparent", border: "none", cursor: aiLoading[lead.id] ? "not-allowed" : "pointer", color: "#7A8FA8", fontSize: 11, padding: 0 }}
                                  title="Sugestão IA">
                                  {aiLoading[lead.id] ? "⏳" : "⚡"}
                                </button>
                              </div>
                              {aiSuggestions[lead.id] && (
                                <div style={{ fontSize: 10, color: "#E8C97A", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 6, padding: "3px 7px", marginBottom: 4, lineHeight: 1.4 }}>
                                  {aiSuggestions[lead.id]}
                                </div>
                              )}
                              {lead.productInterest && <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 3 }}>{CONVERTED_LABELS[lead.productInterest] ?? lead.productInterest}</div>}
                              <div style={{ fontSize: 10, color: "#7A8FA8", display: "flex", alignItems: "center", gap: 3, marginBottom: 6 }}>
                                <MapPin style={{ width: 10, height: 10 }} />{lead.city}, {lead.state}
                              </div>
                              {lead.creditProposalId && (
                                <div style={{
                                  fontSize: 10, color: "#C9A84C", display: "flex", alignItems: "center", gap: 3, marginBottom: 6,
                                  background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 6, padding: "2px 6px", width: "fit-content",
                                }} title="Documentos anexados via link de captação">
                                  <Paperclip style={{ width: 10, height: 10 }} />
                                  {proposalDocCounts[lead.creditProposalId] ?? 0} documento{(proposalDocCounts[lead.creditProposalId] ?? 0) !== 1 ? "s" : ""}
                                </div>
                              )}
                              {/* Copiar link do Simulador Home Equity */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCopyHomeEquityLink(); }}
                                title="Copiar link do Simulador Home Equity (com sua identificação) para enviar ao lead"
                                style={{
                                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                                  background: copiedHomeEquity ? "rgba(201,168,76,0.2)" : "rgba(201,168,76,0.1)",
                                  border: `1px solid ${copiedHomeEquity ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.25)"}`,
                                  borderRadius: 6, padding: "4px 8px", color: "#C9A84C", cursor: "pointer",
                                  fontSize: 11, fontWeight: 600, marginBottom: 6,
                                }}
                              >
                                {copiedHomeEquity
                                  ? <><Check className="w-3 h-3" /> Copiado!</>
                                  : <><Home className="w-3 h-3" /> Link Home Equity</>
                                }
                              </button>
                              {/* Mover para */}
                              <select
                                value=""
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { if (e.target.value) handleMoveKanban(lead.id, e.target.value as CRMLead["status"]); }}
                                style={{ width: "100%", background: "#162744", border: "1px solid #243A66", borderRadius: 6, padding: "4px 8px", color: "#7A8FA8", fontSize: 11, cursor: "pointer", outline: "none" }}
                              >
                                <option value="">Mover para →</option>
                                {KANBAN_COLUMNS.filter(c => c.id !== col.id).map(c => (
                                  <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: PROSPECÇÃO ── */}
        {tab === "prospeccao" && (
          <ProspeccaoTab
            onAddLead={async (prefill) => {
              // Código emitido pelo servidor (ver app/api/crm/route.ts).
              const payload = {
                name:            prefill.name ?? "Sem nome",
                document:        prefill.document ?? "",
                personType:      prefill.personType ?? "PJ",
                email:           prefill.email ?? "",
                phone:           prefill.phone ?? "",
                segment:         prefill.segment ?? "",
                city:            prefill.city ?? "",
                state:           prefill.state ?? "",
                annualRevenue:   0,
                status:          "prospect",
                source:          "ativo",
                visitDate:       "",
                nextContact:     "",
                notes:           "",
                convertedTo:     "",
                convertedAt:     "",
                productInterest: "",
                creditLine:      "",
                partnerId:       userId,
                partnerName:     userName,
                createdAt:       todayISO(),
                interactions:    [],
              };

              try {
                const res = await fetch("/api/crm", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (json.lead) {
                  const saved: CRMLead = {
                    id:              json.lead.id,
                    code:            json.lead.code,
                    name:            json.lead.name,
                    document:        json.lead.document ?? "",
                    personType:      (json.lead.person_type ?? "PJ") as "PF" | "PJ",
                    email:           json.lead.email ?? "",
                    phone:           json.lead.phone ?? "",
                    segment:         json.lead.segment ?? "",
                    annualRevenue:   Number(json.lead.annual_revenue ?? 0),
                    city:            json.lead.city ?? "",
                    state:           json.lead.state ?? "",
                    status:          (json.lead.status ?? "prospect") as CRMLead["status"],
                    source:          (json.lead.source ?? "ativo") as CRMLead["source"],
                    visitDate:       json.lead.visit_date ?? "",
                    nextContact:     json.lead.next_contact ?? "",
                    notes:           json.lead.notes ?? "",
                    convertedTo:     "" as const,
                    convertedAt:     "",
                    productInterest: json.lead.product_interest ?? "",
                    creditLine:      json.lead.credit_line ?? "",
                    partnerId:       json.lead.partner_id ?? userId,
                    partnerName:     json.lead.partner_name ?? userName,
                    createdAt:       json.lead.created_at?.split("T")[0] ?? todayISO(),
                    interactions:    [],
                    metadata:        (json.lead.metadata ?? {}) as Record<string, unknown>,
                  };
                  setLeads(prev => [saved, ...prev]);
                  setTab("pipeline");
                  return;
                }
              } catch {}

              // Fallback local (demo). Código é só rótulo de tela, não grava.
              setLeads(prev => [{
                ...payload,
                id: `crm-${Date.now()}`,
                code: `CRM-DEMO-${String(Date.now()).slice(-4)}`,
              } as CRMLead, ...prev]);
              setTab("pipeline");
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
                      background: reportPeriod === p ? "#C9A84C" : "transparent",
                      color: reportPeriod === p ? "#09081A" : "#7A8FA8",
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
                    color: reportPartner === "all" ? "#7A8FA8" : "#E8EDF5",
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
              <div style={{ borderBottom: "2px solid #C9A84C", paddingBottom: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#C9A84C", letterSpacing: 1 }}>V3 PARTNERS</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#E8EDF5", marginTop: 2 }}>Relatório CRM</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#7A8FA8" }}>
                    <div>Período: <strong style={{ color: "#E8EDF5" }}>{periodLabel}</strong></div>
                    <div>Partner: <strong style={{ color: "#E8EDF5" }}>{reportPartnerName}</strong></div>
                    <div>Gerado em: <strong style={{ color: "#E8EDF5" }}>{formatDate(todayISO())}</strong></div>
                  </div>
                </div>
              </div>

              {/* Summary stats */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#C9A84C", marginBottom: 12 }}>Resumo</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  {[
                    { label: "Total Leads", value: rTotal, color: "#7A8FA8" },
                    { label: "Qualificados", value: rQualificados, color: "#3B82F6" },
                    { label: "Ganhos", value: rGanhos, color: "#10B981" },
                    { label: "Perdidos", value: rPerdidos, color: "#EF4444" },
                    { label: "Taxa Conversão", value: `${rConversao}%`, color: "#C9A84C" },
                    { label: "Vol. Convertido", value: formatCurrency(rVolumeConverted), color: "#E8C97A" },
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
                      <div style={{ fontSize: 11, color: "#7A8FA8", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By status */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#C9A84C", marginBottom: 12 }}>Por Status</div>
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
                          color: "#09081A",
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
                <div style={{ fontSize: 14, fontWeight: 700, color: "#C9A84C", marginBottom: 12 }}>Por Destino</div>
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
                <div style={{ fontSize: 14, fontWeight: 700, color: "#C9A84C", marginBottom: 12 }}>
                  Leads ({reportLeads.length})
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #122036" }}>
                        {["Código", "Nome", "Tipo", "Segmento", "Faturamento", "Visita", "Status", "Convertido p/", "Interações"].map((col) => (
                          <th key={col} style={{ padding: "8px 10px", textAlign: "left", color: "#7A8FA8", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportLeads.map((lead, idx) => (
                        <tr key={lead.id} style={{ borderBottom: "1px solid #122036", background: idx % 2 === 1 ? "rgba(15,30,53,0.4)" : "transparent" }}>
                          <td style={{ padding: "7px 10px", color: "#7A8FA8", whiteSpace: "nowrap" }}>{lead.code}</td>
                          <td style={{ padding: "7px 10px", color: "#E8EDF5", whiteSpace: "nowrap" }}>{lead.name}</td>
                          <td style={{ padding: "7px 10px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: lead.personType === "PJ" ? "rgba(59,130,246,0.2)" : "rgba(168,85,247,0.2)", color: lead.personType === "PJ" ? "#3B82F6" : "#A855F7" }}>
                              {lead.personType}
                            </span>
                          </td>
                          <td style={{ padding: "7px 10px", color: "#7A8FA8", whiteSpace: "nowrap" }}>{lead.segment}</td>
                          <td style={{ padding: "7px 10px", color: "#C9A84C", whiteSpace: "nowrap" }}>{formatCurrency(lead.annualRevenue)}</td>
                          <td style={{ padding: "7px 10px", color: "#7A8FA8", whiteSpace: "nowrap" }}>{formatDate(lead.visitDate)}</td>
                          <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${getStatusColor(lead.status)}25`, color: getStatusColor(lead.status) }}>
                              {STATUS_LABELS[lead.status]}
                            </span>
                          </td>
                          <td style={{ padding: "7px 10px", color: "#E8C97A", whiteSpace: "nowrap" }}>
                            {lead.convertedTo ? CONVERTED_LABELS[lead.convertedTo] : "—"}
                          </td>
                          <td style={{ padding: "7px 10px", color: "#7A8FA8", textAlign: "center" }}>
                            {lead.interactions.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: "1px solid #122036", paddingTop: 12, fontSize: 11, color: "#7A8FA8", textAlign: "center" }}>
                Relatório gerado em {formatDate(todayISO())} — V3 Partners Plataforma
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: LINK DE CAPTAÇÃO ── */}
        {tab === "captacao" && (
          <div style={{ padding: "24px 0" }}>
            {/* Header section */}
            <div style={{ marginBottom: 24, padding: "20px 24px", borderRadius: 12, border: "1px solid rgba(201,168,76,0.2)", background: "rgba(201,168,76,0.04)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Link2 style={{ width: 18, height: 18, color: "#C9A84C" }} />
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#F0ECE4" }}>Link de Captação Digital</h2>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#7A8FA8", maxWidth: 520, lineHeight: 1.5 }}>
                    Gere um link personalizado para enviar ao cliente. Ele preenche os dados e a solicitação vai direto para o seu CRM com todos os campos preenchidos.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={loadCaptacaoLinks}
                    disabled={captacaoLoading}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(201,168,76,0.2)", background: "transparent", color: "#7A8FA8", cursor: "pointer", fontSize: 13 }}
                  >
                    <RefreshCw style={{ width: 14, height: 14 }} className={captacaoLoading ? "animate-spin" : ""} />
                    Atualizar
                  </button>
                  <button
                    onClick={handleGerarLink}
                    disabled={captacaoGenerating}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px", borderRadius: 8, border: "none", background: captacaoGenerating ? "#7A8FA8" : "linear-gradient(135deg, #C9A84C, #E8C97A)", color: "#09081A", fontWeight: 700, fontSize: 13, cursor: captacaoGenerating ? "not-allowed" : "pointer" }}
                  >
                    <Plus style={{ width: 16, height: 16 }} />
                    {captacaoGenerating ? "Gerando..." : "Gerar Novo Link"}
                  </button>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              {[
                { num: "1", title: "Gere o link", desc: "Clique em \"Gerar Novo Link\" acima" },
                { num: "2", title: "Envie ao cliente", desc: "Copie e compartilhe via WhatsApp, e-mail ou SMS" },
                { num: "3", title: "Cliente preenche", desc: "Formulário com seus dados e produto de interesse" },
                { num: "4", title: "Lead no CRM", desc: "Aparece aqui com badge \"Digital\" para você direcionar" },
              ].map((step) => (
                <div key={step.num} style={{ flex: "1 1 180px", padding: "14px 16px", borderRadius: 10, border: "1px solid #122036", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#C9A84C", marginBottom: 8 }}>{step.num}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#F0ECE4", marginBottom: 3 }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: "#7A8FA8" }}>{step.desc}</div>
                </div>
              ))}
            </div>

            {/* Links list */}
            {captacaoLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#7A8FA8", fontSize: 14 }}>
                <RefreshCw style={{ width: 20, height: 20, margin: "0 auto 8px", display: "block" }} className="animate-spin" />
                Carregando links...
              </div>
            ) : captacaoLinks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", border: "1px dashed rgba(201,168,76,0.2)", borderRadius: 12 }}>
                <Link2 style={{ width: 32, height: 32, color: "#7A8FA8", margin: "0 auto 12px", display: "block" }} />
                <p style={{ color: "#7A8FA8", fontSize: 14, margin: 0 }}>Nenhum link gerado ainda.</p>
                <p style={{ color: "#7A8FA8", fontSize: 12, margin: "4px 0 0" }}>Clique em "Gerar Novo Link" para começar.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {captacaoLinks.map((link) => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${link.token}`;
                  const isCopied = copiedToken === link.token;
                  return (
                    <div key={link.id} style={{ padding: "16px 20px", borderRadius: 12, border: `1px solid ${link.active ? "rgba(201,168,76,0.2)" : "rgba(122,143,168,0.15)"}`, background: link.active ? "rgba(201,168,76,0.03)" : "rgba(255,255,255,0.01)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      {/* Status dot */}
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: link.active ? "#10B981" : "#7A8FA8", flexShrink: 0 }} />

                      {/* Link info */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontFamily: "monospace", color: "#C9A84C", background: "rgba(201,168,76,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                            /c/{link.token.slice(0, 12)}...
                          </span>
                          {link.active ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981", background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(16,185,129,0.2)" }}>ATIVO</span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#7A8FA8", background: "rgba(122,143,168,0.1)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(122,143,168,0.2)" }}>INATIVO</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "#7A8FA8" }}>
                          {link.uses_count} {link.uses_count === 1 ? "resposta" : "respostas"} · Criado em {new Date(link.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>

                      {/* URL preview */}
                      <div style={{ fontSize: 11, color: "#7A8FA8", fontFamily: "monospace", background: "#0D1B2A", padding: "6px 12px", borderRadius: 6, border: "1px solid #122036", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 2 }}>
                        {url}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => handleCopyLink(link.token)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: `1px solid ${isCopied ? "rgba(16,185,129,0.4)" : "rgba(201,168,76,0.3)"}`, background: isCopied ? "rgba(16,185,129,0.1)" : "rgba(201,168,76,0.08)", color: isCopied ? "#10B981" : "#C9A84C", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                        >
                          {isCopied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                          {isCopied ? "Copiado!" : "Copiar"}
                        </button>
                        <button
                          onClick={() => handleToggleLink(link.id, !link.active)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(122,143,168,0.2)", background: "transparent", color: "#7A8FA8", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                        >
                          {link.active
                            ? <ToggleRight style={{ width: 14, height: 14, color: "#10B981" }} />
                            : <ToggleLeft style={{ width: 14, height: 14 }} />}
                          {link.active ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Digital leads notice */}
            {visibleLeads.filter(l => l.source === "digital").length > 0 && (
              <div style={{ marginTop: 28, padding: "16px 20px", borderRadius: 12, border: "1px solid rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.04)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#60A5FA", marginBottom: 6 }}>
                  📥 {visibleLeads.filter(l => l.source === "digital").length} lead(s) Digital no seu CRM
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#7A8FA8" }}>
                  Leads com badge "Digital" na aba Leads chegaram via link de captação. Vá para a aba Leads para direcioná-los.
                </p>
              </div>
            )}

            {/* ── SEÇÃO M&A ── */}
            <div style={{ marginTop: 40 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(201,168,76,0.1)" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#C9A84C", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Link de Captação M&A
                </span>
                <div style={{ flex: 1, height: 1, background: "rgba(201,168,76,0.1)" }} />
              </div>

              <div style={{ marginBottom: 24, padding: "20px 24px", borderRadius: 12, border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.04)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Building2 style={{ width: 18, height: 18, color: "#818CF8" }} />
                      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#F0ECE4" }}>Formulário M&A Digital</h2>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#7A8FA8", maxWidth: 520, lineHeight: 1.5 }}>
                      Gere um link personalizado para o cliente preencher os dados da empresa para uma operação de M&A (venda, fusão, captação de capital etc.). O lead vai direto para sua aba Leads.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={loadMaCaptacaoLinks}
                      disabled={maCaptacaoLoading}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.2)", background: "transparent", color: "#7A8FA8", cursor: "pointer", fontSize: 13 }}
                    >
                      <RefreshCw style={{ width: 14, height: 14 }} className={maCaptacaoLoading ? "animate-spin" : ""} />
                      Atualizar
                    </button>
                    <button
                      onClick={handleGerarMaLink}
                      disabled={maCaptacaoGenerating}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px", borderRadius: 8, border: "none", background: maCaptacaoGenerating ? "#7A8FA8" : "linear-gradient(135deg, #6366F1, #818CF8)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: maCaptacaoGenerating ? "not-allowed" : "pointer" }}
                    >
                      <Plus style={{ width: 16, height: 16 }} />
                      {maCaptacaoGenerating ? "Gerando..." : "Gerar Link M&A"}
                    </button>
                  </div>
                </div>
              </div>

              {/* How it works — M&A */}
              <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                {[
                  { num: "1", title: "Gere o link", desc: "Clique em \"Gerar Link M&A\" acima" },
                  { num: "2", title: "Envie ao cliente", desc: "Compartilhe via WhatsApp, e-mail ou SMS" },
                  { num: "3", title: "Cliente preenche", desc: "Empresa, setor, financeiro e tipo de operação" },
                  { num: "4", title: "Lead no CRM", desc: "Aparece na aba Leads com badge M&A para encaminhar" },
                ].map((step) => (
                  <div key={step.num} style={{ flex: "1 1 180px", padding: "14px 16px", borderRadius: 10, border: "1px solid #122036", background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#818CF8", marginBottom: 8 }}>{step.num}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#F0ECE4", marginBottom: 3 }}>{step.title}</div>
                    <div style={{ fontSize: 12, color: "#7A8FA8" }}>{step.desc}</div>
                  </div>
                ))}
              </div>

              {/* M&A links list */}
              {maCaptacaoLoading ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#7A8FA8", fontSize: 14 }}>
                  <RefreshCw style={{ width: 20, height: 20, margin: "0 auto 8px", display: "block" }} className="animate-spin" />
                  Carregando links M&A...
                </div>
              ) : maCaptacaoLinks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 0", border: "1px dashed rgba(99,102,241,0.2)", borderRadius: 12 }}>
                  <Building2 style={{ width: 32, height: 32, color: "#7A8FA8", margin: "0 auto 12px", display: "block" }} />
                  <p style={{ color: "#7A8FA8", fontSize: 14, margin: 0 }}>Nenhum link M&A gerado ainda.</p>
                  <p style={{ color: "#7A8FA8", fontSize: 12, margin: "4px 0 0" }}>Clique em "Gerar Link M&A" para começar.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {maCaptacaoLinks.map((link) => {
                    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/mf/${link.token}`;
                    const isCopied = maCopiedToken === link.token;
                    return (
                      <div key={link.id} style={{ padding: "16px 20px", borderRadius: 12, border: `1px solid ${link.active ? "rgba(99,102,241,0.25)" : "rgba(122,143,168,0.15)"}`, background: link.active ? "rgba(99,102,241,0.04)" : "rgba(255,255,255,0.01)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: link.active ? "#818CF8" : "#7A8FA8", flexShrink: 0 }} />

                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontFamily: "monospace", color: "#818CF8", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                              /mf/{link.token.slice(0, 12)}...
                            </span>
                            {link.active ? (
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#818CF8", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(99,102,241,0.25)" }}>ATIVO</span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#7A8FA8", background: "rgba(122,143,168,0.1)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(122,143,168,0.2)" }}>INATIVO</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#7A8FA8" }}>
                            {link.uses_count} {link.uses_count === 1 ? "resposta" : "respostas"} · Criado em {new Date(link.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: "#7A8FA8", fontFamily: "monospace", background: "#0D1B2A", padding: "6px 12px", borderRadius: 6, border: "1px solid #122036", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 2 }}>
                          {url}
                        </div>

                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={() => handleCopyMaLink(link.token)}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: `1px solid ${isCopied ? "rgba(16,185,129,0.4)" : "rgba(99,102,241,0.3)"}`, background: isCopied ? "rgba(16,185,129,0.1)" : "rgba(99,102,241,0.08)", color: isCopied ? "#10B981" : "#818CF8", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                          >
                            {isCopied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                            {isCopied ? "Copiado!" : "Copiar"}
                          </button>
                          <button
                            onClick={() => handleToggleMaLink(link.id, !link.active)}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(122,143,168,0.2)", background: "transparent", color: "#7A8FA8", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                          >
                            {link.active
                              ? <ToggleRight style={{ width: 14, height: 14, color: "#818CF8" }} />
                              : <ToggleLeft style={{ width: 14, height: 14 }} />}
                            {link.active ? "Desativar" : "Ativar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* M&A leads notice */}
              {visibleLeads.filter(l => l.creditLine === "M&A" || (l.metadata as Record<string, unknown>)?.form_type === "ma").length > 0 && (
                <div style={{ marginTop: 28, padding: "16px 20px", borderRadius: 12, border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.04)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#818CF8", marginBottom: 6 }}>
                    🏢 {visibleLeads.filter(l => l.creditLine === "M&A" || (l.metadata as Record<string, unknown>)?.form_type === "ma").length} lead(s) M&A no seu CRM
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#7A8FA8" }}>
                    Leads M&A aguardam na aba Leads. Clique em &quot;Mesa M&A&quot; para encaminhar para a mesa especializada.
                  </p>
                </div>
              )}
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

      {/* ── MODAL: CSV Import ── */}
      {showImport && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowImport(false); }}>
          <div style={{ background: "#09081A", border: "1px solid #1E3A5F", borderRadius: 16, padding: 28, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#F0ECE4" }}>Importar Contatos CSV</h2>
              <button onClick={() => setShowImport(false)} style={{ background: "transparent", border: "none", color: "#7A8FA8", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>

            {/* Step indicator */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {[1,2,3].map(s => (
                <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: importStep >= s ? "#C9A84C" : "#122036" }} />
              ))}
            </div>

            {/* Step 1: Upload */}
            {importStep === 1 && (
              <div>
                <p style={{ margin: "0 0 16px", fontSize: 13, color: "#7A8FA8" }}>
                  Selecione um arquivo CSV com os dados dos contatos. A primeira linha deve ser o cabeçalho.
                </p>
                <label style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  border: "2px dashed rgba(201,168,76,0.3)", borderRadius: 12, padding: "32px 24px",
                  cursor: "pointer", background: "rgba(201,168,76,0.03)", color: "#C9A84C",
                }}>
                  <span style={{ fontSize: 32, marginBottom: 8 }}>⬆</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Clique para selecionar ou arraste o arquivo .csv</span>
                  <input type="file" accept=".csv" style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); }} />
                </label>
              </div>
            )}

            {/* Step 2: Map columns */}
            {importStep === 2 && importRawRows.length > 0 && (
              <div>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#7A8FA8" }}>
                  Mapeie as colunas do seu CSV para os campos do CRM:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {importRawRows[0].map((header, i) => (
                    <div key={i} style={{ background: "#0F1E35", border: "1px solid #122036", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#7A8FA8", marginBottom: 4 }}>Coluna: <strong style={{ color: "#E8EDF5" }}>{header}</strong></div>
                      <select value={importMapping[i] ?? "ignorar"} onChange={(e) => setImportMapping(prev => ({ ...prev, [i]: e.target.value }))}
                        style={{ width: "100%", background: "#162744", border: "1px solid #243A66", borderRadius: 6, padding: "5px 8px", color: "#E8EDF5", fontSize: 12, outline: "none" }}>
                        <option value="ignorar">Ignorar</option>
                        <option value="nome">Nome</option>
                        <option value="email">E-mail</option>
                        <option value="telefone">Telefone</option>
                        <option value="cidade">Cidade</option>
                        <option value="estado">Estado/UF</option>
                        <option value="observacoes">Observações</option>
                      </select>
                    </div>
                  ))}
                </div>
                {/* Preview */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#7A8FA8", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>
                    Prévia (5 primeiros registros)
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr>{importRawRows[0].map((h, i) => <th key={i} style={{ padding: "4px 8px", borderBottom: "1px solid #122036", color: "#7A8FA8", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {importRawRows.slice(1, 6).map((row, ri) => (
                          <tr key={ri}>{row.map((cell, ci) => <td key={ci} style={{ padding: "4px 8px", borderBottom: "1px solid #0d1929", color: "#E8EDF5", whiteSpace: "nowrap" }}>{cell}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setImportStep(1)} style={{ background: "transparent", border: "1px solid #122036", borderRadius: 8, padding: "8px 16px", color: "#7A8FA8", cursor: "pointer", fontSize: 13 }}>Voltar</button>
                  <button onClick={handleImportSubmit} disabled={importLoading}
                    style={{ background: "#C9A84C", border: "none", borderRadius: 8, padding: "8px 20px", color: "#09081A", fontWeight: 700, cursor: importLoading ? "not-allowed" : "pointer", fontSize: 13 }}>
                    {importLoading ? "Importando..." : `Importar ${importRawRows.slice(1).filter(r => r[0]?.trim()).length} contato(s)`}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Result */}
            {importStep === 3 && (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{importResult?.startsWith("✅") ? "✅" : "❌"}</div>
                <p style={{ fontSize: 15, color: importResult?.startsWith("✅") ? "#10B981" : "#EF4444", fontWeight: 600, margin: "0 0 20px" }}>{importResult}</p>
                <button onClick={() => setShowImport(false)} style={{ background: "#C9A84C", border: "none", borderRadius: 8, padding: "8px 24px", color: "#09081A", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}

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
                <div style={{ fontSize: 12, color: "#7A8FA8", marginTop: 4 }}>
                  {selectedLead.code}
                  {isAdmin && ` · ${selectedLead.partnerName}`}
                </div>
              </DialogHeader>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 8 }}>
                {/* Left: Basic data */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
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
                      <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 2 }}>{row.label}</div>
                      <div style={{ fontSize: 13, color: "#E8EDF5" }}>{row.value}</div>
                    </div>
                  ))}
                </div>

                {/* Right: CRM data */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
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
                      <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 2 }}>{row.label}</div>
                      <div style={{ fontSize: 13, color: "#E8EDF5" }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dados do formulário de captação (metadata) */}
              {selectedLead.metadata && Object.keys(selectedLead.metadata).length > 0 && (() => {
                const m = selectedLead.metadata!;
                const fmt = (v: unknown) => (v == null || v === "" ? null : String(v));

                // ── Formulário M&A (captação via link) ──
                if (m.form_type === "ma") {
                  const hasNegocio = fmt(m.descricao) || fmt(m.diferenciais);
                  const hasFin = fmt(m.faturamento) || fmt(m.ebitda) || fmt(m.valorPretendido);
                  const hasResp = fmt(m.nome) || fmt(m.cargo);
                  return (
                    <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 10, background: "rgba(17,31,53,0.5)", border: "1px solid rgba(201,168,76,0.2)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Formulário M&amp;A — Captação
                      </div>

                      {/* Identificação */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>Identificação da Empresa</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {fmt(m.empresa) && <div><span style={{ fontSize: 10, color: "#7A8FA8" }}>Empresa: </span><span style={{ fontSize: 12, color: "#E8EDF5" }}>{fmt(m.empresa)}</span></div>}
                          {fmt(m.cnpj) && <div><span style={{ fontSize: 10, color: "#7A8FA8" }}>CNPJ: </span><span style={{ fontSize: 12, color: "#E8EDF5" }}>{fmt(m.cnpj)}</span></div>}
                          {fmt(m.setor) && <div><span style={{ fontSize: 10, color: "#7A8FA8" }}>Setor: </span><span style={{ fontSize: 12, color: "#E8EDF5" }}>{fmt(m.setor)}</span></div>}
                          {(fmt(m.cidade) || fmt(m.estado)) && <div><span style={{ fontSize: 10, color: "#7A8FA8" }}>Localização: </span><span style={{ fontSize: 12, color: "#E8EDF5" }}>{[fmt(m.cidade), fmt(m.estado)].filter(Boolean).join(" · ")}</span></div>}
                          {fmt(m.tipoOperacao) && <div style={{ gridColumn: "span 2" }}><span style={{ fontSize: 10, color: "#7A8FA8" }}>Tipo de Operação: </span><span style={{ fontSize: 12, color: "#E8EDF5" }}>{fmt(m.tipoOperacao)}</span></div>}
                        </div>
                      </div>

                      {/* Sobre o Negócio */}
                      {hasNegocio && (
                        <div style={{ marginBottom: 12, paddingTop: 10, borderTop: "1px solid rgba(36,58,102,0.6)" }}>
                          <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>Sobre o Negócio</div>
                          {fmt(m.descricao) && (
                            <div style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 2 }}>Descrição:</div>
                              <div style={{ fontSize: 12, color: "#E8EDF5", lineHeight: 1.6 }}>{fmt(m.descricao)}</div>
                            </div>
                          )}
                          {fmt(m.diferenciais) && (
                            <div>
                              <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 2 }}>Diferenciais:</div>
                              <div style={{ fontSize: 12, color: "#E8EDF5", lineHeight: 1.6 }}>{fmt(m.diferenciais)}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dados Financeiros */}
                      {hasFin && (
                        <div style={{ marginBottom: 12, paddingTop: 10, borderTop: "1px solid rgba(36,58,102,0.6)" }}>
                          <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 8, fontWeight: 700, textTransform: "uppercase" }}>Dados Financeiros</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                            {fmt(m.faturamento) && (
                              <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 8, padding: "8px 10px" }}>
                                <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 2 }}>Faturamento</div>
                                <div style={{ fontSize: 12, color: "#E8C97A", fontWeight: 600 }}>{fmt(m.faturamento)}</div>
                              </div>
                            )}
                            {fmt(m.ebitda) && (
                              <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 8, padding: "8px 10px" }}>
                                <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 2 }}>EBITDA</div>
                                <div style={{ fontSize: 12, color: "#E8C97A", fontWeight: 600 }}>{fmt(m.ebitda)}</div>
                              </div>
                            )}
                            {fmt(m.valorPretendido) && (
                              <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 8, padding: "8px 10px" }}>
                                <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 2 }}>Valor Pretendido</div>
                                <div style={{ fontSize: 12, color: "#E8C97A", fontWeight: 600 }}>{fmt(m.valorPretendido)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Responsável */}
                      {hasResp && (
                        <div style={{ paddingTop: 10, borderTop: "1px solid rgba(36,58,102,0.6)" }}>
                          <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>Responsável</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {fmt(m.nome) && <div><span style={{ fontSize: 10, color: "#7A8FA8" }}>Nome: </span><span style={{ fontSize: 12, color: "#E8EDF5" }}>{fmt(m.nome)}</span></div>}
                            {fmt(m.cargo) && <div><span style={{ fontSize: 10, color: "#7A8FA8" }}>Cargo: </span><span style={{ fontSize: 12, color: "#E8EDF5" }}>{fmt(m.cargo)}</span></div>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Formulário genérico CRM (crédito, consórcio, etc.) ──
                const hasAddress = fmt(m.enderecoRua) || fmt(m.cep) || fmt(m.city);
                const hasFinanceiro = fmt(m.renda) || fmt(m.faturamento) || fmt(m.estadoCivil) || fmt(m.restricao);
                const hasProduto = fmt(m.valorSolicitado) || fmt(m.prazo) || fmt(m.finalidade) || fmt(m.observacoes);
                const imoveis = Array.isArray(m.imoveis) ? m.imoveis : [];
                const docs = Array.isArray(m.documentos) ? m.documentos as { label: string; name: string; url: string }[] : [];
                if (!hasAddress && !hasFinanceiro && !hasProduto && imoveis.length === 0 && docs.length === 0) return null;
                return (
                  <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 10, background: "rgba(17,31,53,0.5)", border: "1px solid rgba(22,39,68,0.8)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Dados do Formulário de Captação
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {/* Endereço */}
                      {hasAddress && (
                        <div>
                          <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>Endereço do Cliente</div>
                          {fmt(m.enderecoRua) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>{fmt(m.enderecoRua)}</div>}
                          {fmt(m.cep) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>CEP: {fmt(m.cep)}</div>}
                          {(fmt(m.city) || fmt(m.state)) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>{[fmt(m.city), fmt(m.state)].filter(Boolean).join(", ")}</div>}
                        </div>
                      )}
                      {/* Financeiro */}
                      {hasFinanceiro && (
                        <div>
                          <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>Dados Financeiros</div>
                          {fmt(m.renda) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>Renda: {fmt(m.renda)}</div>}
                          {fmt(m.faturamento) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>Faturamento: {fmt(m.faturamento)}</div>}
                          {fmt(m.estadoCivil) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>Estado Civil: {fmt(m.estadoCivil)}</div>}
                          {fmt(m.restricao) && <div style={{ fontSize: 12, color: fmt(m.restricao) === "SIM" ? "#EF4444" : "#10B981" }}>Restrição: {fmt(m.restricao)}</div>}
                        </div>
                      )}
                      {/* Produto */}
                      {hasProduto && (
                        <div>
                          <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>Produto Solicitado</div>
                          {fmt(m.valorSolicitado) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>Valor: {fmt(m.valorSolicitado)}</div>}
                          {fmt(m.prazo) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>Prazo: {fmt(m.prazo)}</div>}
                          {fmt(m.finalidade) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>Finalidade: {fmt(m.finalidade)}</div>}
                          {fmt(m.observacoes) && <div style={{ fontSize: 12, color: "#7A8FA8", fontStyle: "italic" }}>Obs: {fmt(m.observacoes)}</div>}
                        </div>
                      )}
                      {/* Imóveis */}
                      {imoveis.length > 0 && imoveis.map((im: Record<string, unknown>, idx: number) => (
                        <div key={idx}>
                          <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>Imóvel em Garantia {imoveis.length > 1 ? idx + 1 : ""}</div>
                          {fmt(im.endereco) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>{fmt(im.endereco)}</div>}
                          {fmt(im.cep) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>CEP: {fmt(im.cep)}</div>}
                          {(fmt(im.cidade) || fmt(im.estado)) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>{[fmt(im.cidade), fmt(im.estado)].filter(Boolean).join(", ")}</div>}
                          {fmt(im.valor_medio) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>Valor: R$ {Number(im.valor_medio).toLocaleString("pt-BR")}</div>}
                          {fmt(im.zona) && <div style={{ fontSize: 12, color: "#E8EDF5" }}>Zona: {fmt(im.zona)}</div>}
                        </div>
                      ))}
                    </div>
                    {/* Documentos */}
                    {docs.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>Documentos Enviados ({docs.length})</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {docs.map((doc, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
                              <span style={{ fontSize: 11, color: "#10B981" }}>{doc.label}</span>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#C9A84C", textDecoration: "none" }}>
                                {doc.name} ↗
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Notes */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
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
                <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Histórico de Interações ({selectedLead.interactions.length})
                </div>

                {selectedLead.interactions.length === 0 && (
                  <div style={{ color: "#7A8FA8", fontSize: 13, marginBottom: 12 }}>Nenhuma interação registrada.</div>
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
                          color: "#C9A84C",
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
                          <span style={{ fontSize: 11, color: "#7A8FA8" }}>{formatDate(inter.date)}</span>
                          <span style={{ fontSize: 11, color: "#7A8FA8" }}>· {inter.author}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#E8EDF5" }}>{inter.notes}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add interaction */}
                <div style={{ background: "#0F1E35", border: "1px solid #122036", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#7A8FA8", marginBottom: 8 }}>Adicionar Interação</div>
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

              {/* ── Mover para Fase ── */}
              <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(9,8,26,0.5)", border: "1px solid rgba(22,39,68,0.8)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#7A8FA8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Mover para Fase
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {STAGES.map((stage) => {
                    const isActive = selectedLead.status === stage.id;
                    return (
                      <button
                        key={stage.id}
                        onClick={() => !isActive && handleMoveToStage(selectedLead.id, stage.id as CRMLead["status"])}
                        style={{
                          padding: "5px 13px",
                          borderRadius: 20,
                          border: `1px solid ${isActive ? stage.color : "rgba(22,39,68,0.9)"}`,
                          background: isActive ? stage.bg : "transparent",
                          color: isActive ? stage.color : "#7A8FA8",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: isActive ? "default" : "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {stage.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <Button variant="outline" onClick={() => setSelectedLead(null)}>
                  Fechar
                </Button>

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
                {(selectedLead.status === "proposta" || selectedLead.status === "negociacao" ||
                  (selectedLead.status === "ganho" && ["credito_varejo","credito_estruturado","high_ticket"].includes(selectedLead.convertedTo))) && (
                  <Button
                    onClick={() => {
                      handleEnviarMesa(selectedLead);
                      setSelectedLead(null);
                    }}
                    style={{ background: "#10B981", borderColor: "#10B981", color: "#fff" }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Enviar para Mesa de Crédito
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

      {/* ── MODAL: Lead de captação com proposta vinculada — mesmo modal da Mesa de Crédito ── */}
      <PropostaDetailModal
        open={!!crmProposal}
        onClose={() => setCrmProposal(null)}
        proposal={crmProposal}
        onStageChange={handleCrmStageChange}
        onProposalUpdate={handleCrmProposalUpdate}
        canChangeStage={canChangeStageInCrm}
        canEditValorSolicitado={canChangeStageInCrm}
        canCompileDocuments={canChangeStageInCrm}
        canEditInstituicao={canChangeStageInCrm}
        pendingCrmReview={!!(crmProposal?.metadata as Record<string, unknown> | undefined)?.crm_pending_review}
        onConfirmSendToMesa={handleConfirmCrmSendToMesa}
        isAdmin={userRole === "ADMIN"}
      />

      {/* ── MODAL: Convert Lead ── */}
      <Dialog open={!!showConvert} onOpenChange={(open) => { if (!open) { setShowConvert(null); setSelectedConvert(""); setSelectedCreditLine(""); } }}>
        <DialogContent className="max-w-lg" style={{ background: "#091221", border: "1px solid #122036", maxHeight: "90vh", overflowY: "auto" }}>
          {showConvert && (
            <>
              <DialogHeader>
                <DialogTitle style={{ color: "#E8EDF5" }}>Encaminhar para qual produto?</DialogTitle>
              </DialogHeader>
              <div style={{ fontSize: 13, color: "#7A8FA8", marginBottom: 16 }}>
                {showConvert.name}
              </div>

              {/* Passo 1: Produto */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "#C4922E", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                1. Escolha o produto
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {CONVERT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedConvert === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => { setSelectedConvert(opt.id); setSelectedCreditLine(""); }}
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
                      <div style={{ fontSize: 11, color: "#7A8FA8" }}>{opt.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Passo 2: Linha de crédito (somente se produto for crédito) */}
              {selectedConvert && CREDIT_LINES_BY_PRODUCT[selectedConvert] && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#C4922E", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    2. Escolha a linha de crédito
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {CREDIT_LINES_BY_PRODUCT[selectedConvert].map((item) => {
                      const isSelected = selectedCreditLine === item.line;
                      const opt = CONVERT_OPTIONS.find(o => o.id === selectedConvert)!;
                      return (
                        <div
                          key={item.line}
                          onClick={() => setSelectedCreditLine(item.line)}
                          style={{
                            background: isSelected ? opt.bg : "#0F1E35",
                            border: `2px solid ${isSelected ? opt.color : "#122036"}`,
                            borderRadius: 8,
                            padding: "10px 14px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            transition: "all 0.15s",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? opt.color : "#E8EDF5" }}>
                              {item.line}
                            </div>
                            <div style={{ fontSize: 11, color: "#5A7490", marginTop: 2 }}>{item.desc}</div>
                          </div>
                          {isSelected && (
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: opt.color, flexShrink: 0 }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button variant="outline" onClick={() => { setShowConvert(null); setSelectedConvert(""); setSelectedCreditLine(""); }}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConvert}
                  disabled={
                    !selectedConvert ||
                    (!!CREDIT_LINES_BY_PRODUCT[selectedConvert] && !selectedCreditLine)
                  }
                >
                  <ChevronRight className="w-4 h-4 mr-1" />
                  Confirmar e Encaminhar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODAL: New Lead — Passo 1: Selecionar Produto ── */}
      <Dialog open={showNewLead && newLead.productInterest === ""} onOpenChange={(open) => { if (!open) setShowNewLead(false); }}>
        <DialogContent className="max-w-md" style={{ background: "#09081A", border: "1px solid #1E3A5F" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#E8EDF5", fontSize: 18 }}>Novo Lead — Selecione o Produto</DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: 12, color: "#7A8FA8", marginBottom: 16, marginTop: 4 }}>
            Escolha o produto de interesse do cliente para abrir o formulário correto.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {CONVERT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (opt.id === "credito_varejo" || opt.id === "credito_estruturado" || opt.id === "high_ticket") {
                      const lvl = opt.id === "credito_varejo" ? "NIVEL_1" : opt.id === "credito_estruturado" ? "NIVEL_2" : "NIVEL_3";
                      setCreditoFormLevel(lvl as "NIVEL_1" | "NIVEL_2" | "NIVEL_3");
                      setShowNewLead(false);
                      setTimeout(() => setShowCreditoForm(true), 80);
                    } else if (opt.id === "ma") {
                      setShowNewLead(false);
                      setTimeout(() => setShowMaForm(true), 80);
                    } else {
                      setNewLead((p) => ({ ...p, productInterest: opt.id, creditLine: "" }));
                    }
                  }}
                  style={{
                    background: "#0F1E35", border: `1px solid ${opt.color}30`,
                    borderRadius: 10, padding: "14px 12px", cursor: "pointer",
                    textAlign: "left", transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = opt.bg; (e.currentTarget as HTMLButtonElement).style.borderColor = opt.color; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0F1E35"; (e.currentTarget as HTMLButtonElement).style.borderColor = `${opt.color}30`; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Icon style={{ width: 16, height: 16, color: opt.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#E8EDF5" }}>{opt.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#7A8FA8" }}>{opt.desc}</div>
                  {(opt.id === "credito_varejo" || opt.id === "credito_estruturado" || opt.id === "high_ticket" || opt.id === "ma") && (
                    <div style={{ marginTop: 6, fontSize: 10, color: opt.color, fontWeight: 600 }}>
                      → Abre formulário especializado
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <Button variant="outline" onClick={() => setShowNewLead(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: New Lead — Passo 2: Formulário Simples (Consórcio / Split / outros) ── */}
      <Dialog open={showNewLead && newLead.productInterest !== ""} onOpenChange={(open) => { if (!open) { setShowNewLead(false); setNewLead((p) => ({ ...p, productInterest: "", creditLine: "" })); } }}>
        <DialogContent className="max-w-lg" style={{ background: "#091221", border: "1px solid #122036", maxHeight: "90vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#E8EDF5" }}>
              Novo Lead —{" "}
              <span style={{ color: CONVERT_OPTIONS.find(o => o.id === newLead.productInterest)?.color ?? "#C9A84C" }}>
                {CONVERT_OPTIONS.find(o => o.id === newLead.productInterest)?.label ?? ""}
              </span>
            </DialogTitle>
          </DialogHeader>
          <button
            onClick={() => setNewLead((p) => ({ ...p, productInterest: "", creditLine: "" }))}
            style={{ fontSize: 11, color: "#7A8FA8", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 4, textDecoration: "underline" }}
          >
            ← Trocar produto
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 4 }}>
            {/* Section 1: Dados Pessoais */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
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
                      border: `2px solid ${newLead.personType === t ? "#C9A84C" : "#122036"}`,
                      borderRadius: 8,
                      background: newLead.personType === t ? "rgba(196,146,46,0.15)" : "transparent",
                      color: newLead.personType === t ? "#E8C97A" : "#7A8FA8",
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
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>
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
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>
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
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>Telefone</label>
                  <input
                    type="text"
                    value={newLead.phone}
                    onChange={(e) => setNewLead((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    style={inputStyle}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>E-mail *</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead((p) => ({ ...p, email: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>Cidade</label>
                  <input
                    type="text"
                    value={newLead.city}
                    onChange={(e) => setNewLead((p) => ({ ...p, city: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>Estado (UF)</label>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                2. Dados Comerciais
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>Segmento</label>
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
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>Origem</label>
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
                    <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>
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
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>Observações</label>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                3. CRM
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>Data da Visita</label>
                  <input
                    type="date"
                    value={newLead.visitDate}
                    onChange={(e) => setNewLead((p) => ({ ...p, visitDate: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>Próximo Contato</label>
                  <input
                    type="date"
                    value={newLead.nextContact}
                    onChange={(e) => setNewLead((p) => ({ ...p, nextContact: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Nota informativa para Consórcio / Split */}
            {newLead.productInterest === "split" && (
              <div style={{ background: "rgba(196,146,46,0.08)", border: "1px solid rgba(196,146,46,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#E8C97A" }}>
                💡 Após criar o lead, acesse o <strong>Simulador Monetto</strong> para gerar proposta de Split Fiscal.
              </div>
            )}
            {newLead.productInterest === "consorcio" && (
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#10B981" }}>
                💡 Após criar o lead, acesse o <strong>Simulador de Consórcio</strong> para calcular parcelas.
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <Button variant="outline" onClick={() => { setShowNewLead(false); setNewLead((p) => ({ ...p, productInterest: "", creditLine: "" })); }}>
              Cancelar
            </Button>
            <Button onClick={handleNewLeadSubmit} disabled={!newLead.name || !newLead.email}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Lead
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL FORMULÁRIO DE CRÉDITO (Mesa de Crédito) ── */}
      <NovaPropostaModal
        open={showCreditoForm}
        onClose={() => setShowCreditoForm(false)}
        level={creditoFormLevel}
        partnerName={userName}
        partnerId={userId}
        onSubmit={async (proposal): Promise<string> => {
          // Salva na Mesa de Crédito
          const metadata = (proposal.metadata as Record<string, unknown>) ?? {};
          const res = await fetch("/api/credit-proposals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title:           proposal.title,
              client_name:     proposal.client_name,
              client_cpf_cnpj: (proposal.cpf_cnpj as string) ?? null,
              credit_line:     proposal.credit_line,
              requested_value: proposal.requested_value,
              current_level:   creditoFormLevel,
              metadata,
            }),
          });
          const json = await res.json();
          if (!json.ok) {
            throw new Error(typeof json.error === "string" ? json.error : "Erro ao salvar na Mesa de Crédito");
          }
          setShowCreditoForm(false);
          return (json.proposal as Record<string, unknown>).id as string;
        }}
      />

      {/* ── MODAL FORMULÁRIO M&A ── */}
      {/* Banner de sucesso M&A */}
      {maDealSuccessMsg && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 60,
          background: "#162744", border: "1px solid #C9A84C", borderRadius: 10,
          padding: "12px 20px", display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)", maxWidth: 400,
        }}>
          <span style={{ color: "#C9A84C", fontWeight: 700, fontSize: 14 }}>✓</span>
          <span style={{ color: "#F5F1E8", fontSize: 13 }}>{maDealSuccessMsg}</span>
          <button
            onClick={() => setMaDealSuccessMsg(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#9BAFC5", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
          >×</button>
        </div>
      )}

      {showMaForm && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            overflowY: "auto",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowMaForm(false); }}
        >
          <div style={{
            background: "#09081A", border: "1px solid #1E3A5F", borderRadius: 16,
            padding: 32, width: "100%", maxWidth: 760, maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowMaForm(false)}>
                Fechar
              </Button>
            </div>
            <NovoDealForm
              isDemo={false}
              userId={userId}
              onSuccess={(_dealId, dealCode) => {
                setShowMaForm(false);
                setMaDealSuccessMsg(`Deal ${dealCode} enviado para a Mesa M&A com sucesso.`);
                setTimeout(() => setMaDealSuccessMsg(null), 6000);
                refreshLeads();
              }}
              onCancel={() => setShowMaForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Prospecção Tab ───────────────────────────────────────────────────────────

function ProspeccaoTab({ onAddLead }: { onAddLead: (prefill: Partial<{ personType: "PF"|"PJ"; name: string; document: string; email: string; phone: string; city: string; state: string; segment: string; }>) => Promise<void> | void }) {
  const [saving, setSaving] = useState<string | null>(null);
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
        <div style={{ fontSize: 14, fontWeight: 700, color: "#C9A84C", marginBottom: 4 }}>Prospeccao — Consulta CNPJ</div>
        <div style={{ fontSize: 12, color: "#7A8FA8", marginBottom: 16 }}>Dados publicos BrasilAPI · Razao social, socios, telefone, e-mail, capital social.</div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["single", "batch"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setResults([]); setError(""); }}
              style={{ ...btnBase, padding: "6px 16px", fontSize: 12,
                background: mode === m ? "#C9A84C" : "#0F1E35", color: mode === m ? "#09081A" : "#7A8FA8" }}>
              {m === "single" ? "Busca por CNPJ" : "Importar Lista de CNPJs"}
            </button>
          ))}
        </div>

        {mode === "single" ? (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>CNPJ da Empresa</label>
              <input type="text" value={cnpjInput}
                onChange={(e) => setCnpjInput(maskCnpj(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleSingle()}
                placeholder="00.000.000/0000-00" maxLength={18}
                style={{ ...pInputStyle, letterSpacing: "0.08em", fontSize: 15 }} />
            </div>
            <button onClick={handleSingle} disabled={loading}
              style={{ ...btnBase, background: loading ? "#7A8FA8" : "#C9A84C", color: "#09081A", padding: "9px 22px", fontSize: 13, cursor: loading ? "not-allowed" : "pointer" }}>
              <Search className="w-4 h-4" />{loading ? "Consultando..." : "Consultar"}
            </button>
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 11, color: "#7A8FA8", display: "block", marginBottom: 4 }}>Lista de CNPJs — um por linha (max. 20)</label>
            <textarea value={batchInput} onChange={(e) => setBatchInput(e.target.value)}
              placeholder={"11.222.333/0001-81\n44.555.666/0001-22"} rows={5}
              style={{ ...pInputStyle, resize: "vertical", fontFamily: "monospace", lineHeight: 1.6 }} />
            <button onClick={handleBatch} disabled={loading}
              style={{ ...btnBase, background: loading ? "#7A8FA8" : "#C9A84C", color: "#09081A", padding: "9px 22px", fontSize: 13, cursor: loading ? "not-allowed" : "pointer", marginTop: 10 }}>
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
          <div style={{ fontSize: 11, color: "#C9A84C", fontWeight: 700, marginBottom: 3 }}>Como prospectar por cidade/segmento?</div>
          <div style={{ fontSize: 11, color: "#7A8FA8", lineHeight: 1.6 }}>
            A Receita Federal nao disponibiliza busca gratuita por nome/cidade. Pesquise em{" "}
            <a href="https://casadosdados.com.br" target="_blank" rel="noreferrer" style={{ color: "#C9A84C" }}>casadosdados.com.br</a>
            {" ou "}<a href="https://cnpja.com.br" target="_blank" rel="noreferrer" style={{ color: "#C9A84C" }}>cnpja.com.br</a>
            {", copie os CNPJs e importe aqui em lote para buscar socios, telefone e e-mail."}
          </div>
        </div>
      </div>

      {results.length > 1 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#7A8FA8" }}>Filtrar:</span>
          <select value={ufFilter} onChange={(e) => setUfFilter(e.target.value)}
            style={{ ...pInputStyle, width: 80, padding: "5px 8px", fontSize: 12 }}>
            <option value="">Todos UF</option>
            {UF_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="text" value={capitalMin} onChange={(e) => setCapitalMin(e.target.value)}
            placeholder="Capital min. R$" style={{ ...pInputStyle, width: 150, padding: "5px 10px", fontSize: 12 }} />
          <span style={{ fontSize: 12, color: "#7A8FA8" }}>{filtered.length}/{results.length} empresa(s)</span>
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
                      <div style={{ fontSize: 11, color: "#7A8FA8" }}>{c.nome_fantasia}</div>
                    )}
                    <div style={{ fontSize: 10, color: "#7A8FA8", marginTop: 2, fontFamily: "monospace" }}>{fmtCnpj(c.cnpj)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#7A8FA8" }}>{c.municipio || "—"}{c.uf ? ` / ${c.uf}` : ""}</div>
                  <div style={{ fontSize: 13, color: "#C9A84C", fontWeight: 700 }}>{fmtCap(c.capital_social)}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: c.situacao_cadastral === "ATIVA" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                    color: c.situacao_cadastral === "ATIVA" ? "#10B981" : "#EF4444" }}>
                    {c.situacao_cadastral || "—"}
                  </span>
                  <button onClick={() => setExpanded(isOpen ? null : c.cnpj)}
                    style={{ background: "transparent", border: "1px solid #122036", borderRadius: 6, padding: "5px 12px", color: "#7A8FA8", fontSize: 11, cursor: "pointer" }}>
                    {isOpen ? "Ocultar" : "Detalhes"}
                  </button>
                  <button onClick={() => onAddLead({ personType: "PJ", name: c.razao_social,
                    document: fmtCnpj(c.cnpj), email: c.email || "", phone: c.telefone || "",
                    city: c.municipio || "", state: c.uf || "", segment: (c.cnae || "").slice(0, 50) })}
                    style={{ ...btnBase, background: "rgba(196,146,46,0.15)", border: "1px solid rgba(196,146,46,0.3)", padding: "5px 14px", color: "#E8C97A", fontSize: 11 }}>
                    + Lead
                  </button>
                </div>

                {isOpen && (
                  <div style={{ padding: "14px 16px 18px", background: "#09081A", borderTop: "1px solid #122036" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#C9A84C", marginBottom: 10, textTransform: "uppercase" }}>Contato</div>
                        {([["Telefone", c.telefone], ["Telefone 2", c.telefone2], ["E-mail", c.email], ["Logradouro", c.logradouro], ["Bairro", c.bairro], ["CEP", c.cep]] as [string,string][]).map(([l, v]) => (
                          <div key={l} style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 10, color: "#7A8FA8" }}>{l}</div>
                            <div style={{ fontSize: 12, color: "#E8EDF5" }}>{v || "—"}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#C9A84C", marginBottom: 10, textTransform: "uppercase" }}>Empresa</div>
                        {([["Porte", c.porte], ["Capital Social", fmtCap(c.capital_social)], ["CNAE", (c.cnae || "").slice(0, 60)], ["Abertura", c.data_abertura ? new Date(c.data_abertura).toLocaleDateString("pt-BR") : "—"]] as [string,string][]).map(([l, v]) => (
                          <div key={l} style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 10, color: "#7A8FA8" }}>{l}</div>
                            <div style={{ fontSize: 12, color: l === "Capital Social" ? "#C9A84C" : "#E8EDF5", fontWeight: l === "Capital Social" ? 700 : 400 }}>{v || "—"}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#C9A84C", marginBottom: 10, textTransform: "uppercase" }}>Socios ({c.socios?.length || 0})</div>
                        {c.socios && c.socios.length > 0 ? c.socios.slice(0, 6).map((s, i) => (
                          <div key={i} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: "#E8EDF5" }}>{s.nome}</div>
                            <div style={{ fontSize: 10, color: "#7A8FA8" }}>{s.qualificacao}{s.entrada ? ` · desde ${new Date(s.entrada).toLocaleDateString("pt-BR")}` : ""}</div>
                          </div>
                        )) : <div style={{ fontSize: 12, color: "#7A8FA8" }}>Sem socios registrados</div>}
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
