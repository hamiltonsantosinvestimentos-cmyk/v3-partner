---
name: coderabbit-review
description: |
  Unified CodeRabbit CLI execution via WSL (with native Linux/Mac fallback) and
  a bounded self-healing loop. Use this skill when running automated code
  review before commits, PRs, or QA gates. Resolves the project path
  dynamically — never hardcode an absolute path in this file.
user-invocable: true
argument-hint: "[scope: uncommitted|committed|base] [branch-if-base]"
---

# CodeRabbit Review

Centralized CodeRabbit CLI execution for automated code review, with a bounded
auto-fix loop. Works via WSL on Windows; falls back to a direct call on
native Linux/Mac.

## Prerequisites

- CodeRabbit CLI installed at `~/.local/bin/coderabbit` (inside WSL on
  Windows, or directly on Linux/Mac)
- On Windows: a WSL distribution (Ubuntu assumed) with the project's drive
  mounted under `/mnt/`
- Authenticated: `~/.local/bin/coderabbit auth status` exits 0

**Never hardcode an absolute project path in this file.** Every path used
below is resolved at execution time from the current working directory. If a
future edit reintroduces a fixed `/mnt/c/Users/...` or `C:\Users\...` path,
that is a regression — remove it.

## Execution

### 1. Resolve the Project Path (do this first, every time)

Detect the environment and compute the path CodeRabbit should run against:

```bash
# From the Bash tool, already inside the project root:
if command -v wsl.exe >/dev/null 2>&1 || grep -qi microsoft /proc/version 2>/dev/null; then
  ENV="wsl-windows"
  # Convert the current Windows-style path to its WSL mount path dynamically.
  WIN_PATH="$(pwd -W 2>/dev/null || pwd)"
else
  ENV="native"
fi
```

- If `ENV=wsl-windows`: the actual review command runs *inside* `wsl bash -c
  '...'`, and the first thing that inner command does is
  `cd "$(wslpath "$WIN_PATH")"` — never a literal path.
- If `ENV=native`: run `coderabbit` directly, no `wsl` wrapper, `cd` into
  `$(pwd)`.

If path resolution fails (e.g., `wslpath` not found, or `pwd -W` returns
empty on a non-git-bash shell), STOP and report: *"Não consegui resolver o
caminho do projeto para o CodeRabbit — confirme se está rodando de dentro da
raiz do repositório."* Do not guess a path.

### 2. Determine Scope

Parse `$ARGUMENTS`:

| Argument | Flags | Use Case |
|----------|-------|----------|
| `uncommitted` (default) | `--prompt-only -t uncommitted` | Pre-commit review |
| `committed` | `--prompt-only -t committed --base main` | QA story review |
| `base {branch}` | `--prompt-only --base {branch}` | Pre-PR review against a specific base |

### 3. Build and Execute the Command

**WSL (Windows):**
```bash
wsl bash -c "cd \"\$(wslpath '$WIN_PATH')\" && ~/.local/bin/coderabbit {flags}"
```

**Native (Linux/Mac):**
```bash
cd "$(pwd)" && ~/.local/bin/coderabbit {flags}
```

**Timeout by scope** (CodeRabbit reviews are genuinely slow — do not shorten
these):
| Scope | Timeout |
|-------|---------|
| `uncommitted` (small diff) | 900000ms (15 min) |
| `committed` | 1200000ms (20 min) |
| `base {branch}` (may be far diverged) | 1500000ms (25 min) |

Before the first run in a session, verify the CLI is present and
authenticated:
```bash
{wsl-wrapper if applicable} ~/.local/bin/coderabbit --version
{wsl-wrapper if applicable} ~/.local/bin/coderabbit auth status
```
If either fails, jump to **Error Handling** below — do not attempt the
review command.

### 4. Parse Results

`--prompt-only` returns freeform markdown/text, not structured JSON. Parse it
by scanning for severity markers CodeRabbit emits inline with each finding
(e.g. a line containing `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` near a file
path and line number). For each finding, extract: file path, line number,
one-line summary, severity. If a finding's severity cannot be confidently
determined from the text, classify it as its **next-lower** severity rather
than guessing upward (never over-escalate a finding you're unsure about to
CRITICAL, since that triggers the auto-fix loop below).

Classify every finding:

| Severity | Action |
|----------|--------|
| **CRITICAL** | Must fix immediately — blocks completion, triggers self-healing loop |
| **HIGH** | Recommend fix before merge |
| **MEDIUM** | Document as technical debt |
| **LOW** | Optional improvement, note only |

