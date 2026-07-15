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
3. **`.env` precisa de `VITE_SUPABASE_ANON_KEY`** (além da URL). O Vite embute em build time; se faltar, o build sobe com **tela em branco** (supabase.js dá throw). O `.env` é gitignored.
4. **Questões e respostas vivem no Supabase, não no git.** "Colocar na main" = commit de código; dados não passam pelo git.
5. **Deploy usa gh-pages** (push no branch gh-pages do repo `matheusprospero/questoes`) — precisa de conta com acesso de escrita.
6. Para inserir questões em massa: `importador/importar.py` (por prova) ou os scripts em `importador/conteudo/` (autorais). service_role em `importador/conteudo/service_role.txt` (gitignored).

## Stack
React 18 + Vite + React Router 6 + React Query (@tanstack) + CSS Modules + lucide-react + react-hot-toast.
Backend: Supabase (Postgres + Auth + Storage bucket `midia`). Auth via `AuthContext` (`useAuth`: `usuario`, `perfil`, `isAdmin`, `isAssinante`).

## Modelo de dados (Postgres) — ver `schema_completo.sql`
Conteúdo (admin escreve, todos leem): `disciplinas`, `assuntos`, `bancas`, `orgaos`, `questoes`, `questao_alternativas`, `questao_videos` (URL só admin/assinante).
- `questoes.liberada` (bool): aluno só vê `liberada or is_admin()`. Autorais entram `false` até o admin liberar. `questoes.revisada`: fila de conferência do admin (≠ liberada).
Por usuário (isolado por RLS `usuario_id = auth.uid()`): `respostas` (append-only, `acertou`, `origem` estudo/simulado, `respondido_em`, `tempo_seg`), `revisoes` (SRS 1/3/7/15/30/60), `cadernos`/`caderno_questoes`, `simulados`/`simulado_questoes`, `favoritos`, `metas`, `planos_estudo`/`plano_itens`.
- Professor (admin) LÊ respostas/metas/planos/revisoes dos alunos (policies `*_admin_le`) para o acompanhamento.
- View `v_estudo_dia` (security_invoker): agregação por dia (heatmap, dia/semana/mês).
Helpers RLS: `is_admin()`, `eh_assinante()`.

## Rotas / páginas (`src/router.jsx`, `src/pages/`)
Aluno: `/` Início · `/plano` PlanoEstudos · `/aulas` · `/estudo` Estudo (resolver) · `/calendario` heatmap · `/estatisticas` · `/boletim` (PDF via print) · `/questoes` banco · `/favoritos` · `/cadernos` · `/simulados` · `/perfil`.
Admin (`RotaProtegida somenteAdmin`): `/acompanhamento` (por aluno) · `/questoes/nova|:id/editar` · `/revisao` · `/simulados/:id/relatorio` · `/aulas/nova|editar` · `/alunos` · `/destaques` · `/reports` · `/engajamento`.
Menu em `src/components/layout/AppLayout.jsx` (NAV_ITEMS + bloco admin "Gestão").

## Serviços (`src/services/`)
- `estudo.js` — núcleo: registrarResposta (com tempo_seg + dispara SRS), listarRespostas(usuarioId?), estudoPorDia, somarPeriodo, calcularProntidao (45% acerto/35% cobertura/20% recência), calcularMarcos, montarMetaDoDia, e análises (maestriaPorAssunto, evolucaoMensal, agruparDesempenho, calcularOfensiva, montarRecomendadas...).
- `metas.js` — lerMetas/salvarMetas (banco) + cache localStorage `config-meta` (o código síncrono lê do cache). lerMetasDe(id) para o professor.
- `plano.js` — CRUD planos_estudo + plano_itens (edital verticalizado).
- `acompanhamento.js` — listarAlunosComResumo, resumoAluno(id) (admin).
- `questoes.js` — listagem/facetas/favoritos + marcarLiberada/marcarRevisada.
- `simulados.js` (relatorioSimulado), `cadernos.js`, `aulas.js`, `destaques.js`, `feedback.js`.

## Migrations SQL (raiz) — rodar no Supabase SQL Editor
`schema_completo.sql` (do zero, fonte de verdade) · e incrementais já consolidadas nele: `liberada.sql`, `revisada.sql`, `revisao_espacada.sql`, `relatorio_simulados.sql`, `feedback.sql`, `plano_estudos.sql` (acompanhamento de estudos), `codigo_area.sql`, `simulados_propostos.sql`, `destaque_simulados.sql`, `destaques_agenda.sql`, `login_google.sql`, `aulas*.sql`.

## Convenções
- Textos e nomes de código em pt-BR. Enunciados/comentários de questões em HTML; frações como `<sup>x</sup>&frasl;<sub>y</sub>`.
- Páginas: React Query (useQuery/useMutation com invalidateQueries), CSS Modules, variáveis `--bg-surface`, `--border-subtle`, `--text-primary/secondary/tertiary`, `--color-primary`, `--radius-lg`.
- Commits direto na `main` (workflow do dono). Terminar mensagem de commit com o Co-Authored-By do Claude.
