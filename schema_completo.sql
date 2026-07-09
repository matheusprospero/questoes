-- ============================================================================
-- BANCO DE QUESTÕES DE CONCURSOS PÚBLICOS — Schema completo (Supabase)
-- Uso pessoal (usuário único). RLS libera tudo para usuário autenticado.
--
-- COMO USAR:
--   1. Crie um projeto novo no Supabase
--   2. Abra SQL Editor → New query
--   3. Cole este arquivo inteiro e clique em RUN
--   4. Em Authentication → Users, crie seu usuário (e-mail + senha)
-- ============================================================================

-- O script pode ser re-executado do zero: remove tudo antes de recriar
drop table if exists respostas          cascade;
drop table if exists favoritos          cascade;
drop table if exists simulado_questoes  cascade;
drop table if exists simulados          cascade;
drop table if exists caderno_questoes   cascade;
drop table if exists cadernos           cascade;
drop table if exists questao_alternativas cascade;
drop table if exists questoes           cascade;
drop table if exists assuntos           cascade;
drop table if exists bancas             cascade;
drop table if exists orgaos             cascade;
drop table if exists disciplinas        cascade;

-- ============================================================================
-- TABELAS DE CLASSIFICAÇÃO
-- ============================================================================

create table disciplinas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  cor       text not null default '#6366f1',
  ordem     int  not null default 0,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Assuntos (tópicos) de cada disciplina — substituem as habilidades BNCC
create table assuntos (
  id            uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references disciplinas(id) on delete cascade,
  nome          text not null,
  ordem         int  not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  unique (disciplina_id, nome)
);

create table bancas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  criado_em timestamptz not null default now()
);

create table orgaos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  criado_em timestamptz not null default now()
);

-- ============================================================================
-- QUESTÕES
-- ============================================================================

create table questoes (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null default 'multipla_escolha'
                 check (tipo in ('multipla_escolha', 'certo_errado')),
  enunciado      text not null,           -- HTML do editor rico
  comentario     text,                    -- justificativa/comentário do gabarito (HTML)
  disciplina_id  uuid references disciplinas(id) on delete set null,
  assunto_id     uuid references assuntos(id)    on delete set null,
  banca_id       uuid references bancas(id)      on delete set null,
  orgao_id       uuid references orgaos(id)      on delete set null,
  ano            int check (ano between 1990 and 2100),
  cargo          text,
  nivel          text check (nivel in ('fundamental', 'medio', 'superior')),
  dificuldade    int not null default 3 check (dificuldade between 1 and 5),
  gabarito_certo boolean,                 -- só para certo_errado: true = Certo, false = Errado
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index idx_questoes_disciplina on questoes(disciplina_id);
create index idx_questoes_assunto    on questoes(assunto_id);
create index idx_questoes_banca      on questoes(banca_id);
create index idx_questoes_ano        on questoes(ano);

-- Alternativas (apenas para tipo multipla_escolha)
create table questao_alternativas (
  id         uuid primary key default gen_random_uuid(),
  questao_id uuid not null references questoes(id) on delete cascade,
  letra      text not null,
  texto      text not null,               -- HTML
  correta    boolean not null default false,
  ordem      int not null default 0
);

create index idx_alternativas_questao on questao_alternativas(questao_id);

-- Mantém atualizado_em em dia
create or replace function set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger trg_questoes_atualizado
  before update on questoes
  for each row execute function set_atualizado_em();

-- ============================================================================
-- CADERNOS (agrupamentos de questões para estudo)
-- ============================================================================

create table cadernos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  descricao text,
  criado_em timestamptz not null default now()
);

create table caderno_questoes (
  caderno_id uuid not null references cadernos(id) on delete cascade,
  questao_id uuid not null references questoes(id) on delete cascade,
  ordem      int not null default 0,
  primary key (caderno_id, questao_id)
);

-- ============================================================================
-- SIMULADOS (com exportação para Word/impressão)
-- ============================================================================

create table simulados (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  descricao     text,
  instrucoes    text,
  cabecalho     text,                       -- HTML do cabeçalho de impressão
  cfg_impressao jsonb not null default '{}',
  criado_em     timestamptz not null default now()
);

create table simulado_questoes (
  simulado_id uuid not null references simulados(id) on delete cascade,
  questao_id  uuid not null references questoes(id)  on delete cascade,
  ordem       int not null default 0,
  primary key (simulado_id, questao_id)
);

-- ============================================================================
-- FAVORITOS
-- ============================================================================

create table favoritos (
  id         uuid primary key default gen_random_uuid(),
  questao_id uuid not null references questoes(id) on delete cascade unique,
  criado_em  timestamptz not null default now()
);

