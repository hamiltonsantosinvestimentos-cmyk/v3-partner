// ── Web search backend (zero cost) ─────────────────────────────────────────
// Tenta Exa → Serper → DuckDuckGo (fallback gratuito)
export async function webSearch(query: string): Promise<string> {
  // 1. Exa (se configurado)
  const exaKey = process.env.EXA_API_KEY?.trim();
  if (exaKey) {
    try {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "x-api-key": exaKey, "Content-Type": "application/json" },
        body: JSON.stringify({ query, numResults: 5, useAutoprompt: true, type: "neural" }),
      });
      if (res.ok) {
        const data = await res.json();
        return (data.results ?? [])
          .map((r: { title: string; url: string; text?: string }) =>
            `[${r.title}](${r.url})\n${r.text?.substring(0, 300) ?? ""}`)
          .join("\n\n");
      }
    } catch { /* fallthrough */ }
  }

  // 2. Serper (se configurado)
  const serperKey = process.env.SERPER_API_KEY?.trim();
  if (serperKey) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: 5, hl: "pt", gl: "br" }),
      });
      if (res.ok) {
        const data = await res.json();
        return (data.organic ?? [])
          .map((r: { title: string; link: string; snippet: string }) =>
            `[${r.title}](${r.link})\n${r.snippet}`)
          .join("\n\n");
      }
    } catch { /* fallthrough */ }
  }

  // 3. DuckDuckGo Instant Answer — gratuito, sem API key
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { "User-Agent": "V3Partners-MarketScout/1.0" } });
    if (res.ok) {
      const data = await res.json();
      const results: string[] = [];
      if (data.AbstractText) results.push(data.AbstractText);
      if (data.RelatedTopics?.length) {
        data.RelatedTopics.slice(0, 5).forEach((t: { Text?: string; FirstURL?: string }) => {
          if (t.Text) results.push(`• ${t.Text}${t.FirstURL ? ` — ${t.FirstURL}` : ""}`);
        });
      }
      return results.join("\n") || `Nenhum resultado encontrado para: ${query}`;
    }
  } catch { /* fallthrough */ }

  return `Busca indisponível para: ${query}. Responda com base no seu conhecimento.`;
}
