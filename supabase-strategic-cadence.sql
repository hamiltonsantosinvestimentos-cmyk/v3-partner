-- ============================================================
-- Plan Strategy: Cadência de Planejamento Estratégico (adaptação G4)
-- Execute no SQL Editor do Supabase
-- Ver: docs/estrategia/g4-cadencia-planejamento-estrategico.md
-- ============================================================

CREATE TABLE IF NOT EXISTS strategic_cadence_checkins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector         text NOT NULL,   -- MA | CREDITO | CONSORCIO | BOLSA_ATIVOS | MARKETPLACE | CREDITO_INTERNACIONAL | ASSINATURAS
  cadence        text NOT NULL CHECK (cadence IN ('SEMANAL','MENSAL','TRIMESTRAL','SEMESTRAL','ANUAL')),
  period_label   text NOT NULL,   -- ex: "2026-W32" (semanal), "2026-08" (mensal), "2026-Q3" (trimestral), "2026-S2" (semestral), "2026" (anual)
  status         text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDO')),
  summary        text NOT NULL DEFAULT '',       -- o que moveu / principais pontos do período
  blockers       text NOT NULL DEFAULT '',       -- bloqueios sinalizados
  next_actions   text NOT NULL DEFAULT '',       -- compromissos para o próximo período
  updated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector, cadence, period_label)
);

CREATE INDEX IF NOT EXISTS idx_strategic_cadence_period ON strategic_cadence_checkins(cadence, period_label);
CREATE INDEX IF NOT EXISTS idx_strategic_cadence_sector ON strategic_cadence_checkins(sector);

ALTER TABLE strategic_cadence_checkins ENABLE ROW LEVEL SECURITY;

-- Leitura: ADMIN/GESTAO (é uma ferramenta de governança da diretoria)
CREATE POLICY "read_strategic_cadence"
  ON strategic_cadence_checkins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN','GESTAO')
    )
  );

-- Escrita: ADMIN/GESTAO
CREATE POLICY "admin_write_strategic_cadence"
  ON strategic_cadence_checkins FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN','GESTAO')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN','GESTAO')
    )
  );
