import { supabase } from './supabase'

// Listar todos os usuários (admin/formador)
export async function listarUsuarios() {
  const { data, error } = await supabase
    .from('vw_usuarios')
    .select('*')
    .order('nome')

  if (error) throw error
  return data
}

// Buscar perfil por ID
export async function buscarPerfil(id) {
  const { data, error } = await supabase
    .from('perfis')
    .select('*, escolas(nome)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Atualizar próprio perfil
export async function atualizarPerfil(id, dados) {
  const { error } = await supabase
    .from('perfis')
    .update({ ...dados, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// Alterar papel (admin only — via RPC)
export async function alterarPapel(usuarioId, novoPapel) {
  const { error } = await supabase.rpc('rpc_alterar_papel', {
    usuario_id: usuarioId,
    novo_papel: novoPapel,
  })
  if (error) throw error
}

// Ativar/desativar usuário (admin only — via RPC)
export async function toggleUsuario(usuarioId, ativo) {
  const { error } = await supabase.rpc('rpc_toggle_usuario', {
    usuario_id: usuarioId,
    ativo,
  })
  if (error) throw error
}

// Criar usuário via Supabase Admin (requer service role — usar só em Edge Function)
// No frontend, usamos o convite por e-mail do Supabase Auth
export async function convidarUsuario(email, nome, papel) {
  // Registra o convite na tabela
  const { data: perfil } = await supabase.auth.getUser()

  const { error } = await supabase.from('convites').insert({
    email,
    nome,
    papel,
    convidado_por: perfil.user.id,
  })

  if (error) throw error

  // Envia o convite via Supabase Auth (magic link)
  const { error: authError } = await supabase.auth.admin?.inviteUserByEmail
    ? await supabase.auth.admin.inviteUserByEmail(email, {
        data: { nome, papel },
      })
    : { error: null }

  if (authError) throw authError
}

export async function vincularDisciplinas(usuarioId, disciplinasIds) {
  const { error } = await supabase
    .from('perfis')
    .update({ disciplinas_ids: disciplinasIds })
    .eq('id', usuarioId)
  if (error) throw error
}

export async function buscarDisciplinasFormador(usuarioId) {
  const { data, error } = await supabase
    .from('perfis')
    .select('disciplinas_ids')
    .eq('id', usuarioId)
    .single()
  if (error) throw error
  return data?.disciplinas_ids || []
}
