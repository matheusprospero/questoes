-- ============================================================================
-- SIMULADOS PROPOSTOS — o professor "propõe" um simulado e TODOS os alunos
-- passam a vê-lo (e podem resolvê-lo online no modo estudo).
--
-- Rode este trecho UMA VEZ no Supabase → SQL Editor.
-- ============================================================================

-- 1. Coluna que marca o simulado como proposto para todos
alter table simulados add column if not exists proposto boolean not null default false;

-- 2. O dono de um registro é admin? (security definer para driblar o RLS de perfis)
create or replace function usuario_eh_admin(uid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from perfis where id = uid and papel = 'admin');
$$;

-- 3. Todos os usuários autenticados leem simulados propostos POR UM ADMIN
--    (aluno não consegue "publicar" simulado próprio para os outros)
drop policy if exists "leitura_propostos" on simulados;
create policy "leitura_propostos" on simulados for select to authenticated
  using (proposto = true and usuario_eh_admin(usuario_id));

drop policy if exists "leitura_itens_propostos" on simulado_questoes;
create policy "leitura_itens_propostos" on simulado_questoes for select to authenticated
  using (exists (
    select 1 from simulados s
    where s.id = simulado_id and s.proposto = true and usuario_eh_admin(s.usuario_id)
  ));
