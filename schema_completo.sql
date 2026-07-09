-- ============================================================
-- REPOSITÓRIO PEDAGÓGICO MUNICIPAL — Schema Completo
-- Atualizado com todas as alterações aplicadas durante o projeto
-- ============================================================

-- ── Extensões ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Disciplinas ──────────────────────────────────────────────
create table if not exists public.disciplinas (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  codigo      text,
  ativo       boolean default true,
  criado_em   timestamptz default now()
);

-- ── Habilidades (Matriz Curricular) ──────────────────────────
create table if not exists public.habilidades (
  id            uuid primary key default uuid_generate_v4(),
  disciplina_id uuid references public.disciplinas(id) on delete cascade,
  codigo        text not null,
  descricao     text not null,
  ano_escolar   text,
  ativo         boolean default true,
  criado_em     timestamptz default now()
);

-- ── Escolas ──────────────────────────────────────────────────
create table if not exists public.escolas (
  id        uuid primary key default uuid_generate_v4(),
  nome      text not null,
  codigo    text,
  regiao    text,
  ativo     boolean default true,
  criado_em timestamptz default now()
);

-- ── Perfis de usuário ────────────────────────────────────────
create table if not exists public.perfis (
  id               uuid primary key references auth.users(id) on delete cascade,
  nome             text not null,
  email            text,
  papel            text not null default 'professor'
                     check (papel in ('professor','formador','administrador')),
  escola_id        uuid references public.escolas(id),
  escola_nome      text,
  ativo            boolean default true,
  disciplinas_ids  uuid[] default '{}',
  avatar_url       text,
  criado_em        timestamptz default now(),
  atualizado_em    timestamptz default now()
);

create index if not exists idx_perfis_disciplinas on public.perfis using gin(disciplinas_ids);

-- ── Convites ─────────────────────────────────────────────────
create table if not exists public.convites (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null,
  nome        text,
  papel       text default 'professor',
  token       text unique not null,
  usado       boolean default false,
  criado_por  uuid references public.perfis(id),
  criado_em   timestamptz default now(),
  expira_em   timestamptz default (now() + interval '7 days')
);

-- ── Questões ─────────────────────────────────────────────────
create table if not exists public.questoes (
  id                 uuid primary key default uuid_generate_v4(),
  titulo             text not null,
  enunciado          text,
  tipo               text not null default 'multipla_escolha'
                       check (tipo in ('multipla_escolha','dissertativa')),
  disciplina_id      uuid references public.disciplinas(id),
  ano_escolar        text,
  nivel_dificuldade  int check (nivel_dificuldade between 1 and 5),
  fonte              text,
  status             text not null default 'rascunho'
                       check (status in ('rascunho','em_revisao','publicado','arquivado')),
  autor_id           uuid references public.perfis(id),
  criado_em          timestamptz default now(),
  atualizado_em      timestamptz default now()
);

-- ── Alternativas das questões ────────────────────────────────
create table if not exists public.questao_alternativas (
  id         uuid primary key default uuid_generate_v4(),
  questao_id uuid references public.questoes(id) on delete cascade,
  letra      text not null,
  texto      text,
  correta    boolean default false,
  ordem      int default 0
);

-- ── Gabaritos (dissertativas) ────────────────────────────────
create table if not exists public.questao_gabaritos (
  id         uuid primary key default uuid_generate_v4(),
  questao_id uuid references public.questoes(id) on delete cascade,
  texto      text,
  criterios  text
);

-- ── Habilidades vinculadas às questões ──────────────────────
create table if not exists public.questao_habilidades (
  questao_id    uuid references public.questoes(id) on delete cascade,
  habilidade_id uuid references public.habilidades(id) on delete cascade,
  primary key (questao_id, habilidade_id)
);

-- ── Versões de questões ──────────────────────────────────────
create table if not exists public.questao_versoes (
  id         uuid primary key default uuid_generate_v4(),
  questao_id uuid references public.questoes(id) on delete cascade,
  versao     int not null,
  dados      jsonb,
  autor_id   uuid references public.perfis(id),
  criado_em  timestamptz default now()
);

-- ── Aprovações de questões ───────────────────────────────────
create table if not exists public.aprovacoes (
  id              uuid primary key default uuid_generate_v4(),
  questao_id      uuid references public.questoes(id) on delete cascade,
  status_anterior text,
  status_novo     text,
  justificativa   text,
  autor_id        uuid references public.perfis(id),
  criado_em       timestamptz default now()
);

-- ── Avaliações de questões ───────────────────────────────────
create table if not exists public.avaliacoes (
  id         uuid primary key default uuid_generate_v4(),
  questao_id uuid references public.questoes(id) on delete cascade,
  nota       int check (nota between 1 and 5),
  autor_id   uuid references public.perfis(id),
  criado_em  timestamptz default now(),
  unique(questao_id, autor_id)
);

-- ── Favoritos ────────────────────────────────────────────────
create table if not exists public.favoritos (
  id         uuid primary key default uuid_generate_v4(),
  questao_id uuid references public.questoes(id) on delete cascade,
  usuario_id uuid references public.perfis(id) on delete cascade,
  criado_em  timestamptz default now(),
  unique(questao_id, usuario_id)
);

