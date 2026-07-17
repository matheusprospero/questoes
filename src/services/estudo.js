import { supabase } from './supabase'
import { listarQuestoes } from './questoes'

const temGab = (q) => q.tipo === 'certo_errado'
  ? (q.gabarito_certo !== null && q.gabarito_certo !== undefined)
  : (q.alternativas || []).some(a => a.correta)
const misturar = (a) => [...a].sort(() => Math.random() - 0.5)

// ── Registro de respostas ─────────────────────────────────────

export async function registrarResposta({ questao_id, resposta, acertou, origem = 'estudo', simulado_id = null, tempo_seg = null }) {
  const { error } = await supabase.from('respostas').insert({
    questao_id,
    resposta,
    acertou,
    origem,
    simulado_id,
    tempo_seg,
  })
  if (error) throw error
  // Agenda a revisão espaçada (não bloqueia; ignora se a função ainda não existir)
  supabase.rpc('registrar_revisao', { p_questao: questao_id, p_acertou: acertou }).then(() => {}, () => {})
}

// ── Revisão espaçada ──────────────────────────────────────────
const SELECT_Q_REVISAO = `
  questao_id, proxima_em,
  questoes(*, disciplinas(id, nome, cor), assuntos(id, nome), bancas(id, nome), orgaos(id, nome),
    questao_alternativas(id, letra, texto, correta, ordem))
`
export async function questoesParaRevisar() {
  const hoje = new Date().toLocaleDateString('en-CA')
  const { data, error } = await supabase
    .from('revisoes')
    .select(SELECT_Q_REVISAO)
    .lte('proxima_em', hoje)
    .order('proxima_em', { ascending: true })
  if (error) throw error
  return (data || [])
    .filter(r => r.questoes)
    .map(r => ({
      ...r.questoes,
      alternativas: r.questoes.questao_alternativas?.slice().sort((a, b) => a.ordem - b.ordem) ?? [],
    }))
}

export async function contarRevisoesHoje() {
  const hoje = new Date().toLocaleDateString('en-CA')
  const { count, error } = await supabase
    .from('revisoes')
    .select('questao_id', { count: 'exact', head: true })
    .lte('proxima_em', hoje)
  if (error) return 0
  return count ?? 0
}

