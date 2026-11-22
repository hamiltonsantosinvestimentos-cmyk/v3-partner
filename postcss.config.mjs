const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Tema do Enterprise white label: troca as cores da V3 por var(--wl-*, cor V3) no CSS já
    // compilado. Sem tema, nada muda. BRIEF docs/briefs/2026-11-21_tema-visual-enterprise-manual-de-marca.md
    "./postcss-tema-enterprise.cjs": {},
  },
};

export default config;
