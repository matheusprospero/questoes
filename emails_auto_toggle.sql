-- Liga/desliga os e-mails automáticos (boas-vindas e lembrete de meta) pela
-- interface, sem mexer no Apps Script. Flag em config_app (chave emails_auto).
-- Rodar no SQL Editor do Supabase. Requer emails_automaticos.sql já rodado.

insert into config_app (chave, valor)
values ('emails_auto', jsonb_build_object('boas_vindas', true, 'lembrete', true))
on conflict (chave) do nothing;

-- Boas-vindas respeita o flag emails_auto.boas_vindas
create or replace function enfileirar_boas_vindas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tpl jsonb; cfg jsonb;
begin
  if new.email is null or new.papel <> 'aluno' then return new; end if;
  select valor into cfg from config_app where chave = 'emails_auto';
  if cfg is not null and coalesce((cfg->>'boas_vindas')::boolean, true) = false then
    return new;   -- boas-vindas desativado
  end if;
  select valor into tpl from config_app where chave = 'email_boas_vindas';
  if tpl is null then return new; end if;
  insert into emails_fila (para, assunto, corpo, categoria)
  values (new.email,
          aplicar_vars_email(tpl->>'assunto', new.nome),
          aplicar_vars_email(tpl->>'corpo', new.nome),
          'boas_vindas');
  return new;
end $$;

-- Lembrete diário respeita o flag emails_auto.lembrete
create or replace function enfileirar_lembretes_metas()
returns int language plpgsql security definer set search_path = public as $$
declare
  tpl jsonb; cfg jsonb; hora_min int; n int := 0; r record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  ass text; cor text;
begin
  select valor into cfg from config_app where chave = 'emails_auto';
  if cfg is not null and coalesce((cfg->>'lembrete')::boolean, true) = false then
    return 0;   -- lembrete desativado
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