// Monta a "meta do dia": revisão vencida + metas por disciplina + pontos
// fracos + questões novas para completar a meta. Retorna { questoes, resumo }.
export async function montarMetaDoDia(cfg = {}) {
  // A meta do dia é o MAIOR valor entre o total e a soma das metas por disciplina
  const somaDisc = Object.values(cfg.porDisciplina || {}).reduce((a, b) => a + (Number(b) || 0), 0)
  const metaTotal = Math.max(1, Number(cfg.metaDiaria) || 0, somaDisc)
  const obj = cfg.objetivo || {}
  const scopeDiscs = new Set(Object.keys(cfg.porDisciplina || {}).map(String))
  const scopeAssuntos = new Set((obj.assuntos || []).map(String))
  const baseFiltro = {}
  if (obj.banca_id) baseFiltro.banca_id = obj.banca_id
  const noObjetivo = (q) =>
    (!obj.banca_id || String(q.banca_id) === String(obj.banca_id)) &&
    (scopeDiscs.size === 0 || scopeDiscs.has(String(q.disciplina_id))) &&
    (scopeAssuntos.size === 0 || scopeAssuntos.has(String(q.assunto_id)))

  const [revisaoRaw, respostas, todasRaw] = await Promise.all([
    questoesParaRevisar().catch(() => []),
    listarRespostas(),
    listarQuestoes(baseFiltro),
  ])

  // O que já foi feito HOJE (para continuar de onde parou, não recomeçar)
  const hojeStr = new Date().toLocaleDateString('en-CA')
  const respHoje = respostas.filter(r => new Date(r.respondido_em).toLocaleDateString('en-CA') === hojeStr)
  const feitoHojeIds = new Set(respHoje.map(r => r.questao_id))
  const feitoDisc = {}
  for (const r of respHoje) { const d = r.questoes?.disciplinas; if (d) feitoDisc[d.id] = (feitoDisc[d.id] || 0) + 1 }
  const restante = Math.max(0, metaTotal - respHoje.length)
  if (restante === 0) return { questoes: [], resumo: { revisao: 0, disciplinas: 0, fracos: 0, novas: 0 }, concluida: true }

  const meta = restante // monta só o que falta
  const revisao = revisaoRaw.filter(temGab).filter(noObjetivo)
  const todas = todasRaw.filter(temGab).filter(noObjetivo)
  const respondidas = new Set(respostas.map(r => r.questao_id))

  const sel = []
  const usados = new Set()
  // Não repete o que já foi feito hoje
  const add = (q) => { if (q && !usados.has(q.id) && !feitoHojeIds.has(q.id) && sel.length < meta) { usados.add(q.id); sel.push(q); return true } return false }

  const resumo = { revisao: 0, disciplinas: 0, fracos: 0, novas: 0 }

  // 1) Revisão vencida (prioridade)
  for (const q of revisao) { if (add(q)) resumo.revisao++ }

  // 2) Metas por disciplina — completa o que FALTA de cada uma (descontando o de hoje)
  for (const [discId, goal] of Object.entries(cfg.porDisciplina || {})) {
    const jaNa = sel.filter(q => String(q.disciplina_id) === String(discId)).length
    let faltam = Math.max(0, Number(goal) - (feitoDisc[discId] || 0) - jaNa)
    const cand = todas.filter(q => String(q.disciplina_id) === String(discId) && !usados.has(q.id))
    const ordenadas = [...misturar(cand.filter(q => !respondidas.has(q.id))), ...misturar(cand.filter(q => respondidas.has(q.id)))]
    for (const q of ordenadas) { if (faltam <= 0) break; if (add(q)) { faltam--; resumo.disciplinas++ } }
  }

  // 3) Pontos fracos (assuntos onde mais erra)
  if (sel.length < meta) {
    const fracos = montarRecomendadas(todas.filter(q => !usados.has(q.id)), respostas, { limite: meta - sel.length })
    for (const q of fracos) { if (add(q)) resumo.fracos++ }
  }
  // 4) Questões novas variadas
  if (sel.length < meta) {
    const novas = amostraDiversificada(todas.filter(q => !usados.has(q.id) && !respondidas.has(q.id)), meta - sel.length)
    for (const q of novas) { if (add(q)) resumo.novas++ }
  }
  // 5) Se ainda faltar, qualquer não usada
  if (sel.length < meta) {
    for (const q of misturar(todas.filter(q => !usados.has(q.id)))) { if (!add(q)) break }
  }

  return { questoes: misturar(sel), resumo, concluida: false }
}

// Todas as respostas, com a classificação da questão (para estatísticas).
// usuarioId opcional: o professor (admin) passa o id do aluno para acompanhá-lo.
// (aceita apenas string: se vier o contexto do React Query — queryFn: listarRespostas —, ignora)
export async function listarRespostas(usuarioId = null) {
  if (typeof usuarioId !== 'string') usuarioId = null
  let q = supabase
    .from('respostas')
    .select(`
      id, questao_id, resposta, acertou, origem, respondido_em, tempo_seg,
      questoes(
        id, tipo, enunciado, ano,
        disciplinas(id, nome, cor),
        assuntos(id, nome),
        bancas(id, nome)
      )
    `)
    .order('respondido_em', { ascending: true })
  if (usuarioId) q = q.eq('usuario_id', usuarioId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

// ── Série temporal por dia (heatmap + visão dia/semana/mês) ──
// Usa a view v_estudo_dia (security_invoker: aluno vê o seu; admin vê de todos).
export async function estudoPorDia({ usuarioId = null, de = null, ate = null } = {}) {
  let q = supabase.from('v_estudo_dia').select('usuario_id, dia, origem, total, acertos, tempo_seg')
  if (usuarioId) q = q.eq('usuario_id', usuarioId)
  if (de) q = q.gte('dia', de)
  if (ate) q = q.lte('dia', ate)
  const { data, error } = await q.order('dia', { ascending: true })
  if (error) throw error
  // junta as origens (estudo + simulado) num total por dia
  const porDia = new Map()
  for (const r of data ?? []) {
    const g = porDia.get(r.dia) ?? { dia: r.dia, total: 0, acertos: 0, tempo_seg: 0 }
    g.total += r.total; g.acertos += r.acertos; g.tempo_seg += r.tempo_seg
    porDia.set(r.dia, g)
  }
  return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia))
}

