// Ícone do app instalado no domínio do Enterprise, nos tamanhos exatos (180, 192, 512 e 512m maskable),
// sobre a cor principal da marca. BRIEF docs/briefs/2026-11-26_app-instalado-marca-enterprise.md
import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { formaCanonicaIcone, urlIcone, URL_RESOLUCAO, type TamanhoIcone } from "@/lib/manifest-marca";
import { ehMarca, hostDoPedido, marcaDoAppPorHost } from "@/lib/manifest-marca-server";

const LIMITE_BYTES = 1024 * 1024;

function redirecionar(req: NextRequest, destino: string, status: 307 | 308, cache?: string) {
  const res = NextResponse.redirect(new URL(destino, req.url), status);
  if (cache) res.headers.set("Cache-Control", cache);
  return res;
}

/** Baixa o ícone antes de gerar a imagem: PNG/JPEG, até 1 MB, em 3 s. Qualquer falha = null (inicial). */
async function baixarIcone(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    if (!r.ok) return null;
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (tipo !== "image/png" && tipo !== "image/jpeg") return null;
    const tam = Number(r.headers.get("content-length") ?? "0");
    if (tam > LIMITE_BYTES) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > LIMITE_BYTES) return null;
    return `data:${tipo};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const forma = formaCanonicaIcone(req.nextUrl.searchParams);
  if (forma.estado === "invalida") return redirecionar(req, URL_RESOLUCAO, 308);

  const m = await marcaDoAppPorHost(hostDoPedido(req.headers));
  const falhou = !!m && "erro" in m;
  if (!ehMarca(m)) {
    // Host da V3, sem Enterprise ou falha de consulta: ícone da V3 (falha sem cache).
    return redirecionar(req, "/icon-512.png", 307, falhou ? "no-store" : "public, s-maxage=300");
  }
  if (forma.estado === "resolucao") return redirecionar(req, urlIcone("512", m.versao), 308, "public, s-maxage=300");
  if (forma.v !== m.versao) return redirecionar(req, urlIcone(forma.t, m.versao), 308, "public, s-maxage=300");

  const t: TamanhoIcone = forma.t;
  const tamanho = t === "180" ? 180 : t === "192" ? 192 : 512;
  const escala = t === "512m" ? 0.8 : 1;
  const lado = Math.round(tamanho * escala);
  const dataUrl = await baixarIcone(m.iconeUrl);
  const inicial = (m.nome.trim()[0] ?? "P").toUpperCase();

  return new ImageResponse(
    (
      <div style={{ width: tamanho, height: tamanho, display: "flex", alignItems: "center", justifyContent: "center", background: m.corPrincipal }}>
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} width={lado} height={lado} alt="" style={{ width: lado, height: lado, objectFit: "contain" }} />
        ) : (
          <span style={{ color: m.corAcento, fontSize: Math.round(lado * 0.5), fontWeight: 800 }}>{inicial}</span>
        )}
      </div>
    ),
    {
      width: tamanho,
      height: tamanho,
      headers: { "Cache-Control": dataUrl ? "public, max-age=86400, s-maxage=86400, immutable" : "no-store" },
    },
  );
}
