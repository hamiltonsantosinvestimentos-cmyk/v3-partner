-- ROLLBACK: fee_v3_pct nullable
-- Referente a: supabase/migrations/20260806d_cm_commission_simulations_fee_v3_pct_nullable.sql
--
-- NAO restaura NOT NULL de proposito: fazer isso reintroduziria o bug P0
-- que travava "Salvar Simulacao" desde a Fase 3 (a rota nunca mais escreve
-- nesse campo). Se algum dia for necessario reverter de verdade, primeiro
-- volte o codigo da rota a escrever fee_v3_pct, so depois rode:
--   ALTER TABLE cm_commission_simulations ALTER COLUMN fee_v3_pct SET NOT NULL;
-- Este arquivo existe só para documentar a decisão, não executa nada.
SELECT 1;
