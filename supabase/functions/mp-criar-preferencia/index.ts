// ============================================================================
// mp-criar-preferencia — cria uma preferência de checkout no Mercado Pago.
//
// O front chama esta função com o aluno logado (Authorization: Bearer <jwt>).
// O PREÇO É SEMPRE CALCULADO AQUI, no servidor, lendo o banco com service_role —
// nunca confiar em valor vindo do cliente. A função devolve a URL do checkout
// (init_point) para onde o aluno é redirecionado (cartão + PIX na tela do MP).
//
// Body esperado (JSON):
//   { turma_id, tipo: 'completo'|'disciplina', plano: 'mensal'|'vitalicio',
//     disciplina_ids?: string[] }   // disciplina_ids obrigatório quando tipo='disciplina'
//
// Secrets necessários (supabase secrets set ...):
//   MP_ACCESS_TOKEN            token de produção do Mercado Pago
//   SITE_URL                   ex.: https://matheusprospero.com.br
//   SUPABASE_URL               (injetado automaticamente)
//   SUPABASE_SERVICE_ROLE_KEY  (injetado automaticamente)
//   SUPABASE_ANON_KEY          (injetado automaticamente)
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405)

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
    const SITE_URL = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '')

    // Identifica o aluno pelo JWT que veio no header.
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'não autenticado' }, 401)
    const user = userData.user

    const { turma_id, tipo, plano, disciplina_ids = [] } = await req.json()
    if (!turma_id || !['completo', 'disciplina'].includes(tipo) || !['mensal', 'vitalicio'].includes(plano))
      return json({ error: 'parâmetros inválidos' }, 400)

    const precoCol = plano === 'mensal' ? 'preco_mensal' : 'preco_vitalicio'
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── Calcula preço e descrição no servidor ──────────────────────────────
    const { data: turma } = await admin.from('turmas')
      .select('id, nome, ativa, preco_mensal, preco_vitalicio').eq('id', turma_id).single()
    if (!turma || !turma.ativa) return json({ error: 'turma indisponível' }, 400)

    let valor = 0
    let titulo = ''
    let discIds: string[] = []

    if (tipo === 'completo') {
      valor = Number(turma[precoCol])
      titulo = `${turma.nome} — acesso completo (${plano})`
    } else {
      if (!Array.isArray(disciplina_ids) || disciplina_ids.length === 0)
        return json({ error: 'selecione ao menos uma disciplina' }, 400)
      const { data: tds } = await admin.from('turma_disciplinas')
        .select(`disciplina_id, ${precoCol}, disciplinas(nome)`)
        .eq('turma_id', turma_id).in('disciplina_id', disciplina_ids)
      if (!tds || tds.length === 0) return json({ error: 'disciplinas inválidas' }, 400)
      for (const td of tds) {
        const p = Number((td as Record<string, unknown>)[precoCol])
        if (!p || p <= 0) return json({ error: 'disciplina sem preço definido' }, 400)
        valor += p
        discIds.push(td.disciplina_id)
      }
      const nomes = tds.map((t: Record<string, any>) => t.disciplinas?.nome).filter(Boolean).join(', ')
      titulo = `${turma.nome} — ${nomes} (${plano})`
    }

    if (!valor || valor <= 0) return json({ error: 'preço não definido para este plano' }, 400)

    // ── Registra o pagamento como pendente (para casar com o webhook) ──────
    const { data: pag } = await admin.from('pagamentos').insert({
      usuario_id: user.id,
      turma_id,
      tipo,
      plano,
      disciplina_ids: tipo === 'completo' ? [] : discIds,
      valor,
      status: 'pendente',
    }).select('id').single()

    // ── Cria a preferência no Mercado Pago ─────────────────────────────────
    const pref = {
      items: [{
        title: titulo.slice(0, 250),
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Number(valor.toFixed(2)),
      }],
      payer: { email: user.email },
      // external_reference casa o pagamento de volta com nosso registro
      external_reference: pag?.id ?? '',
      metadata: {
        pagamento_id: pag?.id ?? '',
        usuario_id: user.id,
        turma_id,
        tipo,
        plano,
        disciplina_ids: (tipo === 'completo' ? [] : discIds).join(','),
      },
      back_urls: {
        success: `${SITE_URL}/pagamento/retorno?status=sucesso`,
        pending: `${SITE_URL}/pagamento/retorno?status=pendente`,
        failure: `${SITE_URL}/pagamento/retorno?status=erro`,
      },
      auto_return: 'approved',
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MP_TOKEN}`,
      },
      body: JSON.stringify(pref),
    })
    const mp = await mpRes.json()
    if (!mpRes.ok) {
      console.error('Erro MP', mp)
      return json({ error: 'falha ao criar checkout', detalhe: mp?.message }, 502)
    }

    if (pag?.id && mp.id)
      await admin.from('pagamentos').update({ mp_preference_id: mp.id }).eq('id', pag.id)

    return json({ init_point: mp.init_point, preference_id: mp.id, valor })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})
