-- ============================================================================
-- Venda de acesso (Mercado Pago): preços por turma/disciplina, planos
-- mensal/vitalício e liberação automática da matrícula via webhook.
-- Rodar no SQL Editor do Supabase (DEPOIS de turmas.sql e turmas_conteudo.sql).
-- Idempotente.
--
-- Modelo de venda:
--   • Turma "conteúdo completo"  → libera TODAS as disciplinas da turma.
--   • "Disciplina avulsa"        → libera só a(s) disciplina(s) escolhida(s).
--   • Plano vitalício  → matrícula sem vencimento (acesso_ate = null).
--   • Plano mensal     → matrícula com acesso_ate = agora + 1 mês (renova ao pagar de novo).
--
-- DECISÃO DE NEGÓCIO (importante):
--   O acesso ao conteúdo de turma passa a ser liberado SOMENTE pela matrícula
--   ativa e vigente — o booleano global `perfis.assinante` deixa de ser exigido
--   nas aulas. `assinante` continua valendo apenas para os vídeos de resolução
--   do banco de questões (produto à parte). Assim não se cobra duas vezes.
-- ============================================================================

-- ── 1. Preços ───────────────────────────────────────────────────────────────
-- Preço do "conteúdo completo" da turma (todas as disciplinas).
alter table turmas add column if not exists preco_mensal    numeric(10,2);
alter table turmas add column if not exists preco_vitalicio numeric(10,2);

-- Preço de cada disciplina avulsa dentro da turma.
alter table turma_disciplinas add column if not exists preco_mensal    numeric(10,2);
alter table turma_disciplinas add column if not exists preco_vitalicio numeric(10,2);

-- ── 2. Vencimento e origem da matrícula ─────────────────────────────────────
-- acesso_ate: null = vitalício; data = expira (plano mensal).
alter table matriculas add column if not exists acesso_ate timestamptz;
-- origem: como a matrícula foi criada (professor na mão × compra pelo site).
alter table matriculas add column if not exists origem text not null default 'professor'
  check (origem in ('professor', 'compra'));

-- ── 3. Funções de acesso passam a respeitar o vencimento ────────────────────
create or replace function matriculado_em(p_turma uuid, p_disc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from matriculas m
     where m.usuario_id = auth.uid()
       and m.turma_id = p_turma
       and m.status = 'ativa'
       and (m.acesso_ate is null or m.acesso_ate > now())
       and (p_disc is null or m.disciplina_id = p_disc)
  );
$$;

create or replace function pode_ver_aula(p_aula uuid, p_disc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin()
     or not exists (select 1 from turma_aulas where aula_id = p_aula)
     or exists (
          select 1 from turma_aulas ta
            join matriculas m on m.turma_id = ta.turma_id
                             and m.usuario_id = auth.uid()
                             and m.status = 'ativa'
                             and (m.acesso_ate is null or m.acesso_ate > now())
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
                             and (m.acesso_ate is null or m.acesso_ate > now())
           where ts.simulado_id = p_sim);
$$;

-- ── 4. Desacopla o conteúdo de turma do booleano `assinante` ────────────────
-- Aula/itens: visível se publicada e o aluno pode ver pela matrícula (ou é pública).
drop policy if exists "leitura_publicadas" on aulas;
create policy "leitura_publicadas" on aulas for select to authenticated
  using (publicada = true and pode_ver_aula(id, disciplina_id));

drop policy if exists "leitura_itens_publicadas" on aula_questoes;
create policy "leitura_itens_publicadas" on aula_questoes for select to authenticated
  using (exists (
    select 1 from aulas a
     where a.id = aula_id and a.publicada = true
       and pode_ver_aula(a.id, a.disciplina_id)));
-- (simulados propostos já dependem só de pode_ver_simulado — nada a mudar aqui)

-- ── 5. Registro de pagamentos (auditoria + idempotência do webhook) ─────────
create table if not exists pagamentos (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references auth.users(id) on delete cascade,
  turma_id          uuid references turmas(id) on delete set null,
  tipo              text not null check (tipo in ('completo', 'disciplina')),
  plano             text not null check (plano in ('mensal', 'vitalicio')),
  disciplina_ids    uuid[] not null default '{}',   -- vazio quando tipo = 'completo'
  valor             numeric(10,2),
  status            text not null default 'pendente',  -- espelha o status do MP (approved/pending/rejected...)
  mp_payment_id     text unique,                    -- id do pagamento no Mercado Pago (idempotência)
  mp_preference_id  text,
  criado_em         timestamptz not null default now(),
  processado_em     timestamptz
);
create index if not exists idx_pagamentos_usuario on pagamentos(usuario_id, criado_em desc);

alter table pagamentos enable row level security;
-- Aluno vê os próprios pagamentos; professor vê todos. Escrita é só via
-- service_role (Edge Function), que ignora RLS — por isso não há policy de insert.
drop policy if exists "pagamento_dono_le"  on pagamentos;
drop policy if exists "pagamento_admin_le" on pagamentos;
create policy "pagamento_dono_le"  on pagamentos for select to authenticated
  using (usuario_id = auth.uid());
create policy "pagamento_admin_le" on pagamentos for select to authenticated
  using (is_admin());
