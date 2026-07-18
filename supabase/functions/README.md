# Pagamentos (Mercado Pago) — Edge Functions

Backend da venda de acesso. O front (GitHub Pages) é estático, então a lógica de
pagamento vive aqui, em Edge Functions do Supabase (Deno). Duas funções:

| Função | O que faz |
|---|---|
| `mp-criar-preferencia` | Calcula o preço no servidor (lendo o banco) e cria a preferência de checkout no Mercado Pago. Devolve a URL (`init_point`) para redirecionar o aluno. Cartão + PIX aparecem na tela do MP. |
| `mp-webhook` | Recebe a notificação do MP, confere o pagamento na API do MP e, se aprovado, ativa a(s) matrícula(s) do aluno (libera o acesso). |

## Pré-requisitos (uma vez)

1. **Rodar a migration** `venda_acesso.sql` no Supabase → SQL Editor.
2. **Conta Mercado Pago** → pegar o **Access Token de produção**
   (Painel MP → Suas integrações → sua aplicação → Credenciais de produção).
3. Ter a **Supabase CLI** e estar logado: `supabase login` e `supabase link --project-ref <ref>`.

## Deploy

```bash
# secrets (o SUPABASE_URL / SERVICE_ROLE / ANON já são injetados automaticamente)
supabase secrets set MP_ACCESS_TOKEN="APP_USR-...seu-token-de-producao..."
supabase secrets set SITE_URL="https://matheusprospero.com.br"

# funções
supabase functions deploy mp-criar-preferencia
supabase functions deploy mp-webhook --no-verify-jwt   # webhook é chamado pelo MP, sem JWT
```

> `mp-criar-preferencia` **exige** JWT (o aluno logado) — não use `--no-verify-jwt` nela.
> `mp-webhook` é público (o MP chama sem token), por isso `--no-verify-jwt`. A segurança
> vem de reconsultar o pagamento na API do MP com o `MP_ACCESS_TOKEN`.

## Configurar o webhook no Mercado Pago

Painel MP → sua aplicação → **Webhooks / Notificações** → URL de produção:

```
https://<seu-projeto>.supabase.co/functions/v1/mp-webhook
```

Evento: **Pagamentos** (`payment`).

## Testar

- **Sandbox:** use credenciais de teste do MP e cartões de teste. O `init_point`
  de teste é o `sandbox_init_point` (a função devolve o de produção; para testar,
  troque o token pelo de teste).
- **PIX:** o pagamento entra como `pending` e vira `approved` quando o pagador
  confirma — o webhook é chamado de novo nesse momento e só então libera o acesso.

## Fluxo resumido

```
Aluno clica "Comprar" (front)
  → mp-criar-preferencia (preço vem do banco, nunca do cliente)
  → redireciona para o checkout do MP (cartão + PIX)
  → aluno paga
  → MP chama mp-webhook
  → confere na API do MP → status approved?
      → grava pagamento + upsert matriculas (status 'ativa', acesso_ate conforme o plano)
  → aluno volta para /pagamento/retorno e já tem acesso
```
