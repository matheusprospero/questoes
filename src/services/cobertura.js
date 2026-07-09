import { supabase } from './supabase'

// Cruza habilidades × questões para identificar lacunas de cobertura.
export async function carregarCobertura(filtros = {}) {
  // 1. Habilidades ativas (com disciplina)
  let habQuery = supabase
    .from('habilidades')
    .select('id, codigo, descricao, ano_escolar, disciplina_id, disciplinas(nome, cor)')
    .eq('ativo', true)
    .order('codigo', { ascending: true })

  if (filtros.disciplina_id) habQuery = habQuery.eq('disciplina_id', filtros.disciplina_id)
  if (filtros.ano_escolar)   habQuery = habQuery.eq('ano_escolar', filtros.ano_escolar)

  // 2. Vínculos questão↔habilidade, com status/arquivamento da questão
  const [habRes, vincRes] = await Promise.all([
    habQuery,
    supabase.from('questao_habilidades').select('habilidade_id, questoes(status, arquivado_em)'),
  ])

  if (habRes.error) throw habRes.error
  if (vincRes.error) throw vincRes.error

  const habilidades = habRes.data ?? []
  const vinculos = vincRes.data ?? []

  // Contagem por habilidade (ignora questões arquivadas)
  const contagem = {}   // habId -> { total, publicadas }
  for (const v of vinculos) {
    const q = v.questoes
    if (!q || q.arquivado_em) continue
    const c = contagem[v.habilidade_id] || (contagem[v.habilidade_id] = { total: 0, publicadas: 0 })
    c.total++
    if (q.status === 'publicado') c.publicadas++
  }

  // Enriquecer habilidades com a contagem
  const itens = habilidades.map(h => {
    const c = contagem[h.id] || { total: 0, publicadas: 0 }
    return {
      ...h,
      total: c.total,
      publicadas: c.publicadas,
      nivel: c.publicadas === 0 ? (c.total === 0 ? 'sem' : 'rascunho') : c.publicadas < 3 ? 'baixa' : 'ok',
    }
  })

  // Resumo geral
  const resumo = {
    totalHabilidades: itens.length,
    semQuestoes: itens.filter(i => i.total === 0).length,
    semPublicadas: itens.filter(i => i.publicadas === 0).length,
    cobertas: itens.filter(i => i.publicadas > 0).length,
  }
  resumo.percentualCobertura = itens.length
    ? Math.round((resumo.cobertas / itens.length) * 100)
    : 0

  // Agrupamento por disciplina
  const grupos = {}
  for (const it of itens) {
    const nome = it.disciplinas?.nome || 'Sem disciplina'
    if (!grupos[nome]) {
      grupos[nome] = { nome, cor: it.disciplinas?.cor || '#94a3b8', itens: [], cobertas: 0 }
    }
    grupos[nome].itens.push(it)
    if (it.publicadas > 0) grupos[nome].cobertas++
  }
  const porDisciplina = Object.values(grupos)
    .map(g => ({ ...g, percentual: g.itens.length ? Math.round((g.cobertas / g.itens.length) * 100) : 0 }))
    .sort((a, b) => a.percentual - b.percentual)

  return { itens, resumo, porDisciplina }
}
