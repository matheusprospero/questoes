import { supabase } from './supabase'

// ── Planos de estudo (edital verticalizado + ciclo de estudos) ──────────────

const SELECT_ITEM = `
  id, plano_id, disciplina_id, assunto_id, peso, meta_questoes,
  estudado, revisado, ciclos, ordem, atualizado_em,
  disciplinas(id, nome, cor), assuntos(id, nome)
`

export async function listarPlanos() {
  const { data, error } = await supabase
    .from('planos_estudo')
    .select('*, bancas(id, nome), orgaos(id, nome)')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function criarPlano({ nome, banca_id = null, orgao_id = null, cargo = null }) {
  const { data, error } = await supabase
    .from('planos_estudo')
    .insert({ nome, banca_id, orgao_id, cargo })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renomearPlano(id, nome) {
  const { error } = await supabase.from('planos_estudo').update({ nome }).eq('id', id)
  if (error) throw error
}

export async function excluirPlano(id) {
  const { error } = await supabase.from('planos_estudo').delete().eq('id', id)
  if (error) throw error
}

export async function listarItens(planoId) {
  const { data, error } = await supabase
    .from('plano_itens')
    .select(SELECT_ITEM)
    .eq('plano_id', planoId)
    .order('ordem', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Adiciona itens ao plano a partir de uma lista de {disciplina_id, assunto_id?, peso?, meta_questoes?}
export async function adicionarItens(planoId, itens) {
  if (!itens?.length) return []
  const base = await supabase.from('plano_itens').select('id', { count: 'exact', head: true }).eq('plano_id', planoId)
  let ordem = base.count ?? 0
  const linhas = itens.map(it => ({
    plano_id: planoId,
    disciplina_id: it.disciplina_id ?? null,
    assunto_id: it.assunto_id ?? null,
    peso: it.peso ?? 3,
    meta_questoes: it.meta_questoes ?? 0,
    ordem: ordem++,
  }))
  const { data, error } = await supabase.from('plano_itens').insert(linhas).select(SELECT_ITEM)
  if (error) throw error
  return data ?? []
}

export async function atualizarItem(id, patch) {
  const { error } = await supabase
    .from('plano_itens')
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// Registra mais uma volta no ciclo de estudos do item.
export async function incrementarCiclo(id, ciclosAtual) {
  await atualizarItem(id, { ciclos: (ciclosAtual || 0) + 1 })
}

export async function removerItem(id) {
  const { error } = await supabase.from('plano_itens').delete().eq('id', id)
  if (error) throw error
}