-- ── Provas ───────────────────────────────────────────────────
create table if not exists public.provas (
  id              uuid primary key default uuid_generate_v4(),
  titulo          text not null,
  descricao       text,
  disciplina_id   uuid references public.disciplinas(id),
  disciplinas_ids uuid[] default '{}',
  tipo_prova      text not null default 'disciplina'
                    check (tipo_prova in ('disciplina','simulado')),
  ano_escolar     text,
  instrucoes      text,
  cabecalho       text default '',
  cfg_impressao   jsonb default '{}',
  visibilidade    text not null default 'pessoal'
                    check (visibilidade in ('pessoal','rede')),
  status_revisao  text not null default 'rascunho'
                    check (status_revisao in ('rascunho','em_revisao','publicado')),
  autor_id        uuid references public.perfis(id),
  criado_em       timestamptz default now(),
  atualizado_em   timestamptz default now()
);

-- ── Questões de uma prova ────────────────────────────────────
create table if not exists public.prova_questoes (
  id         uuid primary key default uuid_generate_v4(),
  prova_id   uuid references public.provas(id) on delete cascade,
  questao_id uuid references public.questoes(id) on delete cascade,
  ordem      int default 0,
  pontuacao  numeric(5,2) default 1.0,
  unique(prova_id, questao_id)
);

-- ── Histórico de uso ─────────────────────────────────────────
create table if not exists public.historico_uso (
  id         uuid primary key default uuid_generate_v4(),
  questao_id uuid references public.questoes(id) on delete cascade,
  prova_id   uuid references public.provas(id) on delete set null,
  usuario_id uuid references public.perfis(id),
  tipo       text,
  observacao text,
  criado_em  timestamptz default now()
);

-- ── Planos de aula ───────────────────────────────────────────
create table if not exists public.planos_aula (
  id            uuid primary key default uuid_generate_v4(),
  titulo        text not null,
  descricao     text,
  disciplina_id uuid references public.disciplinas(id),
  ano_escolar   text,
  duracao_aulas int,
  objetivos     text,
  conteudo      text,
  metodologia   text,
  recursos      text,
  avaliacao     text,
  status        text default 'rascunho',
  autor_id      uuid references public.perfis(id),
  criado_em     timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ── Materiais pedagógicos ────────────────────────────────────
create table if not exists public.materiais (
  id            uuid primary key default uuid_generate_v4(),
  titulo        text not null,
  descricao     text,
  tipo          text,
  url           text,
  disciplina_id uuid references public.disciplinas(id),
  ano_escolar   text,
  tags          text[],
  autor_id      uuid references public.perfis(id),
  criado_em     timestamptz default now()
);

-- ── Coleções ─────────────────────────────────────────────────
create table if not exists public.colecoes (
  id         uuid primary key default uuid_generate_v4(),
  nome       text not null,
  descricao  text,
  publica    boolean default false,
  autor_id   uuid references public.perfis(id),
  criado_em  timestamptz default now()
);

create table if not exists public.colecao_questoes (
  colecao_id uuid references public.colecoes(id) on delete cascade,
  questao_id uuid references public.questoes(id) on delete cascade,
  ordem      int default 0,
  primary key (colecao_id, questao_id)
);

-- ── Notificações ─────────────────────────────────────────────
create table if not exists public.notificacoes (
  id         uuid primary key default uuid_generate_v4(),
  usuario_id uuid references public.perfis(id) on delete cascade,
  tipo       text,
  titulo     text,
  mensagem   text,
  lida       boolean default false,
  dados      jsonb default '{}',
  criado_em  timestamptz default now()
);

-- ============================================================
-- PERMISSÕES
-- ============================================================
grant usage on schema public to public;
grant select, insert, update, delete on all tables in schema public to public;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

alter table public.disciplinas          disable row level security;
alter table public.habilidades          disable row level security;
alter table public.escolas              disable row level security;
alter table public.perfis               disable row level security;
alter table public.convites             disable row level security;
alter table public.questoes             disable row level security;
alter table public.questao_alternativas disable row level security;
alter table public.questao_gabaritos    disable row level security;
alter table public.questao_habilidades  disable row level security;
alter table public.questao_versoes      disable row level security;
alter table public.aprovacoes           disable row level security;
alter table public.avaliacoes           disable row level security;
alter table public.favoritos            disable row level security;
alter table public.provas               disable row level security;
alter table public.prova_questoes       disable row level security;
alter table public.historico_uso        disable row level security;
alter table public.planos_aula          disable row level security;
alter table public.materiais            disable row level security;
alter table public.colecoes             disable row level security;
alter table public.colecao_questoes     disable row level security;
alter table public.notificacoes         disable row level security;

-- ============================================================
-- TRIGGER — criar perfil ao registrar usuário
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'papel', 'professor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- STORAGE — bucket midia
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'midia', 'midia', true, 5242880,
  array['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
)
on conflict (id) do update set public = true;

drop policy if exists "Upload autenticado" on storage.objects;
drop policy if exists "Leitura pública"    on storage.objects;
drop policy if exists "Deletar próprio"    on storage.objects;

create policy "Upload autenticado" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'midia');

create policy "Leitura pública" on storage.objects
  for select to public
  using (bucket_id = 'midia');

create policy "Deletar próprio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'midia');
