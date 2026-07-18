import { supabase } from './supabase'

// Turmas + Central de Matrículas.
// Matrícula = aluno × turma × disciplina, status: ativa | pendente | recusada.

const SELECT_TURMA = '*, turma_disciplinas(disciplina_id, disciplinas(id, nome, cor))'

export function disciplinasDaTurma(turma) {
  return (turma?.turma_disciplinas || [])
    .map(td => td.disciplinas)
    .filter(Boolean)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ── Turmas (admin gerencia; aluno lê as ativas) ───────────────
export async function listarTurmas() {
  const { data, error } = await supabase
    .from('turmas')
    .select(SELECT_TURMA)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function criarTurma({ nome, descricao = null }) {
  const { data, error } = await supabase.from('turmas').insert({ nome, descricao }).select().single()
  if (error) throw error
  return data
}

export async function atualizarTurma(id, patch) {
  const { error } = await supabase.from('turmas').update(patch).eq('id', id)
  if (error) throw error
}

export async function excluirTurma(id) {
  const { error } = await supabase.from('turmas').delete().eq('id', id)
  if (error) throw error
}

// Define o conjunto de disciplinas da turma (substitui o atual)
export async function definirDisciplinas(turmaId, disciplinaIds) {
  const { error: e1 } = await supabase.from('turma_disciplinas').delete().eq('turma_id', turmaId)
  if (e1) throw e1
  if (disciplinaIds.length) {
    const { error: e2 } = await supabase
      .from('turma_disciplinas')
      .insert(disciplinaIds.map(d => ({ turma_id: turmaId, disciplina_id: d })))
    if (e2) throw e2
  }
}

// ── Matrículas (admin) ────────────────────────────────────────
// Todas as matrículas (opcionalmente de uma turma), com nome/e-mail do aluno.
export async function listarMatriculas({ turmaId = null, status = null } = {}) {
  let q = supabase
    .from('matriculas')
    .select('*, turmas(id, nome), disciplinas(id, nome, cor)')
    .order('criado_em', { ascending: false })
  if (turmaId) q = q.eq('turma_id', turmaId)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  const lista = data ?? []
  const ids = [...new Set(lista.map(m => m.usuario_id))]
  if (ids.length) {
    const { data: perfis } = await supabase.from('perfis').select('id, nome, email').in('id', ids)
    const porId = new Map((perfis ?? []).map(p => [p.id, p]))
    for (const m of lista) m.aluno = porId.get(m.usuario_id) ?? null
  }
  return lista
}

// Professor matricula direto (status ativa). Upsert cobre re-matricular recusadas.
export async function matricular(usuarioId, turmaId, disciplinaIds) {
  const linhas = disciplinaIds.map(d => ({
    usuario_id: usuarioId,
    turma_id: turmaId,
    disciplina_id: d,
    status: 'ativa',
    decidido_em: new Date().toISOString(),
  }))
  const { error } = await supabase
    .from('matriculas')
    .upsert(linhas, { onConflict: 'usuario_id,turma_id,disciplina_id' })
  if (error) throw error
}

export async function decidirMatricula(id, aprovar) {
  const { error } = await supabase
    .from('matriculas')
    .update({ status: aprovar ? 'ativa' : 'recusada', decidido_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function removerMatricula(id) {
  const { error } = await supabase.from('matriculas').delete().eq('id', id)
  if (error) throw error
}

export async function contarSolicitacoesPendentes() {
  const { count, error } = await supabase
    .from('matriculas')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente')
  if (error) return 0
  return count ?? 0
}

// ── Lado do aluno ─────────────────────────────────────────────
export async function minhasMatriculas() {
  const { data, error } = await supabase
    .from('matriculas')
    .select('*, turmas(id, nome), disciplinas(id, nome, cor)')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function solicitarMatricula(turmaId, disciplinaId) {
  const { error } = await supabase
    .from('matriculas')
    .insert({ turma_id: turmaId, disciplina_id: disciplinaId, status: 'pendente', usuario_id: (await supabase.auth.getUser()).data?.user?.id })
  if (error) throw error
}

export async function cancelarSolicitacao(id) {
  const { error } = await supabase.from('matriculas').delete().eq('id', id)
  if (error) throw error
}

// ── Conteúdo da turma (N-N: aula/simulado pode estar em várias turmas) ──
export async function turmasDaAula(aulaId) {
  const { data, error } = await supabase.from('turma_aulas').select('turma_id').eq('aula_id', aulaId)
  if (error) throw error
  return (data ?? []).map(r => r.turma_id)
}
export async function turmasDoSimulado(simuladoId) {
  const { data, error } = await supabase.from('turma_simulados').select('turma_id').eq('simulado_id', simuladoId)
  if (error) throw error
  return (data ?? []).map(r => r.turma_id)
}
// Substitui o conjunto de turmas de uma aula/simulado
export async function setTurmasDaAula(aulaId, turmaIds) {
  await supabase.from('turma_aulas').delete().eq('aula_id', aulaId)
  if (turmaIds.length) {
    const { error } = await supabase.from('turma_aulas').insert(turmaIds.map(t => ({ turma_id: t, aula_id: aulaId })))
    if (error) throw error
  }
}
export async function setTurmasDoSimulado(simuladoId, turmaIds) {
  await supabase.from('turma_simulados').delete().eq('simulado_id', simuladoId)
  if (turmaIds.length) {
    const { error } = await supabase.from('turma_simulados').insert(turmaIds.map(t => ({ turma_id: t, simulado_id: simuladoId })))
    if (error) throw error
  }
}

// Uma turma + suas disciplinas, aulas e simulados (RLS já filtra o que o aluno vê)
export async function buscarTurmaComConteudo(turmaId) {
  const { data: turma, error } = await supabase.from('turmas').select(SELECT_TURMA).eq('id', turmaId).single()
  if (error) throw error
  const [{ data: ta }, { data: ts }] = await Promise.all([
    supabase.from('turma_aulas').select('aulas(id, titulo, descricao, disciplina_id, publicada, aula_questoes(count))').eq('turma_id', turmaId),
    supabase.from('turma_simulados').select('simulados(id, titulo, descricao, proposto, simulado_questoes(count))').eq('turma_id', turmaId),
  ])
  const aulas = (ta ?? []).map(r => r.aulas).filter(Boolean)
  const simulados = (ts ?? []).map(r => r.simulados).filter(Boolean)
  return { turma, aulas, simulados }
}

// Progresso do aluno no conteúdo da turma: questões distintas respondidas
// (de aulas + simulados da turma) sobre o total, e % de acerto.
export async function progressoTurma(turmaId) {
  const [{ data: ta }, { data: ts }] = await Promise.all([
    supabase.from('turma_aulas').select('aulas(aula_questoes(questao_id))').eq('turma_id', turmaId),
    supabase.from('turma_simulados').select('simulados(simulado_questoes(questao_id))').eq('turma_id', turmaId),
  ])
  const ids = new Set()
  for (const r of ta ?? []) for (const q of r.aulas?.aula_questoes ?? []) ids.add(q.questao_id)
  for (const r of ts ?? []) for (const q of r.simulados?.simulado_questoes ?? []) ids.add(q.questao_id)
  const total = ids.size
  if (total === 0) return { total: 0, feitas: 0, acertos: 0, pct: 0, pctAcerto: 0 }

  // Respostas do aluno nessas questões (última por questão define acerto)
  const lista = [...ids]
  const respostas = []
  for (let i = 0; i < lista.length; i += 300) {
    const chunk = lista.slice(i, i + 300)
    const { data } = await supabase.from('respostas')
      .select('questao_id, acertou, respondido_em')
      .in('questao_id', chunk)
      .order('respondido_em', { ascending: true })
    if (data) respostas.push(...data)
  }
  const ultima = new Map()
  for (const r of respostas) ultima.set(r.questao_id, r.acertou)
  const feitas = ultima.size
  const acertos = [...ultima.values()].filter(Boolean).length
  return {
    total, feitas, acertos,
    pct: Math.round((feitas / total) * 100),
    pctAcerto: feitas ? Math.round((acertos / feitas) * 100) : 0,
  }
}