### 5. Self-Healing Loop (only if CRITICAL findings exist)

```
iteration = 0
max_iterations = agent-specific (dev: 2, qa: 3, devops: 2)

WHILE iteration < max_iterations AND critical_issues_remain:
  1. For EACH critical issue, in order:
     a. Read the exact file:line flagged.
     b. Apply the smallest change that resolves the specific finding —
        do not refactor unrelated code in the same file.
     c. Run the project's typecheck command (see project CLAUDE.md /
        package.json — e.g. `npx tsc --noEmit`) on the changed file(s).
        If typecheck fails, revert the fix and mark this finding
        "auto-fix failed — needs manual review" instead of looping again
        on it.
  2. Re-run the CodeRabbit review command from step 3 (full command, same
     scope) — do not skip this; a finding is only "fixed" once CodeRabbit
     itself confirms it's gone.
  3. iteration++

IF critical_issues_remain after max_iterations:
  HALT. Report exactly which CRITICAL findings are still open and why
  (e.g. "auto-fix failed typecheck", "still flagged after 2 attempts").
  Do not silently drop them from the report.
```

### 6. Report

Save to `docs/qa/coderabbit-reports/{YYYY-MM-DD}-{branch-name}-{scope}.md`
(replace `/` in branch names with `-`; if run twice same day/branch/scope,
append `-2`, `-3`, ... — never silently overwrite a prior report).

```markdown
## CodeRabbit Review Results

**Date:** {YYYY-MM-DD}  **Scope:** {scope}  **Branch:** {branch}

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | N | Fixed: N / Remaining: N |
| HIGH | N | Documented |
| MEDIUM | N | Tech debt |
| LOW | N | Noted |

### Remaining CRITICAL (if any)
1. `{file}:{line}` — {finding} — {why still open}

**Decision:** PASS (0 CRITICAL remaining) / FAIL (CRITICAL remaining after max_iterations)
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `wsl.exe: command not found` AND not running natively on Linux/Mac | WSL not installed on a Windows machine | STOP, report: "WSL não está disponível — instale via `wsl --install` ou rode este skill numa máquina Linux/Mac." |
| `coderabbit: command not found` | Not installed | `pip install coderabbit-cli` (inside WSL if on Windows) |
| `auth status` fails / "not authenticated" | Auth expired or never run | Report the exact CLI command to re-authenticate; do not attempt it yourself (interactive login) |
| Path resolution fails (step 1) | Not running from repo root, or `wslpath`/`pwd -W` unavailable | STOP — see step 1 |
| Timeout at scope limit | Very large diff/history | Report as "review still processing, re-run with the same scope" — do not silently treat as failure |
| CLI crashes mid-review (partial/no output) | CLI bug or killed process | Retry once; if it fails twice, report the raw stderr and STOP — do not fabricate a result |

## Agent-Specific Configuration

| Agent | Max Iterations | Severity Filter | Trigger |
|-------|---------------|-----------------|---------|
| @dev | 2 | CRITICAL only | Pre-commit (story completion) |
| @qa | 3 | CRITICAL + HIGH | Story review start |
| @devops | 2 | CRITICAL + HIGH | Pre-push / Pre-PR |

## Worked Example (few-shot)

Input: `/coderabbit-review uncommitted`, agent = `@dev`.

1. Resolve path → `ENV=wsl-windows`, `WIN_PATH=C:\Users\atend\Desktop\v3-partner`.
2. Scope → `--prompt-only -t uncommitted`, timeout 900000ms.
3. Run `wsl bash -c "cd \"$(wslpath 'C:\Users\atend\Desktop\v3-partner')\" && ~/.local/bin/coderabbit --prompt-only -t uncommitted"`.
4. Output contains: `CRITICAL app/api/foo/route.ts:42 — missing auth check before service-role query`.
5. 1 CRITICAL, 0 HIGH → loop triggers (dev, max 2 iterations).
   - Iteration 1: read `route.ts:42`, add the missing auth check, run `npx tsc --noEmit` on the file → passes. Re-run CodeRabbit → finding gone.
6. Report: CRITICAL 1 (Fixed: 1/Remaining: 0) → **Decision: PASS**. Saved to `docs/qa/coderabbit-reports/2026-07-13-feat-foo-uncommitted.md`.
