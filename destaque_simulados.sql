-- Simulado em destaque: card de "propaganda" na página inicial dos alunos.
-- Só faz sentido junto com proposto = true (a policy de leitura já exige proposto).
-- Rodar no SQL Editor do Supabase.

alter table simulados
  add column if not exists destaque boolean not null default false;