// Soma um período [de, ate] (strings YYYY-MM-DD) a partir das linhas por dia.
export function somarPeriodo(porDia, de, ate) {
  let total = 0, acertos = 0, tempo = 0, dias = 0
  for (const g of porDia) {
    if ((de && g.dia < de) || (ate && g.dia > ate)) continue
    total += g.total; acertos += g.acertos; tempo += g.tempo_seg; if (g.total > 0) dias++
  }
  return { total, acertos, tempo, dias, percentual: total ? Math.round((acertos / total) * 100) : 0 }
}

// Score de prontidão (transparente): por disciplina combina cobertura (nº de
// assuntos com ≥5 respostas), acerto e recência; 0–100. Nada de caixa-preta.
export function calcularProntidao(respostas) {
  const porDisc = new Map()
  const assuntosVistos = new Map() // disc -> Map(assunto -> {total, acertos})
  const agora = Date.now()
  for (const r of respostas) {
    const d = r.questoes?.disciplinas
    const a = r.questoes?.assuntos
    if (!d) continue
    const g = porDisc.get(d.id) ?? { id: d.id, nome: d.nome, cor: d.cor, total: 0, acertos: 0, ultima: 0 }
    g.total += 1; if (r.acertou) g.acertos += 1
    const t = new Date(r.respondido_em).getTime(); if (t > g.ultima) g.ultima = t
    porDisc.set(d.id, g)
    if (a) {
      if (!assuntosVistos.has(d.id)) assuntosVistos.set(d.id, new Map())
      const am = assuntosVistos.get(d.id)
      const ag = am.get(a.id) ?? { total: 0, acertos: 0 }
      ag.total += 1; if (r.acertou) ag.acertos += 1; am.set(a.id, ag)
    }
  }
  const lista = [...porDisc.values()].map(g => {
    const am = assuntosVistos.get(g.id) || new Map()
    const assuntosSolidos = [...am.values()].filter(x => x.total >= 5).length
    const cobertura = Math.min(1, assuntosSolidos / 8)          // ~8 assuntos sólidos = cobertura plena
    const acerto = g.total ? g.acertos / g.total : 0
    const diasSemEstudo = (agora - g.ultima) / 86400000
    const recencia = diasSemEstudo <= 7 ? 1 : diasSemEstudo <= 21 ? 0.8 : diasSemEstudo <= 45 ? 0.6 : 0.4
    const prontidao = Math.round((0.45 * acerto + 0.35 * cobertura + 0.20 * recencia) * 100)
    return { ...g, pct: Math.round(acerto * 100), cobertura: Math.round(cobertura * 100), prontidao }
  }).sort((a, b) => b.total - a.total)
  const geral = lista.length ? Math.round(lista.reduce((s, x) => s + x.prontidao, 0) / lista.length) : 0
  return { geral, disciplinas: lista }
}

// Marcos/conquistas (gamificação) — calculados a partir da atividade.
export function calcularMarcos(respostas, streak = 0) {
  const total = respostas.length
  const acertos = respostas.filter(r => r.acertou).length
  const pct = total ? Math.round((acertos / total) * 100) : 0
  const assuntos = maestriaPorAssunto(respostas)
  const dominados = assuntos.filter(a => a.total >= 5 && a.pct >= 80).length
  const def = [
    { chave: 'q100',   nome: 'Primeira centena',   detalhe: '100 questões resolvidas',  ok: total >= 100,  alvo: 100, valor: total },
    { chave: 'q500',   nome: 'Meio milhar',        detalhe: '500 questões resolvidas',  ok: total >= 500,  alvo: 500, valor: total },
    { chave: 'q1000',  nome: 'Maratonista',        detalhe: '1000 questões resolvidas', ok: total >= 1000, alvo: 1000, valor: total },
    { chave: 's7',     nome: 'Semana de fogo',     detalhe: '7 dias seguidos',          ok: streak >= 7,   alvo: 7,   valor: streak },
    { chave: 's30',    nome: 'Mês inabalável',     detalhe: '30 dias seguidos',         ok: streak >= 30,  alvo: 30,  valor: streak },
    { chave: 's100',   nome: 'Cem dias de disciplina', detalhe: '100 dias seguidos',    ok: streak >= 100, alvo: 100, valor: streak },
    { chave: 'ac80',   nome: 'Pontaria afiada',    detalhe: '80% de acerto (≥100 questões)', ok: total >= 100 && pct >= 80, alvo: 80, valor: pct },
    { chave: 'dom5',   nome: 'Especialista',       detalhe: '5 assuntos dominados',     ok: dominados >= 5, alvo: 5,  valor: dominados },
  ]
  return def
}

