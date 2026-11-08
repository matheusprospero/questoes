# Montar os Encontros 1 e 2 de Matemática (INEPAM) a partir do banco

Cole esta mensagem na sessão local do Claude Code, na pasta do projeto `questoes`.

---

Preciso montar dois **simulados** no banco com questões que já estão importadas. São as
provas da INEPAM (banca "INEPAM", ano 2026, disciplina Matemática, 60 questões, todas
com `liberada = false`). As aulas são só de exercícios, então o que importa é **quais
questões entram em cada encontro e em que ordem**.

Use `importador/importar.py` para falar com o banco (`import importar as m` e
`m.rest_get(...)`, service_role). Para localizar cada questão, filtre por `cargo` e pelo
trecho inicial do `enunciado` indicado abaixo (`enunciado=ilike.*trecho*`). Cada trecho
devolve exatamente uma questão; se devolver zero ou mais de uma, pare e me avise em vez
de escolher por conta.

Crie dois simulados (tabela `simulados` + `simulado_questoes`, respeitando a ordem
abaixo no campo de ordem). Não altere `liberada` de nenhuma questão: eu libero depois de
revisar. Não crie nem edite questões. Não faça commit de nada: é só dado no banco.

## Encontro 1 — "Matemática INEPAM · Encontro 1: porcentagem, juros e MMC" (15 questões)

| # | Bloco | Cargo (Órgão) | Trecho do enunciado para localizar |
|---|---|---|---|
| 1 | Porcentagem – aumento % | Escriturário (Câmara de Campo Limpo Paulista) | `O número de alunos em uma turma aumentou de 36 para 45` |
| 2 | Porcentagem – preço original após desconto | Psicólogo (Prefeitura de Adamantina) | `Um tênis custa R$ 128,74 com desconto de 18%` |
| 3 | Porcentagem – preço original após desconto | Assistente Administrativo (Câmara de Campo Limpo Paulista) | `Um produto recebeu um desconto de 17% e passou a custar R$ 48,97` |
| 4 | Porcentagem – preço original após aumento | Guarda Civil (Prefeitura de Bofete) | `Todo ano, em seu aniversário, o dono de uma empresa de robótica` |
| 5 | Porcentagem – aumentos sucessivos | Assistente Legislativo (Câmara de Campo Limpo Paulista) | `Uma máquina de lavar roupas sofreu dois aumentos sucessivos` |
| 6 | Porcentagem – aumento e queda sucessivos | Telefonista (Prefeitura de Adamantina) | `Uma pessoa investiu R$ 28.000,00 em janeiro` |
| 7 | Juros simples – montante | Almoxarife (Prefeitura de Adamantina) | `Um capital de R$ 369.100,00 foi aplicado a juros simples` |
| 8 | Juros simples – juros | Assistente Legislativo (Câmara de Campo Limpo Paulista) | `Um capital de R$ 14.560,00, após 18 meses` |
| 9 | Juros simples – taxa | Auxiliar Administrativo (Câmara Municipal de Mongaguá) | `Um capital de R$ 15.480,00, aplicado durante 1 ano e 3 meses` |
| 10 | Juros simples – tempo | Analista de Patrimônio e Almoxarifado (Câmara Municipal de Mongaguá) | `Um empréstimo de R$ 253.100,00 a 0,5% ao mês` |
| 11 | MMC – "coincidir de novo" | Guarda Civil (Prefeitura de Bofete) | `Três irmãos estão batendo tambores` |
| 12 | MMC – com data | Assistente Administrativo (Câmara de Campo Limpo Paulista) | `Uma escola organiza campeonatos de xadrez` |
| 13 | MDC – kits | Assistente Legislativo (Câmara de Campo Limpo Paulista) | `Um professor deseja dividir 84 chocolates e 126 pirulitos` |
| 14 | MDC – grupos | Almoxarife (Prefeitura de Adamantina) | `No início do ano letivo, uma escola possui 70 alunos no Curso A` |
| 15 | Regra de três | Almoxarife (Prefeitura de Adamantina) | `Durante as férias, João estudava 2 horas e 20 minutos por dia` |

