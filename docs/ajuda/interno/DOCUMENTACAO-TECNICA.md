# Banco de Questões — Documentação técnica

> Mapa de navegação. O [`CLAUDE.md`](../../../CLAUDE.md) da raiz é a fonte de verdade
> sobre caminhos e fluxo de atualização — ele tem precedência sobre este
> arquivo. O manual de uso está em
> [`MANUAL-DO-USUARIO.md`](../MANUAL-DO-USUARIO.md).

## 1. Stack

SPA em **React 18 + Vite + React Router 6**, com **React Query** para estado de
servidor, **CSS Modules**, `lucide-react` e `react-hot-toast`. Backend:
**Supabase** (PostgreSQL + Auth + Storage, bucket `midia`). Publicação:
**GitHub Pages** via `gh-pages`.

Autenticação por `AuthContext` → `useAuth()`: `usuario`, `perfil`, `isAdmin`,
`isAssinante`.

## 2. ⚠️ O fluxo de atualização, na ordem

Esta é a parte que mais custa quando se erra:

1. **Migrations de banco são MANUAIS.** Cada `*.sql` da raiz é rodado **pelo
   dono**, no SQL Editor do Supabase. Não há DDL pela API.
2. **Rode o SQL ANTES do deploy.** Publicar primeiro quebra as telas novas por
   falta de tabela ou coluna.
3. **`.env` precisa de `VITE_SUPABASE_ANON_KEY`**, além da URL. O Vite embute em
   tempo de build; faltando, o build sobe e o site abre **em branco** (o
   `supabase.js` lança). O `.env` é ignorado pelo Git e **já está completo na
   máquina do dono — não sobrescrever**.
4. **`npm run deploy` publica em PRODUÇÃO.** Só rodar com autorização explícita.
5. Depois do deploy, o navegador costuma segurar cache — peça o teste em **aba
   anônima** ou Ctrl+Shift+R antes de investigar "não mudou nada".

⚠️ **As Edge Functions não passam pelo `npm run deploy`.** Elas são implantadas
pela CLI do Supabase (`supabase/functions/README.md`). Front e função
desalinhados produzem erro de pagamento que não parece versão.

⚠️ **Questões e respostas vivem no Supabase, não no Git.** "Colocar na main" é
commit de código; dado não passa pelo Git.

## 3. Estrutura

```
src/
  router.jsx      todas as rotas, e onde somenteAdmin é exigido
  contexts/       AuthContext
  components/layout/  AppLayout (NAV_ITEMS + bloco "Gestão · Professor")
  services/       TODA chamada ao Supabase mora aqui
  pages/          uma pasta por módulo
*.sql             migrations, rodadas à mão (ver §2)
importador/       inserção de questões em massa
supabase/functions/  mp-criar-preferencia, mp-webhook
google-script/    enviar_emails.gs (cópia de referência)
```

**Regra de camada:** página não chama o banco direto — chama um serviço.

## 4. Os serviços, em uma linha cada

| Serviço | Responde por |
|---|---|
| `estudo.js` | o núcleo: registrar resposta (com tempo, dispara SRS), prontidão, marcos, meta do dia, maestria, evolução, ofensiva, recomendadas |
| `metas.js` | metas no banco + cache local; preferências de lembrete por aluno |
| `plano.js` | planos de estudo e itens (edital verticalizado) |
| `acompanhamento.js` | a visão do professor sobre cada aluno |
| `turmas.js` | turmas, disciplinas com preço, matrículas, vínculo N-N do conteúdo |
| `pagamentos.js` | compra, histórico, relatório de vendas, config do meio de pagamento |
| `comunicacao.js` | fila de e-mails, envio manual, chaves dos automáticos |
| `questoes.js` | listagem, facetas, favoritos, `liberada` e `revisada` |
| `simulados.js`, `cadernos.js`, `aulas.js`, `destaques.js`, `feedback.js` | o que o nome diz |

## 5. Regras de dados que não são óbvias

⚠️ **`liberada` e `revisada` são coisas diferentes.** `liberada` é o aluno ver;
`revisada` é a fila de conferência do professor. Questões autorais entram
`liberada = false`. Confundir as duas publica conteúdo não conferido.

⚠️ **`respostas` é append-only.** Refazer a questão cria registro novo; as
estatísticas contam os dois. Nada de `update` ali.

⚠️ **`origem` separa estudo de simulado.** Somar os dois infla a estatística
diária com o que foi resolvido em prova.

⚠️ **A prontidão é 45% acerto + 35% cobertura + 20% recência.** Mexer nos pesos
muda a nota de todo mundo, retroativamente — não é ajuste de tela.

⚠️ **A revisão espaçada é 1/3/7/15/30/60 dias.** A tabela `revisoes` é
alimentada pelo `registrarResposta`.

⚠️ **`v_estudo_dia` é `security_invoker`** — ela respeita o RLS de quem
consulta. Trocar para `definer` entregaria o estudo de um aluno a outro.

⚠️ **O professor lê os dados dos alunos por policies próprias** (`*_admin_le`)
em respostas, metas, planos e revisões. Não é `service_role` no front.

## 6. Venda de acesso

```
aluno clica comprar
   → pagamentos.js invoca a Edge Function mp-criar-preferencia
      → o PREÇO é calculado no SERVIDOR
      → devolve o checkout (cartão + PIX)
   → aluno paga
   → mp-webhook recebe a confirmação
      → ATIVA a matrícula, com período
```

