import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { listarPendentesRevisao, marcarRevisada } from '../../services/questoes'
import { ClipboardCheck, Pencil, Check, Eye, Loader2, X } from 'lucide-react'
import styles from './Revisao.module.css'

// Remove tags HTML para exibir o começo do enunciado
function textoPlano(html) {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return (div.textContent || '').replace(/\s+/g, ' ').trim()
}

// Diagnóstico rápido do que pode estar errado na questão
function motivos(q) {
  const lista = []
  if (!(q.comentario || '').trim()) lista.push({ tag: 'semComent', label: 'Sem gabarito comentado' })
  const vazias = (q.alternativas || []).filter(a => textoPlano(a.texto).length <= 1).length
  if (vazias > 0) lista.push({ tag: 'altVazia', label: `${vazias} alternativa${vazias > 1 ? 's' : ''} vazia${vazias > 1 ? 's' : ''}` })
  if (!(q.alternativas || []).some(a => a.correta) && q.tipo === 'multipla_escolha')
    lista.push({ tag: 'semGab', label: 'Sem gabarito marcado' })
  if (lista.length === 0) lista.push({ tag: 'novo', label: 'Aguardando revisão' })
  return lista
}

// Opções distintas de um campo relacionado, com contagem
function opcoes(questoes, get) {
  const m = new Map()
  for (const q of questoes) {
    const r = get(q)
    if (!r?.id) continue
    const g = m.get(String(r.id)) ?? { id: String(r.id), nome: r.nome, total: 0 }
    g.total += 1; m.set(g.id, g)
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export default function Revisao() {
  const queryClient = useQueryClient()
  const [filtros, setFiltros] = useState({ disciplina: '', assunto: '', banca: '', orgao: '' })
  const setF = (k, v) => setFiltros(f => ({ ...f, [k]: v, ...(k === 'disciplina' ? { assunto: '' } : {}) }))
  const temFiltro = Object.values(filtros).some(Boolean)

  const { data: questoes = [], isLoading } = useQuery({
    queryKey: ['revisao-pendentes'],
    queryFn: listarPendentesRevisao,
  })

  // Opções dos selects, derivadas das pendentes (assunto depende da disciplina)
  const optDisc = useMemo(() => opcoes(questoes, q => q.disciplinas), [questoes])
  const optBanca = useMemo(() => opcoes(questoes, q => q.bancas), [questoes])
  const optOrgao = useMemo(() => opcoes(questoes, q => q.orgaos), [questoes])
  const optAssunto = useMemo(() =>
    opcoes(questoes.filter(q => !filtros.disciplina || String(q.disciplinas?.id) === filtros.disciplina), q => q.assuntos),
    [questoes, filtros.disciplina])

  const filtradas = useMemo(() => questoes.filter(q =>
    (!filtros.disciplina || String(q.disciplinas?.id) === filtros.disciplina) &&
    (!filtros.assunto || String(q.assuntos?.id) === filtros.assunto) &&
    (!filtros.banca || String(q.bancas?.id) === filtros.banca) &&
    (!filtros.orgao || String(q.orgaos?.id) === filtros.orgao)
  ), [questoes, filtros])

  const revisar = useMutation({
    mutationFn: (id) => marcarRevisada(id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revisao-pendentes'] })
      queryClient.invalidateQueries({ queryKey: ['revisao-count'] })
      queryClient.invalidateQueries({ queryKey: ['questoes'] })
      toast.success('Marcada como revisada.')
    },
    onError: () => toast.error('Não foi possível marcar como revisada.'),
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}><ClipboardCheck size={22} /> Revisão de questões</h1>
          <p className={styles.subtitulo}>
            Questões aguardando a sua revisão. Novas importações também aparecem aqui
            até serem marcadas como revisadas.
          </p>
        </div>
        {questoes.length > 0 && (
          <span className={styles.contador}>
            {temFiltro ? `${filtradas.length} de ${questoes.length}` : questoes.length} pendente{questoes.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {questoes.length > 0 && (
        <div className={styles.filtros}>
          <select className={styles.filtroSel} value={filtros.disciplina} onChange={e => setF('disciplina', e.target.value)}>
            <option value="">Disciplina (todas)</option>
            {optDisc.map(o => <option key={o.id} value={o.id}>{o.nome} ({o.total})</option>)}
          </select>
          <select className={styles.filtroSel} value={filtros.assunto} onChange={e => setF('assunto', e.target.value)}>
            <option value="">Assunto (todos)</option>
            {optAssunto.map(o => <option key={o.id} value={o.id}>{o.nome} ({o.total})</option>)}
          </select>
          <select className={styles.filtroSel} value={filtros.banca} onChange={e => setF('banca', e.target.value)}>
            <option value="">Banca (todas)</option>
            {optBanca.map(o => <option key={o.id} value={o.id}>{o.nome} ({o.total})</option>)}
          </select>
          <select className={styles.filtroSel} value={filtros.orgao} onChange={e => setF('orgao', e.target.value)}>
            <option value="">Órgão (todos)</option>
            {optOrgao.map(o => <option key={o.id} value={o.id}>{o.nome} ({o.total})</option>)}
          </select>
          {temFiltro && (
            <button className={styles.filtroLimpar} onClick={() => setFiltros({ disciplina: '', assunto: '', banca: '', orgao: '' })}>
              <X size={13} /> Limpar
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className={styles.loading}><Loader2 size={22} className={styles.spin} /> Carregando…</div>
      )}

      {!isLoading && questoes.length === 0 && (
        <div className={styles.vazio}>
          <Check size={28} />
          <p>Tudo revisado! Nenhuma questão pendente.</p>
        </div>
      )}

      {!isLoading && questoes.length > 0 && filtradas.length === 0 && (
        <div className={styles.vazio}>
          <p>Nenhuma pendente com esses filtros.</p>
        </div>
      )}

      <div className={styles.lista}>
        {filtradas.map(q => (
          <div key={q.id} className={styles.card}>
            <div className={styles.cardTop}>
              {q.codigo && <span className={styles.codigo}>{q.codigo}</span>}
              <span className={styles.prova}>
                {[q.bancas?.nome, q.orgaos?.nome, q.ano, q.cargo].filter(Boolean).join(' · ')}
              </span>
              {q.disciplinas?.nome && <span className={styles.disciplina}>{q.disciplinas.nome}</span>}
            </div>

            <div className={styles.tags}>
              {motivos(q).map(m => (
                <span key={m.tag} className={`${styles.tag} ${styles['tag_' + m.tag]}`}>{m.label}</span>
              ))}
            </div>

            <Link to={`/questoes/${q.id}`} className={styles.enunciado}>
              {textoPlano(q.enunciado).slice(0, 180) || '(enunciado vazio)'}…
            </Link>

            <div className={styles.acoes}>
              <Link to={`/questoes/${q.id}`} className={styles.btnGhost}>
                <Eye size={14} /> Abrir
              </Link>
              <Link to={`/questoes/${q.id}/editar`} className={styles.btnGhost}>
                <Pencil size={14} /> Editar
              </Link>
              <button
                type="button"
                className={styles.btnRevisada}
                onClick={() => revisar.mutate(q.id)}
                disabled={revisar.isPending}
              >
                <Check size={14} /> Marcar como revisada
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
