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
