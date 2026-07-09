import { supabase } from './supabase'

// ── Listagem ──────────────────────────────────────────────

export async function listarColecoes(filtros = {}) {
  let query = supabase
    .from('colecoes')
    .select(`
      *,
      perfis(nome),
      colecao_questoes(count)
    `)
    .order('criado_em', { ascending: false })

  if (filtros.autor_id)            query = query.eq('autor_id', filtros.autor_id)
  if (filtros.publica !== undefined) query = query.eq('publica', filtros.publica)

  const { data, error } = await query
  if (error) throw error
  return data.map(c => ({
    ...c,
    total_questoes: c.colecao_questoes?.[0]?.count ?? 0,
  }))
}

export async function buscarColecao(id) {
  const { data, error } = await supabase
    .from('colecoes')
    .select(`
      *,
      perfis(id, nome),
      colecao_questoes(
        ordem,
        questoes(
          id, titulo, tipo, enunciado, ano_escolar, nivel_dificuldade, status, autor_id,
          disciplinas(nome, cor),
          questao_alternativas(id, letra, texto, correta, ordem),
          questao_gabaritos(texto, criterios)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  return {
    ...data,
    questoes: (data.colecao_questoes || [])
      .filter(cq => cq.questoes)
      .sort((a, b) => a.ordem - b.ordem)
      .map(cq => ({
        ...cq.questoes,
        ordem: cq.ordem,
        alternativas: cq.questoes.questao_alternativas?.sort((a, b) => a.ordem - b.ordem) || [],
        gabarito: cq.questoes.questao_gabaritos?.[0] || null,
      })),
  }
}

// ── Criação / Edição / Exclusão ──────────────────────────

export async function criarColecao(dados) {
  const { data, error } = await supabase
    .from('colecoes')
    .insert({
      nome: dados.nome,
      descricao: dados.descricao || null,
      publica: dados.publica || false,
      autor_id: dados.autor_id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function atualizarColecao(id, dados) {
  const { error } = await supabase
    .from('colecoes')
    .update({
      nome: dados.nome,
      descricao: dados.descricao || null,
      publica: dados.publica ?? false,
    })
    .eq('id', id)

  if (error) throw error
}

export async function deletarColecao(id) {
  const { error } = await supabase.from('colecoes').delete().eq('id', id)
  if (error) throw error
}

// ── Questões da coleção ──────────────────────────────────

export async function adicionarQuestaoColecao(colecaoId, questaoId) {
  // Próxima ordem (no fim da lista)
  const { data: maxOrdem } = await supabase
    .from('colecao_questoes')
    .select('ordem')
    .eq('colecao_id', colecaoId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const novaOrdem = (maxOrdem?.ordem ?? -1) + 1

  // upsert + ignoreDuplicates: re-adicionar a mesma questão não gera erro
  const { error } = await supabase
    .from('colecao_questoes')
    .upsert(
      { colecao_id: colecaoId, questao_id: questaoId, ordem: novaOrdem },
      { onConflict: 'colecao_id,questao_id', ignoreDuplicates: true }
    )

  if (error) throw error
}

export async function removerQuestaoColecao(colecaoId, questaoId) {
  const { error } = await supabase
    .from('colecao_questoes')
    .delete()
    .eq('colecao_id', colecaoId)
    .eq('questao_id', questaoId)

  if (error) throw error
}
