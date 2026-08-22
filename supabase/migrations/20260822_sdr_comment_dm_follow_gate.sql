-- Gate de "está seguindo" no Comment-to-DM: antes de mandar a DM do gatilho,
-- checa se quem comentou segue a conta (is_user_follow_business). Se não
-- seguir, manda um pedido com botão em vez da DM do gatilho, e só libera a
-- DM de verdade quando a pessoa confirmar pelo botão (reconferimos o status
-- na hora do clique, não confiamos só na resposta).

ALTER TABLE sdr_comment_events
  ADD COLUMN IF NOT EXISTS aguardando_follow boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sdr_comment_events_aguardando_follow
  ON sdr_comment_events (aguardando_follow) WHERE aguardando_follow = true;
