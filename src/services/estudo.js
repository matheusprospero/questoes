import { supabase } from './supabase'
import { listarQuestoes } from './questoes'

const temGab = (q) => q.tipo === 'certo_errado'
  ? (q.gabarito_certo !== null && q.gabarito_certo !== undefined)
  : (q.alternativas || []).some(a => a.correta)
const misturar = (a) => [...a].sort(() => Math.random() - 0.5)

// ── Registro de respostas ─────────────────────────────────────

export async function registrarResposta({ questao_id, resposta, acertou, origem = 'estudo', simulado_id = null }) {
  const { error } = await supabase.from('respostas').insert({
    questao_id,
    resposta,
    acertou,
    origem,
    simulado_id,
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
  const meta = Math.max(1, Number(cfg.metaDiaria) || 20)
  const obj = cfg.objetivo || {}
  const baseFiltro = {}
  if (obj.banca_id) baseFiltro.banca_id = obj.banca_id
  if (obj.cargo) baseFiltro.cargo = obj.cargo
  // Questão dentro do objetivo?
  const noObjetivo = (q) =>
    (!obj.banca_id || String(q.banca_id) === String(obj.banca_id)) &&
    (!obj.cargo || q.cargo === obj.cargo)

  const [revisaoRaw, respostas, todasRaw] = await Promise.all([
    questoesParaRevisar().catch(() => []),
    listarRespostas(),
    listarQuestoes(baseFiltro),
  ])
  const revisao = revisaoRaw.filter(temGab).filter(noObjetivo)
  const todas = todasRaw.filter(temGab)
  const respondidas = new Set(respostas.map(r => r.questao_id))

  const sel = []
  const usados = new Set()
  const add = (q) => { if (q && !usados.has(q.id) && sel.length < meta) { usados.add(q.id); sel.push(q); return true } return false }

  const resumo = { revisao: 0, disciplinas: 0, fracos: 0, novas: 0 }

  // 1) Revisão vencida (prioridade)
  for (const q of revisao) { if (add(q)) resumo.revisao++ }

  // 2) Metas por disciplina (completa o que falta de cada uma)
  for (const [discId, goal] of Object.entries(cfg.porDisciplina || {})) {
    const jaNa = sel.filter(q => String(q.disciplina_id) === String(discId)).length
    let faltam = Math.max(0, Number(goal) - jaNa)
    const cand = todas.filter(q => String(q.disciplina_id) === String(discId) && !usados.has(q.id))
    const ordenadas = [...misturar(cand.filter(q => !respondidas.has(q.id))), ...misturar(cand.filter(q => respondidas.has(q.id)))]
    for (const q of ordenadas) { if (faltam <= 0) break; if (add(q)) { faltam--; resumo.disciplinas++ } }
  }

  // 3) Pontos fracos (assuntos onde mais erra), inéditas
  if (sel.length < meta) {
    const fracos = montarRecomendadas(todas.filter(q => !usados.has(q.id)), respostas, { limite: meta - sel.length })
    for (const q of fracos) { if (add(q)) resumo.fracos++ }
  }

  // 4) Completa com questões novas variadas
  if (sel.length < meta) {
    const novas = amostraDiversificada(todas.filter(q => !usados.has(q.id) && !respondidas.has(q.id)), meta - sel.length)
    for (const q of novas) { if (add(q)) resumo.novas++ }
  }
  // 5) Se ainda faltar, qualquer não usada
  if (sel.length < meta) {
    for (const q of misturar(todas.filter(q => !usados.has(q.id)))) { if (!add(q)) break }
  }

  return { questoes: misturar(sel), resumo }
}

// Todas as respostas, com a classificação da questão (para estatísticas)
export async function listarRespostas() {
  const { data, error } = await supabase
    .from('respostas')
    .select(`
      id, questao_id, resposta, acertou, origem, respondido_em,
      questoes(
        id, tipo, enunciado, ano,
        disciplinas(id, nome, cor),
        assuntos(id, nome),
        bancas(id, nome)
      )
    `)
    .order('respondido_em', { ascending: true })

  if (error) throw error
  return data ?? []
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
