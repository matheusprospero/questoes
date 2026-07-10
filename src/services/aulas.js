import { supabase } from './supabase'

// Campos + questões vinculadas de uma aula
const SELECT_AULA = `
  *,
  disciplinas(id, nome, cor),
  assuntos(id, nome),
  aula_questoes(
    ordem,
    questoes(
      *,
      disciplinas(id, nome, cor),
      assuntos(id, nome),
      bancas(id, nome),
      orgaos(id, nome),
      questao_alternativas(id, letra, texto, correta, ordem)
    )
  )
`

function normalizar(a) {
  return {
    ...a,
    conteudo: Array.isArray(a.conteudo) ? a.conteudo : [],
    questoes: (a.aula_questoes || [])
      .filter(aq => aq.questoes)
      .sort((x, y) => x.ordem - y.ordem)
      .map(aq => ({
        ...aq.questoes,
        ordem: aq.ordem,
        alternativas: aq.questoes.questao_alternativas?.slice().sort((p, q) => p.ordem - q.ordem) || [],
      })),
  }
}

// ── Listagem ──────────────────────────────────────────────

export async function listarAulas() {
  const { data, error } = await supabase
    .from('aulas')
    .select('*, disciplinas(id, nome, cor), aula_questoes(count)')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return (data || []).map(a => ({
    ...a,
    total_questoes: a.aula_questoes?.[0]?.count ?? 0,
  }))
}

export async function buscarAula(id) {
  const { data, error } = await supabase
    .from('aulas')
    .select(SELECT_AULA)
    .eq('id', id)
    .single()
  if (error) throw error
  return normalizar(data)
}

// ── Criação / Edição / Exclusão ──────────────────────────

function payloadAula(dados) {
  return {
    titulo: dados.titulo?.trim(),
    descricao: dados.descricao?.trim() || null,
    disciplina_id: dados.disciplina_id || null,
    assunto_id: dados.assunto_id || null,
    conteudo: dados.conteudo || [],
  }
}

export async function criarAula(dados, questaoIds) {
  const { data: aula, error } = await supabase
    .from('aulas')
    .insert(payloadAula(dados))
    .select()
    .single()
  if (error) throw error

  await salvarQuestoes(aula.id, questaoIds || [])
  return aula
}

export async function atualizarAula(id, dados, questaoIds) {
  const { data: aula, error } = await supabase
    .from('aulas')
    .update({ ...payloadAula(dados), atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  if (questaoIds) await salvarQuestoes(id, questaoIds)
  return aula
}

async function salvarQuestoes(aulaId, questaoIds) {
  await supabase.from('aula_questoes').delete().eq('aula_id', aulaId)
  if (questaoIds.length > 0) {
    const { error } = await supabase.from('aula_questoes').insert(
      questaoIds.map((qid, idx) => ({ aula_id: aulaId, questao_id: qid, ordem: idx }))
    )
    if (error) throw error
  }
}

export async function deletarAula(id) {
  const { error } = await supabase.from('aulas').delete().eq('id', id)
  if (error) throw error
}

// Publicar (ou despublicar) a aula para os alunos
export async function alternarPublicada(id, publicada) {
  const { error } = await supabase
    .from('aulas')
    .update({ publicada })
    .eq('id', id)
  if (error) throw error
}
