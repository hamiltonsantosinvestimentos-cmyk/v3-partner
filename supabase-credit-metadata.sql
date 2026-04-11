-- Roda no SQL Editor do Supabase
-- Adiciona coluna metadata para armazenar todos os dados da proposta (imóveis, contato, endereço, etc.)
ALTER TABLE credit_desk_proposals
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
