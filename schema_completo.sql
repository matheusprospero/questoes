-- ============================================================================
-- BANCO DE QUESTÕES DE CONCURSOS — Schema completo (Supabase)
--
-- Modelo multiusuário para venda de acesso:
--   • ADMIN (você): cria e edita questões, disciplinas, bancas etc.
--   • ALUNO: lê o banco, resolve questões e tem cadernos/simulados/
--     favoritos/respostas PRÓPRIOS (isolados por RLS).
--
-- COMO USAR:
--   1. Crie um projeto novo no Supabase
--   2. Abra SQL Editor → New query, cole este arquivo inteiro e clique RUN
--   3. Em Authentication → Users → Add user, crie o SEU usuário
--   4. Rode no SQL Editor (com seu e-mail) para virar admin:
--        update perfis set papel = 'admin'
--        where id = (select id from auth.users where email = 'SEU@EMAIL.com');
--   5. Para cada aluno que pagar: Authentication → Users → Add user.
--      Para cortar o acesso: delete (ou banir) o usuário no mesmo painel.
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
drop table if exists perfis             cascade;
drop function if exists is_admin();
drop function if exists handle_new_user() cascade;

-- ============================================================================
-- PERFIS — papel de cada usuário (admin = professor, aluno = pagante)
-- ============================================================================

create table perfis (
  id        uuid primary key references auth.users(id) on delete cascade,
  nome      text,
  email     text,
  papel     text not null default 'aluno' check (papel in ('admin', 'aluno')),
  assinante boolean not null default false,   -- acesso aos vídeos de resolução
  criado_em timestamptz not null default now()
);

-- Cria o perfil automaticamente quando um usuário é criado (painel ou login Google)
create function handle_new_user()
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- security definer: evita recursão de RLS ao usar dentro de policies
create function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin');
$$;

-- ============================================================================
-- TABELAS DE CLASSIFICAÇÃO (conteúdo gerido pelo admin)
-- ============================================================================

create table disciplinas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  cor       text not null default '#6366f1',
  ordem     int  not null default 0,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Assuntos (tópicos) de cada disciplina
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
-- QUESTÕES (conteúdo gerido pelo admin)
-- ============================================================================

