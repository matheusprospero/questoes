-- Feedback dos alunos: reportar problema, comentários, estrelas e dificuldade.
-- Rodar no SQL Editor do Supabase.

-- 1) Reportar problema na questão
create table if not exists questao_reports (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id uuid not null references questoes(id) on delete cascade,
  tipo       text not null check (tipo in ('gabarito', 'sem_resposta', 'enunciado', 'outro')),
  descricao  text,
  resolvido  boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index if not exists idx_reports_questao   on questao_reports(questao_id);
create index if not exists idx_reports_resolvido  on questao_reports(resolvido);

-- 2) Comentários (autor_nome desnormalizado — perfis é privado)
create table if not exists questao_comentarios (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id uuid not null references questoes(id) on delete cascade,
  autor_nome text,
  texto      text not null,
  criado_em  timestamptz not null default now()
);
create index if not exists idx_coment_questao on questao_comentarios(questao_id);

-- 3) Avaliação: estrelas (resolução) + dificuldade percebida — 1 por aluno/questão
create table if not exists questao_avaliacoes (
  usuario_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id   uuid not null references questoes(id) on delete cascade,
  estrelas     smallint check (estrelas between 1 and 5),
  dificuldade  smallint check (dificuldade between 1 and 5),
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, questao_id)
);
create index if not exists idx_aval_questao on questao_avaliacoes(questao_id);

-- Estrelas para a aula
create table if not exists aula_avaliacoes (
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  aula_id       uuid not null references aulas(id) on delete cascade,
  estrelas      smallint check (estrelas between 1 and 5),
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, aula_id)
);
create index if not exists idx_aval_aula on aula_avaliacoes(aula_id);

-- ── RLS ──
alter table questao_reports     enable row level security;
alter table questao_comentarios enable row level security;
alter table questao_avaliacoes  enable row level security;
alter table aula_avaliacoes     enable row level security;

-- Reports: aluno cria e vê os seus; admin vê e resolve todos
drop policy if exists "report_insert" on questao_reports;
create policy "report_insert" on questao_reports for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists "report_select" on questao_reports;
create policy "report_select" on questao_reports for select to authenticated using (usuario_id = auth.uid() or is_admin());
drop policy if exists "report_update" on questao_reports;
create policy "report_update" on questao_reports for update to authenticated using (is_admin());
drop policy if exists "report_delete" on questao_reports;
create policy "report_delete" on questao_reports for delete to authenticated using (usuario_id = auth.uid() or is_admin());

-- Comentários: todos leem; autor cria e apaga o seu; admin apaga qualquer
drop policy if exists "coment_select" on questao_comentarios;
create policy "coment_select" on questao_comentarios for select to authenticated using (true);
drop policy if exists "coment_insert" on questao_comentarios;
create policy "coment_insert" on questao_comentarios for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists "coment_delete" on questao_comentarios;
create policy "coment_delete" on questao_comentarios for delete to authenticated using (usuario_id = auth.uid() or is_admin());

-- Avaliações: todos leem (média/agregado); dono gerencia a sua
drop policy if exists "aval_select" on questao_avaliacoes;
create policy "aval_select" on questao_avaliacoes for select to authenticated using (true);
drop policy if exists "aval_own" on questao_avaliacoes;
create policy "aval_own" on questao_avaliacoes for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "aval_aula_select" on aula_avaliacoes;
create policy "aval_aula_select" on aula_avaliacoes for select to authenticated using (true);
drop policy if exists "aval_aula_own" on aula_avaliacoes;
create policy "aval_aula_own" on aula_avaliacoes for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
