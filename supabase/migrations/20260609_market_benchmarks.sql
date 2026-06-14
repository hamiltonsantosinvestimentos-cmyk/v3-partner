-- ═══════════════════════════════════════════════════════
--  market_benchmarks — referências de mercado por setor
--  Alimentada pela Mesa M&A e pelo pipeline OCR (W9)
--  Relacionada a docs_ingeridos via source_doc_id
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS market_benchmarks (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  sector          text    NOT NULL,
  sub_sector      text,
  benchmark_key   text    NOT NULL,
  benchmark_label text    NOT NULL,
  value_numeric   numeric,
  value_text      text,
  unit            text,
  source          text,
  source_doc_id   uuid    REFERENCES docs_ingeridos(id) ON DELETE SET NULL,
  valid_from      date    NOT NULL DEFAULT CURRENT_DATE,
  valid_until     date,
  created_by      uuid    REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mb_sector_subkey
  ON market_benchmarks(sector, sub_sector, benchmark_key)
  WHERE valid_until IS NULL;

ALTER TABLE market_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mb_read_authenticated"
  ON market_benchmarks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "mb_write_admin_gestao"
  ON market_benchmarks FOR ALL
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ADMIN', 'GESTAO')
  );

-- updated_at trigger (usa função global já existente no projeto)
CREATE TRIGGER set_updated_at_market_benchmarks
  BEFORE UPDATE ON market_benchmarks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ───────────────────────────────────────────────────────
--  SEED: Genética Bovina — fontes ABCZ / Embrapa / V3
-- ───────────────────────────────────────────────────────
INSERT INTO market_benchmarks
  (sector, sub_sector, benchmark_key, benchmark_label, value_numeric, unit, source)
VALUES
  ('agronegocio','genetica_bovina','crescimento_mercado_pct_aa',   'Crescimento médio do mercado de embriões (%/ano)',      12.0,'%',  'ABCZ_Relatorio_2024'),
  ('agronegocio','genetica_bovina','preco_medio_embriao_dom_brl',  'Preço médio embrião nacional (R$)',                   4500.0,'BRL','ABCZ_Relatorio_2024'),
  ('agronegocio','genetica_bovina','preco_medio_embriao_exp_usd',  'Preço médio embrião exportação (USD)',                 850.0,'USD','ABCZ_Relatorio_2024'),
  ('agronegocio','genetica_bovina','taxa_prenhez_mercado_pct',     'Taxa de prenhez média do setor (%)',                    62.0,'%',  'Embrapa_Genetica_2023'),
  ('agronegocio','genetica_bovina','participacao_exportacao_pct',  'Participação de exportações no mercado (%)',            35.0,'%',  'ABCZ_Relatorio_2024'),
  ('agronegocio','genetica_bovina','custo_operacional_pct_receita','Custo operacional médio (% da receita)',                55.0,'%',  'Embrapa_Genetica_2023'),
  ('agronegocio','genetica_bovina','crescimento_estabilizado_pct', 'Crescimento anual — cenário estabilizado (%)',          18.0,'%',  'V3_Model_Internal'),
  ('agronegocio','genetica_bovina','crescimento_expansao_pct',     'Crescimento anual — cenário expansão (%)',              28.0,'%',  'V3_Model_Internal'),
  ('agronegocio','genetica_bovina','crescimento_pessimista_pct',   'Crescimento anual — cenário pessimista (%)',            -5.0,'%',  'V3_Model_Internal'),
  ('agronegocio','genetica_bovina','hedge_custo_ndf_pct',          'Custo estimado hedge NDF (% valor protegido)',           3.5,'%',  'B3_BMF_2024'),
  ('agronegocio','genetica_bovina','hedge_custo_opcao_pct',        'Custo estimado opção de câmbio (% valor protegido)',     5.2,'%',  'B3_BMF_2024');
