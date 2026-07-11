// Gate Brand & Grammar Guardian — V3 Partners
//
// Porta a logica do skill `v3-brand-audit` (~/.claude/skills/v3-brand-audit) para
// dentro do runtime do portal. Roda em processo, sincrono, sem custo de API e sem
// depender do n8n estar no ar — a maior parte da geracao de texto/HTML do sistema
// (FORJA, kit de criativos, teaser cego, contratos) acontece direto em rotas
// Next.js chamando o Claude, nao dentro de workflows n8n.
//
// Uso:
//   const result = auditText(narrativaGerada);
//   if (!result.approved) { ... usar result.corrected e/ou bloquear ... }
//
//   const result = auditHtml(htmlGerado);
//   if (!result.approved) { ... nunca publicar result original, usar result.corrected
//                            se result.blocking.length === 0, senao rejeitar ... }

export type GateViolation = {
  check: string;
  message: string;
  autoFixed: boolean;
};

export type GateResult = {
  approved: boolean;
  corrected: string;
  violations: GateViolation[];
  /** Violacoes que nao podem ser corrigidas automaticamente (ex.: logo ausente) — bloqueiam publicacao. */
  blocking: GateViolation[];
};

const BANNED_COLORS: Record<string, string> = {
  "#7A8FA8": "#9BAFC5",
  "#7a8fa8": "#9BAFC5",
  "#F0ECE4": "#F5F1E8",
  "#f0ece4": "#F5F1E8",
  "#111F35": "#13223A",
  "#111f35": "#13223A",
};

// Palavras que SEMPRE levam acento em PT-BR — nunca existe grafia valida sem acento.
// Evita falsos positivos de palavras ambiguas (esta/está, pode/pôde) que exigem
// contexto para julgar; aqui so entram erros inequivocos.
const UNAMBIGUOUS_ACCENT_FIXES: Record<string, string> = {
  voce: "você",
  Voce: "Você",
  VOCE: "VOCÊ",
  nao: "não",
  Nao: "Não",
  NAO: "NÃO",
  sao: "são",
  Sao: "São",
  entao: "então",
  Entao: "Então",
  alem: "além",
  Alem: "Além",
  tambem: "também",
  Tambem: "Também",
  apos: "após",
  Apos: "Após",
  atraves: "através",
  Atraves: "Através",
  ja: "já",
  Ja: "Já",
  ate: "até",
  Ate: "Até",
};

const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

function checkBloxs(input: string, violations: GateViolation[]): string {
  const pattern = /\bbloxs(\s*s\.a\.?)?\b/gi;
  if (pattern.test(input)) {
    violations.push({
      check: "bloxs",
      message: "Menção ao parceiro tecnológico confidencial (Bloxs) — substituída pela linguagem aprovada.",
      autoFixed: true,
    });
    return input.replace(/\bwhite label bloxs(\s*s\.a\.?)?\b/gi, "plataforma tecnológica proprietária V3")
      .replace(/\bbloxs(\s*s\.a\.?)?\b/gi, "plataforma tecnológica proprietária V3");
  }
  return input;
}

function checkEmDash(input: string, violations: GateViolation[]): string {
  if (/—/.test(input)) {
    violations.push({
      check: "travessao",
      message: "Travessão (—) encontrado — proibição absoluta em documentos V3. Substituído por vírgula.",
      autoFixed: true,
    });
    return input.replace(/\s*—\s*/g, ", ");
  }
  return input;
}

function checkEmoji(input: string, violations: GateViolation[]): string {
  if (EMOJI_REGEX.test(input)) {
    violations.push({
      check: "emoji",
      message: "Emoji encontrado — removido. Comunicação V3 nunca usa emojis.",
      autoFixed: true,
    });
    return input.replace(EMOJI_REGEX, "");
  }
  return input;
}

