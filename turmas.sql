-- ============================================================================
-- Turmas + Central de Matrículas
-- Rodar no SQL Editor do Supabase ANTES do deploy.
--
-- Regras de negócio:
--   • Turma agrupa conteúdo (aulas e simulados propostos) e tem 1+ disciplinas.
--   • Matrícula = aluno × turma × disciplina, com status:
--       'ativa'    → acesso liberado (criada pelo professor, ou aprovada);
--       'pendente' → solicitação do aluno aguardando o professor;
--       'recusada' → negada pelo professor.
--   • Aula com turma_id só aparece para matriculados ATIVOS na turma
--     (na disciplina da aula, se ela tiver disciplina). Simulado proposto com
--     turma_id idem (qualquer disciplina da turma).
--   • Conteúdo SEM turma continua público (nada muda no que já existe).
--   • Banco de questões continua aberto a todos os alunos.
-- ============================================================================

create table if not exists turmas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  descricao  text,
  ativa      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table if not exists turma_disciplinas (
  turma_id      uuid not null references turmas(id) on delete cascade,
  disciplina_id uuid not null references disciplinas(id) on delete cascade,
  primary key (turma_id, disciplina_id)
);

create table if not exists matriculas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  turma_id      uuid not null references turmas(id) on delete cascade,
  disciplina_id uuid not null references disciplinas(id) on delete cascade,
  status        text not null default 'pendente' check (status in ('ativa','pendente','recusada')),
  criado_em     timestamptz not null default now(),
  decidido_em   timestamptz,
  unique (usuario_id, turma_id, disciplina_id)
);
create index if not exists idx_matriculas_usuario on matriculas(usuario_id, status);
create index if not exists idx_matriculas_turma   on matriculas(turma_id, status);

-- Vínculo do conteúdo com a turma (null = público, comportamento atual)
alter table aulas     add column if not exists turma_id uuid references turmas(id) on delete set null;
alter table simulados add column if not exists turma_id uuid references turmas(id) on delete set null;

-- O aluno está matriculado (ativo) na turma? p_disc null = qualquer disciplina.
create or replace function matriculado_em(p_turma uuid, p_disc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from matriculas m
     where m.usuario_id = auth.uid()
       and m.turma_id = p_turma
       and m.status = 'ativa'
       and (p_disc is null or m.disciplina_id = p_disc)
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table turmas            enable row level security;
alter table turma_disciplinas enable row level security;
alter table matriculas        enable row level security;

drop policy if exists "turmas_leitura"      on turmas;
drop policy if exists "turmas_admin_total"  on turmas;
create policy "turmas_leitura" on turmas for select to authenticated
  using (ativa or is_admin());
create policy "turmas_admin_total" on turmas for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "turma_disc_leitura"     on turma_disciplinas;
drop policy if exists "turma_disc_admin_total" on turma_disciplinas;
create policy "turma_disc_leitura" on turma_disciplinas for select to authenticated using (true);
create policy "turma_disc_admin_total" on turma_disciplinas for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "matricula_dono_le"          on matriculas;
drop policy if exists "matricula_solicita"          on matriculas;
drop policy if exists "matricula_cancela_pendente"  on matriculas;
drop policy if exists "matricula_admin_total"       on matriculas;
-- aluno vê as próprias matrículas
create policy "matricula_dono_le" on matriculas for select to authenticated
  using (usuario_id = auth.uid());
-- aluno SOLICITA (nasce pendente, só para si, em turma ativa com a disciplina ofertada)
create policy "matricula_solicita" on matriculas for insert to authenticated
  with check (
    usuario_id = auth.uid() and status = 'pendente'
    and exists (select 1 from turmas t where t.id = turma_id and t.ativa)
    and exists (select 1 from turma_disciplinas td
                 where td.turma_id = matriculas.turma_id
                   and td.disciplina_id = matriculas.disciplina_id)
  );
-- aluno pode desistir de uma solicitação ainda pendente
create policy "matricula_cancela_pendente" on matriculas for delete to authenticated
  using (usuario_id = auth.uid() and status = 'pendente');
-- professor faz tudo (matricula direto com status ativa, aprova, recusa, remove)
create policy "matricula_admin_total" on matriculas for all to authenticated
  using (is_admin()) with check (is_admin());

-- ── Portões de conteúdo (recria as policies de leitura) ────────────────────
-- Aulas: publicada + assinante + (sem turma OU matriculado na turma/disciplina)
drop policy if exists "leitura_publicadas" on aulas;
create policy "leitura_publicadas" on aulas for select to authenticated
  using (
    publicada = true and eh_assinante(auth.uid())
    and (turma_id is null or matriculado_em(turma_id, disciplina_id))
  );

drop policy if exists "leitura_itens_publicadas" on aula_questoes;
create policy "leitura_itens_publicadas" on aula_questoes for select to authenticated
  using (exists (
    select 1 from aulas a
     where a.id = aula_id and a.publicada = true and eh_assinante(auth.uid())
       and (a.turma_id is null or matriculado_em(a.turma_id, a.disciplina_id))
  ));

-- Simulados propostos: + (sem turma OU matriculado em qualquer disciplina da turma)
drop policy if exists "leitura_propostos" on simulados;
create policy "leitura_propostos" on simulados for select to authenticated
  using (
    proposto = true and usuario_eh_admin(usuario_id)
    and (turma_id is null or matriculado_em(turma_id, null))
  );

drop policy if exists "leitura_itens_propostos" on simulado_questoes;
create policy "leitura_itens_propostos" on simulado_questoes for select to authenticated
  using (exists (
    select 1 from simulados s
     where s.id = simulado_id and s.proposto = true and usuario_eh_admin(s.usuario_id)
       and (s.turma_id is null or matriculado_em(s.turma_id, null))
  ));
