# Banco de Questões — Manual do usuário

> Plataforma de estudo por questões de concurso. Duas visões no mesmo sistema:
> a do **aluno**, que resolve e acompanha o próprio desempenho, e a do
> **professor**, que cria conteúdo, vende acesso e acompanha a turma.
> Quem mantém o código deve ler
> [`DOCUMENTACAO-TECNICA.md`](interno/DOCUMENTACAO-TECNICA.md) e o
> [`CLAUDE.md`](../../CLAUDE.md).

**Onde fica:** `matheusprospero.com.br`

---

# Parte I — Aluno

## 1. Entrar

Conta própria, com e-mail e senha ou login pelo Google.

O que você vê depende de **o que comprou**: o banco de questões é aberto a quem
tem conta, e as aulas e simulados de um curso exigem matrícula ativa.

## 2. Início

A porta do sistema. Traz a **meta do dia**, a sua **ofensiva** (dias seguidos de
estudo), os marcos alcançados e o que o sistema recomenda resolver hoje.

A recomendação não é aleatória: ela olha o que você acerta menos, o que faz
tempo que não revisa e o que ainda não tocou.

## 3. Resolver questões

**Resolver Questões** é onde se estuda. Você responde, vê o gabarito e a
resolução, e a resposta fica registrada — com o **tempo** que levou.

⚠️ **As respostas não são apagadas nem sobrescritas.** Refazer a mesma questão
cria um novo registro; as estatísticas contam as duas. É o que permite ver
evolução em vez de só a última tentativa.

**Revisão espaçada:** ao errar, a questão volta a aparecer em **1, 3, 7, 15, 30
e 60 dias**. O intervalo cresce conforme você acerta.

**Banco de Questões** é a busca no acervo: filtre por disciplina, assunto,
banca, órgão e ano, favorite o que interessar, e monte cadernos.

**Vídeos de resolução** são de assinante.

## 4. Organizar o estudo

| Tela | Para quê |
|---|---|
| **Plano de Estudos** | o edital verticalizado: os tópicos, o que já foi visto, o que falta |
| **Cadernos** | seus conjuntos de questões, montados a dedo |
| **Simulados** | prova cronometrada, com relatório ao final |
| **Favoritos** | o que você marcou |

⚠️ **Simulado e estudo são contados separadamente.** O que você resolve em
simulado não infla a estatística do estudo diário, e vice-versa.

## 5. Acompanhar

| Tela | Para quê |
|---|---|
| **Calendário** | o mapa de calor — quanto você estudou em cada dia |
| **Estatísticas** | acerto por disciplina e assunto, evolução por mês, pontos fracos |
| **Boletim** | o consolidado, pronto para imprimir em PDF |

**Prontidão** é a nota que resume o quanto você está preparado. Ela combina
**acerto (45%)**, **cobertura do edital (35%)** e **recência (20%)**.

⚠️ **Acertar muito numa parte pequena do edital não produz prontidão alta** — a
cobertura entra na conta. E parar de estudar derruba a nota sozinho, pela
recência: é proposital.

## 6. Metas e lembretes

Em **Início → ajustar metas** você define a meta diária e, se quiser, ativa o
lembrete por e-mail: em quais **dias da semana** e por quantas **semanas**.

⚠️ **Semanas = 0 significa "sem prazo"**, não "nenhuma semana".

## 7. Cursos

**Cursos** tem duas seções: **Meus cursos** (o que você já comprou) e
**Disponíveis** (o que dá para comprar).

A compra é por **cartão ou PIX**, e o acesso é liberado **automaticamente**
assim que o pagamento é confirmado — não há solicitação a aprovar.

| Tipo | O que é |
|---|---|
| **Curso completo** | todas as disciplinas do curso |
| **Disciplina avulsa** | só a disciplina escolhida |

| Plano | Duração |
|---|---|
| **Mensal** | acesso com data de término |
| **Vitalício** | sem data de término |

Dentro do curso, o conteúdo aparece **agrupado por disciplina**, com as aulas e
os simulados vinculados, e uma barra de progresso.

⚠️ **O acesso tem início e fim.** Uma matrícula comprada com data futura só
abre o conteúdo a partir dela. Se o conteúdo "sumiu", confira o período da sua
matrícula antes de supor defeito.

## 8. Coisas que parecem defeito e não são