create table questoes (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null default 'multipla_escolha'
                 check (tipo in ('multipla_escolha', 'certo_errado')),
  enunciado      text not null,           -- HTML do editor rico
  comentario     text,                    -- justificativa/comentário do gabarito (HTML)
  tem_video      boolean not null default false, -- há resolução em vídeo (URL fica em questao_videos)
  disciplina_id  uuid references disciplinas(id) on delete set null,
  assunto_id     uuid references assuntos(id)    on delete set null,
  banca_id       uuid references bancas(id)      on delete set null,
  orgao_id       uuid references orgaos(id)      on delete set null,
  ano            int check (ano between 1990 and 2100),
  cargo          text,
  nivel          text check (nivel in ('fundamental', 'medio', 'superior')),
  dificuldade    int not null default 3 check (dificuldade between 1 and 5),
  gabarito_certo boolean,                 -- só para certo_errado: true = Certo, false = Errado
  revisada       boolean not null default false, -- conferida pelo admin (ex.: revisão das imagens)
  liberada       boolean not null default true,   -- visível para alunos (autorais nascem false até o admin liberar)
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index idx_questoes_disciplina on questoes(disciplina_id);
create index idx_questoes_assunto    on questoes(assunto_id);
create index idx_questoes_banca      on questoes(banca_id);
create index idx_questoes_ano        on questoes(ano);
create index idx_questoes_liberada   on questoes(liberada);

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

-- URL do vídeo de resolução (protegida: só admin/assinante lê — ver RLS)
create table questao_videos (
  questao_id uuid primary key references questoes(id) on delete cascade,
  video_url  text not null
);

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
-- DADOS POR USUÁRIO (cada aluno tem os seus, isolados por RLS)
-- usuario_id preenche sozinho com o usuário logado (default auth.uid())
-- ============================================================================

create table cadernos (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null,
  descricao  text,
  criado_em  timestamptz not null default now()
);

create index idx_cadernos_usuario on cadernos(usuario_id);

create table caderno_questoes (
  caderno_id uuid not null references cadernos(id) on delete cascade,
  questao_id uuid not null references questoes(id) on delete cascade,
  ordem      int not null default 0,
  primary key (caderno_id, questao_id)
);

create table simulados (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo        text not null,
  descricao     text,
  instrucoes    text,
  cabecalho     text,                       -- HTML do cabeçalho de impressão
  cfg_impressao jsonb not null default '{}',
  proposto      boolean not null default false, -- proposto pelo professor a todos
  destaque      boolean not null default false, -- card de destaque/propaganda na página inicial
  criado_em     timestamptz not null default now()
);

create index idx_simulados_usuario on simulados(usuario_id);

create table simulado_questoes (
  simulado_id uuid not null references simulados(id) on delete cascade,
  questao_id  uuid not null references questoes(id)  on delete cascade,
  ordem       int not null default 0,
  primary key (simulado_id, questao_id)
);

-- Aulas: teoria (blocos de texto/vídeo) + questões do mesmo tema
create table aulas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo        text not null,
  descricao     text,
  disciplina_id uuid references disciplinas(id) on delete set null,
  assunto_id    uuid references assuntos(id)    on delete set null,
  conteudo      jsonb not null default '[]',   -- blocos: [{tipo:'texto',html} | {tipo:'video',url,titulo}]
  publicada     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_aulas_usuario    on aulas(usuario_id);
create index idx_aulas_disciplina on aulas(disciplina_id);
create index idx_aulas_assunto    on aulas(assunto_id);

create table aula_questoes (
  aula_id    uuid not null references aulas(id)    on delete cascade,
  questao_id uuid not null references questoes(id) on delete cascade,
  ordem      int not null default 0,
  primary key (aula_id, questao_id)
);

-- Destaques: cards de "propaganda" da página inicial (livre / simulado / aula)
create table destaques (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo       text not null default 'livre' check (tipo in ('livre', 'simulado', 'aula')),
  ref_id     uuid,
  etiqueta   text,
  titulo     text not null,
  texto      text,
  cta_texto  text,
  link       text,
  ativo      boolean not null default true,
  publicar_em timestamptz,             -- entra no ar a partir de (null = já)
  expira_em   timestamptz,             -- sai do ar em (null = nunca)
  ordem      int not null default 0,
  criado_em  timestamptz not null default now()
);

create index idx_destaques_ativo on destaques(ativo, ordem);

create table favoritos (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id uuid not null references questoes(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  unique (usuario_id, questao_id)
);

create table respostas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id    uuid not null references questoes(id) on delete cascade,
  resposta      text not null,             -- letra (A-E) ou 'C'/'E' no certo_errado
  acertou       boolean not null,
  origem        text not null default 'estudo' check (origem in ('estudo', 'simulado')),
  simulado_id   uuid references simulados(id) on delete set null, -- de qual simulado veio (relatório)
  respondido_em timestamptz not null default now()
);

create index idx_respostas_usuario  on respostas(usuario_id);
create index idx_respostas_questao  on respostas(questao_id);
create index idx_respostas_data     on respostas(respondido_em);
create index idx_respostas_simulado on respostas(simulado_id);

-- ============================================================================
-- RLS
-- ============================================================================

alter table perfis               enable row level security;
alter table disciplinas          enable row level security;
alter table assuntos             enable row level security;
alter table bancas               enable row level security;
alter table orgaos               enable row level security;
alter table questoes             enable row level security;
alter table questao_alternativas enable row level security;
alter table questao_videos       enable row level security;
alter table cadernos             enable row level security;
alter table caderno_questoes     enable row level security;
alter table simulados            enable row level security;
alter table simulado_questoes    enable row level security;
alter table aulas                enable row level security;
alter table aula_questoes        enable row level security;
alter table destaques            enable row level security;
alter table favoritos            enable row level security;
alter table respostas            enable row level security;

-- Perfis: cada um lê o próprio; admin lê todos; só admin altera papel
create policy "perfil_proprio_select" on perfis for select to authenticated
  using (id = auth.uid() or is_admin());
create policy "perfil_proprio_update" on perfis for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (
    -- aluno pode editar o próprio nome, mas não se promover
    is_admin() or (id = auth.uid() and papel = 'aluno')
  );

-- Conteúdo (questões e classificação): todos leem, só admin escreve
create policy "conteudo_select" on disciplinas          for select to authenticated using (true);
create policy "conteudo_select" on assuntos             for select to authenticated using (true);
create policy "conteudo_select" on bancas               for select to authenticated using (true);
create policy "conteudo_select" on orgaos               for select to authenticated using (true);
create policy "conteudo_select" on questoes             for select to authenticated using (liberada or is_admin());
create policy "conteudo_select" on questao_alternativas for select to authenticated using (true);

-- Vídeo de resolução: admin gerencia; só admin/assinante lê a URL
create or replace function eh_assinante(uid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from perfis where id = uid and (assinante = true or papel = 'admin'));
$$;
create policy "video_admin_all" on questao_videos for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "video_leitura_assinante" on questao_videos for select to authenticated
  using (eh_assinante(auth.uid()));

create policy "conteudo_admin_insert" on disciplinas          for insert to authenticated with check (is_admin());
create policy "conteudo_admin_insert" on assuntos             for insert to authenticated with check (is_admin());
create policy "conteudo_admin_insert" on bancas               for insert to authenticated with check (is_admin());
create policy "conteudo_admin_insert" on orgaos               for insert to authenticated with check (is_admin());
create policy "conteudo_admin_insert" on questoes             for insert to authenticated with check (is_admin());
create policy "conteudo_admin_insert" on questao_alternativas for insert to authenticated with check (is_admin());

create policy "conteudo_admin_update" on disciplinas          for update to authenticated using (is_admin());
create policy "conteudo_admin_update" on assuntos             for update to authenticated using (is_admin());
create policy "conteudo_admin_update" on bancas               for update to authenticated using (is_admin());
create policy "conteudo_admin_update" on orgaos               for update to authenticated using (is_admin());
create policy "conteudo_admin_update" on questoes             for update to authenticated using (is_admin());
create policy "conteudo_admin_update" on questao_alternativas for update to authenticated using (is_admin());

create policy "conteudo_admin_delete" on disciplinas          for delete to authenticated using (is_admin());
create policy "conteudo_admin_delete" on assuntos             for delete to authenticated using (is_admin());
create policy "conteudo_admin_delete" on bancas               for delete to authenticated using (is_admin());
create policy "conteudo_admin_delete" on orgaos               for delete to authenticated using (is_admin());
create policy "conteudo_admin_delete" on questoes             for delete to authenticated using (is_admin());
create policy "conteudo_admin_delete" on questao_alternativas for delete to authenticated using (is_admin());

-- Dados por usuário: cada um só enxerga e mexe nos próprios
create policy "dono_total" on cadernos  for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "dono_total" on simulados for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "dono_total" on favoritos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "dono_total" on respostas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Professor lê as respostas dos simulados que ele criou (para o relatório)
create policy "prof_le_respostas_simulado" on respostas for select to authenticated
  using (
    simulado_id is not null and exists (
      select 1 from simulados s
      where s.id = respostas.simulado_id and s.usuario_id = auth.uid()
    )
  );

-- Itens de caderno/simulado: acesso via dono do pai
create policy "dono_via_caderno" on caderno_questoes for all to authenticated
  using (exists (select 1 from cadernos c where c.id = caderno_id and c.usuario_id = auth.uid()))
  with check (exists (select 1 from cadernos c where c.id = caderno_id and c.usuario_id = auth.uid()));

create policy "dono_via_simulado" on simulado_questoes for all to authenticated
  using (exists (select 1 from simulados s where s.id = simulado_id and s.usuario_id = auth.uid()))
  with check (exists (select 1 from simulados s where s.id = simulado_id and s.usuario_id = auth.uid()));

-- Simulados propostos: o professor propõe e todos leem (só leitura)
create or replace function usuario_eh_admin(uid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from perfis where id = uid and papel = 'admin');
$$;

create policy "leitura_propostos" on simulados for select to authenticated
  using (proposto = true and usuario_eh_admin(usuario_id));

create policy "leitura_itens_propostos" on simulado_questoes for select to authenticated
  using (exists (
    select 1 from simulados s
    where s.id = simulado_id and s.proposto = true and usuario_eh_admin(s.usuario_id)
  ));

-- Aulas: o professor gerencia as suas; alunos leem as publicadas
create policy "dono_total" on aulas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "leitura_publicadas" on aulas for select to authenticated
  using (publicada = true and eh_assinante(auth.uid()));

create policy "dono_via_aula" on aula_questoes for all to authenticated
  using (exists (select 1 from aulas a where a.id = aula_id and a.usuario_id = auth.uid()))
  with check (exists (select 1 from aulas a where a.id = aula_id and a.usuario_id = auth.uid()));
create policy "leitura_itens_publicadas" on aula_questoes for select to authenticated
  using (exists (
    select 1 from aulas a
    where a.id = aula_id and a.publicada = true and eh_assinante(auth.uid())
  ));

-- Destaques: professor gerencia os seus; alunos leem os ativos
create policy "dono_total" on destaques for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "leitura_ativos" on destaques for select to authenticated
  using (ativo = true and usuario_eh_admin(usuario_id));

-- ============================================================================
-- FEEDBACK DOS ALUNOS — reports, comentários, avaliações (estrelas/dificuldade)
-- ============================================================================
create table questao_reports (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id uuid not null references questoes(id) on delete cascade,
  tipo text not null check (tipo in ('gabarito','sem_resposta','enunciado','outro')),
  descricao text, resolvido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index idx_reports_questao on questao_reports(questao_id);

create table questao_comentarios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id uuid not null references questoes(id) on delete cascade,
  autor_nome text, texto text not null,
  criado_em timestamptz not null default now()
);
create index idx_coment_questao on questao_comentarios(questao_id);

create table questao_avaliacoes (
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id uuid not null references questoes(id) on delete cascade,
  estrelas smallint check (estrelas between 1 and 5),
  dificuldade smallint check (dificuldade between 1 and 5),
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, questao_id)
);
create index idx_aval_questao on questao_avaliacoes(questao_id);

