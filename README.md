# Questões de Concursos

Banco pessoal de questões de concursos públicos (usuário único): cadastro com editor rico, organização em cadernos, montagem de simulados com exportação para Word/PDF e módulo de estudo com estatísticas de desempenho.

## Funcionalidades

- **Banco de Questões** — múltipla escolha (A–E) ou certo/errado (estilo Cebraspe), classificadas por disciplina, assunto, banca, órgão, ano, cargo, nível e dificuldade, com comentário/justificativa do gabarito.
- **Resolver Questões** — sessões de estudo filtradas, correção imediata com comentário, registro de cada resposta e opção de refazer apenas as erradas.
- **Estatísticas** — % de acerto geral, por disciplina/assunto/banca, evolução mensal e questões mais erradas.
- **Cadernos** — agrupamentos de questões por edital/tema.
- **Simulados** — provas montadas com o banco, com cabeçalho personalizável, impressão/PDF e exportação para Word (gabarito incluso opcional).
- **Favoritos** — marcação rápida de questões.

## Stack

- **Frontend**: React 18 + Vite + React Router 6 + React Query
- **Backend / Banco**: Supabase (PostgreSQL + Auth + Storage)
- **Hospedagem**: GitHub Pages (`npm run deploy`)

## Setup

### 1. Pré-requisitos

- Node.js 20+

### 2. Instalar

```bash
git clone https://github.com/SEU_USUARIO/questoes.git
cd questoes
npm install
```

### 3. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor → New query**, cole o conteúdo de `schema_completo.sql` e execute (**Run**). Isso cria as tabelas, o RLS, o bucket `midia` e seeds de disciplinas/bancas.
3. Em **Authentication → Users → Add user**, crie seu usuário (e-mail + senha). Ele é o único usuário do sistema.

### 4. Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha com os dados do projeto (Settings → API):

```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

### 5. Rodar

```bash
npm run dev
```

Acesse http://localhost:5173 e faça login com o usuário criado no passo 3.

## Deploy (GitHub Pages)

```bash
npm run deploy
```

O `vite.config.js` usa `REPO_NAME = 'questoes'` como base do path em produção — ajuste se o repositório tiver outro nome.
