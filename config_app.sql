-- Configurações do app editáveis pela interface (sem mexer em código).
-- Primeira utilização: modelo do e-mail de aviso de questão corrigida
-- (chave 'email_report'), editado na tela Reportados → Personalizar e-mail.
-- Rodar no SQL Editor do Supabase ANTES do deploy.

create table if not exists config_app (
  chave         text primary key,
  valor         jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table config_app enable row level security;

drop policy if exists "config_admin_total" on config_app;
create policy "config_admin_total" on config_app
  for all to authenticated using (is_admin()) with check (is_admin());
