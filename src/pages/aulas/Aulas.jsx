import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listarAulas, deletarAula, alternarPublicada } from '../../services/aulas'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, Search, GraduationCap, Eye, Pencil, Trash2, Globe, EyeOff, BookOpen,
} from 'lucide-react'
import styles from './Aulas.module.css'

export default function Aulas() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [busca, setBusca] = useState('')

  const { data: aulas = [], isLoading } = useQuery({ queryKey: ['aulas'], queryFn: listarAulas })

  const excluir = useMutation({
    mutationFn: (id) => deletarAula(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Aula excluída.')
    },
    onError: (err) => toast.error('Erro ao excluir: ' + err.message),
  })

  const publicar = useMutation({
    mutationFn: ({ id, publicada }) => alternarPublicada(id, publicada),
    onSuccess: (_, { publicada }) => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] })
      toast.success(publicada ? 'Aula publicada para os alunos!' : 'Aula despublicada (rascunho).')
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  const filtradas = aulas.filter(a =>
    !busca || a.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
    a.disciplinas?.nome?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Aulas</h1>
          <p className={styles.subtitulo}>
            {isAdmin ? 'Teoria + questões para seus alunos' : 'Estude a teoria e treine com questões do tema'}
          </p>
        </div>
        {isAdmin && (
          <button className={styles.btnPrimary} onClick={() => navigate('/aulas/nova')}>
            <Plus size={15} /> Nova aula
          </button>
        )}
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput}
            placeholder="Buscar aula por título ou disciplina..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Carregando aulas...</div>
      ) : filtradas.length === 0 ? (
        <div className={styles.vazio}>
          <GraduationCap size={40} strokeWidth={1.5} />
          <p>{isAdmin ? 'Você ainda não criou nenhuma aula.' : 'Nenhuma aula publicada ainda.'}</p>
          {isAdmin && (
            <button className={styles.btnPrimary} onClick={() => navigate('/aulas/nova')}>
              <Plus size={14} /> Criar primeira aula
            </button>
          )}
        </div>
      ) : (
        <div className={styles.lista}>
          {filtradas.map(a => (
            <div key={a.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardInfo} onClick={() => navigate(`/aulas/${a.id}`)}>
                  <h3 className={styles.cardTitulo}>{a.titulo}</h3>
                  {a.descricao && <p className={styles.cardDesc}>{a.descricao.slice(0, 120)}</p>}
                </div>
                {isAdmin && (
                  <div className={styles.cardAcoes}>
                    <button className={`${styles.iconBtn} ${a.publicada ? styles.iconBtnAtivo : ''}`}
                      onClick={() => publicar.mutate({ id: a.id, publicada: !a.publicada })}
                      disabled={publicar.isPending}
                      title={a.publicada ? 'Despublicar (vira rascunho)' : 'Publicar para os alunos'}>
                      {a.publicada ? <Globe size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button className={styles.iconBtn} onClick={() => navigate(`/aulas/${a.id}`)} title="Ver">
                      <Eye size={15} />
                    </button>
                    <button className={styles.iconBtn} onClick={() => navigate(`/aulas/${a.id}/editar`)} title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button className={styles.iconBtn}
                      onClick={() => { if (confirm(`Excluir a aula "${a.titulo}"?`)) excluir.mutate(a.id) }}
                      title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.cardBadges}>
                {a.disciplinas && (
                  <span className={styles.badgeDisc} style={{ '--cor': a.disciplinas.cor || 'var(--color-primary)' }}>
                    {a.disciplinas.nome}
                  </span>
                )}
                <span className={styles.badge}>{a.total_questoes} questões</span>
                {isAdmin && (a.publicada
                  ? <span className={styles.badgePub}><Globe size={11} /> Publicada</span>
                  : <span className={styles.badgeRascunho}><EyeOff size={11} /> Rascunho</span>)}
              </div>

              <button className={styles.btnAbrir} onClick={() => navigate(`/aulas/${a.id}`)}>
                <BookOpen size={14} /> Abrir aula
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
