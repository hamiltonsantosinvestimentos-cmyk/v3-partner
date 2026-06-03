-- Habilita Realtime na tabela chat_messages
-- Necessário para o widget flutuante receber mensagens instantaneamente

alter publication supabase_realtime add table public.chat_messages;
