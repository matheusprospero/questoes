import { supabase } from './supabase'

// ── Listagem ──────────────────────────────────────────────

export async function listarSimulados() {
  const { data, error } = await supabase
    .from('simulados')
    .select(`
      *,
      simulado_questoes(count)
    `)
    .order('criado_em', { ascending: false })

  if (error) throw error
  return data.map(s => ({
    ...s,
    total_questoes: s.simulado_questoes?.[0]?.count ?? 0,
  }))
}

export async function buscarSimulado(id) {
  const { data, error } = await supabase
    .from('simulados')
    .select(`
      *,
      simulado_questoes(
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
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  return {
    ...data,
    questoes: (data.simulado_questoes || [])
      .filter(sq => sq.questoes)
      .sort((a, b) => a.ordem - b.ordem)
      .map(sq => ({
        ...sq.questoes,
        ordem: sq.ordem,
        alternativas: sq.questoes.questao_alternativas?.slice().sort((a, b) => a.ordem - b.ordem) || [],
      })),
  }
}

// ── Criação / Edição / Exclusão ──────────────────────────

export async function criarSimulado(dados, questaoIds) {
  const payload = {
    titulo: dados.titulo,
    descricao: dados.descricao || null,
    instrucoes: dados.instrucoes || null,
    cabecalho: dados.cabecalho || '',
    cfg_impressao: dados.cfg_impressao || {},
  }
  const { data: simulado, error } = await supabase
    .from('simulados')
    .insert(payload)
    .select()
    .single()

  if (error) throw error

  if (questaoIds && questaoIds.length > 0) {
    await salvarQuestoes(simulado.id, questaoIds)
  }

  return simulado
}

export async function atualizarSimulado(id, dados, questaoIds) {
  const payload = {
    titulo: dados.titulo,
    descricao: dados.descricao || null,
    instrucoes: dados.instrucoes || null,
    cabecalho: dados.cabecalho || '',
    cfg_impressao: dados.cfg_impressao || {},
  }
  const { data: simulado, error } = await supabase
    .from('simulados')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  if (questaoIds) {
    await salvarQuestoes(id, questaoIds)
  }

  return simulado
}

async function salvarQuestoes(simuladoId, questaoIds) {
  await supabase.from('simulado_questoes').delete().eq('simulado_id', simuladoId)

  if (questaoIds.length > 0) {
    const { error } = await supabase.from('simulado_questoes').insert(
      questaoIds.map((qid, idx) => ({
        simulado_id: simuladoId,
        questao_id: qid,
        ordem: idx,
      }))
    )
    if (error) throw error
  }
}

// Professor propõe (ou retira a proposta de) um simulado para todos os alunos
export async function alternarProposto(id, proposto) {
  const { error } = await supabase
    .from('simulados')
    .update({ proposto })
    .eq('id', id)
  if (error) throw error
}

export async function deletarSimulado(id) {
  const { error } = await supabase.from('simulados').delete().eq('id', id)
  if (error) throw error
}

export async function adicionarQuestaoSimulado(simuladoId, questaoId) {
  const { data: maxOrdem } = await supabase
    .from('simulado_questoes')
    .select('ordem')
    .eq('simulado_id', simuladoId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const novaOrdem = (maxOrdem?.ordem ?? -1) + 1

  const { error } = await supabase
    .from('simulado_questoes')
    .upsert(
      { simulado_id: simuladoId, questao_id: questaoId, ordem: novaOrdem },
      { onConflict: 'simulado_id,questao_id', ignoreDuplicates: true }
    )

  if (error) throw error
}
