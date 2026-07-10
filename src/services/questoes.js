import { supabase } from './supabase'

// Campos + relações padrão de uma questão
const SELECT_QUESTAO = `
  *,
  disciplinas(id, nome, cor),
  assuntos(id, nome),
  bancas(id, nome),
  orgaos(id, nome),
  questao_alternativas(id, letra, texto, correta, ordem)
`

function normalizar(q) {
  return {
    ...q,
    alternativas: q.questao_alternativas?.slice().sort((a, b) => a.ordem - b.ordem) ?? [],
  }
}

// ── Listagem ─────────────────────────────────────────────────

export async function listarQuestoes(filtros = {}) {
  // O Supabase/PostgREST devolve no máximo 1000 linhas por requisição.
  // Como o banco já passou de 1000 questões, paginamos até trazer todas.
  const PAGINA = 1000
  let inicio = 0
  const todas = []

  for (;;) {
    let query = supabase
      .from('questoes')
      .select(SELECT_QUESTAO)
      .order('criado_em', { ascending: false })

    if (filtros.tipo)          query = query.eq('tipo', filtros.tipo)
    if (filtros.disciplina_id) query = query.eq('disciplina_id', filtros.disciplina_id)
    if (filtros.assunto_id)    query = query.eq('assunto_id', filtros.assunto_id)
    if (filtros.banca_id)      query = query.eq('banca_id', filtros.banca_id)
    if (filtros.orgao_id)      query = query.eq('orgao_id', filtros.orgao_id)
    if (filtros.cargo)         query = query.eq('cargo', filtros.cargo)
    if (filtros.ano)           query = query.eq('ano', filtros.ano)
    if (filtros.nivel)         query = query.eq('nivel', filtros.nivel)
    if (filtros.dificuldade)   query = query.eq('dificuldade', filtros.dificuldade)

    const { data, error } = await query.range(inicio, inicio + PAGINA - 1)
    if (error) throw error

    todas.push(...data)
    if (data.length < PAGINA) break   // última página
    inicio += PAGINA
  }

  return todas.map(normalizar)
}

export async function buscarQuestao(id) {
  const { data, error } = await supabase
    .from('questoes')
    .select(SELECT_QUESTAO)
    .eq('id', id)
    .single()

  if (error) throw error
  return normalizar(data)
}

// ── Criação / Edição / Exclusão ───────────────────────────────

export async function criarQuestao(dados, alternativas) {
  const { video_url, ...campos } = dados
  const { data: questao, error } = await supabase
    .from('questoes')
    .insert({ ...campos, tem_video: !!video_url?.trim() })
    .select()
    .single()

  if (error) throw error

  await salvarAlternativas(questao.id, dados.tipo, alternativas)
  await salvarVideo(questao.id, video_url)
  return questao
}

