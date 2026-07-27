-- Preferências de lembrete de meta POR ALUNO: recebe ou não, dias da semana em
-- que a meta vale e por quantas semanas fica ativa. Rodar no SQL Editor.
-- Requer emails_automaticos.sql e emails_auto_toggle.sql já rodados.

alter table metas add column if not exists lembrete_ativo boolean not null default true;
alter table metas add column if not exists dias_semana int[] not null default '{1,2,3,4,5}'; -- 0=dom..6=sáb
alter table metas add column if not exists semanas int not null default 0;   -- 0 = sem prazo
alter table metas add column if not exists inicio_meta date;                 -- início da contagem de semanas

-- Lembrete diário: flag global (emails_auto.lembrete) + preferências do aluno
create or replace function enfileirar_lembretes_metas()
returns int language plpgsql security definer set search_path = public as $$
declare
  tpl jsonb; cfg jsonb; hora_min int; n int := 0; r record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  dow  int  := extract(dow from (now() at time zone 'America/Sao_Paulo'))::int; -- 0=dom..6=sáb
  ass text; cor text;
begin
  select valor into cfg from config_app where chave = 'emails_auto';
  if cfg is not null and coalesce((cfg->>'lembrete')::boolean, true) = false then
    return 0;   -- lembrete global desativado
  end if;

  select coalesce((valor->>'hora')::int, 18) into hora_min
    from config_app where chave = 'lembrete_config';
  hora_min := coalesce(hora_min, 18);
  if extract(hour from now() at time zone 'America/Sao_Paulo') < hora_min then
    return 0;
  end if;

  select valor into tpl from config_app where chave = 'email_lembrete';
  if tpl is null then return 0; end if;

  for r in
    select p.nome, p.email,
           coalesce(m.meta_diaria, 20) as meta,
           coalesce(f.feitas, 0) as feitas
      from perfis p
      left join metas m on m.usuario_id = p.id
      left join lateral (
        select count(*)::int as feitas
          from respostas resp
         where resp.usuario_id = p.id
           and (resp.respondido_em at time zone 'America/Sao_Paulo')::date = hoje
      ) f on true
     where p.papel = 'aluno'
       and p.email is not null
       and coalesce(f.feitas, 0) < coalesce(m.meta_diaria, 20)
       -- preferências do aluno:
       and coalesce(m.lembrete_ativo, true) = true
       and dow = any (coalesce(m.dias_semana, '{1,2,3,4,5}'::int[]))
       and ( coalesce(m.semanas, 0) = 0
             or m.inicio_meta is null
             or hoje <= m.inicio_meta + (m.semanas * 7) )
       -- ativo/recente e sem lembrete hoje:
       and ( exists (select 1 from respostas r2
                      where r2.usuario_id = p.id
                        and r2.respondido_em > now() - interval '30 days')
             or p.criado_em > now() - interval '7 days' )
       and not exists (select 1 from emails_fila e
                        where e.para = p.email
                          and e.categoria = 'lembrete'
                          and (e.criado_em at time zone 'America/Sao_Paulo')::date = hoje)
  loop
    ass := aplicar_vars_email(tpl->>'assunto', r.nome);
    cor := aplicar_vars_email(tpl->>'corpo', r.nome);
    ass := replace(replace(replace(ass, '{meta}', r.meta::text), '{feitas}', r.feitas::text), '{restantes}', (r.meta - r.feitas)::text);
    cor := replace(replace(replace(cor, '{meta}', r.meta::text), '{feitas}', r.feitas::text), '{restantes}', (r.meta - r.feitas)::text);
    insert into emails_fila (para, assunto, corpo, categoria)
    values (r.email, ass, cor, 'lembrete');
    n := n + 1;
  end loop;
  return n;
end $$;
