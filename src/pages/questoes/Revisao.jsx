import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { listarPendentesRevisao, marcarRevisada } from '../../services/questoes'
import { ClipboardCheck, Pencil, Check, Eye, Loader2 } from 'lucide-react'
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

export default function Revisao() {
  const queryClient = useQueryClient()

  const { data: questoes = [], isLoading } = useQuery({
    queryKey: ['revisao-pendentes'],
    queryFn: listarPendentesRevisao,
  })

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
          <span className={styles.contador}>{questoes.length} pendente{questoes.length > 1 ? 's' : ''}</span>
        )}
      </div>

      {isLoading && (
        <div className={styles.loading}><Loader2 size={22} className={styles.spin} /> Carregando…</div>
      )}

      {!isLoading && questoes.length === 0 && (
        <div className={styles.vazio}>
          <Check size={28} />
          <p>Tudo revisado! Nenhuma questão pendente.</p>
        </div>
      )}

      <div className={styles.lista}>
        {questoes.map(q => (
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
