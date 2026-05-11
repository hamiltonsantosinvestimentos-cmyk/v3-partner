export const USER_ROLES = {
  ADMIN: "ADMIN",
  PARTNER: "PARTNER",
  PARTNER_PRO: "PARTNER_PRO",
  MESA_OPERACIONAL: "MESA_OPERACIONAL",
  GESTAO: "GESTAO",
  FINANCEIRO: "FINANCEIRO",
  FORNECEDOR: "FORNECEDOR",
  SDR: "SDR",
  CLOSER: "CLOSER",
} as const;

export type UserRole = keyof typeof USER_ROLES;

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  PARTNER: "Partner",
  PARTNER_PRO: "Partner PRO",
  MESA_OPERACIONAL: "Mesa Operacional",
  GESTAO: "Gestão",
  FINANCEIRO: "Financeiro",
  FORNECEDOR: "Fornecedor",
  SDR: "SDR",
  CLOSER: "Closer",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
  PARTNER: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PARTNER_PRO: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  MESA_OPERACIONAL: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  GESTAO: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  FINANCEIRO: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  FORNECEDOR: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  SDR: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  CLOSER: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

// Marketplace
export const MARKETPLACE_CATEGORIES = [
  "Equipamentos de Saúde",
  "Mentoria & Consultoria",
  "Tecnologia & SaaS",
  "Serviços Financeiros",
  "Treinamentos & Cursos",
  "Imóveis & Real Estate",
  "Agronegócio",
  "Outros",
] as const;

export type MarketplaceCategory = typeof MARKETPLACE_CATEGORIES[number];

export const PRODUCT_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  INACTIVE: "INACTIVE",
} as const;

export type ProductStatus = keyof typeof PRODUCT_STATUS;

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  PENDING: "Aguardando Aprovação",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  INACTIVE: "Inativo",
};

export const SUPPLIER_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type SupplierStatus = keyof typeof SUPPLIER_STATUS;

// Mesa de Crédito - 3 níveis
export const CREDIT_DESK_LEVELS = {
  NIVEL_1: "NIVEL_1",
  NIVEL_2: "NIVEL_2",
  NIVEL_3: "NIVEL_3",
} as const;

export type CreditDeskLevel = keyof typeof CREDIT_DESK_LEVELS;

export const CREDIT_DESK_LEVEL_LABELS: Record<CreditDeskLevel, string> = {
  NIVEL_1: "Nível 1 — Crédito Varejo",
  NIVEL_2: "Nível 2 — Crédito Estruturado",
  NIVEL_3: "Nível 3 — High Ticket",
};

export const CREDIT_DESK_LEVEL_COLORS: Record<CreditDeskLevel, string> = {
  NIVEL_1: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  NIVEL_2: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  NIVEL_3: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export const CREDIT_DESK_LEVEL_DESCRIPTIONS: Record<CreditDeskLevel, string> = {
  NIVEL_1: "Crédito Varejo: Home Equity e Aval — operações de menor alçada",
  NIVEL_2: "Crédito Estruturado — operações com estrutura complexa e garantias",
  NIVEL_3: "High Ticket — operações a partir de R$ 5.000.000",
};

export const CREDIT_DESK_LINES: Record<CreditDeskLevel, string[]> = {
  NIVEL_1: [
    "HOME EQUITY",
    "HOME EQUITY ESTRESSADO",
    "AVAL",
    "FUNDO CONSTRUÇÃO RESIDENCIAL",
  ],
  NIVEL_2: [
    "HOMECASH",
    "V3GIRO E V3AUTOGIRO",
    "CGI",
  ],
  NIVEL_3: [
    "CRI",
    "CRA",
    "CPR",
    "FUNDO INTERNACIONAL CASH COLATERAL",
    "FUNDO INTERNACIONAL IMOB",
    "FUNDO CONSTRUÇÃO LOTEAMENTO",
    "FUNDO CONSTRUÇÃO EMPREENDIMENTO",
  ],
};

export const OPERATION_STATUS = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;

export type OperationStatus = keyof typeof OPERATION_STATUS;

export const STATUS_LABELS: Record<OperationStatus, string> = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  IN_REVIEW: "Em Análise",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  CANCELLED: "Cancelado",
  COMPLETED: "Concluído",
};

export const STATUS_COLORS: Record<OperationStatus, string> = {
  DRAFT: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  PENDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  IN_REVIEW: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  APPROVED: "bg-green-500/20 text-green-400 border-green-500/30",
  REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
  CANCELLED: "bg-gray-600/20 text-gray-500 border-gray-600/30",
  COMPLETED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export const DEAL_STAGES = {
  PROSPECTING: "PROSPECTING",
  QUALIFICATION: "QUALIFICATION",
  DUE_DILIGENCE: "DUE_DILIGENCE",
  NEGOTIATION: "NEGOTIATION",
  CLOSING: "CLOSING",
  CLOSED_WON: "CLOSED_WON",
  CLOSED_LOST: "CLOSED_LOST",
} as const;

export type DealStage = keyof typeof DEAL_STAGES;

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  PROSPECTING: "Prospecção",
  QUALIFICATION: "Qualificação",
  DUE_DILIGENCE: "Due Diligence",
  NEGOTIATION: "Negociação",
  CLOSING: "Fechamento",
  CLOSED_WON: "Fechado (Ganho)",
  CLOSED_LOST: "Fechado (Perdido)",
};

export const TICKET_PRIORITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;

export type TicketPriority = keyof typeof TICKET_PRIORITY;

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  URGENT: "bg-red-500/20 text-red-400 border-red-500/30",
};

// Navigation items by role
export const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"],
  },
  {
    href: "/usuarios",
    label: "Usuários",
    icon: "Users",
    roles: ["ADMIN"],
  },
  {
    href: "/ia-assistant",
    label: "IA Assistant",
    icon: "BrainCircuit",
    roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"],
  },
  {
    href: "/split-fiscal",
    label: "Split Fiscal",
    icon: "PieChart",
    roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "GESTAO"],
  },
  {
    href: "/ma",
    label: "M&A",
    icon: "Building2",
    roles: ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO"],
  },
  {
    href: "/mesa-credito",
    label: "Mesa de Crédito",
    icon: "CreditCard",
    roles: ["ADMIN", "MESA_OPERACIONAL", "GESTAO", "PARTNER", "PARTNER_PRO"],
    children: [
      {
        href: "/mesa-credito/nivel-1",
        label: "Nível 1 — Crédito Varejo",
        roles: ["ADMIN", "MESA_OPERACIONAL", "GESTAO", "PARTNER", "PARTNER_PRO"],
      },
      {
        href: "/mesa-credito/nivel-2",
        label: "Nível 2 — Crédito Estruturado",
        roles: ["ADMIN", "MESA_OPERACIONAL", "GESTAO", "PARTNER", "PARTNER_PRO"],
      },
      {
        href: "/mesa-credito/nivel-3",
        label: "Nível 3 — High Ticket",
        roles: ["ADMIN", "GESTAO", "PARTNER_PRO"],
      },
    ],
  },
  {
    href: "/mesa-operacional",
    label: "Mesa Operacional",
    icon: "Headphones",
    roles: ["ADMIN", "MESA_OPERACIONAL", "GESTAO"],
  },
] as const;
