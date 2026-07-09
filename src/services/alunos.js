import { supabase } from './supabase'

// Lista os perfis cadastrados (visível apenas para admin, por RLS).
// Usado na tela de Alunos para acompanhar cadastros e coletar e-mails.
export async function listarAlunos() {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, email, papel, criado_em')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data ?? []
}
