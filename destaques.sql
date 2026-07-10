-- Destaques: cards de "propaganda" da página inicial, gerenciáveis pelo professor.
-- Cada card pode ser livre, ou apontar para um simulado / aula existente.
-- Rodar no SQL Editor do Supabase.

create table if not exists destaques (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo       text not null default 'livre' check (tipo in ('livre', 'simulado', 'aula')),
  ref_id     uuid,                     -- simulado/aula alvo (null quando 'livre')
  etiqueta   text,                     -- tag do card (ex: "Desafio do professor")
  titulo     text not null,
  texto      text,                     -- chamada/pitch
  cta_texto  text,                     -- rótulo do botão
  link       text,                     -- destino quando 'livre' (rota interna ou URL)
  ativo      boolean not null default true,
  ordem      int not null default 0,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_destaques_ativo on destaques(ativo, ordem);

alter table destaques enable row level security;

-- O professor gerencia os seus destaques
drop policy if exists "dono_total" on destaques;
create policy "dono_total" on destaques for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Alunos leem os destaques ativos (só os de admin)
drop policy if exists "leitura_ativos" on destaques;
create policy "leitura_ativos" on destaques for select to authenticated
  using (ativo = true and usuario_eh_admin(usuario_id));
