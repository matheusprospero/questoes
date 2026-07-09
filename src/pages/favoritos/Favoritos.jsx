import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listarQuestoesFavoritas, toggleFavorito } from '../../services/questoes'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Search, Eye, Pencil, Heart, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import styles from './Favoritos.module.css'

export default function Favoritos() {
  const navigate = useNavigate()
  const { usuario, isFormador, isAdmin } = useAuth()
  const podeEditar = isFormador || isAdmin
  const queryClient = useQueryClient()

  const [buscaTexto, setBuscaTexto] = useState('')
  const [expandidas, setExpandidas] = useState(new Set())

  const { data: questoes = [], isLoading } = useQuery({
    queryKey: ['favoritos', usuario?.id],
    queryFn: listarQuestoesFavoritas,
    enabled: !!usuario,
  })

  const desfavoritar = useMutation({
    mutationFn: ({ questaoId, favoritoId }) => toggleFavorito(questaoId, favoritoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoritos'] })
      toast.success('Removido dos favoritos.')
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  function toggleExpandir(id) {
    setExpandidas(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const questoesFiltradas = questoes.filter(q => {
    const t = buscaTexto.toLowerCase()
    return !buscaTexto || [
      q.titulo, q.disciplinas?.nome, q.ano_escolar,
      q.enunciado?.replace(/<[^>]*>/g, ''),
    ].some(c => c?.toLowerCase().includes(t))
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Favoritos</h1>
          <p className={styles.subtitulo}>{questoes.length} questão(ões) favoritada(s)</p>
        </div>
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar nos favoritos por título, disciplina, enunciado..."
            value={buscaTexto}
            onChange={e => setBuscaTexto(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Carregando favoritos...</div>
      ) : questoesFiltradas.length === 0 ? (
        <div className={styles.vazio}>
          <Heart size={36} strokeWidth={1.5} />
          <p>
            {buscaTexto
              ? 'Nenhum favorito encontrado para esta busca'
              : 'Você ainda não favoritou nenhuma questão'}
          </p>
          {!buscaTexto && (
            <button className={styles.btnPrimary} onClick={() => navigate('/questoes')}>
              Explorar o banco de questões
            </button>
          )}
        </div>
      ) : (
        <div className={styles.lista}>
          {questoesFiltradas.map(q => {
            const expandida = expandidas.has(q.id)
            return (
              <div key={q.id} className={styles.questaoCard}>
                <div className={styles.cardHeader}>
                  <button className={styles.expandBtn} onClick={() => toggleExpandir(q.id)}>
                    {expandida ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  <div className={styles.cardInfo} onClick={() => navigate(`/questoes/${q.id}`)}>
                    <h3 className={styles.cardTitulo}>{q.titulo}</h3>
                    <div className={styles.cardMeta}>
                      {q.disciplinas && <span className={styles.badge}>{q.disciplinas.nome}</span>}
                      {q.ano_escolar && <span className={styles.badge}>{q.ano_escolar}</span>}
                      <span className={styles.badge}>
                        {q.tipo === 'multipla_escolha' ? 'Múltipla escolha' : 'Dissertativa'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.cardAcoes}>
                    <button className={styles.heartBtn}
                      onClick={() => desfavoritar.mutate({ questaoId: q.id, favoritoId: q.favorito_id })}
                      disabled={desfavoritar.isPending}
                      title="Remover dos favoritos">
                      <Heart size={15} fill="currentColor" />
                    </button>
                    {(podeEditar || q.autor_id === usuario?.id) && (
                      <button className={styles.iconBtn} onClick={() => navigate(`/questoes/${q.id}/editar`)} title="Editar">
                        <Pencil size={15} />
                      </button>
                    )}
                    <button className={styles.iconBtn} onClick={() => navigate(`/questoes/${q.id}`)} title="Ver">
                      <Eye size={15} />
                    </button>
                  </div>
                </div>

                {expandida && (
                  <div className={styles.cardExpanded}>
                    <div className={styles.enunciado} dangerouslySetInnerHTML={{ __html: q.enunciado }} />

                    {q.tipo === 'multipla_escolha' && q.alternativas?.length > 0 && (
                      <div className={styles.alternativas}>
                        {q.alternativas.map(alt => (
                          <div key={alt.id} className={`${styles.altItem} ${alt.correta ? styles.altCorreta : ''}`}>
                            <span className={styles.altLetra}>{alt.letra})</span>
                            <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
                            {alt.correta && <CheckCircle size={14} className={styles.checkIcon} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.gabarito && (
                      <div className={styles.gabarito}>
                        <p className={styles.label}>Gabarito:</p>
                        <p>{q.gabarito.texto}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
