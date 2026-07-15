import { supabase } from './supabase'
import { estudoPorDia, somarPeriodo } from './estudo'

// Acompanhamento do professor: visão de todos os alunos e de cada um.
// Depende das policies de admin em respostas/metas/planos (plano_estudos.sql).

const hojeISO = () => new Date().toLocaleDateString('en-CA')
function diasAtras(n) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}

// Lista de alunos com um resumo de atividade (últimos 30 dias + total + streak).
export async function listarAlunosComResumo() {
  const { data: perfis, error } = await supabase
    .from('perfis')
    .select('id, nome, email, assinante, criado_em')
    .eq('papel', 'aluno')
    .order('nome', { ascending: true })
  if (error) throw error

  // Uma única leitura da view (admin vê todos) e agrega por aluno.
  const linhas = await estudoPorDia({ de: diasAtras(120) })
  // estudoPorDia junta origens mas some com usuario_id — refazemos a leitura crua:
  const { data: cru } = await supabase
    .from('v_estudo_dia')
    .select('usuario_id, dia, total, acertos')
    .gte('dia', diasAtras(120))
  const porAluno = new Map()
  for (const r of cru ?? []) {
    const g = porAluno.get(r.usuario_id) ?? { total: 0, acertos: 0, dias: new Set(), ult: null }
    g.total += r.total; g.acertos += r.acertos; g.dias.add(r.dia)
    if (!g.ult || r.dia > g.ult) g.ult = r.dia
    porAluno.set(r.usuario_id, g)
  }
  const trintaAtras = diasAtras(30)
  return (perfis ?? []).map(p => {
    const g = porAluno.get(p.id)
    const total = g?.total ?? 0
    const acertos = g?.acertos ?? 0
    const ativo30 = g ? [...g.dias].filter(d => d >= trintaAtras).length : 0
    return {
      ...p,
      total,
      percentual: total ? Math.round((acertos / total) * 100) : 0,
      diasAtivos30: ativo30,
      ultimoDia: g?.ult ?? null,
      inativo: !g?.ult || g.ult < diasAtras(7),
    }
  }).sort((a, b) => b.total - a.total)
}

// Resumo dia/semana/mês de um aluno específico (para o painel do professor).
export async function resumoAluno(usuarioId) {
  const porDia = await estudoPorDia({ usuarioId, de: diasAtras(120) })
  return {
    hoje: somarPeriodo(porDia, hojeISO(), hojeISO()),
    semana: somarPeriodo(porDia, diasAtras(6), hojeISO()),
    mes: somarPeriodo(porDia, diasAtras(29), hojeISO()),
    porDia,
  }
}
