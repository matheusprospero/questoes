# Repositório Pedagógico Municipal

Plataforma colaborativa para armazenamento, organização, busca, avaliação e compartilhamento de recursos pedagógicos da rede municipal de ensino.

## Stack

- **Frontend**: React 18 + Vite + React Router 6
- **Backend / Banco**: Supabase (PostgreSQL + Auth + Storage)
- **Hospedagem**: GitHub Pages (deploy automático via GitHub Actions)

## Setup local

### 1. Pré-requisitos

- Node.js 20+
- npm 10+

### 2. Clonar e instalar

```bash
git clone https://github.com/SEU_USUARIO/repedmunicipal.git
cd repedmunicipal
npm install
```

### 3. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com as credenciais do seu projeto Supabase (Settings → API):

```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

### 4. Aplicar o schema no Supabase

No painel do Supabase → **SQL Editor** → cole o conteúdo de `schema.sql` → Execute.

### 5. Rodar localmente

```bash
npm run dev
```

Acesse: http://localhost:5173

## Deploy (GitHub Pages)

### Configurar secrets no GitHub

No repositório → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|--------|-------|
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública |

### Ativar GitHub Pages

**Settings → Pages → Source**: selecione **GitHub Actions**.

### Deploy automático

Todo push na branch `main` dispara o deploy automaticamente via `.github/workflows/deploy.yml`.

### Nome do repositório

Se o repositório **não** se chamar `repedmunicipal`, atualize a constante `REPO_NAME` em `vite.config.js`.

## Estrutura do projeto

```
src/
├── components/
│   ├── layout/       # AppLayout, RotaProtegida
│   └── ui/           # Componentes reutilizáveis
├── contexts/         # AuthContext
├── hooks/            # Hooks customizados
├── pages/            # Uma pasta por módulo
│   ├── auth/
│   ├── questoes/
│   ├── planos/
│   ├── materiais/
│   ├── matriz/
│   ├── provas/
│   ├── colecoes/
│   ├── favoritos/
│   ├── relatorios/
│   ├── cobertura/
│   └── revisao/
├── services/         # supabase.js
├── styles/           # global.css
└── utils/            # Utilitários gerais
```

## Perfis de acesso

| Papel | Permissões |
|-------|-----------|
| `professor` | Criar, editar próprios recursos, favoritar, gerar provas |
| `formador` | Tudo do professor + revisar, aprovar recursos de outros |
| `administrador` | Acesso total, gerenciamento de usuários e matriz |
