import { supabase } from './supabase'

// ── Registro de respostas ─────────────────────────────────────

export async function registrarResposta({ questao_id, resposta, acertou, origem = 'estudo' }) {
  const { error } = await supabase.from('respostas').insert({
    questao_id,
    resposta,
    acertou,
    origem,
  })
  if (error) throw error
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
