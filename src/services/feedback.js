import { supabase } from './supabase'

// ── Reportar problema ─────────────────────────────────────────
export async function criarReport({ questao_id, tipo, descricao }) {
  const { error } = await supabase.from('questao_reports').insert({ questao_id, tipo, descricao: descricao || null })
  if (error) throw error
}

export async function listarReports({ apenasAbertos = false } = {}) {
  let q = supabase
    .from('questao_reports')
    .select('*, questoes(id, codigo, enunciado, bancas(nome), orgaos(nome), ano, cargo)')
    .order('criado_em', { ascending: false })
  if (apenasAbertos) q = q.eq('resolvido', false)
  const { data, error } = await q
  if (error) throw error
  const reports = data ?? []

  // Junta nome/e-mail de quem reportou (admin lê perfis; aluno vê só o próprio)
  const ids = [...new Set(reports.map(r => r.usuario_id).filter(Boolean))]
  if (ids.length) {
    const { data: perfis } = await supabase
      .from('perfis')
      .select('id, nome, email')
      .in('id', ids)
    const porId = new Map((perfis ?? []).map(p => [p.id, p]))
    for (const r of reports) r.autor = porId.get(r.usuario_id) ?? null
  }

  // Status do e-mail de aviso na fila (enviado pelo Google Apps Script)
  const repIds = reports.map(r => r.id)
  if (repIds.length) {
    const { data: fila } = await supabase
      .from('emails_fila')
      .select('report_id, status, enviado_em')
      .in('report_id', repIds)
    if (fila) {
      const porReport = new Map(fila.map(f => [f.report_id, f]))
      for (const r of reports) r.email = porReport.get(r.id) ?? null
    }
  }
  return reports
}

// ── Modelos de e-mail (personalizáveis na tela Reportados) ──
// Chaves em config_app. Boas-vindas e lembrete são disparados pelo BANCO
// (trigger em perfis / função enfileirar_lembretes_metas chamada pelo Apps Script).
export const MODELOS_EMAIL = {
  email_report: {
    label: 'Questão corrigida (report)',
    variaveis: [
      { tag: '{nome}', desc: 'primeiro nome do aluno' },
      { tag: '{nome_completo}', desc: 'nome completo' },
      { tag: '{codigo}', desc: 'código da questão' },
      { tag: '{tipo}', desc: 'tipo do problema reportado' },
    ],
    exemplo: { '{nome}': 'Maria', '{nome_completo}': 'Maria da Silva', '{codigo}': 'ALUM-2016-MAT-17', '{tipo}': 'Gabarito errado' },
    assunto: 'Questão corrigida — obrigado pelo aviso!',
    corpo:
      'Olá {nome}!\n\n' +
      'A questão que você reportou ({codigo}) foi verificada e corrigida. ' +
      'Obrigado por avisar — isso ajuda todo mundo que estuda na plataforma.\n\n' +
      'Bons estudos!\nProf. Matheus Próspero',
  },
  email_boas_vindas: {
    label: 'Boas-vindas (aluno novo)',
    variaveis: [
      { tag: '{nome}', desc: 'primeiro nome do aluno' },
      { tag: '{nome_completo}', desc: 'nome completo' },
    ],
    exemplo: { '{nome}': 'Maria', '{nome_completo}': 'Maria da Silva' },
    assunto: 'Bem-vindo(a), {nome}! Seus estudos começam agora 🚀',
    corpo:
      'Olá {nome}!\n\n' +
      'Sua conta na plataforma do Prof. Matheus Próspero está pronta. Por aqui você encontra:\n\n' +
      '• Banco de questões de concursos com correção na hora;\n' +
      '• Meta do dia personalizada — defina a sua na página Início;\n' +
      '• Plano de Estudos para organizar o edital;\n' +
      '• Estatísticas e boletim para acompanhar sua evolução.\n\n' +
      'Comece definindo sua meta diária e resolvendo as primeiras questões ainda hoje!\n\n' +
      'Bons estudos!\nProf. Matheus Próspero\nhttps://matheusprospero.com.br',
  },
  email_lembrete: {
    label: 'Lembrete diário de meta',
    variaveis: [
      { tag: '{nome}', desc: 'primeiro nome do aluno' },
      { tag: '{nome_completo}', desc: 'nome completo' },
      { tag: '{feitas}', desc: 'questões resolvidas hoje' },
      { tag: '{meta}', desc: 'meta diária do aluno' },
      { tag: '{restantes}', desc: 'quantas faltam para a meta' },
    ],
    exemplo: { '{nome}': 'Maria', '{nome_completo}': 'Maria da Silva', '{feitas}': '8', '{meta}': '20', '{restantes}': '12' },
    assunto: 'Sua meta de hoje ainda não fechou, {nome} 🎯',
    corpo:
      'Olá {nome}!\n\n' +
      'Passando para lembrar da sua meta de hoje: você já resolveu {feitas} de {meta} questões — faltam {restantes}.\n\n' +
      'Que tal fechar agora? Entre na plataforma e toque em "Começar meta do dia":\nhttps://matheusprospero.com.br\n\n' +
      'Constância vence talento. Até já!\nProf. Matheus Próspero',
  },
}

