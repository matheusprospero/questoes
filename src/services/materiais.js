import { supabase } from './supabase'

export async function listarMateriais(filtros = {}) {
  let query = supabase
    .from('materiais')
    .select('id, titulo, descricao, tipo, formato, url, ano_escolar, tags, criado_em, autor_id, disciplinas(nome, cor), perfis(nome)')
    .order('criado_em', { ascending: false })

  if (filtros.autor_id)      query = query.eq('autor_id', filtros.autor_id)
  if (filtros.tipo)          query = query.eq('tipo', filtros.tipo)
  if (filtros.formato)       query = query.eq('formato', filtros.formato)
  if (filtros.disciplina_id) query = query.eq('disciplina_id', filtros.disciplina_id)
  if (filtros.ano_escolar)   query = query.eq('ano_escolar', filtros.ano_escolar)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function criarMaterial(dados) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('materiais')
    .insert({ ...dados, autor_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarMaterial(id, dados) {
  const { data, error } = await supabase
    .from('materiais')
    .update(dados)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletarMaterial(id) {
  const { error } = await supabase.from('materiais').delete().eq('id', id)
  if (error) throw error
}
