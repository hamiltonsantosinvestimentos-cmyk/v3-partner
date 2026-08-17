import { createClient as sc } from "@supabase/supabase-js";
import { formatCPF } from "@/lib/validators/cpf-cnpj";

// Instrumento NCNDA Mestre (14/08/2026): o signatário "Head" da mesa que
// envia para assinatura varia por origem, regra dada por João em texto,
// não inventada.
//
// 17/08/2026: cpf/nationality/marital_status/profession deixaram de ser
// hardcoded aqui e passaram a ser resolvidos em tempo real a partir de
// profiles (mesma conta que cada Head usa pra logar no portal), coluna
// já existente document_cpf + as 3 novas (migration
// 20260817_profiles_qualificacao_assinatura.sql). Cada Head preenche o
// próprio dado em /perfil (mesmo padrão de auto-edição já usado para
// document_cpf), fica gravado pras próximas sessões, sem precisar de
// deploy novo nem de alguém adivinhar/fabricar CPF de terceiro.
// roleLabel/fullName/email continuam fixos aqui: são identidade estável
// (não mudam por sessão), e full_name em profiles às vezes está em
// formato menos formal (ex: "JOAO LEMOS" sem "Netto", sem acento) —
// usar o nome fixo evita degradar o texto legal.
export type DeskOrigin = "MESA_MA" | "BOLSA_ATIVOS" | "CREDITO_ESTRUTURADO" | "CONSORCIO" | "CREDITO_INTERNACIONAL" | "TRADE_FINANCE";

export interface DeskHead {
  roleLabel: string;
  fullName: string;
  qualificacao: string; // nacionalidade, estado civil, profissão — mesmo formato do texto original
  cpf: string | null; // null = pendente, generate() bloqueia até ser informado
  email: string;
}

// Config estável (identidade + a conta real que cada Head usa pra logar,
// fonte da verdade pra resolver cpf/qualificação em profiles).
const DESK_CONFIG: Record<DeskOrigin, { roleLabel: string; fullName: string; lookupEmail: string; notifyEmail: string }> = {
  MESA_MA: {
    roleLabel: "SÓCIO ADMINISTRADOR / V3 PARTNERS",
    fullName: "João Lemos Netto",
    lookupEmail: "joao.lemos@v3partners.com.br",
    notifyEmail: "joao.lemos@v3partners.com.br",
  },
  BOLSA_ATIVOS: {
    roleLabel: "DIREÇÃO DE COMPLIANCE / V3 PARTNERS",
    fullName: "Luís Humberto Ferreira de Athaydes",
    lookupEmail: "luis.athaydes@v3partners.com.br",
    notifyEmail: "luis.athaydes@v3partners.com.br",
  },
  CREDITO_ESTRUTURADO: {
    roleLabel: "SÓCIO RESPONSÁVEL, MESA DE CRÉDITO / V3 PARTNERS",
    fullName: "Hamilton Santos",
    // 17/08/2026: conta real confirmada por João (não a conta de demo
    // hamilton@v3partners.com.br, PARTNER_PRO, usada pra prospects/partners).
    lookupEmail: "suporte@v3partners.com.br",
    notifyEmail: "hamilton.santos@v3partners.com.br",
  },
  CONSORCIO: {
    roleLabel: "SÓCIO RESPONSÁVEL, COMPLIANCE / V3 PARTNERS",
    fullName: "Robson Lino",
    // 17/08/2026: conta real confirmada por João. robson.lino@v3partners.com.br
    // (usado como notifyEmail abaixo) não tem login/perfil no Supabase —
    // a conta de fato usada é o Gmail pessoal.
    lookupEmail: "robinholino16@gmail.com",
    notifyEmail: "robson.lino@v3partners.com.br",
  },
  CREDITO_INTERNACIONAL: {
    roleLabel: "SÓCIO RESPONSÁVEL, COMPLIANCE / V3 PARTNERS",
    fullName: "Robson Lino",
    lookupEmail: "robinholino16@gmail.com",
    notifyEmail: "robson.lino@v3partners.com.br",
  },
  TRADE_FINANCE: {
    roleLabel: "SÓCIO RESPONSÁVEL, COMPLIANCE / V3 PARTNERS",
    fullName: "Robson Lino",
    lookupEmail: "robinholino16@gmail.com",
    notifyEmail: "robson.lino@v3partners.com.br",
  },
};

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function joinQualificacao(nationality: string | null, maritalStatus: string | null, profession: string | null): string {
  return [nationality, maritalStatus, profession].filter((p): p is string => !!p && p.trim() !== "").join(", ");
}

// Resolve o Head de uma mesa em tempo real, consultando profiles pela
// conta real de login. cpf null (não preenchido ainda) propaga como
// DeskHead.cpf = null, generate() já trata isso com 422 explícito, mesmo
// comportamento de antes — só a fonte do dado mudou, de arquivo estático
// pra banco.
export async function resolveDeskHead(origin: DeskOrigin): Promise<DeskHead> {
  const config = DESK_CONFIG[origin];
  const { data } = await svc()
    .from("profiles")
    .select("document_cpf, nationality, marital_status, profession")
    .eq("email", config.lookupEmail)
    .maybeSingle();

  return {
    roleLabel: config.roleLabel,
    fullName: config.fullName,
    email: config.notifyEmail,
    // formatCPF é idempotente (sempre extrai só dígitos antes de formatar),
    // então cobre tanto CPF já digitado com pontuação quanto puro dígito
    // (ex: Dr. Athaydes tem "78385172653" salvo sem pontuação em profiles).
    cpf: data?.document_cpf && data.document_cpf.trim() !== "" ? formatCPF(data.document_cpf) : null,
    qualificacao: joinQualificacao(data?.nationality ?? null, data?.marital_status ?? null, data?.profession ?? null),
  };
}
