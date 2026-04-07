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
    location: "São Paulo · SP", slug: "techfinance-ltda",
    revenue_ttm: 12000000, ebitda_ttm: 5300000,
    expected_close_date: "2026-06-30",
    asset_data: {
      processo_v3: "V3M&A: 2600200001",
      descricao_ptbr: "Plataforma de crédito digital com tecnologia proprietária de análise de risco. Crescimento de 340% nos últimos 24 meses com base de clientes de 180 mil usuários ativos.",
      descricao_en: "Digital credit platform with proprietary risk analysis technology. 340% growth in the last 24 months with 180k active users.",
      tese_investimento: "Ativo de alta velocidade em setor com múltiplos de saída elevados. Receita recorrente de SaaS + spread de crédito. Tese de consolidação no segmento fintech de crédito no Brasil.",
      metricas: [
        { label: "Receita TTM", value: "R$ 12 MM", sub: "Últimos 12 meses" },
        { label: "EBITDA TTM", value: "R$ 5,3 MM", sub: "Margem 44%" },
        { label: "Usuários Ativos", value: "180 mil", sub: "Base recorrente" },
        { label: "Crescimento", value: "340%", sub: "24 meses" },
      ],
      diferenciais: [
        "Tecnologia proprietária de análise de risco com modelo ML treinado em 2M+ operações",
        "Margem EBITDA de 44% — acima da média do setor (28%)",
        "Integração nativa com BACEN Open Finance — vantagem regulatória",
        "Founders permanecem por 24 meses pós-aquisição",
      ],
      riscos: [
        { nivel: "baixo", descricao: "Concentração de receita", mitigacao: "Top 10 clientes representam 18% da receita" },
        { nivel: "medio", descricao: "Ambiente regulatório BACEN", mitigacao: "Compliance team interno + assessoria Pinheiro Neto" },
      ],
      confidencialidade: "CONFIDENCIAL — NDA requerido",
    },
    created_at: "2026-02-01T10:00:00Z",
  },
  {
    id: "deal-002", code: "MA-26-200002", title: "M&A Grupo Crédito Sul",
    target_company: "Grupo Crédito Sul", sector: "Crédito Estruturado", deal_value: 120000000,
    ebitda_multiple: 12.0, stage: "NEGOTIATION", probability_percent: 80,
    location: "Porto Alegre · RS", slug: "grupo-credito-sul",
    revenue_ttm: 28000000, ebitda_ttm: 10000000,
    expected_close_date: "2026-05-15",
    asset_data: {
      processo_v3: "V3M&A: 2600200002",
      descricao_ptbr: "Grupo financeiro com foco em crédito consignado público e privado, FIDC próprio e carteira de precatórios federais com deságio médio de 28%.",
      tese_investimento: "Plataforma de distribuição de crédito com carteira de R$ 380MM originada. Potencial de securitização imediata via FIDC Sênior com tese de saída para fundo offshore.",
      metricas: [
        { label: "Carteira Ativa", value: "R$ 380 MM", sub: "Crédito estruturado" },
        { label: "FIDC Próprio", value: "R$ 85 MM", sub: "Cotas Sênior + Sub" },
        { label: "Receita TTM", value: "R$ 28 MM", sub: "Spread + Taxas" },
        { label: "Inadimplência", value: "2,1%", sub: "Abaixo benchmark setor" },
      ],
      diferenciais: [
        "FIDC próprio com rating AA pela Fitch — facilita captação institucional",
        "Carteira de precatórios federais com yield de 18% a.a.",
        "Equipe de 120 correspondentes bancários ativos em 8 estados",
      ],
      riscos: [
        { nivel: "baixo", descricao: "Risco de crédito da carteira", mitigacao: "Inadimplência em 2,1% — cobertura de 3,2x pelo fundo de reserva" },
        { nivel: "medio", descricao: "Concentração regional Sul/Sudeste", mitigacao: "Plano de expansão Nordeste em implementação" },
      ],
    },
    created_at: "2026-01-15T10:00:00Z",
  },
  {
    id: "deal-003", code: "MA-26-200003", title: "Fusão InvestCap",
    target_company: "InvestCap S.A.", sector: "Asset Management", deal_value: 280000000,
    ebitda_multiple: 15.2, stage: "QUALIFICATION", probability_percent: 40,
    location: "Rio de Janeiro · RJ", slug: "investcap-sa",
    revenue_ttm: 45000000, ebitda_ttm: 18400000,
    expected_close_date: "2026-09-30",
    asset_data: {
      processo_v3: "V3M&A: 2600200003",
      descricao_ptbr: "Gestora independente com R$ 2,1B em AUM, foco em renda fixa estruturada e multimercado macro. CVM autorizada desde 2011.",
      tese_investimento: "Plataforma de gestão com escala e reputação consolidada. Oportunidade de consolidação no mercado independente brasileiro com upside via distribuição cross-border.",
      metricas: [
        { label: "AUM Total", value: "R$ 2,1 B", sub: "Assets Under Management" },
        { label: "Receita TTM", value: "R$ 45 MM", sub: "Taxa gestão + performance" },
        { label: "EBITDA", value: "R$ 18,4 MM", sub: "Margem 40,8%" },
        { label: "Fundos Ativos", value: "14", sub: "CVM registrados" },
      ],
      diferenciais: [
        "R$ 2,1B AUM com LTV de cotistas acima de 5 anos",
        "Expertise em renda fixa estruturada — alinhada com vertical V3",
        "Potencial de distribuição para fundos asiáticos via Hamilton Santos",
      ],
      riscos: [
        { nivel: "medio", descricao: "Dependência dos 3 gestores sêniors", mitigacao: "Cláusula de non-compete + earnout de 36 meses proposta" },
        { nivel: "baixo", descricao: "Volatilidade de AUM", mitigacao: "82% em contratos de longo prazo com lock-up" },
      ],
    },
    created_at: "2026-03-05T10:00:00Z",
  },
  {
    id: "deal-004", code: "MA-26-200004", title: "Aquisição Corretora Norte",
    target_company: "Corretora Norte", sector: "Corretagem", deal_value: 18000000,
    ebitda_multiple: 6.0, stage: "CLOSED_WON", probability_percent: 100,
    location: "Belém · PA", slug: "corretora-norte",
    revenue_ttm: 5000000, ebitda_ttm: 3000000,
    asset_data: {
      processo_v3: "V3M&A: 2500200004",
      descricao_ptbr: "Corretora de seguros e câmbio com atuação em 6 estados do Norte e Nordeste. Operação estruturada com 48 correspondentes ativos.",
      tese_investimento: "Aquisição estratégica para expansão da rede de distribuição V3 na região Norte. Deal fechado em Dezembro/2025.",
      metricas: [
        { label: "Valor do Deal", value: "R$ 18 MM", sub: "Operação concluída" },
        { label: "Correspondentes", value: "48", sub: "Norte e Nordeste" },
        { label: "Receita TTM", value: "R$ 5 MM", sub: "Seguros + Câmbio" },
        { label: "EBITDA", value: "R$ 3 MM", sub: "Margem 60%" },
      ],
      diferenciais: ["Aquisição concluída · Deal fechado"],
    },
    created_at: "2025-12-10T10:00:00Z",
  },
  {
    id: "deal-005", code: "MA-26-200005", title: "Jazida de Esmeraldas — Nova Era/MG",
    target_company: "Jazida de Esmeraldas", sector: "Mineração · Pedras Preciosas", deal_value: 7000000,
    ebitda_multiple: null, stage: "CLOSING", probability_percent: 90,
    location: "Nova Era · MG", slug: "jazida-esmeralda",
    revenue_ttm: null, ebitda_ttm: null,
    expected_close_date: "2026-05-30",
    asset_data: {
      processo_v3: "V3M&A: 1329999015",
      processo_regulatorio: "ANM 832.577/2013",
      descricao_ptbr: "Jazida de esmeraldas com reserva medida de 170kg e laudo técnico TOPMEC aprovado pela ANM. Área de 358,28ha com processo de lavra regularizado. Tese de exportação para mercados asiáticos de alta valorização.",
      descricao_en: "Emerald mine with measured reserve of 170kg and TOPMEC technical report approved by ANM. 358.28ha area with regularized mining process. Export thesis to high-value Asian markets.",
      tese_investimento: "Ativo de mineração com reserva certificada e valor de mercado 12x acima do valor de transação. Tese de exportação para Hong Kong e Singapura via network Hamilton Santos.",
      tese_investimento_en: "Mining asset with certified reserve and market value 12x above the transaction value. Export thesis to Hong Kong and Singapore via Hamilton Santos network.",
      metricas: [
        { label: "Valor do Deal", value: "R$ 7.000.000", sub: "Valor de transação M&A" },
        { label: "Reserva Medida", value: "170 kg", sub: "Laudo TOPMEC/ANM" },
        { label: "Valor da Reserva", value: "R$ 84,27 MM", sub: "Preço mínimo mercado" },
        { label: "Área", value: "358,28 ha", sub: "Processo ANM ativo" },
      ],
      diferenciais: [
        "Laudo técnico TOPMEC aprovado pela ANM — documentação completa",
        "Valor de transação representa deságio de 91,7% sobre o valor de reserva",
        "Tese de exportação para mercados asiáticos: Singapura e Hong Kong",
        "Kit de divulgação completo gerado — CIM, Teaser, LinkedIn (PT-BR e EN)",
      ],
      riscos: [
        { nivel: "baixo", descricao: "Licenciamento ambiental", mitigacao: "Processo ANM regularizado e ativo desde 2013" },
        { nivel: "medio", descricao: "Precificação internacional de esmeraldas", mitigacao: "Laudo com benchmark de mercado de Hong Kong e Gemological Institute" },
      ],
      confidencialidade: "CONFIDENCIAL — NDA requerido",
      valor_ativo_total: "R$ 84,27 MM",
    },
    created_at: "2026-03-01T10:00:00Z",
  },
  {
    id: "deal-006", code: "MA-26-200006", title: "Fazenda Orgânica Serra Verde",
    target_company: "Fazenda Serra Verde Ltda", sector: "Agropecuária", deal_value: 22000000,
    ebitda_multiple: null, stage: "PROSPECTING", probability_percent: 10,
    location: "Chapada dos Guimarães · MT", slug: "fazenda-serra-verde",
    revenue_ttm: null, ebitda_ttm: null,
    expected_close_date: "2026-09-30",
    asset_data: {
      processo_v3: "V3M&A: 2600200006",
      descricao_ptbr: "Fazenda com 1.200ha em área de preservação permanente certificada, produção orgânica de soja, milho e café. Certificação Rainforest Alliance e USDA Organic. Potencial de crédito de carbono (REDD+).",
      tese_investimento: "Ativo agrícola premium com múltiplas receitas: produção orgânica, créditos de carbono e ecoturismo. Demanda crescente internacional por ativos ESG certificados.",
      metricas: [
        { label: "Área Total", value: "1.200 ha", sub: "Documentação regularizada" },
        { label: "Certificações", value: "3", sub: "Rainforest · USDA · REDD+" },
        { label: "Valor do Deal", value: "R$ 22 MM", sub: "Indicativo" },
        { label: "Potencial Carbono", value: "~R$ 4 MM/ano", sub: "Créditos REDD+" },
      ],
      diferenciais: [
        "Certificação Rainforest Alliance — acesso ao mercado europeu premium",
        "Programa REDD+ em aprovação — receita adicional de créditos de carbono",
        "Solo e clima ideais para café especial Specialty Grade (80+ pontos SCA)",
        "Documentação fundiária 100% regularizada no SNCR/INCRA",
      ],
      riscos: [
        { nivel: "baixo", descricao: "Risco climático", mitigacao: "Seguro agrícola com cobertura de 85% da produção" },
        { nivel: "medio", descricao: "Precificação de carbono", mitigacao: "Contrato forward com compradores europeus em negociação" },
      ],
      contato: {
        nome: "Ricardo Almeida",
        email: "ricardo@fazendaverdes.com.br",
        telefone: "(65) 99988-7766",
      },
      documentos: [
        { nome: "Escritura_Fazenda_Serra_Verde.pdf", tamanho: 1240000, tipo: "application/pdf" },
        { nome: "Certificacao_Rainforest_2025.pdf", tamanho: 890000, tipo: "application/pdf" },
        { nome: "Matricula_INCRA_2026.pdf", tamanho: 450000, tipo: "application/pdf" },
      ],
      juridico: { tem_processos: false, tem_pendencias: false, licencas: "Rainforest Alliance, USDA Organic, REDD+ (em aprovação)" },
      comissionamento: "3",
      confidencialidade: "CONFIDENCIAL — NDA requerido",
    },
    created_at: "2026-04-04T09:15:00Z",
  },
];