export async function atualizarQuestao(id, dados, alternativas) {
  const { video_url, ...campos } = dados
  const { data: questao, error } = await supabase
    .from('questoes')
    .update({ ...campos, tem_video: !!video_url?.trim() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await salvarAlternativas(id, dados.tipo, alternativas)
  await salvarVideo(id, video_url)
  return questao
}

// A URL do vídeo mora em questao_videos (protegida por RLS: só admin/assinante lê)
async function salvarVideo(questaoId, videoUrl) {
  const url = videoUrl?.trim()
  if (url) {
    const { error } = await supabase
      .from('questao_videos')
      .upsert({ questao_id: questaoId, video_url: url }, { onConflict: 'questao_id' })
    if (error) throw error
  } else {
    await supabase.from('questao_videos').delete().eq('questao_id', questaoId)
  }
}

// Busca a URL do vídeo — retorna null se o usuário não for assinante (RLS)
export async function buscarVideoQuestao(questaoId) {
  const { data, error } = await supabase
    .from('questao_videos')
    .select('video_url')
    .eq('questao_id', questaoId)
    .maybeSingle()
  if (error) throw error
  return data?.video_url ?? null
}

async function salvarAlternativas(questaoId, tipo, alternativas) {
  // Sempre limpa: se mudou de múltipla escolha para certo/errado, remove as antigas
  await supabase.from('questao_alternativas').delete().eq('questao_id', questaoId)

  if (tipo === 'multipla_escolha' && alternativas?.length) {
    const { error } = await supabase.from('questao_alternativas').insert(
      alternativas.map((alt, i) => ({
        questao_id: questaoId,
        letra: alt.letra,
        texto: alt.texto,
        correta: alt.correta,
        ordem: i,
      }))
    )
    if (error) throw error
  }
}

export async function excluirQuestao(id) {
  const { error } = await supabase.from('questoes').delete().eq('id', id)
  if (error) throw error
}

// Marca/desmarca a questão como revisada (usado na revisão das imagens)
export async function marcarRevisada(id, revisada) {
  const { error } = await supabase
    .from('questoes')
    .update({ revisada })
    .eq('id', id)
  if (error) throw error
}

// ── Favoritos ─────────────────────────────────────────────────

export async function toggleFavorito(questaoId, favoritoId) {
  if (favoritoId) {
    await supabase.from('favoritos').delete().eq('id', favoritoId)
    return null
  }
  const { data, error } = await supabase
    .from('favoritos')
    .insert({ questao_id: questaoId })
    .select()
    .single()
  if (error) throw error
  return data?.id
}

export async function listarFavoritos() {
  const { data, error } = await supabase
    .from('favoritos')
    .select('id, questao_id')
  if (error) throw error
  return data ?? []
}

// Questões favoritadas, já com os detalhes para exibição
export async function listarQuestoesFavoritas() {
  const { data, error } = await supabase
    .from('favoritos')
    .select(`
      id,
      criado_em,
      questoes(${SELECT_QUESTAO})
    `)
    .order('criado_em', { ascending: false })

  if (error) throw error

  return (data || [])
    .filter(f => f.questoes)
    .map(f => ({
      ...normalizar(f.questoes),
      favorito_id: f.id,
    }))
}

// ── Classificação (disciplinas, assuntos, bancas, órgãos) ─────

export async function listarDisciplinas() {
  const { data, error } = await supabase
    .from('disciplinas')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
  if (error) throw error
  return data
}

export async function listarAssuntos(disciplinaId) {
  let query = supabase
    .from('assuntos')
    .select('id, nome, disciplina_id')
    .eq('ativo', true)
    .order('nome')

  if (disciplinaId) query = query.eq('disciplina_id', disciplinaId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function criarAssunto(disciplinaId, nome) {
  const { data, error } = await supabase
    .from('assuntos')
    .insert({ disciplina_id: disciplinaId, nome: nome.trim() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listarBancas() {
  const { data, error } = await supabase.from('bancas').select('*').order('nome')
  if (error) throw error
  return data
}

export async function criarBanca(nome) {
  const { data, error } = await supabase
    .from('bancas')
    .insert({ nome: nome.trim() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listarOrgaos() {
  const { data, error } = await supabase.from('orgaos').select('*').order('nome')
  if (error) throw error
  return data
}

// Cargos distintos presentes nas questões cadastradas (campo texto livre)
export async function listarCargos() {
  const { data, error } = await supabase
    .from('questoes')
    .select('cargo')
    .not('cargo', 'is', null)
  if (error) throw error
  return [...new Set(data.map(r => r.cargo?.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

// Anos distintos presentes nas questões cadastradas (mais recentes primeiro)
export async function listarAnos() {
  const { data, error } = await supabase
    .from('questoes')
    .select('ano')
    .not('ano', 'is', null)
  if (error) throw error
  return [...new Set(data.map(r => r.ano).filter(Boolean))].sort((a, b) => b - a)
}

export async function criarOrgao(nome) {
  const { data, error } = await supabase
    .from('orgaos')
    .insert({ nome: nome.trim() })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Utilidades de exibição ────────────────────────────────────

// Resumo do enunciado (sem HTML) para listagens
export function resumoEnunciado(html, tamanho = 160) {
  const texto = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return texto.length > tamanho ? texto.slice(0, tamanho) + '…' : texto
}

// Rótulo curto tipo "Cebraspe · PF · 2023" para identificar a questão
export function rotuloQuestao(q) {
  const partes = [q.bancas?.nome, q.orgaos?.nome, q.ano].filter(Boolean)
  return partes.length ? partes.join(' · ') : 'Questão sem origem'
}

// Gabarito em texto: letra correta ou Certo/Errado
export function gabaritoQuestao(q) {
  if (q.tipo === 'certo_errado') {
    if (q.gabarito_certo === true)  return 'Certo'
    if (q.gabarito_certo === false) return 'Errado'
    return '—'
  }
  const correta = (q.alternativas || []).find(a => a.correta)
  return correta?.letra ?? '—'
}
