-- ============================================================================
-- Config do Mercado Pago editável pela própria página (admin).
-- Rodar no SQL Editor do Supabase (depois de venda_acesso.sql). Idempotente.
--
-- Segurança: o Access Token é SECRETO e NUNCA pode ir para o navegador.
--   • A tabela tem RLS habilitado e NENHUMA policy de leitura/escrita para
--     `authenticated` → o cliente não consegue ler o token direto.
--   • A gravação passa por `salvar_pagamento_config()` (SECURITY DEFINER, checa
--     is_admin()); o front só chama essa função, nunca escreve na tabela.
--   • A página lê o STATUS por `pagamento_config_status()`, que devolve o token
--     MASCARADO (só os 4 últimos dígitos) — o segredo não retorna ao navegador.
--   • As Edge Functions leem o token com service_role (ignora RLS).
-- ============================================================================

create table if not exists pagamento_config (
  id              int primary key default 1 check (id = 1),  -- linha única
  mp_access_token text,
  mp_public_key   text,        -- não é segredo (usada no checkout do cliente)
  site_url        text,        -- ex.: https://matheusprospero.com.br
  atualizado_em   timestamptz not null default now()
);
insert into pagamento_config (id) values (1) on conflict do nothing;

alter table pagamento_config enable row level security;
-- (intencional: sem policies para authenticated — só service_role e as funções abaixo)

-- Grava as credenciais (só admin). Campo em branco = mantém o valor atual.
create or replace function salvar_pagamento_config(p_token text, p_public_key text, p_site_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'não autorizado'; end if;
  update pagamento_config set
    mp_access_token = coalesce(nullif(p_token, ''),       mp_access_token),
    mp_public_key   = coalesce(nullif(p_public_key, ''),  mp_public_key),
    site_url        = coalesce(nullif(p_site_url, ''),    site_url),
    atualizado_em   = now()
  where id = 1;
end; $$;

-- Status para a página: token só MASCARADO (nunca o valor completo).
create or replace function pagamento_config_status()
returns table (configurado boolean, token_final text, mp_public_key text, site_url text, atualizado_em timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'não autorizado'; end if;
  return query
    select
      (c.mp_access_token is not null and length(c.mp_access_token) > 0),
      case when c.mp_access_token is not null and length(c.mp_access_token) >= 4
           then '••••' || right(c.mp_access_token, 4) end,
      c.mp_public_key, c.site_url, c.atualizado_em
    from pagamento_config c where c.id = 1;
end; $$;

revoke all on function salvar_pagamento_config(text, text, text) from public;
revoke all on function pagamento_config_status() from public;
grant execute on function salvar_pagamento_config(text, text, text) to authenticated;
grant execute on function pagamento_config_status() to authenticated;
