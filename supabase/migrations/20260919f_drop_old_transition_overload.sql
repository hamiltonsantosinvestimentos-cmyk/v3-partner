-- Fix real (19/09/2026): CREATE OR REPLACE FUNCTION com um parametro novo
-- (p_reason_category) nao substitui a assinatura antiga de 4 parametros no
-- Postgres, cria uma SEGUNDA sobrecarga -- as duas convivendo deixam
-- qualquer chamada com 4 argumentos ambigua ("function is not unique").
-- Achado testando a migration 20260919e ao vivo antes de seguir. Precisa
-- derrubar a assinatura antiga explicitamente, CREATE OR REPLACE nao basta
-- quando a lista de parametros muda de tamanho.

drop function if exists public.transition_cm_listing_status(uuid, cm_listing_status, text, uuid);
