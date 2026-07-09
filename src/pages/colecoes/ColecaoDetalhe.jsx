import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  buscarColecao, adicionarQuestaoColecao, removerQuestaoColecao,
} from '../../services/colecoes'
import { listarQuestoes } from '../../services/questoes'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronDown, ChevronUp, Plus, Search, Trash2,
  Layers, Globe, Lock, CheckCircle, X,
} from 'lucide-react'
import styles from './ColecaoDetalhe.module.css'

export default function ColecaoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario, isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const [expandidas, setExpandidas] = useState(new Set())
  const [pickerAberto, setPickerAberto] = useState(false)
  const [buscaPicker, setBuscaPicker] = useState('')

  const { data: colecao, isLoading } = useQuery({
    queryKey: ['colecao', id],
    queryFn: () => buscarColecao(id),
  })

  const podeEditar = !!colecao && (colecao.autor_id === usuario?.id || isAdmin)

  // Candidatas para o seletor (carregadas só quando o picker abre)
  const { data: publicadas = [] } = useQuery({
    queryKey: ['questoes', 'publicadas'],
    queryFn: () => listarQuestoes({ status: 'publicado' }),
    enabled: pickerAberto,
  })
  const { data: minhas = [] } = useQuery({
    queryKey: ['questoes', 'proprias', usuario?.id],
    queryFn: () => listarQuestoes({ autor_id: usuario?.id }),
    enabled: pickerAberto && !!usuario?.id,
  })

  const adicionar = useMutation({
    mutationFn: (questaoId) => adicionarQuestaoColecao(id, questaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colecao', id] })
      queryClient.invalidateQueries({ queryKey: ['colecoes'] })
      toast.success('Questão adicionada!')
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  const remover = useMutation({
    mutationFn: (questaoId) => removerQuestaoColecao(id, questaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colecao', id] })
      queryClient.invalidateQueries({ queryKey: ['colecoes'] })
      toast.success('Questão removida da coleção.')
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  function toggleExpandir(qid) {
    setExpandidas(prev => {
      const n = new Set(prev)
      n.has(qid) ? n.delete(qid) : n.add(qid)
      return n
    })
  }

  if (isLoading) return <div className={styles.loading}>Carregando coleção...</div>
  if (!colecao) return <div className={styles.loading}>Coleção não encontrada.</div>

  const idsNaColecao = new Set((colecao.questoes || []).map(q => q.id))

  // Mescla próprias + publicadas, remove duplicadas e as já presentes na coleção
  const candidatas = [...minhas, ...publicadas]
    .filter((q, i, arr) => arr.findIndex(x => x.id === q.id) === i)
    .filter(q => !idsNaColecao.has(q.id))
    .filter(q => {
      const t = buscaPicker.toLowerCase()
      return !buscaPicker || [
        q.titulo, q.disciplinas?.nome, q.ano_escolar,
        q.enunciado?.replace(/<[^>]*>/g, ''),
      ].some(c => c?.toLowerCase().includes(t))
    })

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/colecoes')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className={styles.topbarInfo}>
          <span className={styles.topbarTitulo}>{colecao.nome}</span>
          <span className={styles.topbarMeta}>
            {colecao.questoes?.length || 0} questões
            {colecao.autor_id !== usuario?.id && colecao.perfis?.nome && ` · por ${colecao.perfis.nome}`}
          </span>
        </div>
        <span className={`${styles.tipoBadge} ${colecao.publica ? styles.tipoRede : styles.tipoPessoal}`}>
          {colecao.publica ? <><Globe size={12} /> Pública</> : <><Lock size={12} /> Privada</>}
        </span>
        {podeEditar && (
          <button className={styles.btnPrimary} onClick={() => { setPickerAberto(true); setBuscaPicker('') }}>
            <Plus size={15} /> Adicionar questões
          </button>
        )}
      </div>

      {colecao.descricao && <p className={styles.descricao}>{colecao.descricao}</p>}

      {/* Questões da coleção */}
      {(!colecao.questoes || colecao.questoes.length === 0) ? (
        <div className={styles.vazio}>
          <Layers size={36} strokeWidth={1.5} />
          <p>Esta coleção ainda não tem questões</p>
          {podeEditar && (
            <button className={styles.btnPrimary} onClick={() => setPickerAberto(true)}>
              <Plus size={14} /> Adicionar questões
            </button>
          )}
        </div>
      ) : (
        <div className={styles.lista}>
          {colecao.questoes.map((q, idx) => {
            const expandida = expandidas.has(q.id)
            return (
              <div key={q.id} className={styles.questaoCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.qNum}>{idx + 1}</span>
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
                  {podeEditar && (
                    <button className={styles.iconBtnDanger}
                      onClick={() => remover.mutate(q.id)}
                      disabled={remover.isPending}
                      title="Remover da coleção">
                      <Trash2 size={15} />
                    </button>
                  )}
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Seletor de questões */}
      {pickerAberto && (
        <div className={styles.modalOverlay} onClick={() => setPickerAberto(false)}>
          <div className={styles.pickerModal} onClick={e => e.stopPropagation()}>
            <div className={styles.pickerHeader}>
              <h3 className={styles.modalTitulo}>Adicionar questões</h3>
              <button className={styles.closeBtn} onClick={() => setPickerAberto(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Buscar questões pelo título, disciplina, enunciado..."
                value={buscaPicker}
                autoFocus
                onChange={e => setBuscaPicker(e.target.value)}
              />
            </div>

            <div className={styles.candidatasList}>
              {candidatas.length === 0 ? (
                <p className={styles.vazioModal}>Nenhuma questão disponível para adicionar.</p>
              ) : (
                candidatas.map(q => (
                  <button key={q.id} className={styles.candidataItem}
                    onClick={() => adicionar.mutate(q.id)}
                    disabled={adicionar.isPending}>
                    <div className={styles.candidataInfo}>
                      <span className={styles.candidataTitulo}>{q.titulo}</span>
                      <span className={styles.candidataMeta}>
                        {q.disciplinas?.nome ?? '—'}
                        {q.ano_escolar ? ` · ${q.ano_escolar}` : ''}
                        {q.tipo === 'multipla_escolha' ? ' · Múltipla escolha' : ' · Dissertativa'}
                      </span>
                    </div>
                    <Plus size={16} className={styles.candidataPlus} />
                  </button>
                ))
              )}
            </div>

            <div className={styles.modalBotoes}>
              <button className={styles.btnConfirm} onClick={() => setPickerAberto(false)}>
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
