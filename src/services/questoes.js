import { supabase } from './supabase'

// ── Listagem ─────────────────────────────────────────────────

export async function listarQuestoes(filtros = {}) {
  let query = supabase
    .from('questoes')
    .select(`
      *,
      disciplinas(nome, cor),
      perfis(nome),
      questao_habilidades(
        habilidades(id, codigo, descricao)
      ),
      avaliacoes(nota),
      questao_alternativas(id, letra, texto, correta, ordem),
      questao_gabaritos(texto, criterios),
      aprovacoes(status_novo, criado_em, perfis(nome))
    `)
    .is('arquivado_em', null)
    .order('criado_em', { ascending: false })

  if (filtros.status)        query = query.eq('status', filtros.status)
  if (filtros.tipo)          query = query.eq('tipo', filtros.tipo)
  if (filtros.disciplina_id) query = query.eq('disciplina_id', filtros.disciplina_id)
  if (filtros.ano_escolar)   query = query.eq('ano_escolar', filtros.ano_escolar)
  if (filtros.dificuldade)   query = query.eq('nivel_dificuldade', filtros.dificuldade)
  if (filtros.autor_id)      query = query.eq('autor_id', filtros.autor_id)
  if (filtros.busca) {
    query = query.textSearch('busca', filtros.busca, {
      type: 'websearch',
      config: 'portuguese',
    })
  }

  const { data, error } = await query
  if (error) throw error
  return data.map(q => ({
    ...q,
    media_avaliacao: q.avaliacoes?.length
      ? q.avaliacoes.reduce((s, a) => s + a.nota, 0) / q.avaliacoes.length
      : null,
    total_avaliacoes: q.avaliacoes?.length ?? 0,
    habilidades: q.questao_habilidades?.map(qh => qh.habilidades) ?? [],
    alternativas: q.questao_alternativas?.sort((a,b) => a.ordem - b.ordem) ?? [],
    gabarito: q.questao_gabaritos?.[0] ?? null,
    validacao: validacaoDeAprovacoes(q.aprovacoes),
  }))
}

// Extrai quem validou (publicou) a questão a partir do histórico de aprovações
function validacaoDeAprovacoes(aprovacoes) {
  const pub = (aprovacoes ?? [])
    .filter(a => a.status_novo === 'publicado')
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))[0]
  return pub ? { nome: pub.perfis?.nome ?? null, em: pub.criado_em } : null
}

