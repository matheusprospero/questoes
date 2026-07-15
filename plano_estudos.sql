-- ============================================================================
--  Serviço de acompanhamento de estudos — Fases 0 a 3
--  Plano de estudos (edital verticalizado), metas no banco, tempo por questão,
--  agregação por dia/semana/mês e acompanhamento do professor.
--  Rodar no SQL Editor do Supabase (depois de schema_completo.sql e liberada.sql).
-- ============================================================================

-- ── Fase 0 · Alicerce ───────────────────────────────────────────────────────

-- Tempo gasto por questão (segundos) — captado no modo estudo/simulado.
alter table respostas add column if not exists tempo_seg int;

-- Metas do aluno (substitui o localStorage 'config-meta'). Uma linha por aluno.
create table if not exists metas (
  usuario_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  meta_diaria    int  not null default 20,
  meta_semanal   int,                        -- opcional; se nulo, usa meta_diaria * dias_alvo
  dias_alvo      int  not null default 7,    -- meta de dias seguidos (ofensiva)
  plano_id       uuid,                       -- plano de estudos ativo (FK adicionada abaixo)
  objetivo       jsonb not null default '{}'::jsonb,  -- { banca_id, assuntos:[], porDisciplina:{} }
  atualizado_em  timestamptz not null default now()
);

-- ── Fase 1 · Plano de estudos (edital verticalizado + ciclo de estudos) ─────

create table if not exists planos_estudo (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null,
  banca_id    uuid references bancas(id) on delete set null,
  orgao_id    uuid references orgaos(id) on delete set null,
  cargo       text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_planos_usuario on planos_estudo(usuario_id);

-- Cada item do plano = um tópico do "edital verticalizado".
create table if not exists plano_itens (
  id            uuid primary key default gen_random_uuid(),
  plano_id      uuid not null references planos_estudo(id) on delete cascade,
  disciplina_id uuid references disciplinas(id) on delete cascade,
  assunto_id    uuid references assuntos(id)   on delete cascade,  -- null = disciplina inteira
  peso          int not null default 3 check (peso between 1 and 5), -- prioridade/incidência
  meta_questoes int not null default 0,    -- meta de questões para este item
  estudado      boolean not null default false,  -- teoria estudada
  revisado      boolean not null default false,  -- revisão feita
  ciclos        int not null default 0,    -- nº de voltas no ciclo de estudos
  ordem         int not null default 0,
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_plano_itens_plano on plano_itens(plano_id);

-- FK metas.plano_id -> planos_estudo (após criar a tabela).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'metas_plano_fk') then
    alter table metas add constraint metas_plano_fk
      foreign key (plano_id) references planos_estudo(id) on delete set null;
  end if;
end $$;

-- ── Agregação por dia (heatmap + visão dia/semana/mês), respeitando o RLS ────
-- security_invoker = as políticas de `respostas` valem para quem consulta:
-- o aluno vê só o seu; o admin (professor) vê de todos.
create or replace view v_estudo_dia
with (security_invoker = on) as
  select usuario_id,
         (respondido_em at time zone 'America/Sao_Paulo')::date as dia,
         origem,
         count(*)                          as total,
         count(*) filter (where acertou)   as acertos,
         coalesce(sum(tempo_seg), 0)       as tempo_seg
    from respostas
   group by usuario_id, (respondido_em at time zone 'America/Sao_Paulo')::date, origem;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table metas         enable row level security;
alter table planos_estudo enable row level security;
alter table plano_itens   enable row level security;

-- Dono total; o professor (admin) pode LER para o acompanhamento individual.
drop policy if exists "meta_dono"       on metas;
drop policy if exists "meta_admin_le"   on metas;
create policy "meta_dono" on metas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "meta_admin_le" on metas for select to authenticated using (is_admin());

drop policy if exists "plano_dono"      on planos_estudo;
drop policy if exists "plano_admin_le"  on planos_estudo;
create policy "plano_dono" on planos_estudo for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "plano_admin_le" on planos_estudo for select to authenticated using (is_admin());

drop policy if exists "plano_item_dono"     on plano_itens;
drop policy if exists "plano_item_admin_le" on plano_itens;
create policy "plano_item_dono" on plano_itens for all to authenticated
  using     (exists (select 1 from planos_estudo p where p.id = plano_id and p.usuario_id = auth.uid()))
  with check (exists (select 1 from planos_estudo p where p.id = plano_id and p.usuario_id = auth.uid()));
create policy "plano_item_admin_le" on plano_itens for select to authenticated using (is_admin());

-- ── Fase 2 · O professor lê respostas/revisões dos alunos (acompanhamento) ──
drop policy if exists "respostas_admin_le" on respostas;
create policy "respostas_admin_le" on respostas for select to authenticated using (is_admin());
drop policy if exists "revisoes_admin_le" on revisoes;
create policy "revisoes_admin_le" on revisoes for select to authenticated using (is_admin());
