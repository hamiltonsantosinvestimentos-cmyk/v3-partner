#!/usr/bin/env node
/**
 * Gate de liberação de BRIEF (V3 Partners).
 * Trava escrita de código e migrations enquanto não houver BRIEF com QA LIBERADO e "go" do João registrado.
 *
 * Modos (primeiro argumento):
 *   gate      PreToolUse  : bloqueia Write/Edit/MultiEdit em código e migration, apply_migration e SQL de escrita.
 *   capture   UserPromptSubmit : se a mensagem do usuário começa com "go", registra o go no BRIEF ativo.
 *   register  linha de comando : o agente registra o BRIEF e o veredito do QA (não dá o go).
 *   status    linha de comando : mostra o BRIEF ativo.
 *
 * Estado em <projeto>/.claude/brief-release/ : active.json (BRIEF ativo) e go-log.jsonl (só o hook escreve).
 * Limite honesto: o hook pega esquecimento e atalho acidental. Não impede quem quer burlar de propósito.
 * A trava real é o PR com link do BRIEF e a proteção do branch main.
 *
 * Variáveis: CLAUDE_PROJECT_DIR (definida pelo Claude Code), V3_BRIEF_GATE=off (emergência, fica registrado).
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const DIR = path.join(ROOT, ".claude", "brief-release");
const ACTIVE = path.join(DIR, "active.json");
const LOG = path.join(DIR, "go-log.jsonl");
const GO_VALIDADE_HORAS = 8;

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".sql"]);
const LIVRES = [/^docs\//, /^\.claude\//, /^tests?\//, /^e2e\//, /\.md$/i, /\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/, /^supabase\/migrations\/.*\.txt$/];
const SQL_ESCRITA = /\b(create|alter|drop|grant|revoke|insert|update|delete|truncate|comment\s+on)\b/i;

const agora = () => new Date();
const iso = (d) => d.toISOString();
const ler = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const garantirDir = () => fs.mkdirSync(DIR, { recursive: true });
const rel = (p) => path.relative(ROOT, path.resolve(ROOT, p || "")).split(path.sep).join("/");

function stdinJson() {
  try { return JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { return {}; }
}
function bloquear(msg) {
  process.stderr.write("BLOQUEADO PELO GATE DE BRIEF: " + msg + "\n");
  process.exit(2);
}

function protegido(toolName, input) {
  if (/apply_migration$/.test(toolName)) return { sim: true, alvo: "apply_migration" };
  if (/execute_sql$/.test(toolName)) {
    const q = String((input && input.query) || "");
    return SQL_ESCRITA.test(q) ? { sim: true, alvo: "SQL de escrita ou DDL" } : { sim: false };
  }
  if (/^(Write|Edit|MultiEdit)$/.test(toolName)) {
    const alvo = rel(input && (input.file_path || input.path));
    if (!alvo || alvo.startsWith("..")) return { sim: false };
    if (LIVRES.some((r) => r.test(alvo))) return { sim: false };
    if (/^supabase\/migrations\//.test(alvo)) return { sim: true, alvo };
    if (CODE_EXT.has(path.extname(alvo).toLowerCase())) return { sim: true, alvo };
  }
  return { sim: false };
}

function modoGate() {
  const ev = stdinJson();
  if (process.env.V3_BRIEF_GATE === "off") {
    garantirDir();
    fs.appendFileSync(LOG, JSON.stringify({ at: iso(agora()), evento: "gate_desligado_por_variavel", tool: ev.tool_name }) + "\n");
    process.exit(0);
  }
  const p = protegido(ev.tool_name || "", ev.tool_input || {});
  if (!p.sim) process.exit(0);

  const a = ler(ACTIVE);
  if (!a) bloquear(`${p.alvo}: não há BRIEF ativo. Escreva o BRIEF, rode @v3-governance-qa, registre com "node .claude/hooks/brief-release-gate.js register --brief <arquivo> --qa LIBERADO" e espere o "go" do João ou do Hamilton.`);
  if (a.status !== "GO_DADO") bloquear(`${p.alvo}: o BRIEF "${a.brief}" está em ${a.status} (QA: ${a.qa_verdict}). Falta o "go" do João ou do Hamilton. Nada de código antes disso.`);
  if (new Date(a.expires_at) < agora()) bloquear(`${p.alvo}: o "go" do BRIEF "${a.brief}" expirou em ${a.expires_at}. Peça novo "go".`);

  const log = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  const ok = log.some((l) => l.evento === "go" && l.brief === a.brief && l.at === a.go_at);
  if (!ok) bloquear(`${p.alvo}: o "go" de "${a.brief}" não consta no registro do hook (go-log.jsonl). O go só vale se digitado pelo João ou pelo Hamilton no chat.`);

  if (Array.isArray(a.scope) && a.scope.length && p.alvo !== "apply_migration" && p.alvo !== "SQL de escrita ou DDL") {
    if (!a.scope.some((s) => p.alvo.startsWith(s))) bloquear(`${p.alvo}: fora do escopo liberado no BRIEF (${a.scope.join(", ")}). Ajuste o BRIEF e peça novo go.`);
  }
  process.exit(0);
}

function modoCapture() {
  const ev = stdinJson();
  const prompt = String(ev.prompt || "").trim();
  if (!/^go\b/i.test(prompt)) process.exit(0);
  const a = ler(ACTIVE);
  if (!a) process.exit(0);
  const override = /go\s+mesmo\s+assim/i.test(prompt);
  if (a.status === "GO_DADO") process.exit(0);
  if (a.qa_verdict !== "LIBERADO" && !override) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: `Aviso do gate de BRIEF: o QA do BRIEF "${a.brief}" está ${a.qa_verdict}. O "go" não foi registrado. Só "go mesmo assim" registra override, com as falhas aceitas listadas no BRIEF.` } }));
    process.exit(0);
  }
  const agoraD = agora();
  garantirDir();
  const novo = { ...a, status: "GO_DADO", go_at: iso(agoraD), go_prompt: prompt.slice(0, 200), override: override || undefined, expires_at: iso(new Date(agoraD.getTime() + GO_VALIDADE_HORAS * 3600e3)) };
  fs.writeFileSync(ACTIVE, JSON.stringify(novo, null, 2));
  fs.appendFileSync(LOG, JSON.stringify({ at: novo.go_at, evento: "go", brief: a.brief, qa_verdict: a.qa_verdict, override: !!override, prompt: novo.go_prompt }) + "\n");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: `Gate de BRIEF: go registrado para "${a.brief}" até ${novo.expires_at}.` } }));
  process.exit(0);
}

function arg(nome) { const i = process.argv.indexOf("--" + nome); return i > -1 ? process.argv[i + 1] : undefined; }

function modoRegister() {
  const brief = arg("brief"), qa = (arg("qa") || "").toUpperCase();
  if (!brief || !["LIBERADO", "BLOQUEADO"].includes(qa)) { console.error('uso: register --brief <arquivo> --qa LIBERADO|BLOQUEADO [--rodadas N] [--relatorio <arquivo>] [--scope a/,b/]'); process.exit(1); }
  if (!fs.existsSync(path.resolve(ROOT, brief))) { console.error("BRIEF não encontrado: " + brief); process.exit(1); }
  garantirDir();
  const reg = { brief: rel(brief), status: "AGUARDANDO_GO", qa_verdict: qa, qa_rounds: Number(arg("rodadas") || 1), qa_report: arg("relatorio"), scope: arg("scope") ? arg("scope").split(",") : [], registered_at: iso(agora()) };
  fs.writeFileSync(ACTIVE, JSON.stringify(reg, null, 2));
  fs.appendFileSync(LOG, JSON.stringify({ at: reg.registered_at, evento: "register", brief: reg.brief, qa_verdict: qa }) + "\n");
  console.log(`BRIEF registrado: ${reg.brief} | QA ${qa} | aguardando o go do João ou do Hamilton.`);
}

function modoStatus() {
  const a = ler(ACTIVE);
  console.log(a ? JSON.stringify(a, null, 2) : "Sem BRIEF ativo.");
}

const modo = process.argv[2];
({ gate: modoGate, capture: modoCapture, register: modoRegister, status: modoStatus }[modo] || (() => { console.error("modos: gate | capture | register | status"); process.exit(1); }))();
