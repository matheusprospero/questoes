// ============================================================================
// mp-webhook — recebe a notificação do Mercado Pago e libera o acesso.
//
// Fluxo seguro: NUNCA confia no corpo da notificação. Ao receber o id do
// pagamento, consulta a API do MP para conferir o status real. Se 'approved',
// grava/atualiza o registro em `pagamentos` (idempotente por mp_payment_id) e
// ativa a(s) matrícula(s) do aluno — completo = todas as disciplinas da turma;
// disciplina = as escolhidas. Mensal → acesso_ate = agora + 1 mês; vitalício → null.
//
// Configurar no painel do Mercado Pago (Webhooks) apontando para:
//   https://<seu-projeto>.supabase.co/functions/v1/mp-webhook
// e implantar SEM verificação de JWT:  supabase functions deploy mp-webhook --no-verify-jwt
//
// Secrets: MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getMpConfig } from '../_shared/config.ts'

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { token: MP_TOKEN } = await getMpConfig(admin)
    if (!MP_TOKEN) { console.error('sem token do MP'); return new Response('ok', { status: 200 }) }

    // O MP manda o id do pagamento ora no corpo, ora na query string.
    const url = new URL(req.url)
    let paymentId = url.searchParams.get('data.id') || url.searchParams.get('id')
    let topic = url.searchParams.get('type') || url.searchParams.get('topic')
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        paymentId = body?.data?.id || paymentId
        topic = body?.type || topic
      } catch { /* corpo vazio: usa a query string */ }
    }

    // Só nos interessa notificação de pagamento.
    if (topic && topic !== 'payment') return new Response('ignorado', { status: 200 })
    if (!paymentId) return new Response('sem id', { status: 200 })

    // ── Confere o pagamento na fonte (API do MP) ───────────────────────────
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    })
    if (!payRes.ok) {
      console.error('MP payments GET falhou', await payRes.text())
      return new Response('erro consulta MP', { status: 200 })
    }
    const pay = await payRes.json()
    const status = pay.status // approved | pending | rejected | ...
    const md = pay.metadata || {}
    const pagamentoId = md.pagamento_id || pay.external_reference
    const usuarioId = md.usuario_id
    const turmaId = md.turma_id
    const tipo = md.tipo
    const plano = md.plano
    const discIds: string[] = (md.disciplina_ids || '').split(',').map((s: string) => s.trim()).filter(Boolean)

    // Atualiza (ou cria) o registro do pagamento — idempotente por mp_payment_id.
    const registro: Record<string, unknown> = {
      status,
      mp_payment_id: String(paymentId),
      processado_em: new Date().toISOString(),
    }
    if (pagamentoId) {
      await admin.from('pagamentos').update(registro).eq('id', pagamentoId)
    } else if (usuarioId && turmaId) {
      await admin.from('pagamentos').upsert({
        ...registro, usuario_id: usuarioId, turma_id: turmaId, tipo, plano,
        disciplina_ids: tipo === 'completo' ? [] : discIds, valor: pay.transaction_amount,
      }, { onConflict: 'mp_payment_id' })
    }

    if (status !== 'approved') return new Response('ok', { status: 200 })
    if (!usuarioId || !turmaId) return new Response('ok', { status: 200 })

    // ── Descobre quais disciplinas liberar ─────────────────────────────────
    let disciplinasParaLiberar = discIds
    if (tipo === 'completo') {
      const { data: tds } = await admin.from('turma_disciplinas')
        .select('disciplina_id').eq('turma_id', turmaId)
      disciplinasParaLiberar = (tds || []).map((t) => t.disciplina_id)
    }
    if (disciplinasParaLiberar.length === 0) return new Response('ok', { status: 200 })

    // Início agora; mensal expira em 30 dias, vitalício não tem fim.
    const agora = new Date().toISOString()
    const acessoAte = plano === 'mensal'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null

    const linhas = disciplinasParaLiberar.map((d) => ({
      usuario_id: usuarioId,
      turma_id: turmaId,
      disciplina_id: d,
      status: 'ativa',
      origem: 'compra',
      acesso_desde: agora,
      acesso_ate: acessoAte,
      decidido_em: agora,
    }))
    const { error } = await admin.from('matriculas')
      .upsert(linhas, { onConflict: 'usuario_id,turma_id,disciplina_id' })
    if (error) console.error('erro ao ativar matrículas', error)

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error(e)
    // Sempre 200 para o MP não ficar reenviando infinitamente em erro nosso.
    return new Response('ok', { status: 200 })
  }
})
