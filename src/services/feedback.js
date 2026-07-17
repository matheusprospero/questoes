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
  const reports = data ?? []

  // Junta nome/e-mail de quem reportou (admin lê perfis; aluno vê só o próprio)
  const ids = [...new Set(reports.map(r => r.usuario_id).filter(Boolean))]
  if (ids.length) {
    const { data: perfis } = await supabase
      .from('perfis')
      .select('id, nome, email')
      .in('id', ids)
    const porId = new Map((perfis ?? []).map(p => [p.id, p]))
    for (const r of reports) r.autor = porId.get(r.usuario_id) ?? null
  }
  return reports
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

// ── Painel de engajamento (admin) ─────────────────────────────
// Usa reports + avaliações (ambos legíveis pelo admin) para achar as
// questões mais reportadas, mais difíceis (voto dos alunos) e pior avaliadas.
export async function engajamentoTurma() {
  const [{ data: avals }, reports] = await Promise.all([
    supabase.from('questao_avaliacoes')
      .select('questao_id, estrelas, dificuldade, questoes(id, enunciado, bancas(nome), orgaos(nome), ano, cargo)'),
    listarReports({ apenasAbertos: false }),
  ])

  const m = new Map()
  for (const a of (avals || [])) {
    if (!a.questoes) continue
    const g = m.get(a.questao_id) ?? { questao: a.questoes, est: [], dif: [] }
    if (a.estrelas != null) g.est.push(a.estrelas)
    if (a.dificuldade != null) g.dif.push(a.dificuldade)
    m.set(a.questao_id, g)
  }
  const media = (arr) => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null
  const arr = [...m.values()].map(g => ({
    questao: g.questao,
    difMedia: media(g.dif), difN: g.dif.length,
    estMedia: media(g.est), estN: g.est.length,
  }))
  const maisDificeis = arr.filter(x => x.difN >= 3).sort((a, b) => b.difMedia - a.difMedia).slice(0, 10)
  const piorAvaliadas = arr.filter(x => x.estN >= 3).sort((a, b) => a.estMedia - b.estMedia).slice(0, 10)

  const rm = new Map()
  for (const r of reports) {
    if (!r.questoes) continue
    const g = rm.get(r.questao_id) ?? { questao: r.questoes, total: 0, abertos: 0 }
    g.total++; if (!r.resolvido) g.abertos++
    rm.set(r.questao_id, g)
  }
  const maisReportadas = [...rm.values()].sort((a, b) => b.abertos - a.abertos || b.total - a.total).slice(0, 10)

  return { maisDificeis, piorAvaliadas, maisReportadas }
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
