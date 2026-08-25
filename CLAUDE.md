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
- Turmas (= "Cursos" na UI): `turmas`, `turma_disciplinas`, `matriculas` (ativa/pendente/recusada, uma por aluno×turma×disciplina; campos de venda: `acesso_desde`/`acesso_ate` período — null/null=vitalício, `origem` professor|compra, `motivo`, `pagamento_previsto`). Hierarquia **curso → disciplina → aula**: a aula pertence à disciplina (`aulas.disciplina_id`); a UI monta/exibe o conteúdo agrupado por disciplina do curso. Conteúdo é **N-N**: `turma_aulas`/`turma_simulados`. Conteúdo sem vínculo = público. RLS de leitura via `pode_ver_aula(aula, disc)` e `pode_ver_simulado(sim)` (admin, ou sem turma, ou matrícula ativa+vigente na turma respeitando a disciplina da aula). `matriculado_em(turma, disc)` gate as próprias tabelas. Após `venda_acesso.sql`, aulas **não exigem mais `assinante`** — só matrícula ativa. Rodar `turmas.sql` → `turmas_conteudo.sql` → `venda_acesso.sql` → `matricula_periodo.sql` → `matricula_manual.sql`.
Helpers RLS: `is_admin()`, `eh_assinante()` (só vídeos de resolução do banco).

## Rotas / páginas (`src/router.jsx`, `src/pages/`)
Aluno: `/` Início · `/plano` PlanoEstudos · `/turmas` MinhasTurmas (menu "Cursos": seções "Meus cursos" comprados + "Disponíveis"; aluno **só compra** acesso cartão/PIX — não há mais "solicitar"; aviso p/ admin de que é a visão do aluno) · `/turmas/:id` TurmaDetalhe (entra na turma: aulas agrupadas por disciplina + simulados + barra de progresso) · `/pagamento/retorno` (volta do checkout MP, param `retorno`) · `/aulas` · `/estudo` Estudo (resolver) · `/calendario` heatmap · `/estatisticas` · `/boletim` (PDF via print) · `/questoes` banco · `/favoritos` · `/cadernos` · `/simulados` · `/perfil`.
Admin (`RotaProtegida somenteAdmin`): `/acompanhamento` (por aluno) · `/matriculas` CentralMatriculas (turmas + matrículas + preços de venda, service `turmas.js`) · `/pagamentos` PagamentosConfig (credenciais Mercado Pago editáveis na página, service `pagamentos.js`) · `/vendas` Vendas (relatório de vendas: resumo/receita, gráfico por mês, filtros, CSV — `listarVendas` em `pagamentos.js`) · `/comunicacao` (histórico de e-mails + envio manual, service `comunicacao.js`) · `/questoes/nova|:id/editar` · `/revisao` · `/simulados/:id/relatorio` · `/aulas/nova|editar` · `/alunos` · `/destaques` · `/reports` · `/engajamento`.
Menu em `src/components/layout/AppLayout.jsx` (NAV_ITEMS + bloco admin "Gestão").