// Dados demo para o módulo de Criativos M&A
export const DEMO_CREATIVE_JOBS = [
  {
    id: "job-001",
    deal_id: "deal-005",
    status: "DONE",
    progress: 100,
    error_message: null,
    started_at: "2026-04-02T10:05:00Z",
    completed_at: "2026-04-02T10:08:32Z",
    created_by: "demo-admin-001",
    created_at: "2026-04-02T10:05:00Z",
    updated_at: "2026-04-02T10:08:32Z",
  },
  {
    id: "job-002",
    deal_id: "deal-001",
    status: "DONE",
    progress: 100,
    error_message: null,
    started_at: "2026-04-03T14:20:00Z",
    completed_at: "2026-04-03T14:23:15Z",
    created_by: "demo-admin-001",
    created_at: "2026-04-03T14:20:00Z",
    updated_at: "2026-04-03T14:23:15Z",
  },
];

export const DEMO_CREATIVE_FILES = [
  // deal-005 — Jazida de Esmeraldas (kit completo)
  { id: "cf-001", deal_id: "deal-005", job_id: "job-001", file_type: "cim",            language: "pt-br", format: "pdf", storage_path: "deal-005/cim-pt-br.pdf",            public_url: null, file_size_kb: 842,  created_at: "2026-04-02T10:08:00Z" },
  { id: "cf-002", deal_id: "deal-005", job_id: "job-001", file_type: "cim",            language: "en",    format: "pdf", storage_path: "deal-005/cim-en.pdf",              public_url: null, file_size_kb: 857,  created_at: "2026-04-02T10:08:05Z" },
  { id: "cf-003", deal_id: "deal-005", job_id: "job-001", file_type: "teaser",         language: "pt-br", format: "pdf", storage_path: "deal-005/teaser-pt-br.pdf",         public_url: null, file_size_kb: 312,  created_at: "2026-04-02T10:08:10Z" },
  { id: "cf-004", deal_id: "deal-005", job_id: "job-001", file_type: "teaser",         language: "pt-br", format: "png", storage_path: "deal-005/teaser-pt-br.png",         public_url: null, file_size_kb: 1840, created_at: "2026-04-02T10:08:14Z" },
  { id: "cf-005", deal_id: "deal-005", job_id: "job-001", file_type: "teaser",         language: "en",    format: "pdf", storage_path: "deal-005/teaser-en.pdf",            public_url: null, file_size_kb: 308,  created_at: "2026-04-02T10:08:18Z" },
  { id: "cf-006", deal_id: "deal-005", job_id: "job-001", file_type: "teaser",         language: "en",    format: "png", storage_path: "deal-005/teaser-en.png",            public_url: null, file_size_kb: 1790, created_at: "2026-04-02T10:08:22Z" },
  { id: "cf-007", deal_id: "deal-005", job_id: "job-001", file_type: "linkedin_post",  language: "pt-br", format: "jpg", storage_path: "deal-005/linkedin-post-pt-br.jpg",  public_url: null, file_size_kb: 420,  created_at: "2026-04-02T10:08:26Z" },
  { id: "cf-008", deal_id: "deal-005", job_id: "job-001", file_type: "linkedin_post",  language: "en",    format: "jpg", storage_path: "deal-005/linkedin-post-en.jpg",      public_url: null, file_size_kb: 415,  created_at: "2026-04-02T10:08:29Z" },
  { id: "cf-009", deal_id: "deal-005", job_id: "job-001", file_type: "linkedin_story", language: "pt-br", format: "jpg", storage_path: "deal-005/linkedin-story-pt-br.jpg", public_url: null, file_size_kb: 680,  created_at: "2026-04-02T10:08:31Z" },
  { id: "cf-010", deal_id: "deal-005", job_id: "job-001", file_type: "linkedin_story", language: "en",    format: "jpg", storage_path: "deal-005/linkedin-story-en.jpg",     public_url: null, file_size_kb: 672,  created_at: "2026-04-02T10:08:32Z" },
  // deal-001 — TechFinance (kit parcial)
  { id: "cf-011", deal_id: "deal-001", job_id: "job-002", file_type: "cim",            language: "pt-br", format: "pdf", storage_path: "deal-001/cim-pt-br.pdf",            public_url: null, file_size_kb: 765,  created_at: "2026-04-03T14:23:00Z" },
  { id: "cf-012", deal_id: "deal-001", job_id: "job-002", file_type: "teaser",         language: "pt-br", format: "pdf", storage_path: "deal-001/teaser-pt-br.pdf",         public_url: null, file_size_kb: 290,  created_at: "2026-04-03T14:23:10Z" },
  { id: "cf-013", deal_id: "deal-001", job_id: "job-002", file_type: "linkedin_post",  language: "pt-br", format: "jpg", storage_path: "deal-001/linkedin-post-pt-br.jpg",  public_url: null, file_size_kb: 398,  created_at: "2026-04-03T14:23:15Z" },
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

export const DEMO_PROSPECTS_ATIVO = [
  {
    id: "ativo-001", code: "PROS-26-300001", tipo: "ativo",
    segmento: "commodities", sub_segmento: "minerio_ferro",
    titulo: "Reserva de Minério de Ferro — Norte Brasil",
    valor_min: 45000000, valor_max: 60000000,
    localizacao: "Pará · Brasil", stage: "QUALIFICADO",
    created_at: "2026-04-01T10:00:00Z",
  },
  {
    id: "ativo-002", code: "PROS-26-300002", tipo: "ativo",
    segmento: "commodities", sub_segmento: "ouro_prata",
    titulo: "Jazida de Ouro e Prata — Centro-Oeste",
    valor_min: 8000000, valor_max: 12000000,
    localizacao: "Mato Grosso · Brasil", stage: "PENDENTE",
    created_at: "2026-04-02T14:00:00Z",
  },
  {
    id: "ativo-003", code: "PROS-26-300003", tipo: "ativo",
    segmento: "mobilidade", sub_segmento: "aeronaves",
    titulo: "Frota Executiva — 3 Aeronaves",
    valor_min: 18000000, valor_max: 25000000,
    localizacao: "São Paulo · Brasil", stage: "QUALIFICADO",
    created_at: "2026-04-03T09:00:00Z",
  },
  {
    id: "ativo-004", code: "PROS-26-300004", tipo: "ativo",
    segmento: "mobilidade", sub_segmento: "embarcacoes",
    titulo: "Marina e Frota de Embarcações — Sul",
    valor_min: 6000000, valor_max: 9000000,
    localizacao: "Santa Catarina · Brasil", stage: "PENDENTE",
    created_at: "2026-04-04T11:00:00Z",
  },
];

export const DEMO_PROSPECTS_INVESTIDOR = [
  {
    id: "inv-001", code: "PROS-26-400001", tipo: "investidor",
    nome_fantasia: "Family Office Confidencial A",
    ticket_min: 5000000, ticket_max: 50000000,
    segmentos: ["commodities", "mobilidade"],
    perfil: "financeiro", stage: "ATIVO",
    created_at: "2026-03-15T10:00:00Z",
  },
  {
    id: "inv-002", code: "PROS-26-400002", tipo: "investidor",
    nome_fantasia: "Fundo Estratégico B",
    ticket_min: 1000000, ticket_max: 10000000,
    segmentos: ["mobilidade"],
    perfil: "estrategico", stage: "ATIVO",
    created_at: "2026-03-20T14:00:00Z",
  },
];
