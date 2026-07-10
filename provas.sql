-- Repositório de PDFs das provas originais (banca + gabarito)
-- Rodar no Supabase → SQL Editor. Requer que exista a função usuario_eh_admin(uid)
-- (criada em destaques.sql / aulas.sql). Os PDFs ficam no bucket privado "provas"
-- (já criado); só admin lê. Cada questão pode apontar para sua prova de origem.

create table if not exists public.provas (
  id           uuid primary key default gen_random_uuid(),
  orgao        text,
  ano          integer,
  cargo        text,
  banca        text default 'Vunesp',
  arquivo      text not null,   -- caminho no bucket, ex.: provas/sorocaba_diretor_de_escola.pdf
  gabarito     text,            -- caminho do PDF de gabarito (opcional)
  observacoes  text,
  criado_em    timestamptz default now()
);

-- Vínculo opcional da questão com a prova de origem
alter table public.questoes add column if not exists prova_id uuid references public.provas(id);

-- RLS: só admin enxerga/gerencia o repositório de provas
alter table public.provas enable row level security;

drop policy if exists provas_admin_total on public.provas;
create policy provas_admin_total on public.provas
  for all using (usuario_eh_admin(auth.uid())) with check (usuario_eh_admin(auth.uid()));

-- Storage: o bucket "provas" é privado. Política para admin ler/gerenciar os objetos.
drop policy if exists "provas_admin_objects" on storage.objects;
create policy "provas_admin_objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'provas' and usuario_eh_admin(auth.uid()))
  with check (bucket_id = 'provas' and usuario_eh_admin(auth.uid()));