## Serviços (`src/services/`)
- `estudo.js` — núcleo: registrarResposta (com tempo_seg + dispara SRS), listarRespostas(usuarioId?), estudoPorDia, somarPeriodo, calcularProntidao (45% acerto/35% cobertura/20% recência), calcularMarcos, montarMetaDoDia, e análises (maestriaPorAssunto, evolucaoMensal, agruparDesempenho, calcularOfensiva, montarRecomendadas...).
- `metas.js` — lerMetas/salvarMetas (banco) + cache localStorage `config-meta` (o código síncrono lê do cache). lerMetasDe(id) para o professor. Preferências de lembrete por aluno: `metas.lembrete_ativo`, `dias_semana` (int[] 0=dom..6=sáb), `semanas` (0=sem prazo) + `inicio_meta` — editadas no ModalMeta (Início → ajustar metas).
- `plano.js` — CRUD planos_estudo + plano_itens (edital verticalizado).
- `acompanhamento.js` — listarAlunosComResumo, resumoAluno(id) (admin).
- `turmas.js` — CRUD turmas/turma_disciplinas (com preços: `definirDisciplinas(turmaId, linhas)`, `precosDaTurma`), matrículas (admin: `matricular(usuarioId,turmaId,discIds,extras)` com período/motivo/pagamento, `atualizarMatricula(id,patch)`, decidir/remover; aluno: cancelar — solicitar existe mas não é mais exposto no front). Vínculo N-N do conteúdo pelos dois lados: aula→turma (setTurmasDaAula/DoSimulado, turmasDaAula/DoSimulado) e turma→aulas (aulasDaTurma/setAulasDaTurma, simuladosDaTurma/setSimuladosDaTurma — modal "Conteúdo da turma" na CentralMatriculas, escolha de aulas agrupada por disciplina do curso). buscarTurmaComConteudo(id), progressoTurma(id), contarSolicitacoesPendentes.
- `comunicacao.js` — histórico da fila (listarEmails), listarAlunosComEmail, enviarEmailManual (categoria `manual`), lerEmailsAuto/salvarEmailsAuto (flag global config_app `emails_auto` {boas_vindas,lembrete} — toggle na Central de Matrículas). Feedback/e-mails de report ficam em `feedback.js` (enfileirarEmailReport, lerModeloEmail/salvarModeloEmail, MODELOS_EMAIL: report/boas_vindas/lembrete).
- `pagamentos.js` — venda de acesso via Mercado Pago. `comprar({turmaId,tipo,plano,disciplinaIds})` invoca a Edge Function `mp-criar-preferencia` e redireciona pro checkout (cartão+PIX); `meusPagamentos()` histórico; `listarVendas`/`statusVenda` (relatório /vendas); config admin `lerConfigPagamento`/`salvarConfigPagamento`/`urlWebhook`. tipo: completo|disciplina; plano: mensal|vitalicio. Liberação automática pelo webhook (ativa matrícula com período). Preço é sempre calculado no servidor. Backend Deno em `supabase/functions/` (mp-criar-preferencia, mp-webhook; ver README): token vem de `pagamento_config` (service_role) com fallback env; back_urls usam config `site_url` ou o header Origin do site. Implantadas via Supabase CLI (NÃO pelo `npm run deploy`).
- `questoes.js` — listagem/facetas/favoritos + marcarLiberada/marcarRevisada.
- `simulados.js` (relatorioSimulado), `cadernos.js`, `aulas.js`, `destaques.js`, `feedback.js`.
- PDF do simulado: `SimuladoDetalhe.jsx → buildHtml()` monta HTML e chama window.print. `cfg_impressao` (jsonb): tamanhoFonte, separadorQuestoes, quebrarPagina, rodapes, **questoesPorFolha** (0=todas/1/2/3 → classe `.folha` flex 276mm, quebra por página) e **espacoResolucao** (área "Resolução" que preenche o restante da folha, dividida igualmente — uso: gravação de aulas). Config no SimuladoForm.jsx.

## Migrations SQL (raiz) — rodar no Supabase SQL Editor
`schema_completo.sql` (do zero, fonte de verdade) · e incrementais já consolidadas nele: `liberada.sql`, `revisada.sql`, `revisao_espacada.sql`, `relatorio_simulados.sql`, `feedback.sql`, `plano_estudos.sql` (acompanhamento de estudos), `codigo_area.sql`, `simulados_propostos.sql`, `destaque_simulados.sql`, `destaques_agenda.sql`, `login_google.sql`, `aulas*.sql`, `emails_fila.sql` (fila de e-mails; envio via `google-script/enviar_emails.gs` no Apps Script do professor, acionador de 10 min — Reportados enfileira em "Resolver + avisar") · `config_app.sql` (config chave/valor; modelos de e-mail editáveis em Reportados → Personalizar e-mails) · `emails_automaticos.sql` (boas-vindas via trigger em perfis + lembrete diário de meta via RPC `enfileirar_lembretes_metas`, chamada pelo Apps Script; hora em config `lembrete_config`, dedup 1x/dia por aluno, só alunos ativos <30d) · `emails_auto_toggle.sql` (flag global `config_app.emails_auto` {boas_vindas,lembrete}; as funções checam antes de enfileirar — toggle na Central de Matrículas) · `meta_lembrete_aluno.sql` (colunas `metas.lembrete_ativo`/`dias_semana`/`semanas`/`inicio_meta`; a RPC de lembrete respeita as preferências do aluno: recebe/dias/janela de semanas) · `turmas.sql` (turmas + matrículas) · `turmas_conteudo.sql` (conteúdo N-N `turma_aulas`/`turma_simulados` + funções `pode_ver_aula`/`pode_ver_simulado`; rodar DEPOIS de turmas.sql) · `venda_acesso.sql` (venda de acesso Mercado Pago — preços em `turmas` (completo) e `turma_disciplinas` (avulsa), `matriculas.acesso_ate` (null=vitalício / data=mensal) + `.origem`, tabela `pagamentos`; **desacopla o conteúdo de turma do booleano `assinante`** — aulas passam a exigir só matrícula ativa, `assinante` fica só p/ vídeos do banco; rodar DEPOIS de turmas_conteudo.sql) · `matricula_periodo.sql` (`matriculas.acesso_desde` início do acesso — funções `matriculado_em`/`pode_ver_aula`/`pode_ver_simulado` passam a exigir início≤now E fim>now; admin edita início/fim na Central de Matrículas; rodar DEPOIS de venda_acesso.sql) · `matricula_manual.sql` (`matriculas.motivo` + `.pagamento_previsto` — matrícula manual do professor com motivo fora do padrão e data de pagamento prevista; `matricular(...,extras)` e `atualizarMatricula(id,patch)` em turmas.js; rodar DEPOIS de matricula_periodo.sql). Backend do pagamento (Edge Functions Deno) em `supabase/functions/` — deploy/secrets no `supabase/functions/README.md` (NÃO passam pelo `npm run deploy`; são implantadas via Supabase CLI) · `pagamento_config.sql` (credenciais MP editáveis na página `/pagamentos`: tabela `pagamento_config` com RLS fechado, funções `salvar_pagamento_config`/`pagamento_config_status` SECURITY DEFINER admin — token só mascarado volta ao cliente; Edge Functions leem via service_role, fallback p/ env; rodar DEPOIS de venda_acesso.sql).
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

