import { supabase } from './supabase'

export async function listarPlanos(filtros = {}) {
  let query = supabase
    .from('planos_aula')
    .select('id, titulo, descricao, ano_escolar, duracao_aulas, status, criado_em, autor_id, disciplinas(nome, cor), perfis(nome)')
    .order('criado_em', { ascending: false })

  if (filtros.autor_id)      query = query.eq('autor_id', filtros.autor_id)
  if (filtros.status)        query = query.eq('status', filtros.status)
  if (filtros.disciplina_id) query = query.eq('disciplina_id', filtros.disciplina_id)
  if (filtros.ano_escolar)   query = query.eq('ano_escolar', filtros.ano_escolar)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function buscarPlano(id) {
  const { data, error } = await supabase
    .from('planos_aula')
    .select('*, disciplinas(id, nome, cor), perfis(id, nome)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function criarPlano(dados) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('planos_aula')
    .insert({ ...dados, autor_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarPlano(id, dados) {
  const { data, error } = await supabase
    .from('planos_aula')
    .update(dados)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletarPlano(id) {
  const { error } = await supabase.from('planos_aula').delete().eq('id', id)
  if (error) throw error
}
