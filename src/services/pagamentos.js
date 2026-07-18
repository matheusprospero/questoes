import { supabase } from './supabase'

// Venda de acesso via Mercado Pago.
// A criação da preferência (e o cálculo do preço) acontece na Edge Function
// `mp-criar-preferencia`; aqui só disparamos e redirecionamos para o checkout.

// tipo: 'completo' | 'disciplina' ; plano: 'mensal' | 'vitalicio'
export async function iniciarCompra({ turmaId, tipo, plano, disciplinaIds = [] }) {
  const { data, error } = await supabase.functions.invoke('mp-criar-preferencia', {
    body: { turma_id: turmaId, tipo, plano, disciplina_ids: disciplinaIds },
  })
  if (error) {
    // Edge Function devolve { error } no corpo em caso 4xx/5xx
    let msg = error.message
    try { msg = (await error.context?.json())?.error || msg } catch { /* ignora */ }
    throw new Error(msg || 'Não foi possível iniciar o pagamento.')
  }
  if (!data?.init_point) throw new Error(data?.error || 'Checkout indisponível.')
  return data // { init_point, preference_id, valor }
}

// Redireciona o navegador para a tela de pagamento do Mercado Pago.
export async function comprar(params) {
  const { init_point } = await iniciarCompra(params)
  window.location.href = init_point
}

// Histórico de pagamentos do aluno (ou todos, para o admin — RLS decide).
export async function meusPagamentos() {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('*, turmas(nome)')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const precoFmt = (v) =>
  v == null ? null : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
