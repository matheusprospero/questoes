import { supabase } from './supabase'

const SELECT_QUESTAO = `
  *,
  disciplinas(id, nome, cor),
  assuntos(id, nome),
  bancas(id, nome),
  orgaos(id, nome),
  questao_alternativas(id, letra, texto, correta, ordem)
`

// ── Listagem ──────────────────────────────────────────────

export async function listarCadernos() {
  const { data, error } = await supabase
    .from('cadernos')
    .select(`
      *,
      caderno_questoes(count)
    `)
    .order('criado_em', { ascending: false })

  if (error) throw error
  return data.map(c => ({
    ...c,
    total_questoes: c.caderno_questoes?.[0]?.count ?? 0,
  }))
}

export async function buscarCaderno(id) {
  const { data, error } = await supabase
    .from('cadernos')
    .select(`
      *,
      caderno_questoes(
        ordem,
        questoes(${SELECT_QUESTAO})
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  return {
    ...data,
    questoes: (data.caderno_questoes || [])
      .filter(cq => cq.questoes)
      .sort((a, b) => a.ordem - b.ordem)
      .map(cq => ({
        ...cq.questoes,
        ordem: cq.ordem,
        alternativas: cq.questoes.questao_alternativas?.slice().sort((a, b) => a.ordem - b.ordem) || [],
      })),
  }
}

// ── Criação / Edição / Exclusão ──────────────────────────

export async function criarCaderno(dados) {
  const { data, error } = await supabase
    .from('cadernos')
    .insert({
      nome: dados.nome,
      descricao: dados.descricao || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function atualizarCaderno(id, dados) {
  const { error } = await supabase
    .from('cadernos')
    .update({
      nome: dados.nome,
      descricao: dados.descricao || null,
    })
    .eq('id', id)

  if (error) throw error
}

export async function deletarCaderno(id) {
  const { error } = await supabase.from('cadernos').delete().eq('id', id)
  if (error) throw error
}

// ── Questões do caderno ──────────────────────────────────

export async function adicionarQuestaoCaderno(cadernoId, questaoId) {
  // Próxima ordem (no fim da lista)
  const { data: maxOrdem } = await supabase
    .from('caderno_questoes')
    .select('ordem')
    .eq('caderno_id', cadernoId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const novaOrdem = (maxOrdem?.ordem ?? -1) + 1

  // upsert + ignoreDuplicates: re-adicionar a mesma questão não gera erro
  const { error } = await supabase
    .from('caderno_questoes')
    .upsert(
      { caderno_id: cadernoId, questao_id: questaoId, ordem: novaOrdem },
      { onConflict: 'caderno_id,questao_id', ignoreDuplicates: true }
    )

  if (error) throw error
}

export async function removerQuestaoCaderno(cadernoId, questaoId) {
  const { error } = await supabase
    .from('caderno_questoes')
    .delete()
    .eq('caderno_id', cadernoId)
    .eq('questao_id', questaoId)

  if (error) throw error
}