function checkBannedColors(input: string, violations: GateViolation[]): string {
  let out = input;
  for (const [banned, approved] of Object.entries(BANNED_COLORS)) {
    if (out.includes(banned)) {
      violations.push({
        check: "cor-banida",
        message: `Cor legada ${banned} encontrada — substituída por ${approved} (paleta V4.2).`,
        autoFixed: true,
      });
      out = out.split(banned).join(approved);
    }
  }
  return out;
}

function checkAccents(input: string, violations: GateViolation[]): string {
  let out = input;
  let fixedAny = false;
  for (const [wrong, right] of Object.entries(UNAMBIGUOUS_ACCENT_FIXES)) {
    const re = new RegExp(`\\b${wrong}\\b`, "g");
    if (re.test(out)) {
      out = out.replace(re, right);
      fixedAny = true;
    }
  }
  if (fixedAny) {
    violations.push({
      check: "acentuacao",
      message: "Palavra(s) sem acentuação obrigatória corrigida(s) automaticamente.",
      autoFixed: true,
    });
  }
  return out;
}

function checkWhiteBackground(input: string, violations: GateViolation[]): GateViolation | null {
  const re = /background(-color)?\s*:\s*(#fff(fff)?\b|white\b)|bg-white\b/i;
  if (re.test(input)) {
    const v: GateViolation = {
      check: "fundo-branco",
      message: "Fundo branco detectado — proibido em documentos V3. Requer correção manual do layout (não é seguro autocorrigir CSS/estrutura).",
      autoFixed: false,
    };
    violations.push(v);
    return v;
  }
  return null;
}

function checkLogo(input: string, violations: GateViolation[]): GateViolation | null {
  const hasLogo = /v3-logo-flat-gold-alpha\.png/i.test(input);
  if (!hasLogo) {
    const v: GateViolation = {
      check: "logo",
      message: "Logo V3 (v3-logo-flat-gold-alpha.png) ausente do documento — obrigatório em todo HTML V3.",
      autoFixed: false,
    };
    violations.push(v);
    return v;
  }
  return null;
}

function checkFont(input: string, violations: GateViolation[]): GateViolation | null {
  if (!/DM\s*Sans/i.test(input)) {
    const v: GateViolation = {
      check: "fonte",
      message: "DM Sans não encontrada no documento — fonte exclusiva V3.",
      autoFixed: false,
    };
    violations.push(v);
    return v;
  }
  return null;
}

function checkNavyBackground(input: string, violations: GateViolation[]): GateViolation | null {
  if (!/#09081A/i.test(input)) {
    const v: GateViolation = {
      check: "navy",
      message: "Navy Deep (#09081A) não encontrado como fundo — paleta V3 exige navy dominante.",
      autoFixed: false,
    };
    violations.push(v);
    return v;
  }
  return null;
}

/** Auditoria de texto puro (narrativas, copy comercial, respostas de chat) — sem checks visuais de HTML. */
export function auditText(input: string): GateResult {
  const violations: GateViolation[] = [];
  let corrected = input;
  corrected = checkBloxs(corrected, violations);
  corrected = checkEmDash(corrected, violations);
  corrected = checkEmoji(corrected, violations);
  corrected = checkAccents(corrected, violations);

  const blocking = violations.filter((v) => !v.autoFixed);
  return { approved: blocking.length === 0, corrected, violations, blocking };
}

/** Auditoria completa de documento HTML standalone (teaser, CIM, contrato, relatório). */
export function auditHtml(input: string): GateResult {
  const violations: GateViolation[] = [];
  let corrected = input;
  corrected = checkBloxs(corrected, violations);
  corrected = checkEmDash(corrected, violations);
  corrected = checkEmoji(corrected, violations);
  corrected = checkAccents(corrected, violations);
  corrected = checkBannedColors(corrected, violations);
  checkWhiteBackground(corrected, violations);
  checkLogo(corrected, violations);
  checkFont(corrected, violations);
  checkNavyBackground(corrected, violations);

  const blocking = violations.filter((v) => !v.autoFixed);
  return { approved: blocking.length === 0, corrected, violations, blocking };
}
