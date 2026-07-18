-- ============================================================================
-- Turmas: conteúdo em VÁRIAS turmas (N-N) — evolui turmas.sql.
-- Uma aula/simulado pode pertencer a mais de uma turma.
-- Rodar no SQL Editor do Supabase (depois de turmas.sql). Idempotente.
-- ============================================================================

create table if not exists turma_aulas (
  turma_id uuid not null references turmas(id) on delete cascade,
  aula_id  uuid not null references aulas(id)  on delete cascade,
  primary key (turma_id, aula_id)
);
create table if not exists turma_simulados (
  turma_id    uuid not null references turmas(id)    on delete cascade,
  simulado_id uuid not null references simulados(id) on delete cascade,
  primary key (turma_id, simulado_id)
);
create index if not exists idx_turma_aulas_aula on turma_aulas(aula_id);
create index if not exists idx_turma_simulados_sim on turma_simulados(simulado_id);

-- Migra o vínculo antigo (coluna única turma_id) para as tabelas de junção
insert into turma_aulas (turma_id, aula_id)
  select turma_id, id from aulas where turma_id is not null
  on conflict do nothing;
insert into turma_simulados (turma_id, simulado_id)
  select turma_id, id from simulados where turma_id is not null
  on conflict do nothing;

-- Acesso: admin sempre; conteúdo sem turma é público; senão, matriculado ativo
-- em ALGUMA turma que contém o conteúdo (respeitando a disciplina da aula).
create or replace function pode_ver_aula(p_aula uuid, p_disc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin()
     or not exists (select 1 from turma_aulas where aula_id = p_aula)
     or exists (
          select 1 from turma_aulas ta
            join matriculas m on m.turma_id = ta.turma_id
                             and m.usuario_id = auth.uid()
                             and m.status = 'ativa'
           where ta.aula_id = p_aula
             and (p_disc is null or m.disciplina_id = p_disc));
$$;

create or replace function pode_ver_simulado(p_sim uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin()
     or not exists (select 1 from turma_simulados where simulado_id = p_sim)
     or exists (
          select 1 from turma_simulados ts
            join matriculas m on m.turma_id = ts.turma_id
                             and m.usuario_id = auth.uid()
                             and m.status = 'ativa'
           where ts.simulado_id = p_sim);
$$;

-- ── Recria as policies de leitura usando as funções (N-N) ──────────────────
drop policy if exists "leitura_publicadas" on aulas;
create policy "leitura_publicadas" on aulas for select to authenticated
  using (publicada = true and eh_assinante(auth.uid()) and pode_ver_aula(id, disciplina_id));

drop policy if exists "leitura_itens_publicadas" on aula_questoes;
create policy "leitura_itens_publicadas" on aula_questoes for select to authenticated
  using (exists (
    select 1 from aulas a
     where a.id = aula_id and a.publicada = true and eh_assinante(auth.uid())
       and pode_ver_aula(a.id, a.disciplina_id)));

drop policy if exists "leitura_propostos" on simulados;
create policy "leitura_propostos" on simulados for select to authenticated
  using (proposto = true and usuario_eh_admin(usuario_id) and pode_ver_simulado(id));

drop policy if exists "leitura_itens_propostos" on simulado_questoes;
create policy "leitura_itens_propostos" on simulado_questoes for select to authenticated
  using (exists (
    select 1 from simulados s
     where s.id = simulado_id and s.proposto = true and usuario_eh_admin(s.usuario_id)
       and pode_ver_simulado(s.id)));

-- ── RLS das tabelas de junção ──────────────────────────────────────────────
alter table turma_aulas     enable row level security;
alter table turma_simulados enable row level security;

drop policy if exists "turma_aulas_leitura" on turma_aulas;
drop policy if exists "turma_aulas_admin"   on turma_aulas;
create policy "turma_aulas_leitura" on turma_aulas for select to authenticated using (true);
create policy "turma_aulas_admin"   on turma_aulas for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "turma_simulados_leitura" on turma_simulados;
drop policy if exists "turma_simulados_admin"   on turma_simulados;
create policy "turma_simulados_leitura" on turma_simulados for select to authenticated using (true);
create policy "turma_simulados_admin"   on turma_simulados for all to authenticated
  using (is_admin()) with check (is_admin());
