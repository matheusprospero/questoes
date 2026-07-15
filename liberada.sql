-- Classificação "liberada": controla a visibilidade das questões AUTORAIS para os alunos.
-- Rodar no SQL Editor do Supabase.
--
-- Regra de negócio:
--   • Questões de concurso (importadas) nascem liberada = true → sempre visíveis.
--   • As questões geradas por nós são inseridas com liberada = false: ficam
--     escondidas dos alunos e só aparecem depois que o admin marca como liberada.
--   • O admin (professor) enxerga todas, liberadas ou não, para poder revisá-las.

alter table questoes
  add column if not exists liberada boolean not null default true;

create index if not exists idx_questoes_liberada on questoes(liberada);

-- Aluno só enxerga questões liberadas; admin vê todas.
drop policy if exists "conteudo_select" on questoes;
create policy "conteudo_select" on questoes for select to authenticated
  using (liberada or is_admin());