export async function buscarQuestao(id) {
  const { data, error } = await supabase
    .from('questoes')
    .select(`
      *,
      disciplinas(id, nome, cor),
      perfis(id, nome),
      questao_alternativas(id, letra, texto, correta, ordem),
      questao_gabaritos(id, texto, criterios),
      questao_habilidades(habilidades(id, codigo, descricao, ano_escolar)),
      avaliacoes(nota, autor_id),
      comentarios(id, texto, criado_em, arquivado_em, autor_id, pai_id, perfis(nome)),
      aprovacoes(status_novo, justificativa, criado_em, perfis(nome))
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  return {
    ...data,
    alternativas: data.questao_alternativas?.sort((a, b) => a.ordem - b.ordem) ?? [],
    gabarito: data.questao_gabaritos?.[0] ?? null,
    habilidades: data.questao_habilidades?.map(qh => qh.habilidades) ?? [],
    media_avaliacao: data.avaliacoes?.length
      ? data.avaliacoes.reduce((s, a) => s + a.nota, 0) / data.avaliacoes.length
      : null,
    comentarios: data.comentarios?.filter(c => !c.arquivado_em) ?? [],
    validacao: validacaoDeAprovacoes(data.aprovacoes),
  }
}

// ── Criação / Edição ──────────────────────────────────────────

export async function criarQuestao(dados, alternativas, gabarito, habilidadeIds) {
  const { data: questao, error } = await supabase
    .from('questoes')
    .insert(dados)
    .select()
    .single()

  if (error) throw error

  await salvarAlternativasEGabarito(questao.id, dados.tipo, alternativas, gabarito)
  await salvarHabilidades(questao.id, habilidadeIds)
  await salvarVersao(questao.id, 1, questao, 'Criação inicial')

  return questao
}

export async function atualizarQuestao(id, dados, alternativas, gabarito, habilidadeIds) {
  const { data: questao, error } = await supabase
    .from('questoes')
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await salvarAlternativasEGabarito(id, dados.tipo, alternativas, gabarito)
  await salvarHabilidades(id, habilidadeIds)
  await salvarVersao(id, dados.versao_atual, questao, dados.alteracoes || 'Atualização')

  return questao
}

async function salvarAlternativasEGabarito(questaoId, tipo, alternativas, gabarito) {
  if (tipo === 'multipla_escolha' && alternativas?.length) {
    await supabase.from('questao_alternativas').delete().eq('questao_id', questaoId)
    await supabase.from('questao_alternativas').insert(
      alternativas.map((alt, i) => ({
        questao_id: questaoId,
        letra: alt.letra,
        texto: alt.texto,
        correta: alt.correta,
        ordem: i,
      }))
    )
  }

  if (tipo === 'dissertativa' && gabarito) {
    await supabase.from('questao_gabaritos').delete().eq('questao_id', questaoId)
    await supabase.from('questao_gabaritos').insert({
      questao_id: questaoId,
      texto: gabarito.texto,
      criterios: gabarito.criterios,
    })
  }
}

async function salvarHabilidades(questaoId, habilidadeIds) {
  if (!habilidadeIds) return
  await supabase.from('questao_habilidades').delete().eq('questao_id', questaoId)
  if (habilidadeIds.length > 0) {
    await supabase.from('questao_habilidades').insert(
      habilidadeIds.map(hid => ({ questao_id: questaoId, habilidade_id: hid }))
    )
  }
}

async function salvarVersao(questaoId, versao, snapshot, alteracoes) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('questao_versoes').upsert({
    questao_id: questaoId,
    numero_versao: versao,
    snapshot,
    alteracoes,
    autor_id: user.id,
  })
}

// ── Fluxo de aprovação ────────────────────────────────────────

export async function mudarStatus(questaoId, novoStatus, justificativa = null) {
  const { data: questao } = await supabase
    .from('questoes')
    .select('status')
    .eq('id', questaoId)
    .single()

  const { error } = await supabase
    .from('questoes')
    .update({ status: novoStatus })
    .eq('id', questaoId)

  if (error) throw error

  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('aprovacoes').insert({
    questao_id: questaoId,
    status_anterior: questao.status,
    status_novo: novoStatus,
    justificativa,
    autor_id: user.id,
  })
}

// ── Avaliação ─────────────────────────────────────────────────

export async function avaliarQuestao(questaoId, nota) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('avaliacoes')
    .upsert({ questao_id: questaoId, nota, autor_id: user.id })
  if (error) throw error
}

// ── Favorito ──────────────────────────────────────────────────

export async function toggleFavorito(questaoId, favoritoId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (favoritoId) {
    await supabase.from('favoritos').delete().eq('id', favoritoId)
    return null
  }
  const { data } = await supabase
    .from('favoritos')
    .insert({ usuario_id: user.id, questao_id: questaoId })
    .select()
    .single()
  return data?.id
}

export async function listarFavoritos() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('favoritos')
    .select('id, questao_id')
    .eq('usuario_id', user.id)
    .not('questao_id', 'is', null)
  return data ?? []
}

// Questões favoritadas do usuário, já com os detalhes para exibição
export async function listarQuestoesFavoritas() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('favoritos')
    .select(`
      id,
      criado_em,
      questoes(
        *,
        disciplinas(nome, cor),
        perfis(nome),
        questao_alternativas(id, letra, texto, correta, ordem),
        questao_gabaritos(texto, criterios),
        questao_habilidades(habilidades(id, codigo, descricao)),
        avaliacoes(nota)
      )
    `)
    .eq('usuario_id', user.id)
    .not('questao_id', 'is', null)
    .order('criado_em', { ascending: false })

  if (error) throw error

  return (data || [])
    .filter(f => f.questoes)
    .map(f => ({
      ...f.questoes,
      favorito_id: f.id,
      alternativas: f.questoes.questao_alternativas?.sort((a, b) => a.ordem - b.ordem) ?? [],
      gabarito: f.questoes.questao_gabaritos?.[0] ?? null,
      habilidades: f.questoes.questao_habilidades?.map(qh => qh.habilidades) ?? [],
      media_avaliacao: f.questoes.avaliacoes?.length
        ? f.questoes.avaliacoes.reduce((s, a) => s + a.nota, 0) / f.questoes.avaliacoes.length
        : null,
      total_avaliacoes: f.questoes.avaliacoes?.length ?? 0,
    }))
}

// ── Dados auxiliares ──────────────────────────────────────────

export async function listarDisciplinas() {
  const { data, error } = await supabase
    .from('disciplinas')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
  if (error) throw error
  return data
}

export async function listarHabilidades(filtros = {}) {
  let query = supabase
    .from('habilidades')
    .select('id, codigo, descricao, ano_escolar, disciplina_id')
    .eq('ativo', true)
    .order('codigo')

  if (filtros.disciplina_id) query = query.eq('disciplina_id', filtros.disciplina_id)
  if (filtros.ano_escolar)   query = query.eq('ano_escolar', filtros.ano_escolar)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function registrarVisualizacao(questaoId) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('historico_uso').insert({
    usuario_id: user?.id,
    tipo_acao: 'visualizacao',
    questao_id: questaoId,
  })
}

export async function adicionarQuestaoProva(provaId, questaoId) {
  // Obter próxima ordem
  const { data: maxOrdem } = await supabase
    .from('prova_questoes')
    .select('ordem')
    .eq('prova_id', provaId)
    .order('ordem', { ascending: false })
    .limit(1)
    .single()
  
  const novaOrdem = (maxOrdem?.ordem ?? -1) + 1
  
  // Inserir questão na prova
  const { error } = await supabase.from('prova_questoes').insert({
    prova_id: provaId,
    questao_id: questaoId,
    ordem: novaOrdem,
  })
  
  if (error) throw error
}
