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
  // Retirar a proposta também tira o destaque (o aluno deixa de vê-lo)
  const patch = proposto ? { proposto } : { proposto, destaque: false }
  const { error } = await supabase
    .from('simulados')
    .update(patch)
    .eq('id', id)
  if (error) throw error
}

// Destacar na página inicial (card de "propaganda"). Destacar já propõe a todos.
export async function alternarDestaque(id, destaque) {
  const patch = destaque ? { destaque: true, proposto: true } : { destaque: false }
  const { error } = await supabase
    .from('simulados')
    .update(patch)
    .eq('id', id)
  if (error) throw error
}

// Simulados em destaque, visíveis a todos os alunos (para a página inicial)
export async function listarSimuladosDestaque() {
  const { data, error } = await supabase
    .from('simulados')
    .select('id, titulo, descricao, criado_em, simulado_questoes(count)')
    .eq('proposto', true)
    .eq('destaque', true)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return (data || []).map(s => ({
    ...s,
    total_questoes: s.simulado_questoes?.[0]?.count ?? 0,
  }))
}

export async function deletarSimulado(id) {
  const { error } = await supabase.from('simulados').delete().eq('id', id)
  if (error) throw error
}

// ── Relatório de desempenho (simulados propostos) ─────────────
// Agrega as respostas dos alunos ligadas a este simulado (respostas.simulado_id).
// Só o dono (professor) consegue ler as respostas dos outros (RLS).
export async function relatorioSimulado(id) {
  const simulado = await buscarSimulado(id)

  const { data: respostas, error } = await supabase
    .from('respostas')
    .select('usuario_id, questao_id, resposta, acertou, respondido_em')
    .eq('simulado_id', id)
  if (error) throw error

  // Nomes/e-mails dos participantes (admin lê perfis)
  const idsAlunos = [...new Set((respostas || []).map(r => r.usuario_id))]
  let perfis = []
  if (idsAlunos.length) {
    const { data } = await supabase
      .from('perfis')
      .select('id, nome, email')
      .in('id', idsAlunos)
    perfis = data || []
  }
  const perfilPor = new Map(perfis.map(p => [p.id, p]))

  const gabaritoLetra = (q) =>
    q.tipo === 'certo_errado'
      ? (q.gabarito_certo ? 'C' : 'E')
      : (q.alternativas.find(a => a.correta)?.letra ?? null)

  // ── Por questão ──
  const porQuestao = simulado.questoes.map((q, i) => {
    const doQ = (respostas || []).filter(r => r.questao_id === q.id)
    const distribuicao = {}
    for (const r of doQ) distribuicao[r.resposta] = (distribuicao[r.resposta] || 0) + 1
    const acertos = doQ.filter(r => r.acertou).length
    const total = doQ.length
    const maisMarcada = Object.entries(distribuicao)
      .sort((a, b) => b[1] - a[1])[0] // [letra, count] ou undefined
    return {
      numero: i + 1,
      id: q.id,
      enunciado: q.enunciado,
      tipo: q.tipo,
      disciplina: q.disciplinas?.nome ?? null,
      alternativas: q.alternativas,
      letraCorreta: gabaritoLetra(q),
      total,
      acertos,
      erros: total - acertos,
      taxaAcerto: total ? Math.round((acertos / total) * 100) : null,
      distribuicao,
      maisMarcada: maisMarcada ? { letra: maisMarcada[0], qtd: maisMarcada[1] } : null,
    }
  })

  // ── Por aluno ──
  const porAlunoMap = new Map()
  for (const r of (respostas || [])) {
    const g = porAlunoMap.get(r.usuario_id) ?? { id: r.usuario_id, respondidas: 0, acertos: 0, ultima: null }
    g.respondidas += 1
    if (r.acertou) g.acertos += 1
    if (!g.ultima || r.respondido_em > g.ultima) g.ultima = r.respondido_em
    porAlunoMap.set(r.usuario_id, g)
  }
  const totalQuestoes = simulado.questoes.length
  const porAluno = [...porAlunoMap.values()].map(a => {
    const perfil = perfilPor.get(a.id)
    return {
      ...a,
      nome: perfil?.nome || 'Aluno',
      email: perfil?.email || '',
      taxa: a.respondidas ? Math.round((a.acertos / a.respondidas) * 100) : 0,
      completou: totalQuestoes ? a.respondidas >= totalQuestoes : false,
    }
  }).sort((a, b) => b.taxa - a.taxa || b.respondidas - a.respondidas)

  // ── Totais ──
  const totalRespostas = (respostas || []).length
  const totalAcertos = (respostas || []).filter(r => r.acertou).length
  const comStats = porQuestao.filter(q => q.total > 0)
  const maisDificeis = [...comStats].sort((a, b) => a.taxaAcerto - b.taxaAcerto).slice(0, 3)
  const maisFaceis = [...comStats].sort((a, b) => b.taxaAcerto - a.taxaAcerto).slice(0, 3)

  return {
    simulado: { id: simulado.id, titulo: simulado.titulo, proposto: simulado.proposto },
    totalQuestoes,
    participantes: idsAlunos.length,
    concluintes: porAluno.filter(a => a.completou).length,
    totalRespostas,
    totalAcertos,
    totalErros: totalRespostas - totalAcertos,
    taxaAcertoGeral: totalRespostas ? Math.round((totalAcertos / totalRespostas) * 100) : null,
    porQuestao,
    porAluno,
    maisDificeis,
    maisFaceis,
  }
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
