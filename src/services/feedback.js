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

// ── Modelo do e-mail de aviso (personalizável na tela Reportados) ──
export const MODELO_EMAIL_PADRAO = {
  assunto: 'Questão corrigida — obrigado pelo aviso!',
  corpo:
    'Olá {nome}!\n\n' +
    'A questão que você reportou ({codigo}) foi verificada e corrigida. ' +
    'Obrigado por avisar — isso ajuda todo mundo que estuda na plataforma.\n\n' +
    'Bons estudos!\nProf. Matheus Próspero',
}

const TIPO_LABEL = {
  gabarito: 'Gabarito errado',
  sem_resposta: 'Sem resposta correta',
  enunciado: 'Enunciado / imagem',
  outro: 'Outro',
}

export async function lerModeloEmail() {
  const { data, error } = await supabase
    .from('config_app')
    .select('valor')
    .eq('chave', 'email_report')
    .maybeSingle()
  if (error) return { ...MODELO_EMAIL_PADRAO }   // tabela pode não existir ainda
  return { ...MODELO_EMAIL_PADRAO, ...(data?.valor || {}) }
}

export async function salvarModeloEmail(modelo) {
  const { error } = await supabase.from('config_app').upsert({
    chave: 'email_report',
    valor: { assunto: modelo.assunto, corpo: modelo.corpo },
    atualizado_em: new Date().toISOString(),
  })
  if (error) throw error
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
