-- Marcar questões como "revisadas" (usado na revisão das questões com imagem).
-- Rodar no SQL Editor do Supabase.

alter table questoes
  add column if not exists revisada boolean not null default false;

create index if not exists idx_questoes_revisada on questoes(revisada);