export const MODELO_EMAIL_PADRAO = {
  assunto: MODELOS_EMAIL.email_report.assunto,
  corpo: MODELOS_EMAIL.email_report.corpo,
}

const TIPO_LABEL = {
  gabarito: 'Gabarito errado',
  sem_resposta: 'Sem resposta correta',
  enunciado: 'Enunciado / imagem',
  outro: 'Outro',
}

export async function lerModeloEmail(chave = 'email_report') {
  const padrao = { assunto: MODELOS_EMAIL[chave].assunto, corpo: MODELOS_EMAIL[chave].corpo }
  const { data, error } = await supabase
    .from('config_app')
    .select('valor')
    .eq('chave', chave)
    .maybeSingle()
  if (error) return padrao   // tabela pode não existir ainda
  return { ...padrao, ...(data?.valor || {}) }
}

export async function salvarModeloEmail(chave, modelo) {
  const { error } = await supabase.from('config_app').upsert({
    chave,
    valor: { assunto: modelo.assunto, corpo: modelo.corpo },
    atualizado_em: new Date().toISOString(),
  })
  if (error) throw error
}

// Prévia: aplica um mapa {variavel: valor} ao texto
export function aplicarExemplo(texto, mapa) {
  let t = texto || ''
  for (const [tag, val] of Object.entries(mapa || {})) t = t.replaceAll(tag, val)
  return t
}

// Substitui as variáveis do modelo pelos dados do report.
export function aplicarModelo(texto, report) {
  const nomeCompleto = report.autor?.nome || ''
  return (texto || '')
    .replaceAll('{nome}', nomeCompleto ? nomeCompleto.split(' ')[0] : 'aluno(a)')
    .replaceAll('{nome_completo}', nomeCompleto || 'aluno(a)')
    .replaceAll('{codigo}', report.questoes?.codigo || 'questão reportada')
    .replaceAll('{tipo}', TIPO_LABEL[report.tipo] ?? report.tipo ?? '')
}

// Coloca na fila o e-mail de "questão corrigida" para quem reportou.
// O envio em si é feito pelo Google Apps Script (acionador de 10 em 10 min).
export async function enfileirarEmailReport(report) {
  const email = report.autor?.email
  if (!email) throw new Error('Quem reportou não tem e-mail cadastrado')
  const modelo = await lerModeloEmail()
  const { error } = await supabase.from('emails_fila').insert({
    para: email,
    assunto: aplicarModelo(modelo.assunto, report),
    corpo: aplicarModelo(modelo.corpo, report),
    report_id: report.id,
  })
  if (error) throw error
}

export async function resolverReport(id, resolvido) {
  const { error } = await supabase.from('questao_reports').update({ resolvido }).eq('id', id)
  if (error) throw error
}

export async function contarReportsAbertos() {
  const { count, error } = await supabase
    .from('questao_reports')
    .select('id', { count: 'exact', head: true })
    .eq('resolvido', false)
  if (error) throw error
  return count ?? 0
}

