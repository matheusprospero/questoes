-- Fila de e-mails para envio via Google Apps Script (acionador a cada 10 min).
-- Rodar no SQL Editor do Supabase ANTES do deploy.
--
-- Fluxo: ao marcar um report como resolvido, o app insere uma linha aqui
-- (status 'pendente'). O Apps Script (rodando na conta Google do professor)
-- busca os pendentes pela API REST usando a service_role, envia pelo Gmail
-- e marca como 'enviado' (ou 'erro').

create table if not exists emails_fila (
  id         uuid primary key default gen_random_uuid(),
  para       text not null,
  assunto    text not null,
  corpo      text not null,
  status     text not null default 'pendente' check (status in ('pendente','enviado','erro')),
  erro       text,
  report_id  uuid references questao_reports(id) on delete set null,
  criado_em  timestamptz not null default now(),
  enviado_em timestamptz
);

create index if not exists idx_emails_fila_status on emails_fila(status);

alter table emails_fila enable row level security;

-- Só o admin (professor) enxerga e enfileira pelo app.
-- O Apps Script usa a service_role, que ignora RLS.
drop policy if exists "emails_admin_total" on emails_fila;
create policy "emails_admin_total" on emails_fila
  for all to authenticated using (is_admin()) with check (is_admin());
