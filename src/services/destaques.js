import { supabase } from './supabase'

// Todos os destaques do professor (ativos e inativos) — para a tela de gestão
export async function listarDestaques() {
  const { data, error } = await supabase
    .from('destaques')
    .select('*')
    .order('ordem', { ascending: true })
    .order('criado_em', { ascending: true })
  if (error) throw error
  return data || []
}

// Apenas os ativos — para a página inicial dos alunos
export async function listarDestaquesAtivos() {
  const { data, error } = await supabase
    .from('destaques')
    .select('*')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('criado_em', { ascending: true })
  if (error) throw error
  return data || []
}

export async function buscarDestaque(id) {
  const { data, error } = await supabase.from('destaques').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

function payload(dados) {
  return {
    tipo: dados.tipo || 'livre',
    ref_id: dados.tipo === 'livre' ? null : (dados.ref_id || null),
    etiqueta: dados.etiqueta?.trim() || null,
    titulo: dados.titulo?.trim(),
    texto: dados.texto?.trim() || null,
    cta_texto: dados.cta_texto?.trim() || null,
    link: dados.tipo === 'livre' ? (dados.link?.trim() || null) : null,
    ativo: dados.ativo ?? true,
  }
}

export async function criarDestaque(dados) {
  // novo card entra no fim da ordem
  const { data: ult } = await supabase
    .from('destaques').select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = (ult?.ordem ?? -1) + 1
  const { data, error } = await supabase
    .from('destaques')
    .insert({ ...payload(dados), ordem })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarDestaque(id, dados) {
  const { data, error } = await supabase
    .from('destaques')
    .update(payload(dados))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function alternarDestaqueAtivo(id, ativo) {
  const { error } = await supabase.from('destaques').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function deletarDestaque(id) {
  const { error } = await supabase.from('destaques').delete().eq('id', id)
  if (error) throw error
}

// Troca a ordem de dois destaques (para subir/descer na lista)
export async function trocarOrdem(a, b) {
  await supabase.from('destaques').update({ ordem: b.ordem }).eq('id', a.id)
  await supabase.from('destaques').update({ ordem: a.ordem }).eq('id', b.id)
}

// Resolve para onde o card leva, conforme o tipo
export function destinoDestaque(d) {
  if (d.tipo === 'simulado' && d.ref_id) return `/estudo?simulado=${d.ref_id}`
  if (d.tipo === 'aula' && d.ref_id) return `/aulas/${d.ref_id}`
  return d.link || null
}
