# Questões de Concursos

Banco de questões de concursos públicos para venda de acesso a alunos: o professor (admin) cadastra questões com editor rico e resolução em vídeo; cada aluno resolve questões, monta cadernos e simulados próprios e acompanha suas estatísticas.

## Papéis

- **Professor (admin)** — cria/edita questões, disciplinas, assuntos, bancas e órgãos; libera o acesso dos alunos criando os usuários no painel do Supabase.
- **Aluno** — lê o banco, resolve questões, tem cadernos, simulados, favoritos e estatísticas próprios (isolados por RLS).

## Funcionalidades

- **Banco de Questões** — múltipla escolha (A–E) ou certo/errado (estilo Cebraspe), classificadas por disciplina, assunto, banca, órgão, ano, cargo, nível e dificuldade, com comentário do gabarito e **resolução em vídeo (YouTube não listado)**.
- **Resolver Questões** — sessões de estudo filtradas, correção imediata com comentário e vídeo, registro de cada resposta e opção de refazer apenas as erradas.
- **Estatísticas** — % de acerto geral, por disciplina/assunto/banca, evolução mensal e questões mais erradas (por aluno).
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
3. Em **Authentication → Users → Add user**, crie o SEU usuário (e-mail + senha).
4. No **SQL Editor**, promova-se a admin:
   ```sql
   update perfis set papel = 'admin'
   where id = (select id from auth.users where email = 'SEU@EMAIL.com');
   ```
5. **Alunos**: para cada aluno que pagar, crie o usuário em **Authentication → Users → Add user** (ele já nasce como `aluno`). Para encerrar o acesso, exclua ou bana o usuário no mesmo painel.

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
