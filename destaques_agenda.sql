-- Agendamento dos destaques: quando entra no ar e quando sai.
-- Ambos opcionais (null = sem restrição). Rodar no SQL Editor do Supabase.

alter table destaques
  add column if not exists publicar_em timestamptz,  -- entra no ar a partir de (null = já)
  add column if not exists expira_em   timestamptz;  -- sai do ar em (null = nunca)
