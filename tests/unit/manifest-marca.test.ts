// BRIEF docs/briefs/2026-11-26_app-instalado-marca-enterprise.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  corSegura, formaCanonicaIcone, manifestoDaMarca, manifestoV3, nomeSeguro, shortName,
  URL_RESOLUCAO, urlIcone, versaoMarca,
} from "../../lib/manifest-marca";

const q = (s: string) => new URLSearchParams(s);
const V = "0a1b2c3d";

test("formaCanonicaIcone: canônica, resolução e inválida", () => {
  for (const t of ["180", "192", "512", "512m"]) {
    assert.deepEqual(formaCanonicaIcone(q(`t=${t}&v=${V}`)), { estado: "canonica", t, v: V });
  }
  assert.deepEqual(formaCanonicaIcone(q("t=512")), { estado: "resolucao" });
  for (const s of ["t=abc", "t=9999&v=" + V, "t=512&v=XYZ", "t=512&v=" + V + "&x=1", "t=512&t=192&v=" + V, "t=192", "", "v=" + V, "t=512&v=" + V + "&v=" + V]) {
    assert.deepEqual(formaCanonicaIcone(q(s)), { estado: "invalida", redirect: URL_RESOLUCAO }, s);
  }
});

test("formaCanonicaIcone: sem laço (inválida → resolução → canônica)", () => {
  const destinoInvalida = new URL(URL_RESOLUCAO, "https://x.app").searchParams;
  assert.equal(formaCanonicaIcone(destinoInvalida).estado, "resolucao");
  const destinoResolucao = new URL(urlIcone("512", V), "https://x.app").searchParams;
  assert.equal(formaCanonicaIcone(destinoResolucao).estado, "canonica");
});

test("versaoMarca: estável e muda com ícone, cor ou nome", () => {
  const base = { iconeUrl: "https://s/i.png", corPrincipal: "#040968", corAcento: "#00E000", nome: "AGS Finance" };
  const v = versaoMarca(base);
  assert.match(v, /^[0-9a-f]{8}$/);
  assert.equal(versaoMarca({ ...base }), v);
  assert.notEqual(versaoMarca({ ...base, iconeUrl: "https://s/j.png" }), v);
  assert.notEqual(versaoMarca({ ...base, corPrincipal: "#000000" }), v);
  assert.notEqual(versaoMarca({ ...base, nome: "Outra" }), v);
});

test("nome, short_name e cor", () => {
  assert.equal(nomeSeguro(""), "Plataforma");
  assert.equal(nomeSeguro(null), "Plataforma");
  assert.equal(nomeSeguro("<b>AGS</b>"), "bAGS/b");
  assert.equal(nomeSeguro("x".repeat(60)).length, 45);
  assert.equal(shortName("AGS Finance"), "AGS Finance");
  assert.equal(shortName("AGS Finance Brasil"), "AGS Finance");
  assert.equal(shortName("Supercalifragilistico"), "Supercalifra");
  assert.equal(corSegura("#040968", "#09081A"), "#040968");
  assert.equal(corSegura("red", "#09081A"), "#09081A");
  assert.equal(corSegura(null, "#C9A84C"), "#C9A84C");
});

test("manifestoDaMarca: nome, cores e 3 ícones versionados", () => {
  const m = manifestoDaMarca({ nome: "AGS Finance", corPrincipal: "#040968", versao: V });
  assert.equal(m.name, "AGS Finance");
  assert.equal(m.short_name, "AGS Finance");
  assert.equal(m.theme_color, "#040968");
  assert.equal(m.background_color, "#040968");
  assert.deepEqual(m.icons.map((i) => [i.src, i.sizes, i.purpose]), [
    [urlIcone("192", V), "192x192", "any"],
    [urlIcone("512", V), "512x512", "any"],
    [urlIcone("512m", V), "512x512", "maskable"],
  ]);
});

test("manifestoV3 é igual a public/manifest.json", () => {
  const arquivo = JSON.parse(readFileSync("public/manifest.json", "utf8"));
  assert.deepEqual(manifestoV3(), arquivo);
});
