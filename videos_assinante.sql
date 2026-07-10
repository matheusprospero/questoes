-- Camada de assinante + proteção da URL do vídeo de resolução.
-- A URL sai de "questoes" (lida por todos) para uma tabela protegida por RLS:
-- só admin ou assinante conseguem buscá-la. Rodar no SQL Editor do Supabase.

-- 1) Flag de assinante no perfil (o professor libera manual, como o acesso)
alter table perfis add column if not exists assinante boolean not null default false;

-- 2) A URL do vídeo vai para uma tabela própria
create table if not exists questao_videos (
  questao_id uuid primary key references questoes(id) on delete cascade,
  video_url  text not null
);

-- flag "tem vídeo" fica em questoes (visível a todos) só para o teaser "apenas assinantes"
alter table questoes add column if not exists tem_video boolean not null default false;

-- migra o que já existir e remove a coluna antiga exposta
insert into questao_videos (questao_id, video_url)
  select id, video_url from questoes where video_url is not null
  on conflict (questao_id) do nothing;
update questoes set tem_video = true where video_url is not null;
alter table questoes drop column if exists video_url;

-- 3) Quem pode LER a URL: admin ou assinante
create or replace function eh_assinante(uid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from perfis where id = uid and (assinante = true or papel = 'admin'));
$$;

alter table questao_videos enable row level security;

drop policy if exists "video_admin_all" on questao_videos;
create policy "video_admin_all" on questao_videos for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "video_leitura_assinante" on questao_videos;
create policy "video_leitura_assinante" on questao_videos for select to authenticated
  using (eh_assinante(auth.uid()));