---

## Guarda anti-vazamento

#### Regra dura: script SQL não entra no Git

**Nunca versione `.sql`.** Nem migração, nem carga, nem "só o esquema", nem
exemplo com dado fictício. Não há exceção a avaliar caso a caso — a regra existe
justamente porque o caso a caso falha.

Como funciona no lugar disso:

- os scripts ficam em `db/`, que **existe só na máquina de quem trabalha** e é
  barrado pelo `.gitignore`;
- são entregues fora do repositório (anexo na conversa, e-mail, upload direto),
  rodados no SQL Editor do Supabase, e vivem lá;
- precisa de um script antigo? Peça a quem executou. Não o traga de volta.

Isto não é hipótese. Até 2026-08-25 o repositório `site` versionava 17 arquivos
`.sql`; quatro deles somavam **3.152 e-mails de servidores da rede**, e ficaram
baixáveis pela web enquanto estiveram lá — o Pages publica da raiz, então todo
arquivo commitado vira URL.

Onde a definição de esquema já está versionada de antes — é o caso de `lunar`,
`saelm`, `repositorio` e `questoes` —, ela fica listada em `.guarda-permitidos`,
arquivo por arquivo e com a justificativa escrita. Estar na lista **não** é
liberação para acrescentar mais: cada arquivo novo exige uma linha nova, e a
linha exige que alguém tenha aberto o arquivo.

**Também nunca versione:**

- `*.csv`, `*.dump`, `*.xlsx`, `*.xls` — export carrega dado real junto, quase
  sempre sem quem escreveu perceber. Estão no `.gitignore`.
- Dado pessoal de qualquer natureza: nome, e-mail, RA, matrícula, CPF, telefone,
  endereço. Nem em código, nem em comentário, nem em dado de exemplo, nem em
  mensagem de commit.
- Credencial de qualquer tipo: `service_role`, senha de banco, token de API,
  chave privada.

#### As CINCO portas da guarda

Nada disso depende de alguém lembrar. **Uma** regra —
`.claude/hooks/verificar-vazamento.sh` — atende cinco portas, porque fechar só
uma não fecha nada:

| Porta | Cobre | O que ela pergunta |
|---|---|---|
| `PreToolUse` / Bash | `git commit` e `git push` do Claude Code | o que está staged; o que está versionado |
| `PreToolUse` / MCP do GitHub | `create_or_update_file`, `push_files` | escrita direta pela API, que não passa por git nenhum |
| `pre-commit` do git | terminal, VS Code, GitHub Desktop | o que está staged |
| `pre-push` do git | última barreira antes de sair da máquina | o que está versionado, e o que os commits não publicados tocaram |
| `.github/workflows/guarda-dados.yml` | o GitHub, a cada push e PR | o que está versionado — e não depende de máquina nenhuma |

⚠️ **O workflow não reimplementa a regra: ele CHAMA a mesma guarda**, em modo
de push. Duas implementações da mesma regra divergem na primeira correção feita
só em uma — e aí uma libera o que a outra barra, sem ninguém saber qual está
certa.

As portas do git se instalam sozinhas: `.githooks/` é versionado e o
`SessionStart` aponta `core.hooksPath` para lá. À mão, uma vez por clone:
`git config core.hooksPath .githooks`.

⚠️ **`git commit` passar não é sinal verde: o push pergunta outra coisa.** O
commit olha o que está staged; o push olha o que está VERSIONADO — e por isso
pega o que entrou por qualquer outro caminho: `--no-verify`, `git add -f`, outra
máquina, outra ferramenta, ou antes de a guarda existir.

