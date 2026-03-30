// Demo mode — dados fictícios para demonstração
export const DEMO_USERS = [
  {
    id: "demo-admin-001",
    email: "admin@v3partner.com",
    password: "admin123",
    full_name: "Admin V3 Partner",
    role: "ADMIN" as const,
    avatar_url: null,
    phone: "(11) 99999-0001",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "demo-partner-001",
    email: "partner@v3partner.com",
    password: "partner123",
    full_name: "João Partner Silva",
    role: "PARTNER" as const,
    avatar_url: null,
    phone: "(11) 98888-0001",
    is_active: true,
    created_at: "2026-01-10T00:00:00Z",
  },
  {
    id: "demo-gestao-001",
    email: "gestao@v3partner.com",
    password: "gestao123",
    full_name: "Maria Gestão Costa",
    role: "GESTAO" as const,
    avatar_url: null,
    phone: "(11) 97777-0001",
    is_active: true,
    created_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "demo-mesa-001",
    email: "mesa@v3partner.com",
    password: "mesa123",
    full_name: "Carlos Mesa Operacional",
    role: "MESA_OPERACIONAL" as const,
    avatar_url: null,
    phone: "(11) 96666-0001",
    is_active: true,
    created_at: "2026-01-20T00:00:00Z",
  },
  {
    id: "demo-financeiro-001",
    email: "financeiro@v3partner.com",
    password: "financeiro123",
    full_name: "Ana Financeiro Lima",
    role: "FINANCEIRO" as const,
    avatar_url: null,
    phone: "(11) 95555-0001",
    is_active: true,
    created_at: "2026-01-25T00:00:00Z",
  },
  {
    id: "demo-partner-pro-001",
    email: "partnerpro@v3partner.com",
    password: "partnerpro123",
    full_name: "Lucas Partner PRO",
    role: "PARTNER_PRO" as const,
    avatar_url: null,
    phone: "(11) 94444-0001",
    is_active: true,
    created_at: "2026-02-01T00:00:00Z",
  },
];

export const DEMO_SPLITS = [
  {
    id: "split-001", code: "SF-26-100001", title: "Split Fiscal - Operação Varejo SP",
    total_value: 850000, split_percent: 2.5, partner_revenue: 21250,
    status: "APPROVED", created_at: "2026-03-01T10:00:00Z",
  },
  {
    id: "split-002", code: "SF-26-100002", title: "Split Fiscal - Correspondente RJ",
    total_value: 1200000, split_percent: 2.0, partner_revenue: 24000,
    status: "IN_REVIEW", created_at: "2026-03-10T14:00:00Z",
  },
  {
    id: "split-003", code: "SF-26-100003", title: "Split Fiscal - Parceiro MG",
    total_value: 430000, split_percent: 3.0, partner_revenue: 12900,
    status: "PENDING", created_at: "2026-03-15T09:00:00Z",
  },
  {
    id: "split-004", code: "SF-26-100004", title: "Split Fiscal - Expansão Sul",
    total_value: 2100000, split_percent: 1.8, partner_revenue: 37800,
    status: "COMPLETED", created_at: "2026-02-20T11:00:00Z",
  },
  {
    id: "split-005", code: "SF-26-100005", title: "Split Fiscal - Operação Nordeste",
    total_value: 670000, split_percent: 2.2, partner_revenue: 14740,
    status: "DRAFT", created_at: "2026-03-20T16:00:00Z",
  },
];

export const DEMO_DEALS = [
  {
    id: "deal-001", code: "MA-26-200001", title: "Aquisição TechFinance Ltda",
    target_company: "TechFinance Ltda", sector: "Fintech", deal_value: 45000000,
    ebitda_multiple: 8.5, stage: "DUE_DILIGENCE", probability_percent: 65,
    created_at: "2026-02-01T10:00:00Z",
  },
  {
    id: "deal-002", code: "MA-26-200002", title: "M&A Grupo Crédito Sul",
    target_company: "Grupo Crédito Sul", sector: "Crédito", deal_value: 120000000,
    ebitda_multiple: 12.0, stage: "NEGOTIATION", probability_percent: 80,
    created_at: "2026-01-15T10:00:00Z",
  },
  {
    id: "deal-003", code: "MA-26-200003", title: "Fusão InvestCap",
    target_company: "InvestCap S.A.", sector: "Asset Management", deal_value: 280000000,
    ebitda_multiple: 15.2, stage: "QUALIFICATION", probability_percent: 40,
    created_at: "2026-03-05T10:00:00Z",
  },
  {
    id: "deal-004", code: "MA-26-200004", title: "Aquisição Corretora Norte",
    target_company: "Corretora Norte", sector: "Corretagem", deal_value: 18000000,
    ebitda_multiple: 6.0, stage: "CLOSED_WON", probability_percent: 100,
    created_at: "2025-12-10T10:00:00Z",
  },
  {
    id: "deal-005", code: "MA-26-200005", title: "Expansão Finança Digital",
    target_company: "Finança Digital", sector: "Fintech", deal_value: 65000000,
    ebitda_multiple: 10.5, stage: "CLOSING", probability_percent: 90,
    created_at: "2026-03-18T10:00:00Z",
  },
];