// ── Utilidades de análise (client-side, volume pessoal) ──────

// IDs das questões cuja ÚLTIMA resposta foi errada
export function idsUltimaErrada(respostas) {
  const ultimaPorQuestao = new Map()
  for (const r of respostas) {
    ultimaPorQuestao.set(r.questao_id, r) // lista vem ordenada por data asc
  }
  return new Set(
    [...ultimaPorQuestao.values()].filter(r => !r.acertou).map(r => r.questao_id)
  )
}

// Amostra diversificada: ao montar uma sessão limitada sem filtros,
// mistura disciplinas, bancas e provas diferentes (round-robin), em vez
// de sortear e arriscar cair tudo da mesma prova.
export function amostraDiversificada(questoes, qtd) {
  const embaralhadas = [...questoes].sort(() => Math.random() - 0.5)
  if (!qtd || qtd >= questoes.length) return embaralhadas

  // agrupa por disciplina e, dentro dela, por prova (banca+órgão+ano+cargo)
  const porDisciplina = new Map()
  for (const q of embaralhadas) {
    const d = q.disciplina_id ?? 'sem-disciplina'
    if (!porDisciplina.has(d)) porDisciplina.set(d, new Map())
    const provas = porDisciplina.get(d)
    const p = [q.banca_id, q.orgao_id, q.ano, q.cargo].map(v => v ?? '').join('|')
    if (!provas.has(p)) provas.set(p, [])
    provas.get(p).push(q)
  }

  // dentro de cada disciplina, alterna entre provas diferentes
  const filas = [...porDisciplina.values()].map(provas => {
    const listas = [...provas.values()]
    const fila = []
    let sobrou = true
    while (sobrou) {
      sobrou = false
      for (const lista of listas) {
        if (lista.length) { fila.push(lista.pop()); sobrou = true }
      }
    }
    return fila
  })

  // alterna entre disciplinas até fechar a quantidade
  const resultado = []
  while (resultado.length < qtd) {
    let pegou = false
    for (const fila of filas) {
      if (fila.length && resultado.length < qtd) {
        resultado.push(fila.shift())
        pegou = true
      }
    }
    if (!pegou) break
  }
  return resultado.sort(() => Math.random() - 0.5) // ordem final misturada
}