| O que você vê | O que é |
|---|---|
| Uma aula do curso não abre | matrícula fora do período, ou a aula é de disciplina que você não comprou |
| A questão que errei voltou a aparecer | é a revisão espaçada (seção 3) |
| Minha prontidão caiu sem eu errar nada | o componente de recência: faz tempo desde o último estudo |
| Resolvi muita questão e a prontidão subiu pouco | pouca cobertura do edital (seção 5) |
| O vídeo de resolução não abre | é de assinante |
| Paguei e não liberou na hora | a confirmação do pagamento pode demorar alguns instantes; se persistir, fale com o professor |
| Atualizaram o site e nada mudou para mim | cache do navegador — abra em aba anônima ou recarregue com Ctrl+Shift+R |

---

# Parte II — Professor

## 9. As telas de gestão

O menu ganha a seção **Gestão · Professor**, com contadores nos itens que têm
pendência.

| Tela | Para quê |
|---|---|
| **Acompanhamento** | o desempenho aluno a aluno |
| **Matrículas** | turmas, matrículas, preços de venda e o conteúdo de cada turma |
| **Pagamentos** | as credenciais do meio de pagamento, editáveis na própria página |
| **Vendas** | o relatório: receita, gráfico por mês, filtros e exportação CSV |
| **Comunicação** | histórico de e-mails e envio manual |
| **Destaques** | o que aparece em destaque para os alunos |
| **Engajamento** | quem está estudando e quem parou |
| **Reportados** | questões que os alunos marcaram como erradas |
| **Revisão** | a fila de conferência das questões |
| **Alunos** | a base de alunos |

## 10. Publicar uma questão

Duas chaves, **independentes**:

| Campo | O que faz |
|---|---|
| **liberada** | o aluno vê a questão |
| **revisada** | a questão passou pela sua conferência |

⚠️ **São coisas diferentes, e confundi-las libera conteúdo não conferido.**
Questões autorais entram como **não liberadas** e só aparecem para os alunos
depois que você as libera.

## 11. Montar um curso

Em **Matrículas**:

1. Crie a **turma** (o curso) e as **disciplinas** dela, com os preços.
2. Vincule o **conteúdo** — aulas e simulados — pelo modal "Conteúdo da turma".
3. Matricule manualmente quando precisar, com **motivo** e **data de pagamento
   prevista**, ou deixe a venda liberar sozinha.

A hierarquia é **curso → disciplina → aula**: a aula pertence à disciplina, e é
por isso que quem compra uma disciplina avulsa vê só as aulas dela.

⚠️ **Conteúdo sem vínculo de turma é público** para quem tem conta. Se uma aula
deve ser de um curso, vincule-a — senão ela fica aberta, sem aviso.

⚠️ **O preço é sempre calculado no servidor.** O valor que aparece na tela não
é o que o pagamento usa — isso impede manipulação no navegador.

## 12. Simulados para imprimir

O PDF do simulado é configurável: tamanho da fonte, separador entre questões,
quebra de página, rodapés, **questões por folha** (todas / 1 / 2 / 3) e
**espaço de resolução** — uma área "Resolução" que preenche o restante da folha,
dividida igualmente. O espaço de resolução foi pensado para gravação de aulas.

## 13. E-mails

- **Boas-vindas** e **lembrete de meta** são automáticos, e há uma chave global
  para ligar ou desligar cada um.
- **Envio manual** para um ou vários alunos, em Comunicação.
- Os **modelos** de e-mail são editáveis.

⚠️ **O lembrete respeita a preferência de cada aluno** — dias da semana e janela
de semanas — e há limite de um por dia por aluno. Ele só alcança alunos ativos
nos últimos 30 dias.

⚠️ **Quem envia de fato é um Google Apps Script**, disparado a cada 10 minutos.
Se os e-mails pararem, o lugar de olhar é ele, não o site.

## 14. Onde reclamar do quê

| Assunto | Onde se resolve |
|---|---|
| Aluno diz que pagou e não liberou | Vendas → situação da venda; depois Matrículas |
| Aluno não vê uma aula | vínculo da aula com a turma, e o período da matrícula |
| Questão com erro | Reportados — resolver e avisar o aluno |
| Questão autoral não aparece | falta **liberada** |
| E-mails pararam | o Apps Script (seção 13) |
| "Não mudou nada" depois de publicar | cache do navegador — aba anônima |
