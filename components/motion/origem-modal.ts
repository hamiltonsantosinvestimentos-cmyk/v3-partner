"use client";

// Movimento V3: guarda o retângulo do card clicado para o modal da proposta nascer dele
// (e voltar para ele ao fechar). Quem abre o modal chama registrarOrigemModal(card);
// o modal consome com pegarOrigemModal().

let origem: DOMRect | null = null;

export function registrarOrigemModal(el: Element | null) {
  origem = el ? el.getBoundingClientRect() : null;
}

export function pegarOrigemModal(): DOMRect | null {
  const o = origem;
  origem = null;
  return o;
}

/** clip-path que recorta a tela no retângulo do card. */
export function recorteDe(r: DOMRect, raio = 12) {
  const dir = Math.max(0, window.innerWidth - r.right), baixo = Math.max(0, window.innerHeight - r.bottom);
  return `inset(${Math.max(0, r.top)}px ${dir}px ${baixo}px ${Math.max(0, r.left)}px round ${raio}px)`;
}