// ── Comentários ───────────────────────────────────────────────
export async function listarComentarios(questaoId) {
  const { data, error } = await supabase
    .from('questao_comentarios')
    .select('*')
    .eq('questao_id', questaoId)
    .order('criado_em', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function criarComentario({ questao_id, texto, autor_nome }) {
  const { error } = await supabase.from('questao_comentarios').insert({ questao_id, texto: texto.trim(), autor_nome: autor_nome || null })
  if (error) throw error
}

export async function excluirComentario(id) {
  const { error } = await supabase.from('questao_comentarios').delete().eq('id', id)
  if (error) throw error
}

// ── Avaliações (estrelas + dificuldade) ───────────────────────
export async function listarAvaliacoes(questaoId) {
  const { data, error } = await supabase
    .from('questao_avaliacoes')
    .select('usuario_id, estrelas, dificuldade')
    .eq('questao_id', questaoId)
  if (error) throw error
  return data ?? []
}

export async function salvarAvaliacao({ questao_id, usuario_id, estrelas, dificuldade }) {
  const { error } = await supabase
    .from('questao_avaliacoes')
    .upsert({ questao_id, usuario_id, estrelas: estrelas ?? null, dificuldade: dificuldade ?? null, atualizado_em: new Date().toISOString() },
      { onConflict: 'usuario_id,questao_id' })
  if (error) throw error
}

// Média/contagem a partir das linhas
export function resumoAvaliacoes(rows) {
  const est = rows.map(r => r.estrelas).filter(v => v != null)
  const dif = rows.map(r => r.dificuldade).filter(v => v != null)
  const media = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const dist = [1, 2, 3, 4, 5].map(n => dif.filter(v => v === n).length)
  return {
    estrelasMedia: media(est), estrelasN: est.length,
    difMedia: media(dif), difN: dif.length, difDist: dist,
  }
}

// ── Painel de engajamento (admin) ─────────────────────────────
// Usa reports + avaliações (ambos legíveis pelo admin) para achar as
// questões mais reportadas, mais difíceis (voto dos alunos) e pior avaliadas.
export async function engajamentoTurma() {
  const [{ data: avals }, reports] = await Promise.all([
    supabase.from('questao_avaliacoes')
      .select('questao_id, estrelas, dificuldade, questoes(id, enunciado, bancas(nome), orgaos(nome), ano, cargo)'),
    listarReports({ apenasAbertos: false }),
  ])

  const m = new Map()
  for (const a of (avals || [])) {
    if (!a.questoes) continue
    const g = m.get(a.questao_id) ?? { questao: a.questoes, est: [], dif: [] }
    if (a.estrelas != null) g.est.push(a.estrelas)
    if (a.dificuldade != null) g.dif.push(a.dificuldade)
    m.set(a.questao_id, g)
  }
  const media = (arr) => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null
  const arr = [...m.values()].map(g => ({
    questao: g.questao,
    difMedia: media(g.dif), difN: g.dif.length,
    estMedia: media(g.est), estN: g.est.length,
  }))
  const maisDificeis = arr.filter(x => x.difN >= 3).sort((a, b) => b.difMedia - a.difMedia).slice(0, 10)
  const piorAvaliadas = arr.filter(x => x.estN >= 3).sort((a, b) => a.estMedia - b.estMedia).slice(0, 10)

  const rm = new Map()
  for (const r of reports) {
    if (!r.questoes) continue
    const g = rm.get(r.questao_id) ?? { questao: r.questoes, total: 0, abertos: 0 }
    g.total++; if (!r.resolvido) g.abertos++
    rm.set(r.questao_id, g)
  }
  const maisReportadas = [...rm.values()].sort((a, b) => b.abertos - a.abertos || b.total - a.total).slice(0, 10)

  return { maisDificeis, piorAvaliadas, maisReportadas }
}

// ── Avaliação da aula (estrelas) ──────────────────────────────
export async function listarAvaliacoesAula(aulaId) {
  const { data, error } = await supabase
    .from('aula_avaliacoes').select('usuario_id, estrelas').eq('aula_id', aulaId)
  if (error) throw error
  return data ?? []
}

export async function salvarAvaliacaoAula({ aula_id, usuario_id, estrelas }) {
  const { error } = await supabase
    .from('aula_avaliacoes')
    .upsert({ aula_id, usuario_id, estrelas, atualizado_em: new Date().toISOString() },
      { onConflict: 'usuario_id,aula_id' })
  if (error) throw error
}
