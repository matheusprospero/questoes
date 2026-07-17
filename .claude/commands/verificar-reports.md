---
description: Verifica e corrige as questões reportadas com erro pelos alunos
---

Verifique as questões reportadas com erro (tabela `questao_reports`, `resolvido=false`) e corrija o que for possível. Siga o CLAUDE.md (não reler schema; usar `importador/importar.py` para acessar o banco).

Passos:

1. Busque os reports abertos com a classificação da questão e o autor:
   `python -c` importando `importador/importar.py` → `rest_get('questao_reports', 'select=id,tipo,descricao,usuario_id,questao_id,criado_em&resolvido=is.false')`, depois as questões (`enunciado`, `comentario`, `codigo`, `questao_alternativas(letra,texto,correta,ordem)`) e os perfis dos autores (`perfis?select=id,nome,email`).

2. Para cada questão reportada, verifique nesta ordem:
   - **Gabarito**: refaça a conta/análise de forma independente (para matemática, calcule em Python). Confirme que a alternativa marcada como correta bate com a resolução.
   - **Enunciado**: truncamento (frases cortadas no meio), texto-base ausente ("o texto" sem texto anexado — em Português, o texto-base pode estar em outra questão da mesma prova: buscar por `codigo=like.<PROVA>-PORT-*`), lixo de extração (marca-d'água "RASCUNHO"/"cursos.com.br" fatiada), potências quebradas (`x2` → `x<sup>2</sup>`, exceto células de Excel como B2/D2 em questões de Informática).
   - **Imagens**: toda URL `<img src>` deve responder HTTP 200 (HEAD request).
   - **Alternativas**: 5 (A–E) para múltipla escolha, exatamente 1 correta, nenhuma vazia.
   - **Comentário**: se cita uma letra, deve bater com a alternativa correta.

3. Corrija via PATCH (`/rest/v1/questoes` e `/rest/v1/questao_alternativas`) apenas o que for CERTO. Se o gabarito parecer errado mas não houver como confirmar (ex.: precisa da prova original), NÃO altere — deixe o report aberto e liste na resposta final com a dúvida explicada.

4. Para cada questão corrigida: marque o report `resolvido=true` (PATCH em `questao_reports`) e a questão `revisada=true`.

5. Resumo final: tabela com código da questão, o que foi reportado, o que foi feito (corrigida/aberta+motivo), e **nome + e-mail de quem reportou** (para o professor avisar por e-mail — a tela Reportados tem botão de e-mail pronto).

Regras: não usar `npm run deploy`; alterações de dados valem imediatamente (não passam pelo git). Não excluir questões sem confirmação do usuário.
