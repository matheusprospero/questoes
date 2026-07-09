import { supabase } from './supabase'

// ── Listagem ──────────────────────────────────────────────

export async function listarProvas(filtros = {}) {
  let query = supabase
    .from('provas')
    .select(`
      *,
      disciplinas(nome, cor),
      perfis(nome),
      prova_questoes(count)
    `)
    .order('criado_em', { ascending: false })

  if (filtros.disciplina_id)  query = query.eq('disciplina_id', filtros.disciplina_id)
  if (filtros.autor_id)       query = query.eq('autor_id', filtros.autor_id)
  if (filtros.ano_escolar)    query = query.eq('ano_escolar', filtros.ano_escolar)
  if (filtros.visibilidade)    query = query.eq('visibilidade', filtros.visibilidade)
  if (filtros.status_revisao)  query = query.eq('status_revisao', filtros.status_revisao)

  const { data, error } = await query

  if (error) throw error
  return data.map(p => ({
    ...p,
    total_questoes: p.prova_questoes?.[0]?.count ?? 0,
  }))
}

export async function buscarProva(id) {
  const { data, error } = await supabase
    .from('provas')
    .select(`
      *,
      disciplinas(id, nome, cor),
      perfis(id, nome),
      prova_questoes(
        ordem,
        questoes(
          id, titulo, tipo, enunciado, nivel_dificuldade,
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
    questoes: (data.prova_questoes || [])
      .sort((a, b) => a.ordem - b.ordem)
      .map(pq => ({
        ...pq.questoes,
        ordem: pq.ordem,
        alternativas: pq.questoes.questao_alternativas?.sort((a, b) => a.ordem - b.ordem) || [],
        gabarito: pq.questoes.questao_gabaritos?.[0] || null,
      })),
  }
}

// ── Criação / Edição ──────────────────────────────────────

export async function criarProva(dados, questaoIds) {
  const payload = {
    titulo: dados.titulo,
    descricao: dados.descricao || null,
    disciplina_id: dados.disciplina_id || null,
    disciplinas_ids: dados.disciplinas_ids || [],
    tipo_prova: dados.tipo_prova || 'disciplina',
    ano_escolar: dados.ano_escolar || null,
    instrucoes: dados.instrucoes || null,
    visibilidade: dados.visibilidade || 'pessoal',
    cabecalho: dados.cabecalho || '',
    cfg_impressao: dados.cfg_impressao || {},
    status_revisao: dados.status_revisao || 'rascunho',
    autor_id: dados.autor_id,
  }
  const { data: prova, error } = await supabase
    .from('provas')
    .insert(payload)
    .select()
    .single()

  if (error) throw error

  if (questaoIds && questaoIds.length > 0) {
    await salvarQuestoes(prova.id, questaoIds)
  }

  return prova
}

export async function atualizarProva(id, dados, questaoIds) {
  const payload = {
    titulo: dados.titulo,
    descricao: dados.descricao || null,
    disciplina_id: dados.disciplina_id || null,
    disciplinas_ids: dados.disciplinas_ids || [],
    tipo_prova: dados.tipo_prova || 'disciplina',
    ano_escolar: dados.ano_escolar || null,
    instrucoes: dados.instrucoes || null,
    visibilidade: dados.visibilidade || 'pessoal',
    cabecalho: dados.cabecalho || '',
    cfg_impressao: dados.cfg_impressao || {},
    status_revisao: dados.status_revisao || 'rascunho',
  }
  const { data: prova, error } = await supabase
    .from('provas')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  if (questaoIds) {
    await salvarQuestoes(id, questaoIds)
  }

  return prova
}

export async function mudarStatusProva(id, novoStatus, justificativa = null) {
  const payload = { status_revisao: novoStatus }
  if (novoStatus === 'publicado') payload.visibilidade = 'rede'
  if (novoStatus === 'rascunho')  payload.visibilidade = 'pessoal'
  const { error } = await supabase.from('provas').update(payload).eq('id', id)
  if (error) throw error
}

async function salvarQuestoes(provaId, questaoIds) {
  await supabase.from('prova_questoes').delete().eq('prova_id', provaId)

  if (questaoIds.length > 0) {
    await supabase.from('prova_questoes').insert(
      questaoIds.map((qid, idx) => ({
        prova_id: provaId,
        questao_id: qid,
        ordem: idx,
      }))
    )
  }
}

export async function deletarProva(id) {
  const { error } = await supabase.from('provas').delete().eq('id', id)
  if (error) throw error
}

// ── Reordenar questões ────────────────────────────────────

export async function reordenarQuestoes(provaId, novaOrdem) {
  // novaOrdem é um array de IDs na ordem desejada
  const atualizacoes = novaOrdem.map((questaoId, idx) => ({
    prova_id: provaId,
    questao_id: questaoId,
    ordem: idx,
  }))

  await supabase.from('prova_questoes').delete().eq('prova_id', provaId)
  await supabase.from('prova_questoes').insert(atualizacoes)
}

// ── Geração de PDF ────────────────────────────────────────

export async function gerarPDFProva(provaData) {
  // Função auxiliar que retorna o HTML para o PDF
  // (a implementação real usa uma lib como html2pdf ou puppeteer)
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${provaData.titulo}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { text-align: center; font-size: 20px; margin-bottom: 10px; }
          .header { text-align: center; margin-bottom: 30px; font-size: 12px; }
          .questao { margin-bottom: 30px; page-break-inside: avoid; }
          .questao-numero { font-weight: bold; margin-bottom: 8px; }
          .enunciado { margin-bottom: 12px; line-height: 1.6; }
          .alternativa { margin-left: 20px; margin-bottom: 6px; }
          .alternativa-letra { font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>${provaData.titulo}</h1>
        <div class="header">
          <p>Disciplina: ${provaData.disciplinas?.nome || '—'}</p>
          <p>Ano: ${provaData.ano_escolar || '—'} | Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          <p>Total de questões: ${provaData.questoes?.length || 0}</p>
        </div>
        
        ${(provaData.questoes || []).map((q, idx) => `
          <div class="questao">
            <div class="questao-numero">Questão ${idx + 1}</div>
            <div class="enunciado">${q.enunciado}</div>
            ${q.tipo === 'multipla_escolha' && q.alternativas ? `
              ${q.alternativas.map(alt => `
                <div class="alternativa">
                  <span class="alternativa-letra">${alt.letra})</span> ${alt.texto}
                </div>
              `).join('')}
            ` : `
              <div style="height: 60px; border: 1px solid #ccc; margin-left: 20px;"></div>
            `}
          </div>
        `).join('')}
      </body>
    </html>
  `

  return html
}

// ── Rastreamento ──────────────────────────────────────────

export async function registrarUsoProva(provaId) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('historico_uso').insert({
    usuario_id: user?.id,
    tipo_acao: 'visualizacao_prova',
    prova_id: provaId,
  })
}

// ── Dados auxiliares ──────────────────────────────────────

export async function listarDisciplinas() {
  const { data, error } = await supabase
    .from('disciplinas')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
  if (error) throw error
  return data
}

export async function listarQuestoesBuscaRapida(filtros = {}) {
  let query = supabase
    .from('questoes')
    .select('id, titulo, disciplina_id, tipo, nivel_dificuldade')
    .eq('status', 'publicado')
    .is('arquivado_em', null)
    .order('titulo')

  if (filtros.disciplina_id) query = query.eq('disciplina_id', filtros.disciplina_id)
  if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
  if (filtros.busca) {
    query = query.ilike('titulo', `%${filtros.busca}%`)
  }

  const { data, error } = await query.limit(50)
  if (error) throw error
  return data
}
