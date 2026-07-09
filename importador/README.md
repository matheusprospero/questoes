# Importador de questões

Ferramenta local para importar questões (com imagens) para o Supabase deste projeto.
Sobe as imagens para o bucket `midia` e insere as questões apontando para as URLs
públicas — mantendo o banco leve (sem base64 embutido no enunciado).

## Segurança

- Usa a **service_role key** (Supabase → Settings → API → `service_role`, secret).
  Essa chave tem acesso total; **rode sempre na sua máquina** e nunca a compartilhe.
- A pasta `conteudo/` (que guarda a chave, o conteúdo das provas e as imagens) é
  **ignorada pelo git** — nada de conteúdo protegido por direitos autorais vai para
  o repositório público. Só a ferramenta (`importar.py`) é versionada.

## Como usar

1. Coloque sua service_role key em `importador/conteudo/service_role.txt`
   (ou na variável de ambiente `SUPABASE_SERVICE_ROLE`).
2. Rode, apontando para o arquivo do lote:

   ```
   python importador/importar.py importador/conteudo/sorocaba_2025_peb.json
   ```

   Para reimportar o mesmo lote do zero (apaga antes as questões do mesmo órgão/ano):

   ```
   python importador/importar.py importador/conteudo/sorocaba_2025_peb.json --limpar
   ```

A URL do projeto é lida automaticamente do `.env` da raiz (`VITE_SUPABASE_URL`).

## Formato de um lote (JSON)

```jsonc
{
  "slug": "sorocaba-2025-peb-i",     // usado no caminho das imagens no storage
  "disciplina": "Matemática",         // precisa já existir no banco
  "banca": "Vunesp",                  // criada se não existir
  "orgao": "Prefeitura de Sorocaba",  // criado se não existir
  "ano": 2025,
  "cargo": "Professor de Educação Básica I",
  "nivel": "superior",                // fundamental | medio | superior
  "imagens_dir": "imagens",           // pasta das imagens, relativa ao JSON
  "questoes": [
    {
      "num": 22,
      "assunto": "Estatística e gráficos",   // criado se não existir
      "dificuldade": 3,                       // 1 a 5
      "enunciado": "<p>...</p>{{IMG:q22_grafico.png}}<p>...</p>",
      "comentario": "<p>Resolução...</p>",
      "alternativas": [
        ["A", "<p>texto</p>", true],
        ["B", "<p>texto</p>", false]
      ]
    }
  ]
}
```

- Para inserir uma imagem no enunciado, use o marcador `{{IMG:arquivo.png}}` —
  o importador sobe `imagens/arquivo.png` e troca o marcador pela URL pública.
- Para questões **certo/errado**, use `"tipo": "certo_errado"`, `"gabarito_certo": true|false`
  e omita `alternativas`.
- Para resolução em vídeo, adicione `"video_url": "https://youtu.be/..."`.
- Cada questão pode ter sua própria `"disciplina"` (sobrepõe a do lote) — útil para provas
  que misturam matérias. Disciplinas, bancas, órgãos e assuntos são criados se não existirem.
```
