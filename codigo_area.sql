-- Código legível da questão (ex.: TJSP-2010-MAT-32) + área do concurso
-- Rode no SQL Editor do Supabase (uma vez).

alter table questoes add column if not exists codigo text;
alter table questoes add column if not exists area text;
alter table provas   add column if not exists area text;

create unique index if not exists questoes_codigo_idx on questoes (codigo) where codigo is not null;
create index if not exists questoes_area_idx on questoes (area);
