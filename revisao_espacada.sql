-- Revisão espaçada (SRS): cada questão respondida volta em intervalos crescentes.
-- Rodar no SQL Editor do Supabase.

create table if not exists revisoes (
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id    uuid not null references questoes(id) on delete cascade,
  proxima_em    date not null,
  intervalo     int not null default 1,
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, questao_id)
);
create index if not exists idx_revisoes_prox on revisoes(usuario_id, proxima_em);

alter table revisoes enable row level security;
drop policy if exists "revisao_own" on revisoes;
create policy "revisao_own" on revisoes for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Agenda/atualiza a revisão da questão para o usuário atual.
-- Acerto → intervalo cresce (1,3,7,15,30,60); erro → volta para 1 dia.
create or replace function registrar_revisao(p_questao uuid, p_acertou boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_int int;
begin
  select intervalo into v_int from revisoes where usuario_id = auth.uid() and questao_id = p_questao;
  if p_acertou then
    v_int := case coalesce(v_int, 0)
      when 0 then 1 when 1 then 3 when 3 then 7 when 7 then 15 when 15 then 30 else 60 end;
  else
    v_int := 1;
  end if;
  insert into revisoes (usuario_id, questao_id, intervalo, proxima_em, atualizado_em)
  values (auth.uid(), p_questao, v_int, current_date + v_int, now())
  on conflict (usuario_id, questao_id)
  do update set intervalo = excluded.intervalo, proxima_em = excluded.proxima_em, atualizado_em = now();
end;
$$;
