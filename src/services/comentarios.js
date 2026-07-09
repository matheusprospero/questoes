import { supabase } from './supabase'

// Adiciona um comentário a um item (questão, plano ou material).
// Passe apenas o id do tipo de item correspondente.
export async function adicionarComentario({ questao_id = null, plano_id = null, material_id = null, pai_id = null, texto }) {
  const txt = (texto || '').trim()
  if (!txt) throw new Error('Escreva um comentário')

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('comentarios')
    .insert({ questao_id, plano_id, material_id, pai_id, texto: txt, autor_id: user.id })
    .select('id, texto, criado_em, autor_id, perfis(nome)')
    .single()

  if (error) throw error
  return data
}

// Remoção lógica (soft delete) — preserva histórico
export async function arquivarComentario(id) {
  const { error } = await supabase
    .from('comentarios')
    .update({ arquivado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
