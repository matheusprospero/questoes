-- ============================================================================
-- Período de acesso da matrícula: data de INÍCIO + data de FIM.
-- Rodar no SQL Editor do Supabase (depois de venda_acesso.sql). Idempotente.
--
-- • acesso_ate   (já existia): fim do acesso. null = sem fim (vitalício).
-- • acesso_desde (novo):       início do acesso. null = vale desde já.
-- Um aluno vê o conteúdo quando: matrícula 'ativa' E (sem início ou início já
-- passou) E (sem fim ou fim ainda não passou). Isso permite agendar o começo e
-- controlar o vencimento dos planos mensais.
-- ============================================================================

alter table matriculas add column if not exists acesso_desde timestamptz;

-- Funções de acesso passam a respeitar início E fim.
create or replace function matriculado_em(p_turma uuid, p_disc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from matriculas m
     where m.usuario_id = auth.uid()
       and m.turma_id = p_turma
       and m.status = 'ativa'
       and (m.acesso_desde is null or m.acesso_desde <= now())
       and (m.acesso_ate   is null or m.acesso_ate   >  now())
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
                             and (m.acesso_desde is null or m.acesso_desde <= now())
                             and (m.acesso_ate   is null or m.acesso_ate   >  now())
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
                             and (m.acesso_desde is null or m.acesso_desde <= now())
                             and (m.acesso_ate   is null or m.acesso_ate   >  now())
           where ts.simulado_id = p_sim);
$$;