-- ============================================================================
-- RESPOSTAS (módulo de resolução/estudo)
-- ============================================================================

create table respostas (
  id            uuid primary key default gen_random_uuid(),
  questao_id    uuid not null references questoes(id) on delete cascade,
  resposta      text not null,             -- letra (A-E) ou 'C'/'E' no certo_errado
  acertou       boolean not null,
  origem        text not null default 'estudo' check (origem in ('estudo', 'simulado')),
  respondido_em timestamptz not null default now()
);

create index idx_respostas_questao on respostas(questao_id);
create index idx_respostas_data    on respostas(respondido_em);

-- ============================================================================
-- RLS — acesso total para usuário autenticado (uso pessoal, usuário único)
-- ============================================================================

alter table disciplinas          enable row level security;
alter table assuntos             enable row level security;
alter table bancas               enable row level security;
alter table orgaos               enable row level security;
alter table questoes             enable row level security;
alter table questao_alternativas enable row level security;
alter table cadernos             enable row level security;
alter table caderno_questoes     enable row level security;
alter table simulados            enable row level security;
alter table simulado_questoes    enable row level security;
alter table favoritos            enable row level security;
alter table respostas            enable row level security;

create policy "autenticado_total" on disciplinas          for all to authenticated using (true) with check (true);
create policy "autenticado_total" on assuntos             for all to authenticated using (true) with check (true);
create policy "autenticado_total" on bancas               for all to authenticated using (true) with check (true);
create policy "autenticado_total" on orgaos               for all to authenticated using (true) with check (true);
create policy "autenticado_total" on questoes             for all to authenticated using (true) with check (true);
create policy "autenticado_total" on questao_alternativas for all to authenticated using (true) with check (true);
create policy "autenticado_total" on cadernos             for all to authenticated using (true) with check (true);
create policy "autenticado_total" on caderno_questoes     for all to authenticated using (true) with check (true);
create policy "autenticado_total" on simulados            for all to authenticated using (true) with check (true);
create policy "autenticado_total" on simulado_questoes    for all to authenticated using (true) with check (true);
create policy "autenticado_total" on favoritos            for all to authenticated using (true) with check (true);
create policy "autenticado_total" on respostas            for all to authenticated using (true) with check (true);

-- ============================================================================
-- STORAGE — bucket "midia" para imagens do editor (enunciados/alternativas)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('midia', 'midia', true)
on conflict (id) do nothing;

drop policy if exists "midia_leitura_publica" on storage.objects;
drop policy if exists "midia_escrita_autenticado" on storage.objects;
drop policy if exists "midia_update_autenticado" on storage.objects;
drop policy if exists "midia_delete_autenticado" on storage.objects;

create policy "midia_leitura_publica" on storage.objects
  for select using (bucket_id = 'midia');
create policy "midia_escrita_autenticado" on storage.objects
  for insert to authenticated with check (bucket_id = 'midia');
create policy "midia_update_autenticado" on storage.objects
  for update to authenticated using (bucket_id = 'midia');
create policy "midia_delete_autenticado" on storage.objects
  for delete to authenticated using (bucket_id = 'midia');

-- ============================================================================
-- SEEDS — disciplinas e bancas comuns em concursos (edite à vontade)
-- ============================================================================

insert into disciplinas (nome, cor, ordem) values
  ('Língua Portuguesa',            '#ef4444', 1),
  ('Raciocínio Lógico-Matemático', '#f59e0b', 2),
  ('Matemática',                   '#eab308', 3),
  ('Informática',                  '#06b6d4', 4),
  ('Direito Constitucional',       '#3b82f6', 5),
  ('Direito Administrativo',       '#6366f1', 6),
  ('Direito Penal',                '#8b5cf6', 7),
  ('Direito Processual Penal',     '#a855f7', 8),
  ('Direito Civil',                '#ec4899', 9),
  ('Direito Processual Civil',     '#f43f5e', 10),
  ('Administração Pública',        '#10b981', 11),
  ('Administração Financeira e Orçamentária', '#14b8a6', 12),
  ('Contabilidade',                '#22c55e', 13),
  ('Ética no Serviço Público',     '#84cc16', 14),
  ('Atualidades',                  '#f97316', 15),
  ('Legislação Específica',        '#64748b', 16);

insert into bancas (nome) values
  ('Cebraspe'),
  ('FGV'),
  ('FCC'),
  ('Vunesp'),
  ('Cesgranrio'),
  ('IBFC'),
  ('AOCP'),
  ('Quadrix'),
  ('IDECAN'),
  ('Instituto Consulplan'),
  ('IADES'),
  ('FUNDATEC');