// Sugestões "similares às que errei": questões AINDA NÃO respondidas,
// dos mesmos assuntos/disciplinas das questões cuja última resposta foi
// errada. Quanto mais erros no assunto, maior a prioridade da sugestão.
export function montarRecomendadas(questoes, respostas, { limite = 15 } = {}) {
  // Última resposta por questão (lista vem ordenada por data asc)
  const ultimaPorQuestao = new Map()
  for (const r of respostas) ultimaPorQuestao.set(r.questao_id, r)
  const respondidas = new Set(ultimaPorQuestao.keys())

  // Peso de erro por assunto e por disciplina
  const errosAssunto = new Map()
  const errosDisciplina = new Map()
  for (const r of ultimaPorQuestao.values()) {
    if (r.acertou || !r.questoes) continue
    const a = r.questoes.assuntos?.id
    const d = r.questoes.disciplinas?.id
    if (a) errosAssunto.set(a, (errosAssunto.get(a) ?? 0) + 1)
    if (d) errosDisciplina.set(d, (errosDisciplina.get(d) ?? 0) + 1)
  }

  return questoes
    .filter(q => !respondidas.has(q.id))
    .map(q => ({
      q,
      // mesmo assunto pesa 3x mais que só mesma disciplina
      score: (errosAssunto.get(q.assunto_id) ?? 0) * 3 +
             (errosDisciplina.get(q.disciplina_id) ?? 0),
      sorteio: Math.random(), // desempate aleatório estável para o sort
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.sorteio - b.sorteio)
    .slice(0, limite)
    .map(x => x.q)
}

// Agrupa respostas por uma chave (nome de disciplina/assunto/banca)
export function agruparDesempenho(respostas, chaveFn) {
  const grupos = new Map()
  for (const r of respostas) {
    const chave = chaveFn(r)
    if (!chave) continue
    const g = grupos.get(chave) ?? { nome: chave, total: 0, acertos: 0 }
    g.total += 1
    if (r.acertou) g.acertos += 1
    grupos.set(chave, g)
  }
  return [...grupos.values()]
    .map(g => ({ ...g, percentual: Math.round((g.acertos / g.total) * 100) }))
    .sort((a, b) => b.total - a.total)
}

// Evolução mensal: [{ mes: '2026-07', label: 'jul/26', total, acertos, percentual }]
export function evolucaoMensal(respostas) {
  const meses = new Map()
  for (const r of respostas) {
    const d = new Date(r.respondido_em)
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const g = meses.get(mes) ?? { mes, total: 0, acertos: 0 }
    g.total += 1
    if (r.acertou) g.acertos += 1
    meses.set(mes, g)
  }
  const NOMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return [...meses.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map(g => {
      const [ano, m] = g.mes.split('-')
      return {
        ...g,
        label: `${NOMES[Number(m) - 1]}/${ano.slice(2)}`,
        percentual: Math.round((g.acertos / g.total) * 100),
      }
    })
}

// Ofensiva (streak): dias seguidos com pelo menos uma questão + total de hoje
const diaLocal = (iso) => new Date(iso).toLocaleDateString('en-CA') // YYYY-MM-DD
export function calcularOfensiva(respostas) {
  const dias = new Set(respostas.map(r => diaLocal(r.respondido_em)))
  const hojeStr = new Date().toLocaleDateString('en-CA')
  const hoje = respostas.filter(r => diaLocal(r.respondido_em) === hojeStr).length
  let streak = 0
  const d = new Date()
  if (!dias.has(d.toLocaleDateString('en-CA'))) d.setDate(d.getDate() - 1) // ontem ainda mantém
  while (dias.has(d.toLocaleDateString('en-CA'))) { streak++; d.setDate(d.getDate() - 1) }
  return { streak, hoje, diasAtivos: dias.size }
}

// Maestria por assunto: [{ id, nome, disciplina, total, acertos, pct }]
export function maestriaPorAssunto(respostas) {
  const m = new Map()
  for (const r of respostas) {
    const a = r.questoes?.assuntos
    if (!a) continue
    const g = m.get(a.id) ?? { id: a.id, nome: a.nome, disciplina: r.questoes?.disciplinas?.nome ?? null, total: 0, acertos: 0 }
    g.total += 1
    if (r.acertou) g.acertos += 1
    m.set(a.id, g)
  }
  return [...m.values()]
    .map(g => ({ ...g, pct: Math.round((g.acertos / g.total) * 100) }))
    .sort((a, b) => b.total - a.total)
}

// Questões mais erradas: [{ questao, erros, total }]
export function questoesMaisErradas(respostas, limite = 10) {
  const porQuestao = new Map()
  for (const r of respostas) {
    if (!r.questoes) continue
    const g = porQuestao.get(r.questao_id) ?? { questao: r.questoes, erros: 0, total: 0 }
    g.total += 1
    if (!r.acertou) g.erros += 1
    porQuestao.set(r.questao_id, g)
  }
  return [...porQuestao.values()]
    .filter(g => g.erros > 0)
    .sort((a, b) => b.erros - a.erros || b.total - a.total)
    .slice(0, limite)
}