export const DEMO_CREDIT_PROPOSALS = [
  // Nível 1
  {
    id: "cp-001", code: "CRED-26-300001", title: "Home Equity - Residência SP",
    client_name: "Roberto Almeida", credit_line: "HOME EQUITY",
    requested_value: 350000, approved_value: 320000, current_level: "NIVEL_1",
    status: "APPROVED", created_at: "2026-03-01T10:00:00Z",
  },
  {
    id: "cp-002", code: "CRED-26-300002", title: "Aval - Empresa Familiar",
    client_name: "Fernanda Santos ME", credit_line: "AVAL",
    requested_value: 150000, approved_value: null, current_level: "NIVEL_1",
    status: "IN_REVIEW", created_at: "2026-03-15T10:00:00Z",
  },
  {
    id: "cp-003", code: "CRED-26-300003", title: "Home Equity - Apartamento RJ",
    client_name: "Marcos Pereira", credit_line: "HOME EQUITY",
    requested_value: 280000, approved_value: null, current_level: "NIVEL_1",
    status: "PENDING", created_at: "2026-03-20T10:00:00Z",
  },
  // Nível 2
  {
    id: "cp-004", code: "CRED-26-300004", title: "FIDC - Recebíveis Varejo",
    client_name: "Rede Varejo SP Ltda", credit_line: "FIDC",
    requested_value: 5000000, approved_value: 4500000, current_level: "NIVEL_2",
    status: "APPROVED", created_at: "2026-02-10T10:00:00Z",
  },
  {
    id: "cp-005", code: "CRED-26-300005", title: "CRI - Loteamento Residencial",
    client_name: "Construtora Horizonte", credit_line: "CRI",
    requested_value: 12000000, approved_value: null, current_level: "NIVEL_2",
    status: "IN_REVIEW", created_at: "2026-03-12T10:00:00Z",
  },
  // Nível 3
  {
    id: "cp-006", code: "CRED-26-300006", title: "High Ticket - Project Finance Industrial",
    client_name: "Indústria Forte S.A.", credit_line: "PROJECT FINANCE",
    requested_value: 85000000, approved_value: null, current_level: "NIVEL_3",
    status: "IN_REVIEW", created_at: "2026-03-08T10:00:00Z",
  },
  {
    id: "cp-007", code: "CRED-26-300007", title: "High Ticket - Real Estate Premium",
    client_name: "Grupo Imobiliário Elite", credit_line: "REAL ESTATE HIGH VALUE",
    requested_value: 150000000, approved_value: 140000000, current_level: "NIVEL_3",
    status: "APPROVED", created_at: "2026-01-25T10:00:00Z",
  },
];

export const DEMO_TICKETS = [
  {
    id: "tick-001", code: "TICK-26-400001", title: "Análise de compliance - Operação SF-26-100002",
    category: "compliance", priority: "HIGH", status: "IN_REVIEW",
    due_date: "2026-03-30T18:00:00Z", created_at: "2026-03-18T10:00:00Z",
  },
  {
    id: "tick-002", code: "TICK-26-400002", title: "Suporte técnico - Integração bancária",
    category: "tecnico", priority: "MEDIUM", status: "PENDING",
    due_date: "2026-04-05T18:00:00Z", created_at: "2026-03-20T09:00:00Z",
  },
  {
    id: "tick-003", code: "TICK-26-400003", title: "Urgente: Documentação vencida - cliente Almeida",
    category: "juridico", priority: "URGENT", status: "PENDING",
    due_date: "2026-03-28T12:00:00Z", created_at: "2026-03-25T14:00:00Z",
  },
  {
    id: "tick-004", code: "TICK-26-400004", title: "Revisão contrato de parceria",
    category: "juridico", priority: "LOW", status: "COMPLETED",
    due_date: null, created_at: "2026-03-10T10:00:00Z",
  },
  {
    id: "tick-005", code: "TICK-26-400005", title: "Onboarding novo partner - João Silva",
    category: "onboarding", priority: "MEDIUM", status: "IN_REVIEW",
    due_date: "2026-04-02T18:00:00Z", created_at: "2026-03-22T11:00:00Z",
  },
];

export const DEMO_NOTIFICATIONS = [
  { id: "n1", title: "Deal aprovado", message: "Aquisição Corretora Norte foi fechado com sucesso", type: "success", read: false, created_at: "2026-03-27T08:00:00Z" },
  { id: "n2", title: "Proposta de crédito", message: "Nova proposta High Ticket aguardando aprovação", type: "warning", read: false, created_at: "2026-03-26T15:00:00Z" },
  { id: "n3", title: "Ticket urgente", message: "Documentação vencida - ação necessária", type: "error", read: false, created_at: "2026-03-25T14:00:00Z" },
];
