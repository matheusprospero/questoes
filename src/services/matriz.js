import { supabase } from './supabase'

// ── Disciplinas ───────────────────────────────────────────────

export async function listarTodasDisciplinas() {
  const { data, error } = await supabase
    .from('disciplinas')
    .select('*')
    .order('ordem', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function criarDisciplina(dados) {
  const { data, error } = await supabase
    .from('disciplinas')
    .insert(dados)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarDisciplina(id, dados) {
  const { data, error } = await supabase
    .from('disciplinas')
    .update(dados)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletarDisciplina(id) {
  const { error } = await supabase.from('disciplinas').delete().eq('id', id)
  if (error) throw error
}

// ── Habilidades ───────────────────────────────────────────────

export async function listarTodasHabilidades(filtros = {}) {
  let query = supabase
    .from('habilidades')
    .select('*, disciplinas(nome, cor)')
    .order('codigo', { ascending: true })

  if (filtros.disciplina_id) query = query.eq('disciplina_id', filtros.disciplina_id)
  if (filtros.ano_escolar)   query = query.eq('ano_escolar', filtros.ano_escolar)
  if (typeof filtros.ativo === 'boolean') query = query.eq('ativo', filtros.ativo)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function criarHabilidade(dados) {
  const { data, error } = await supabase
    .from('habilidades')
    .insert(dados)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarHabilidade(id, dados) {
  const { data, error } = await supabase
    .from('habilidades')
    .update(dados)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletarHabilidade(id) {
  const { error } = await supabase.from('habilidades').delete().eq('id', id)
  if (error) throw error
}

// Conta quantas questões usam cada habilidade (para avisar antes de excluir)
export async function contarUsoHabilidades() {
  const { data, error } = await supabase
    .from('questao_habilidades')
    .select('habilidade_id')
  if (error) throw error
  const contagem = {}
  for (const r of data ?? []) {
    contagem[r.habilidade_id] = (contagem[r.habilidade_id] || 0) + 1
  }
  return contagem
}
