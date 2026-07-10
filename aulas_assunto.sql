-- Assunto na aula (além da disciplina) — para vincular a mais questões do mesmo assunto.
-- Rodar no SQL Editor do Supabase.

alter table aulas
  add column if not exists assunto_id uuid references assuntos(id) on delete set null;

create index if not exists idx_aulas_assunto on aulas(assunto_id);
