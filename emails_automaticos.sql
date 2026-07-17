-- E-mails automáticos: boas-vindas (ao criar aluno) e lembrete diário de meta.
-- Usa a mesma fila (emails_fila) + Apps Script. Rodar no SQL Editor ANTES do deploy.
-- Requer: emails_fila.sql e config_app.sql já rodados.

-- Categoria para controle/dedup (report, boas_vindas, lembrete)
alter table emails_fila add column if not exists categoria text;

-- ── Modelos padrão (editáveis depois na tela Reportados → Personalizar e-mail) ──
insert into config_app (chave, valor) values
  ('email_boas_vindas', jsonb_build_object(
    'assunto', 'Bem-vindo(a), {nome}! Seus estudos começam agora 🚀',
    'corpo', E'Olá {nome}!\n\nSua conta na plataforma do Prof. Matheus Próspero está pronta. Por aqui você encontra:\n\n• Banco de questões de concursos com correção na hora;\n• Meta do dia personalizada — defina a sua na página Início;\n• Plano de Estudos para organizar o edital;\n• Estatísticas e boletim para acompanhar sua evolução.\n\nComece definindo sua meta diária e resolvendo as primeiras questões ainda hoje!\n\nBons estudos!\nProf. Matheus Próspero\nhttps://matheusprospero.com.br')),
  ('email_lembrete', jsonb_build_object(
    'assunto', 'Sua meta de hoje ainda não fechou, {nome} 🎯',
    'corpo', E'Olá {nome}!\n\nPassando para lembrar da sua meta de hoje: você já resolveu {feitas} de {meta} questões — faltam {restantes}.\n\nQue tal fechar agora? Entre na plataforma e toque em "Começar meta do dia":\nhttps://matheusprospero.com.br\n\nConstância vence talento. Até já!\nProf. Matheus Próspero')),
  ('lembrete_config', jsonb_build_object('hora', 18))
on conflict (chave) do nothing;

-- Substitui as variáveis comuns de um modelo
create or replace function aplicar_vars_email(t text, p_nome text)
returns text language sql immutable as $$
  select replace(replace(coalesce(t,''),
    '{nome_completo}', coalesce(nullif(p_nome,''), 'aluno(a)')),
    '{nome}', coalesce(nullif(split_part(coalesce(p_nome,''),' ',1),''), 'aluno(a)'))
$$;

-- ── Boas-vindas: dispara quando um perfil de aluno com e-mail é criado ──
create or replace function enfileirar_boas_vindas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tpl jsonb;
begin
  if new.email is null or new.papel <> 'aluno' then return new; end if;
  select valor into tpl from config_app where chave = 'email_boas_vindas';
  if tpl is null then return new; end if;   -- sem modelo, não envia
  insert into emails_fila (para, assunto, corpo, categoria)
  values (new.email,
          aplicar_vars_email(tpl->>'assunto', new.nome),
          aplicar_vars_email(tpl->>'corpo', new.nome),
          'boas_vindas');
  return new;
end $$;

drop trigger if exists trg_perfis_boas_vindas on perfis;
create trigger trg_perfis_boas_vindas after insert on perfis
  for each row execute function enfileirar_boas_vindas();

-- ── Lembrete diário de meta ──
-- Chamada pelo Apps Script a cada ciclo; só age a partir da hora configurada
-- (config lembrete_config.hora, padrão 18h de São Paulo) e no máximo 1x/dia
-- por aluno. Lembra quem ainda não bateu a meta diária e está ativo
-- (respostas nos últimos 30 dias) ou é recém-chegado (conta criada há < 7 dias).
create or replace function enfileirar_lembretes_metas()
returns int language plpgsql security definer set search_path = public as $$
declare
  tpl jsonb; hora_min int; n int := 0; r record;
  agora_sp timestamptz := now();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  ass text; cor text;
begin
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

-- Só o Apps Script (service_role) pode disparar os lembretes
revoke execute on function enfileirar_lembretes_metas() from public, anon, authenticated;
grant execute on function enfileirar_lembretes_metas() to service_role;
