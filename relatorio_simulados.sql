-- Relatório de simulados: liga cada resposta ao simulado de origem e
-- permite ao professor (dono do simulado) ler as respostas dos alunos.
-- Rodar no SQL Editor do Supabase.

-- 1) De qual simulado veio a resposta (null = estudo avulso)
alter table respostas
  add column if not exists simulado_id uuid references simulados(id) on delete set null;

create index if not exists idx_respostas_simulado on respostas(simulado_id);

-- 2) O professor lê TODAS as respostas ligadas aos simulados que ele criou
--    (soma-se à policy "dono_total": o aluno continua lendo só as próprias).
drop policy if exists "prof_le_respostas_simulado" on respostas;
create policy "prof_le_respostas_simulado" on respostas for select to authenticated
  using (
    simulado_id is not null and exists (
      select 1 from simulados s
      where s.id = respostas.simulado_id and s.usuario_id = auth.uid()
    )
  );
