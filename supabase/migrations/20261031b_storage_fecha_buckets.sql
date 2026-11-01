-- Política de sigilo (31/10/2026), Storage: arquivo de cliente só sai pela API da V3 (chave de serviço, papel
-- validado, link assinado, com registro). BRIEF: 2026-10-31_Operacional_BRIEF-Seguranca-Storage-Buckets-Abertos-a-Usuario-Logado_v1.html
-- (QA liberado na rodada 2).
--
-- ORDEM OBRIGATÓRIA: o código deste PR (rota /api/admin/cadastros/documento, DocLink, bloqueio do upload do chat de
-- equipe) entra em produção ANTES desta migration; sem isso, tornar partner-docs privado quebra os links da tela de
-- cadastros do administrador. Aplicar depois do deploy verificado, com o SQL mostrado e o go do João, e com a ciência
-- escrita do Robson sobre a exposição histórica (condição 1 do BRIEF).
-- Rollback: 20261031b_storage_fecha_buckets_rollback.sql.txt (reabre a exposição; só em emergência).
--
-- Escopo: oito políticas de storage.objects para o papel authenticated (credit-documents e contratos) e o flag público
-- de dois buckets. Nenhuma política nova, nenhum grant novo. A chave de serviço ignora a RLS e continua acessando tudo
-- (as rotas do servidor e os envios por link assinado não dependem destas políticas).

-- credit-documents: SELECT (2), INSERT (2) e DELETE (2) para qualquer usuário logado
drop policy if exists "Autenticados podem ler" on storage.objects;
drop policy if exists "Autenticados podem visualizar documentos" on storage.objects;
drop policy if exists "Autenticados podem fazer upload de documentos" on storage.objects;
drop policy if exists "Autenticados podem upload" on storage.objects;
drop policy if exists "Autenticados podem deletar" on storage.objects;
drop policy if exists "Autenticados podem deletar documentos" on storage.objects;
-- fica "service_role full access credit-documents" (service_role)

-- contratos: INSERT e SELECT para qualquer usuário logado
drop policy if exists "Autenticados fazem upload de contratos" on storage.objects;
drop policy if exists "Autenticados visualizam contratos" on storage.objects;

-- Buckets que estavam públicos com documento sigiloso ou sem controle
update storage.buckets set public = false where id in ('partner-docs', 'team-chat-attachments');
