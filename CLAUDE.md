# CLAUDE.md — mapa do projeto (para agilizar e economizar tokens)

Banco de questões de concursos (venda de acesso). O **professor/admin** cria questões e
acompanha alunos; o **aluno** resolve questões, monta plano/cadernos/simulados e vê estatísticas.
Tudo isolado por RLS. Frontend em GitHub Pages, dados no Supabase.

## Comandos
- `npm run dev` — servidor local (porta 5173). Nunca rodar via Bash; use o preview.
- `npm run build` — valida a compilação (Vite).
- `npm run deploy` — `vite build && gh-pages -d dist`. **Publica em produção** (matheusprospero.com.br). Só rodar com autorização explícita do usuário.

## ⚠️ Fluxo de atualização (ler antes de mexer)
1. **Migrations de banco são MANUAIS**: cada `*.sql` da raiz é rodado pelo usuário no Supabase → SQL Editor. Eu não consigo rodar DDL pela API (service_role não faz DDL). Sempre entregar o SQL e pedir para rodar.
2. **Rodar o SQL ANTES do `npm run deploy`** — senão as telas novas quebram por falta de tabela/coluna.
3. **`.env` precisa de `VITE_SUPABASE_ANON_KEY`** (além da URL). O Vite embute em build time; se faltar, o build sobe com **tela em branco** (supabase.js dá throw). O `.env` é gitignored e **já está completo nesta máquina — não sobrescrever**.
3b. Após deploy, o navegador do usuário costuma segurar cache — pedir teste em **aba anônima**/Ctrl+Shift+R antes de investigar "não mudou nada".
4. **Questões e respostas vivem no Supabase, não no git.** "Colocar na main" = commit de código; dados não passam pelo git.
5. **Deploy usa gh-pages** (push no branch gh-pages do repo `matheusprospero/questoes`) — precisa de conta com acesso de escrita.
6. Para inserir questões em massa: `importador/importar.py` (por prova) ou os scripts em `importador/conteudo/` (autorais). service_role em `importador/conteudo/service_role.txt` (gitignored).

## Stack
React 18 + Vite + React Router 6 + React Query (@tanstack) + CSS Modules + lucide-react + react-hot-toast.
Backend: Supabase (Postgres + Auth + Storage bucket `midia`). Auth via `AuthContext` (`useAuth`: `usuario`, `perfil`, `isAdmin`, `isAssinante`).

## Modelo de dados (Postgres) — ver `schema_completo.sql`
Conteúdo (admin escreve, todos leem): `disciplinas`, `assuntos`, `bancas`, `orgaos`, `questoes`, `questao_alternativas`, `questao_videos` (URL só admin/assinante).
- `questoes.liberada` (bool): aluno só vê `liberada or is_admin()`. Autorais entram `false` até o admin liberar. `questoes.revisada`: fila de conferência do admin (≠ liberada).
- Questões autorais: banca **"Prof. Matheus Próspero"** (~713, geradas por IA e verificadas). `questoes.codigo` (ex.: `TJSP-2010-MAT-32`) ordena a lista do banco (natural sort em Questoes.jsx).
Por usuário (isolado por RLS `usuario_id = auth.uid()`): `respostas` (append-only, `acertou`, `origem` estudo/simulado, `respondido_em`, `tempo_seg`), `revisoes` (SRS 1/3/7/15/30/60), `cadernos`/`caderno_questoes`, `simulados`/`simulado_questoes`, `favoritos`, `metas`, `planos_estudo`/`plano_itens`.
- Professor (admin) LÊ respostas/metas/planos/revisoes dos alunos (policies `*_admin_le`) para o acompanhamento.
- View `v_estudo_dia` (security_invoker): agregação por dia (heatmap, dia/semana/mês).
- Turmas: `turmas`, `turma_disciplinas`, `matriculas` (ativa/pendente/recusada, uma por aluno×turma×disciplina). Conteúdo é **N-N**: `turma_aulas`/`turma_simulados` (aula/simulado pode estar em várias turmas). Conteúdo sem vínculo = público. RLS de leitura via `pode_ver_aula(aula, disc)` e `pode_ver_simulado(sim)` (admin, ou sem turma, ou matriculado ativo em turma que contém o conteúdo respeitando a disciplina da aula). `matriculado_em(turma, disc)` gate as próprias tabelas. Rodar `turmas.sql` **e depois** `turmas_conteudo.sql` (este migra a coluna antiga `turma_id` para as tabelas N-N).
Helpers RLS: `is_admin()`, `eh_assinante()`.

