-- Aulas: teoria (blocos de texto/vídeo) + questões do mesmo tema.
-- Rodar no SQL Editor do Supabase.

create table if not exists aulas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo        text not null,
  descricao     text,
  disciplina_id uuid references disciplinas(id) on delete set null,
  conteudo      jsonb not null default '[]',   -- blocos: [{tipo:'texto',html} | {tipo:'video',url,titulo}]
  publicada     boolean not null default false, -- visível aos alunos
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_aulas_usuario    on aulas(usuario_id);
create index if not exists idx_aulas_disciplina on aulas(disciplina_id);

create table if not exists aula_questoes (
  aula_id    uuid not null references aulas(id)     on delete cascade,
  questao_id uuid not null references questoes(id)  on delete cascade,
  ordem      int not null default 0,
  primary key (aula_id, questao_id)
);

-- RLS
alter table aulas         enable row level security;
alter table aula_questoes enable row level security;

-- O professor cria/edita/exclui as suas aulas
drop policy if exists "dono_total" on aulas;
create policy "dono_total" on aulas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Aulas publicadas: todos os alunos leem (só as de admin)
drop policy if exists "leitura_publicadas" on aulas;
create policy "leitura_publicadas" on aulas for select to authenticated
  using (publicada = true and usuario_eh_admin(usuario_id));

-- Itens: acesso via dono da aula
drop policy if exists "dono_via_aula" on aula_questoes;
create policy "dono_via_aula" on aula_questoes for all to authenticated
  using (exists (select 1 from aulas a where a.id = aula_id and a.usuario_id = auth.uid()))
  with check (exists (select 1 from aulas a where a.id = aula_id and a.usuario_id = auth.uid()));

drop policy if exists "leitura_itens_publicadas" on aula_questoes;
create policy "leitura_itens_publicadas" on aula_questoes for select to authenticated
  using (exists (
    select 1 from aulas a
    where a.id = aula_id and a.publicada = true and usuario_eh_admin(a.usuario_id)
  ));