create table aula_avaliacoes (
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  aula_id uuid not null references aulas(id) on delete cascade,
  estrelas smallint check (estrelas between 1 and 5),
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, aula_id)
);

alter table questao_reports     enable row level security;
alter table questao_comentarios enable row level security;
alter table questao_avaliacoes  enable row level security;
alter table aula_avaliacoes     enable row level security;

create policy "report_insert" on questao_reports for insert to authenticated with check (usuario_id = auth.uid());
create policy "report_select" on questao_reports for select to authenticated using (usuario_id = auth.uid() or is_admin());
create policy "report_update" on questao_reports for update to authenticated using (is_admin());
create policy "report_delete" on questao_reports for delete to authenticated using (usuario_id = auth.uid() or is_admin());

create policy "coment_select" on questao_comentarios for select to authenticated using (true);
create policy "coment_insert" on questao_comentarios for insert to authenticated with check (usuario_id = auth.uid());
create policy "coment_delete" on questao_comentarios for delete to authenticated using (usuario_id = auth.uid() or is_admin());

create policy "aval_select" on questao_avaliacoes for select to authenticated using (true);
create policy "aval_own" on questao_avaliacoes for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "aval_aula_select" on aula_avaliacoes for select to authenticated using (true);
create policy "aval_aula_own" on aula_avaliacoes for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ============================================================================
-- STORAGE — bucket "midia" para imagens do editor (só admin envia)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('midia', 'midia', true)
on conflict (id) do nothing;

drop policy if exists "midia_leitura_publica" on storage.objects;
drop policy if exists "midia_escrita_autenticado" on storage.objects;
drop policy if exists "midia_update_autenticado" on storage.objects;
drop policy if exists "midia_delete_autenticado" on storage.objects;
drop policy if exists "midia_escrita_admin" on storage.objects;
drop policy if exists "midia_update_admin" on storage.objects;
drop policy if exists "midia_delete_admin" on storage.objects;

create policy "midia_leitura_publica" on storage.objects
  for select using (bucket_id = 'midia');
create policy "midia_escrita_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'midia' and is_admin());
create policy "midia_update_admin" on storage.objects
  for update to authenticated using (bucket_id = 'midia' and is_admin());
create policy "midia_delete_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'midia' and is_admin());

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
