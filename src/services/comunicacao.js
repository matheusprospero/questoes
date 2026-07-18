import { supabase } from './supabase'

// Central de comunicação (admin): histórico da fila de e-mails + envio manual.
// O envio físico continua com o Google Apps Script (ciclo de 10 min).

export const CATEGORIAS = {
  report: { label: 'Questão corrigida', cor: '#0284c7' },
  boas_vindas: { label: 'Boas-vindas', cor: '#7c3aed' },
  lembrete: { label: 'Lembrete de meta', cor: '#d97706' },
  manual: { label: 'Aviso do professor', cor: '#059669' },
}

// Todos os e-mails da fila (histórico), mais novos primeiro.
export async function listarEmails({ limite = 1000 } = {}) {
  const { data, error } = await supabase
    .from('emails_fila')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data ?? []
}

// Alunos com e-mail (para o seletor de destinatários e para nomear o histórico)
export async function listarAlunosComEmail() {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, email')
    .eq('papel', 'aluno')
    .not('email', 'is', null)
    .order('nome', { ascending: true })
  if (error) throw error
  return data ?? []
}

function aplicarVars(texto, aluno) {
  const nome = aluno?.nome || ''
  return (texto || '')
    .replaceAll('{nome}', nome ? nome.split(' ')[0] : 'aluno(a)')
    .replaceAll('{nome_completo}', nome || 'aluno(a)')
}

// Enfileira um e-mail manual para cada destinatário (variáveis por aluno).
export async function enviarEmailManual({ alunos, assunto, corpo }) {
  if (!alunos?.length) throw new Error('Selecione ao menos um destinatário')
  const linhas = alunos.map(a => ({
    para: a.email,
    assunto: aplicarVars(assunto, a),
    corpo: aplicarVars(corpo, a),
    categoria: 'manual',
  }))
  let { error } = await supabase.from('emails_fila').insert(linhas)
  // Compatibilidade: se a coluna categoria ainda não existir (emails_automaticos.sql pendente)
  if (error && /categoria/.test(error.message || '')) {
    ({ error } = await supabase.from('emails_fila').insert(linhas.map(({ categoria, ...r }) => r)))
  }
  if (error) throw error
  return linhas.length
}
