import { supabase } from './supabase'

// ── Reportar problema ─────────────────────────────────────────
export async function criarReport({ questao_id, tipo, descricao }) {
  const { error } = await supabase.from('questao_reports').insert({ questao_id, tipo, descricao: descricao || null })
  if (error) throw error
}

export async function listarReports({ apenasAbertos = false } = {}) {
  let q = supabase
    .from('questao_reports')
    .select('*, questoes(id, enunciado, bancas(nome), orgaos(nome), ano, cargo)')
    .order('criado_em', { ascending: false })
  if (apenasAbertos) q = q.eq('resolvido', false)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function resolverReport(id, resolvido) {
  const { error } = await supabase.from('questao_reports').update({ resolvido }).eq('id', id)
  if (error) throw error
}

export async function contarReportsAbertos() {
  const { count, error } = await supabase
    .from('questao_reports')
    .select('id', { count: 'exact', head: true })
    .eq('resolvido', false)
  if (error) throw error
  return count ?? 0
}

// ── Comentários ───────────────────────────────────────────────
export async function listarComentarios(questaoId) {
  const { data, error } = await supabase
    .from('questao_comentarios')
    .select('*')
    .eq('questao_id', questaoId)
    .order('criado_em', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function criarComentario({ questao_id, texto, autor_nome }) {
  const { error } = await supabase.from('questao_comentarios').insert({ questao_id, texto: texto.trim(), autor_nome: autor_nome || null })
  if (error) throw error
}

export async function excluirComentario(id) {
  const { error } = await supabase.from('questao_comentarios').delete().eq('id', id)
  if (error) throw error
}

// ── Avaliações (estrelas + dificuldade) ───────────────────────
export async function listarAvaliacoes(questaoId) {
  const { data, error } = await supabase
    .from('questao_avaliacoes')
    .select('usuario_id, estrelas, dificuldade')
    .eq('questao_id', questaoId)
  if (error) throw error
  return data ?? []
}

export async function salvarAvaliacao({ questao_id, usuario_id, estrelas, dificuldade }) {
  const { error } = await supabase
    .from('questao_avaliacoes')
    .upsert({ questao_id, usuario_id, estrelas: estrelas ?? null, dificuldade: dificuldade ?? null, atualizado_em: new Date().toISOString() },
      { onConflict: 'usuario_id,questao_id' })
  if (error) throw error
}

// Média/contagem a partir das linhas
export function resumoAvaliacoes(rows) {
  const est = rows.map(r => r.estrelas).filter(v => v != null)
  const dif = rows.map(r => r.dificuldade).filter(v => v != null)
  const media = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const dist = [1, 2, 3, 4, 5].map(n => dif.filter(v => v === n).length)
  return {
    estrelasMedia: media(est), estrelasN: est.length,
    difMedia: media(dif), difN: dif.length, difDist: dist,
  }
}

// ── Avaliação da aula (estrelas) ──────────────────────────────
export async function listarAvaliacoesAula(aulaId) {
  const { data, error } = await supabase
    .from('aula_avaliacoes').select('usuario_id, estrelas').eq('aula_id', aulaId)
  if (error) throw error
  return data ?? []
}

export async function salvarAvaliacaoAula({ aula_id, usuario_id, estrelas }) {
  const { error } = await supabase
    .from('aula_avaliacoes')
    .upsert({ aula_id, usuario_id, estrelas, atualizado_em: new Date().toISOString() },
      { onConflict: 'usuario_id,aula_id' })
  if (error) throw error
}