⚠️ **O preço é sempre calculado no servidor.** Confiar no valor vindo do
navegador é o buraco clássico desse fluxo.

⚠️ **O token do meio de pagamento vive em `pagamento_config`**, lido pelas Edge
Functions com `service_role`, com reserva em variável de ambiente. Ao cliente
volta **só a versão mascarada** — as funções `salvar_pagamento_config` e
`pagamento_config_status` são `SECURITY DEFINER` restritas ao admin.

⚠️ **As `back_urls` saem da config `site_url` ou do header `Origin`.** Ambiente
novo sem isso devolve o aluno ao lugar errado depois de pagar.

**Matrícula:** `acesso_desde` / `acesso_ate` (null/null = vitalício),
`origem` (professor | compra), `motivo`, `pagamento_previsto`.

⚠️ **O período é verificado nas duas pontas:** `matriculado_em`,
`pode_ver_aula` e `pode_ver_simulado` exigem início ≤ agora **e** fim > agora.
Matrícula ativa fora do período não abre conteúdo — e é isso que explica a
maioria dos "a aula sumiu".

⚠️ **Conteúdo sem vínculo de turma é público** para quem tem conta. O vínculo é
N-N (`turma_aulas`, `turma_simulados`) e editável pelos dois lados.

⚠️ **Desde `venda_acesso.sql`, aula não exige mais `assinante`** — só matrícula
ativa. O booleano `assinante` ficou apenas para os vídeos de resolução do banco.

## 7. Ordem das migrations

A raiz guarda os `*.sql` incrementais; `schema_completo.sql` é a fonte de
verdade para instalar do zero.

A cadeia da venda de acesso **tem ordem obrigatória**:

```
turmas.sql → turmas_conteudo.sql → venda_acesso.sql
           → matricula_periodo.sql → matricula_manual.sql
pagamento_config.sql   (depois de venda_acesso.sql)
```

⚠️ **O SQL Editor do Supabase envolve o script inteiro numa transação.** Um erro
no meio desfaz tudo que veio antes e o painel mostra só a mensagem do erro —
parece que o resto passou. Ao falhar no meio, presuma que **nada** rodou.

## 8. E-mails

Fila em `emails_fila`; quem envia é o **Google Apps Script**
(`google-script/enviar_emails.gs`), com acionador de 10 minutos.

⚠️ **O `.gs` do repositório é cópia de referência.** O que roda está vinculado à
planilha do professor — mudanças precisam ser coladas lá **à mão**. Editar só o
repositório não muda nada no envio.

Automáticos: boas-vindas (trigger em `perfis`) e lembrete diário de meta (RPC
`enfileirar_lembretes_metas`, chamada pelo Apps Script). Chave global
`config_app.emails_auto` liga e desliga cada um; as funções conferem antes de
enfileirar.

⚠️ **O lembrete respeita a preferência do aluno** (`lembrete_ativo`,
`dias_semana`, `semanas`, `inicio_meta`), com dedup de 1 por dia e só para
alunos ativos nos últimos 30 dias. `semanas = 0` é **sem prazo**.

## 9. Economia de tokens e de tempo

Do [`CLAUDE.md`](../../../CLAUDE.md), e vale para pessoas também:

- **Confie no mapa do `CLAUDE.md`.** Não releia `schema_completo.sql` (623
  linhas) nem varra `src/` para achar onde algo mora.
- **Consultas ao banco:** use `python -c` importando `importador/importar.py`
  (`m.rest_get(tabela, query)` = PostgREST com `service_role`). Não monte
  cliente novo.
- **Questões em massa:** o pipeline está em
  `importador/conteudo/inserir_verificadas.py` (subagentes por assunto →
  verificação matemática → balanceamento de gabaritos A–E → inserir
  `liberada=false`).
- **Validação de build:** `npm run build | tail -3` basta (~7 s). Não suba o dev
  server para mudança não visual.

⚠️ **A `service_role` do importador fica em
`importador/conteudo/service_role.txt`, que é ignorado pelo Git.** Ela nunca
entra no front nem no repositório.

## 10. Convenções

- Textos e nomes de código **em pt-BR**.
- Enunciados e comentários de questões em **HTML**; frações como
  `<sup>x</sup>&frasl;<sub>y</sub>`.
- React Query com `invalidateQueries`; CSS Modules; variáveis `--bg-surface`,
  `--border-subtle`, `--text-primary/secondary/tertiary`, `--color-primary`,
  `--radius-lg`.

## 11. Roteiro de investigação

1. **Site em branco depois do deploy** → `VITE_SUPABASE_ANON_KEY` ausente no
   build (§2).
2. **"Não mudou nada"** → cache do navegador; peça aba anônima antes de
   investigar (§2).
3. **Tela nova quebrada em produção** → o SQL não foi rodado antes do deploy
   (§2).
4. **Aluno não vê a aula** → período da matrícula, ou vínculo da aula com a
   turma (§6).
5. **Pagamento confirmado e matrícula parada** → o webhook; confira a
   implantação da Edge Function (§2, §6).
6. **Questão autoral não aparece** → falta `liberada` (§5).
7. **E-mails pararam** → o Apps Script, não o site (§8).
8. **Estatística inflada** → `origem` misturando estudo e simulado (§5).
