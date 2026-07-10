-- Aulas viram conteúdo exclusivo de assinantes.
-- Só admin ou assinante (eh_assinante) leem as aulas publicadas e seus itens.
-- Rodar no SQL Editor do Supabase (depois de videos_assinante.sql, que cria eh_assinante).

drop policy if exists "leitura_publicadas" on aulas;
create policy "leitura_publicadas" on aulas for select to authenticated
  using (publicada = true and eh_assinante(auth.uid()));

drop policy if exists "leitura_itens_publicadas" on aula_questoes;
create policy "leitura_itens_publicadas" on aula_questoes for select to authenticated
  using (exists (
    select 1 from aulas a
    where a.id = aula_id and a.publicada = true and eh_assinante(auth.uid())
  ));
