// BACEN PTAX USD/BRL — fallback: AwesomeAPI
// Returns the most recent available closing rate.

export interface FxSnapshot {
  usd_brl: number;
  source: "bacen_ptax" | "awesomeapi" | "fallback";
  date: string; // ISO
  fetched_at: string; // ISO
}

const BACEN_URL =
  "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json";
const AWESOME_URL =
  "https://economia.awesomeapi.com.br/json/last/USD-BRL";

export async function fetchFxRate(): Promise<FxSnapshot> {
  const now = new Date().toISOString();

  // ── BACEN PTAX (primary) ──────────────────────────────────
  try {
    const res = await fetch(BACEN_URL, {
      next: { revalidate: 3600 }, // cache 1h in Next.js
    });
    if (res.ok) {
      const data = (await res.json()) as Array<{ data: string; valor: string }>;
      const entry = data[0];
      if (entry) {
        const rate = parseFloat(entry.valor.replace(",", "."));
        if (rate > 0) {
          return {
            usd_brl: rate,
            source: "bacen_ptax",
            date: entry.data,
            fetched_at: now,
          };
        }
      }
    }
  } catch {
    // fall through to next source
  }

  // ── AwesomeAPI (fallback) ─────────────────────────────────
  try {
    const res = await fetch(AWESOME_URL, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = (await res.json()) as { USDBRL?: { bid: string; create_date: string } };
      const bid = parseFloat(data.USDBRL?.bid ?? "0");
      if (bid > 0) {
        return {
          usd_brl: bid,
          source: "awesomeapi",
          date: data.USDBRL?.create_date ?? now.slice(0, 10),
          fetched_at: now,
        };
      }
    }
  } catch {
    // fall through to hard fallback
  }

  // ── Hard fallback (last known ~2026) ──────────────────────
  return {
    usd_brl: 5.75,
    source: "fallback",
    date: now.slice(0, 10),
    fetched_at: now,
  };
}