## Encontro 2 — "Matemática INEPAM · Encontro 2: probabilidade, radicais e medidas" (15 questões)

| # | Bloco | Cargo (Órgão) | Trecho do enunciado para localizar |
|---|---|---|---|
| 1 | Probabilidade – simples | Analista de Patrimônio e Almoxarifado (Câmara Municipal de Mongaguá) | `Em uma simulação de evacuação em área de guerra` |
| 2 | Probabilidade – simples (múltiplos) | Escriturário (Câmara de Campo Limpo Paulista) | `Um dado especial possui 12 faces numeradas de 1 a 12` |
| 3 | Probabilidade – complementar | Auxiliar Administrativo (Câmara Municipal de Mongaguá) | `Em um experimento climático, a chance de chover em um dia é 37%` |
| 4 | Probabilidade – complementar (fração) | Telefonista (Prefeitura de Adamantina) | `Em uma caixa há 3 cartões azuis, 19 pretos e 8 amarelos` |
| 5 | Racionalização – raiz simples | Psicólogo (Prefeitura de Adamantina) | `Racionalizando e simplificando` |
| 6 | Racionalização – raiz simples | Auxiliar Administrativo (Câmara Municipal de Mongaguá) | `Em uma análise de emissão de gases em regiões de conflito` |
| 7 | Racionalização – conjugado | Analista de Patrimônio e Almoxarifado (Câmara Municipal de Mongaguá) | `Durante um estudo sobre a camada de ozônio` |
| 8 | Medidas – massa | Assistente Legislativo (Câmara de Campo Limpo Paulista) | `Um caminhão transporta 0,34 toneladas de areia` |
| 9 | Medidas – volume | Escriturário (Câmara de Campo Limpo Paulista) | `Um reservatório contém 21,4 m³ de água` |
| 10 | Medidas – tempo decimal | Assistente Administrativo (Câmara de Campo Limpo Paulista) | `Um estudante assiste a uma aula online, toda segunda-feira, de 1,75 horas` |
| 11 | Estatística – média | Assistente Administrativo (Câmara de Campo Limpo Paulista) | `Um atleta registrou seus tempos (em minutos) em cinco treinos` |
| 12 | Estatística – gráfico de setores | Telefonista (Prefeitura de Adamantina) | `Uma tabela mostra os gastos de Helena` |
| 13 | Contagem – princípio fundamental | Almoxarife (Prefeitura de Adamantina) | `No início do ano letivo, um aluno deve escolher uma língua estrangeira` |
| 14 | Contagem – arranjo | Assistente Legislativo (Câmara de Campo Limpo Paulista) | `Uma senha é formada por 3 símbolos distintos` |
| 15 | Revisão – juros com números grandes | Guarda Civil (Prefeitura de Bofete) | `Qual é o montante de uma aplicação cujo capital é de R$ 3.695.400,00` |

## Ficam de fora dos dois encontros (30 questões)

Sobram para o aulão e para os encontros 3 e 4. Entre elas, as **4 com alternativa F**
(a banca não ofereceu a resposta certa): Auxiliar Administrativo "aumento de 19% e
depois desconto de 19%", Recepcionista "68,94% das pessoas aprovam", Técnico de
Secretaria "mediana", Escriturário "empréstimo de R$ 99.000,00". Servem para a conversa
sobre erros da banca, não para a aula de conteúdo. Também fica de fora a do Guarda Civil
"Joelma utiliza 70 gramas de creme", que tem enunciado defeituoso.

## Ao terminar

Liste os dois simulados criados com o id de cada um e, para cada questão, a ordem, o
cargo e as primeiras palavras do enunciado, para eu conferir contra esta lista.