## Rotas / páginas (`src/router.jsx`, `src/pages/`)
Aluno: `/` Início · `/plano` PlanoEstudos · `/turmas` MinhasTurmas (menu "Cursos": seções "Meus cursos" comprados + "Disponíveis"; compra/solicita matrícula) · `/turmas/:id` TurmaDetalhe (entra na turma: aulas+simulados dela + barra de progresso do aluno) · `/aulas` · `/estudo` Estudo (resolver) · `/calendario` heatmap · `/estatisticas` · `/boletim` (PDF via print) · `/questoes` banco · `/favoritos` · `/cadernos` · `/simulados` · `/perfil`.
Admin (`RotaProtegida somenteAdmin`): `/acompanhamento` (por aluno) · `/matriculas` CentralMatriculas (turmas + matrículas + preços de venda, service `turmas.js`) · `/pagamentos` PagamentosConfig (credenciais Mercado Pago editáveis na página, service `pagamentos.js`) · `/vendas` Vendas (relatório de vendas: resumo/receita, gráfico por mês, filtros, CSV — `listarVendas` em `pagamentos.js`) · `/comunicacao` (histórico de e-mails + envio manual, service `comunicacao.js`) · `/questoes/nova|:id/editar` · `/revisao` · `/simulados/:id/relatorio` · `/aulas/nova|editar` · `/alunos` · `/destaques` · `/reports` · `/engajamento`.
Menu em `src/components/layout/AppLayout.jsx` (NAV_ITEMS + bloco admin "Gestão").

## Serviços (`src/services/`)
- `estudo.js` — núcleo: registrarResposta (com tempo_seg + dispara SRS), listarRespostas(usuarioId?), estudoPorDia, somarPeriodo, calcularProntidao (45% acerto/35% cobertura/20% recência), calcularMarcos, montarMetaDoDia, e análises (maestriaPorAssunto, evolucaoMensal, agruparDesempenho, calcularOfensiva, montarRecomendadas...).
- `metas.js` — lerMetas/salvarMetas (banco) + cache localStorage `config-meta` (o código síncrono lê do cache). lerMetasDe(id) para o professor.
- `plano.js` — CRUD planos_estudo + plano_itens (edital verticalizado).
- `acompanhamento.js` — listarAlunosComResumo, resumoAluno(id) (admin).
- `turmas.js` — CRUD turmas/turma_disciplinas, matrículas (admin: matricular/decidir; aluno: solicitar/cancelar), vínculo N-N do conteúdo (setTurmasDaAula/DoSimulado, turmasDaAula/DoSimulado), buscarTurmaComConteudo(id), progressoTurma(id) (questões respondidas ÷ total do conteúdo da turma), contarSolicitacoesPendentes.
- `comunicacao.js` — histórico da fila (listarEmails), listarAlunosComEmail, enviarEmailManual (categoria `manual`). Feedback/e-mails de report ficam em `feedback.js` (enfileirarEmailReport, lerModeloEmail/salvarModeloEmail, MODELOS_EMAIL: report/boas_vindas/lembrete).
- `pagamentos.js` — venda de acesso via Mercado Pago. `comprar({turmaId,tipo,plano,disciplinaIds})` invoca a Edge Function `mp-criar-preferencia` e redireciona pro checkout (cartão+PIX); `meusPagamentos()` histórico. tipo: completo|disciplina; plano: mensal|vitalicio. Liberação automática pelo webhook (ativa matrícula). Preço é sempre calculado no servidor. Backend em `supabase/functions/` (ver README lá).
- `questoes.js` — listagem/facetas/favoritos + marcarLiberada/marcarRevisada.
- `simulados.js` (relatorioSimulado), `cadernos.js`, `aulas.js`, `destaques.js`, `feedback.js`.
- PDF do simulado: `SimuladoDetalhe.jsx → buildHtml()` monta HTML e chama window.print. `cfg_impressao` (jsonb): tamanhoFonte, separadorQuestoes, quebrarPagina, rodapes, **questoesPorFolha** (0=todas/1/2/3 → classe `.folha` flex 276mm, quebra por página) e **espacoResolucao** (área "Resolução" que preenche o restante da folha, dividida igualmente — uso: gravação de aulas). Config no SimuladoForm.jsx.

