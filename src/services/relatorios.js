import { supabase } from './supabase'

// Carrega tudo o que os relatórios precisam, em paralelo, e agrega no cliente.
export async function carregarRelatorios() {
  const [questoesRes, provasRes, planosRes, materiaisRes, avaliacoesRes, favoritosRes, perfisRes] =
    await Promise.all([
      supabase.from('questoes').select('id, status, ano_escolar, nivel_dificuldade, criado_em, disciplina_id, disciplinas(nome, cor)').is('arquivado_em', null),
      supabase.from('provas').select('id, visibilidade, status_revisao'),
      supabase.from('planos_aula').select('id, status'),
      supabase.from('materiais').select('id, tipo'),
      supabase.from('avaliacoes').select('questao_id, nota'),
      supabase.from('favoritos').select('id'),
      supabase.from('perfis').select('id, papel, ativo'),
    ])

  for (const r of [questoesRes, provasRes, planosRes, materiaisRes, avaliacoesRes, favoritosRes, perfisRes]) {
    if (r.error) throw r.error
  }

  const questoes = questoesRes.data ?? []
  const provas = provasRes.data ?? []
  const planos = planosRes.data ?? []
  const materiais = materiaisRes.data ?? []
  const avaliacoes = avaliacoesRes.data ?? []
  const favoritos = favoritosRes.data ?? []
  const perfis = perfisRes.data ?? []

  // ── Totais ────────────────────────────────────────────────
  const totais = {
    questoes: questoes.length,
    publicadas: questoes.filter(q => q.status === 'publicado').length,
    provas: provas.length,
    planos: planos.length,
    materiais: materiais.length,
    favoritos: favoritos.length,
    usuarios: perfis.length,
    usuariosAtivos: perfis.filter(p => p.ativo).length,
  }

  // ── Questões por status ───────────────────────────────────
  const porStatus = agrupar(questoes, q => q.status || 'sem status')

  // ── Questões por disciplina ───────────────────────────────
  const discMap = {}
  for (const q of questoes) {
    const nome = q.disciplinas?.nome || 'Sem disciplina'
    if (!discMap[nome]) discMap[nome] = { nome, cor: q.disciplinas?.cor || '#94a3b8', total: 0 }
    discMap[nome].total++
  }
  const porDisciplina = Object.values(discMap).sort((a, b) => b.total - a.total)

  // ── Questões por ano escolar ──────────────────────────────
  const porAno = ordenarAnos(agrupar(questoes, q => q.ano_escolar || 'Sem ano'))

  // ── Questões por dificuldade ──────────────────────────────
  const porDificuldade = [1, 2, 3, 4, 5].map(n => ({
    chave: `Nível ${n}`,
    total: questoes.filter(q => q.nivel_dificuldade === n).length,
  }))
  porDificuldade.push({ chave: 'Não definida', total: questoes.filter(q => !q.nivel_dificuldade).length })

  // ── Avaliações ────────────────────────────────────────────
  const totalNotas = avaliacoes.reduce((s, a) => s + (a.nota || 0), 0)
  const mediaGeral = avaliacoes.length ? totalNotas / avaliacoes.length : null
  const distribuicaoNotas = [1, 2, 3, 4, 5].map(n => ({
    chave: `${n} ★`,
    total: avaliacoes.filter(a => a.nota === n).length,
  }))

  // ── Provas / Planos / Materiais ───────────────────────────
  const provasPorVisibilidade = agrupar(provas, p => p.visibilidade === 'rede' ? 'Rede' : 'Pessoal')
  const planosPorStatus = agrupar(planos, p => p.status || 'sem status')
  const materiaisPorTipo = agrupar(materiais, m => m.tipo || 'outro')

  // ── Usuários por papel ────────────────────────────────────
  const usuariosPorPapel = agrupar(perfis, p => p.papel || 'sem papel')

  return {
    totais,
    porStatus,
    porDisciplina,
    porAno,
    porDificuldade,
    avaliacoes: { total: avaliacoes.length, mediaGeral, distribuicaoNotas },
    provasPorVisibilidade,
    planosPorStatus,
    materiaisPorTipo,
    usuariosPorPapel,
  }
}

function agrupar(itens, chaveFn) {
  const map = {}
  for (const it of itens) {
    const k = chaveFn(it)
    map[k] = (map[k] || 0) + 1
  }
  return Object.entries(map)
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => b.total - a.total)
}

function ordenarAnos(lista) {
  const ordem = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']
  return [...lista].sort((a, b) => {
    const ia = ordem.indexOf(a.chave), ib = ordem.indexOf(b.chave)
    if (ia === -1 && ib === -1) return b.total - a.total
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}