⚠️ **A guarda ignora as EXCLUSÕES (`--diff-filter=d`).** Apagar um arquivo
proibido é a correção, não a falta. Até 2026-08-25 ela olhava `--name-only`
puro e barrava justamente o commit que limpava o vazamento — ou seja, tornava
permanente qualquer vazamento que já tivesse acontecido.

⚠️ **E-mail institucional também é dado pessoal.** Três ou mais endereços
`.gov.br` distintos no mesmo diff bloqueiam; um endereço de contato num
documento passa. O vazamento de 2026-08 foram 3.152 endereços institucionais, e
a regra antiga liberava `.gov.br` inteiro.

⚠️ **O `%` fica FORA da parte local do e-mail, e isso não é descuido de
regex.** Com ele, o coringa do SQL (`email like '%@educacao.pmrp.sp.gov.br'`)
casa como se fosse endereço de gente, e uma checagem de domínio vira "dado
pessoal publicado". Foi assim que a auditoria acusou quatro arquivos do `lunar`
que não tinham endereço nenhum de pessoa.

⚠️ **Nada disso apaga o histórico, e o `.gitignore` não destrava arquivo já
rastreado.** A guarda impede o PRÓXIMO vazamento. O que já foi publicado só sai
com reescrita de histórico e força-push.

#### Quando uma guarda te barra

**A resposta certa é tirar o arquivo do commit**, não contornar a guarda.
`git commit --no-verify`, `git add -f` e `SME_PERMITIR_COMMIT=1` existem para
falso positivo em arquivo que comprovadamente não tem dado pessoal — nunca para
publicar um `.sql`. Na dúvida, pergunte antes de commitar; desfazer depois custa
semanas.

⚠️ **E a válvula destranca UMA porta, não a publicação.** O que entrar com
`SME_PERMITIR_COMMIT=1` continua barrado no `push` e no workflow. É de
propósito: um descuido não pode virar publicação por causa de uma variável de
ambiente.

Falso positivo que se repete — um modelo em branco que a própria página oferece
para download, a definição de esquema de um sistema — vai para
**`.guarda-permitidos`**: uma linha por caminho, linha terminada em `/` cobre a
pasta, e a justificativa escrita ao lado ou em bloco acima. **A mesma lista é
lida pela guarda local, pelo workflow e pela auditoria semanal da rede** — se
cada um tivesse a sua, uma liberaria o que a outra barra.

⚠️ **Liberar o caminho NÃO desliga a checagem de conteúdo.** Um arquivo novo
dentro de uma pasta liberada continua barrado se trouxer CPF, chave privada,
`service_role` ou lista de e-mails. Antes de acrescentar uma linha, **abra o
arquivo** e procure nome, e-mail, RA, matrícula, CPF, telefone e endereço; se
achar qualquer um, ele não entra na lista — sai do Git.

#### Como a regra chega a todo aparelho

São dois alcances diferentes, e os dois são necessários: a **memória** faz o
Claude Code saber a regra; a **guarda** impede a publicação mesmo de quem não
leu. O texto canônico da memória está em `.claude/memoria-perfil.md`.

| Onde | Alcance | Como instalar |
| --- | --- | --- |
| Setup script do ambiente de nuvem | Toda sessão de nuvem, **de qualquer aparelho** — navegador, celular, desktop, `claude --cloud`, rotinas | claude.ai/code → Environments → Setup script, colando `.claude/setup-ambiente-nuvem.sh` |
| `~/.sme-guarda` + `core.hooksPath` global | **Todo repositório daquele computador**, inclusive os que ainda não existem, e toda sessão do Claude Code daquele perfil | `curl -fsSL https://smedigital.com.br/guarda/instalar.sh \| bash`, uma vez por máquina |
| `.githooks/` + `.claude/settings.json` do repositório | Quem clonar este repositório, com ou sem instalador | vem versionado; o `SessionStart` liga sozinho |
| `.github/workflows/guarda-dados.yml` | O GitHub, independente de máquina | vem versionado |
| `CLAUDE.md` de cada repositório | Quem trabalha naquele repositório | replicar esta seção |

O setup script é o que resolve "qualquer computador ou celular" para a memória:
roda como root antes de o Claude Code iniciar e grava `~/.claude/CLAUDE.md`
dentro do container. Como o ambiente é do perfil, e não do aparelho, vale
igualmente no celular e no navegador. O instalador por máquina é o que resolve
o mesmo para a guarda, inclusive fora do Claude Code.

⚠️ **O ambiente de nuvem é efêmero.** O que você instalar à mão dentro de uma
sessão morre com o container; o que vale na sessão seguinte é o que está no
setup script do ambiente ou versionado no repositório.

Ao criar um repositório novo nesta rede, copie para ele o `.gitignore`, o hook,
o `.githooks/`, o workflow e esta seção — ou comece pelo `template-sistema-sme`,
que já traz tudo.

