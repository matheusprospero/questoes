import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { listarAvaliacoesAula, salvarAvaliacaoAula } from '../services/feedback'
import { Star } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './EstrelasAula.module.css'

export default function EstrelasAula({ aulaId }) {
  const { usuario } = useAuth()
  const qc = useQueryClient()
  const [hover, setHover] = useState(0)

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ['aula-avaliacoes', aulaId],
    queryFn: () => listarAvaliacoesAula(aulaId),
  })
  const minha = avaliacoes.find(a => a.usuario_id === usuario?.id)?.estrelas || 0
  const notas = avaliacoes.map(a => a.estrelas).filter(Boolean)
  const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length) : null

  const salvar = useMutation({
    mutationFn: (estrelas) => salvarAvaliacaoAula({ aula_id: aulaId, usuario_id: usuario.id, estrelas }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['aula-avaliacoes', aulaId] }); toast.success('Obrigado pela avaliação!') },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  return (
    <div className={styles.box}>
      <span className={styles.label}>Avalie esta aula</span>
      <div className={styles.estrelas} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => {
          const on = (hover || minha) >= n
          return (
            <button key={n} className={styles.btn}
              onMouseEnter={() => setHover(n)} onClick={() => salvar.mutate(n)} title={`${n} estrela(s)`}>
              <Star size={24} fill={on ? '#f59e0b' : 'none'} color={on ? '#f59e0b' : 'var(--text-tertiary)'} />
            </button>
          )
        })}
      </div>
      {media != null && (
        <span className={styles.media}>{media.toFixed(1)} ★ · {notas.length} avaliação(ões)</span>
      )}
    </div>
  )
}
