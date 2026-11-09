-- 20261108b: corrige a assinatura de NDA do Deal Room (gatilho do registro de NDA)
--
-- Defeito: trg_nda_to_blockchain() (SECURITY DEFINER) fixa search_path em "public", mas usa digest() do
-- pgcrypto, que mora no schema "extensions". vdr_compute_event_hash() (SQL) herda o caminho do chamador.
-- Resultado: todo INSERT em nda_signatures falha com "function digest(text, unknown) does not exist".
-- Dados: so 2 NDAs assinados no Deal Room, o ultimo em 22/05/2026 (antes do endurecimento de search_path).
--
-- Correcao: as duas funcoes passam a ter search_path = public, extensions. Nada mais muda.
-- Rollback: 20261108b_vdr_nda_hash_search_path_rollback.sql.txt

alter function public.trg_nda_to_blockchain()
  set search_path = public, extensions;

alter function public.vdr_compute_event_hash(text, text, text, timestamp with time zone, text)
  set search_path = public, extensions;
