-- ============================================================================
-- LOGIN COM GOOGLE — guardar o e-mail do usuário no perfil (para contato)
--
-- Rode este trecho UMA VEZ no Supabase → SQL Editor. Ele:
--   1. adiciona a coluna "email" na tabela perfis;
--   2. faz o cadastro automático (trigger) gravar nome real e e-mail vindos do Google;
--   3. preenche o e-mail dos perfis que já existem.
--
-- (Para ATIVAR o provedor Google em si, siga as instruções que o Claude passou:
--  Google Cloud Console + Supabase → Authentication → Providers → Google.)
-- ============================================================================

alter table perfis add column if not exists email text;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'nome',
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

update perfis p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');