## Migrations SQL (raiz) — rodar no Supabase SQL Editor
`schema_completo.sql` (do zero, fonte de verdade) · e incrementais já consolidadas nele: `liberada.sql`, `revisada.sql`, `revisao_espacada.sql`, `relatorio_simulados.sql`, `feedback.sql`, `plano_estudos.sql` (acompanhamento de estudos), `codigo_area.sql`, `simulados_propostos.sql`, `destaque_simulados.sql`, `destaques_agenda.sql`, `login_google.sql`, `aulas*.sql`, `emails_fila.sql` (fila de e-mails; envio via `google-script/enviar_emails.gs` no Apps Script do professor, acionador de 10 min — Reportados enfileira em "Resolver + avisar") · `config_app.sql` (config chave/valor; modelos de e-mail editáveis em Reportados → Personalizar e-mails) · `emails_automaticos.sql` (boas-vindas via trigger em perfis + lembrete diário de meta via RPC `enfileirar_lembretes_metas`, chamada pelo Apps Script; hora em config `lembrete_config`, dedup 1x/dia por aluno, só alunos ativos <30d) · `turmas.sql` (turmas + matrículas) · `turmas_conteudo.sql` (conteúdo N-N `turma_aulas`/`turma_simulados` + funções `pode_ver_aula`/`pode_ver_simulado`; rodar DEPOIS de turmas.sql) · `venda_acesso.sql` (venda de acesso Mercado Pago — preços em `turmas` (completo) e `turma_disciplinas` (avulsa), `matriculas.acesso_ate` (null=vitalício / data=mensal) + `.origem`, tabela `pagamentos`; **desacopla o conteúdo de turma do booleano `assinante`** — aulas passam a exigir só matrícula ativa, `assinante` fica só p/ vídeos do banco; rodar DEPOIS de turmas_conteudo.sql) · `matricula_periodo.sql` (`matriculas.acesso_desde` início do acesso — funções `matriculado_em`/`pode_ver_aula`/`pode_ver_simulado` passam a exigir início≤now E fim>now; admin edita início/fim na Central de Matrículas; rodar DEPOIS de venda_acesso.sql) · `matricula_manual.sql` (`matriculas.motivo` + `.pagamento_previsto` — matrícula manual do professor com motivo fora do padrão e data de pagamento prevista; `matricular(...,extras)` e `atualizarMatricula(id,patch)` em turmas.js; rodar DEPOIS de matricula_periodo.sql). Backend do pagamento (Edge Functions Deno) em `supabase/functions/` — deploy/secrets no `supabase/functions/README.md` (NÃO passam pelo `npm run deploy`; são implantadas via Supabase CLI) · `pagamento_config.sql` (credenciais MP editáveis na página `/pagamentos`: tabela `pagamento_config` com RLS fechado, funções `salvar_pagamento_config`/`pagamento_config_status` SECURITY DEFINER admin — token só mascarado volta ao cliente; Edge Functions leem via service_role, fallback p/ env; rodar DEPOIS de venda_acesso.sql).
- O Apps Script de produção vive vinculado à planilha https://docs.google.com/spreadsheets/d/1QJ40pa27u93z3DTsixztXwafxbK3X3-_ggiBqezTo_4/edit (Extensões → Apps Script); o `.gs` do repo é cópia de referência — mudanças precisam ser coladas lá manualmente.

## Economia de tokens (para o Claude)
- Confie neste mapa: NÃO releia `schema_completo.sql` (623 linhas) nem explore `src/` para achar onde algo mora — os caminhos estão acima. Leia só o trecho do arquivo-alvo (offset/limit).
- Consultas ao banco: use `python -c` importando `importador/importar.py` (`m.rest_get(tabela, query)` = PostgREST com service_role). Não montar clientes novos.
- Geração de questões em massa: pipeline pronto descrito em `importador/conteudo/inserir_verificadas.py` (subagentes por assunto → verificação matemática → balancear gabaritos A–E → inserir `liberada=false`).
- Build ~7s: `npm run build | tail -3` basta como validação; não subir dev server para mudanças não visuais.

## Convenções
- Textos e nomes de código em pt-BR. Enunciados/comentários de questões em HTML; frações como `<sup>x</sup>&frasl;<sub>y</sub>`.
- Páginas: React Query (useQuery/useMutation com invalidateQueries), CSS Modules, variáveis `--bg-surface`, `--border-subtle`, `--text-primary/secondary/tertiary`, `--color-primary`, `--radius-lg`.
- Commits direto na `main` (workflow do dono). Terminar mensagem de commit com o Co-Authored-By do Claude.
