import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  buscarCaderno, adicionarQuestaoCaderno, removerQuestaoCaderno,
} from '../../services/cadernos'
import { listarQuestoes, resumoEnunciado, rotuloQuestao } from '../../services/questoes'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronDown, ChevronUp, Plus, Search, Trash2,
  Layers, CheckCircle, XCircle, X,
} from 'lucide-react'
import styles from './CadernoDetalhe.module.css'

export default function CadernoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [expandidas, setExpandidas] = useState(new Set())
  const [pickerAberto, setPickerAberto] = useState(false)
  const [buscaPicker, setBuscaPicker] = useState('')

  const { data: caderno, isLoading } = useQuery({
    queryKey: ['caderno', id],
    queryFn: () => buscarCaderno(id),
  })

  // Candidatas para o seletor (carregadas só quando o picker abre)
  const { data: todasQuestoes = [] } = useQuery({
    queryKey: ['questoes', {}],
    queryFn: () => listarQuestoes(),
    enabled: pickerAberto,
  })

  const adicionar = useMutation({
    mutationFn: (questaoId) => adicionarQuestaoCaderno(id, questaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caderno', id] })
      queryClient.invalidateQueries({ queryKey: ['cadernos'] })
      toast.success('Questão adicionada!')
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  const remover = useMutation({
    mutationFn: (questaoId) => removerQuestaoCaderno(id, questaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caderno', id] })
      queryClient.invalidateQueries({ queryKey: ['cadernos'] })
      toast.success('Questão removida do caderno.')
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

  if (isLoading) return <div className={styles.loading}>Carregando caderno...</div>
  if (!caderno) return <div className={styles.loading}>Caderno não encontrado.</div>

  const idsNoCaderno = new Set((caderno.questoes || []).map(q => q.id))

  const candidatas = todasQuestoes
    .filter(q => !idsNoCaderno.has(q.id))
    .filter(q => {
      const t = buscaPicker.toLowerCase()
      return !buscaPicker || [
        q.disciplinas?.nome, q.assuntos?.nome, q.bancas?.nome, q.orgaos?.nome,
        q.cargo, String(q.ano ?? ''),
        q.enunciado?.replace(/<[^>]*>/g, ''),
      ].some(c => c?.toLowerCase().includes(t))
    })

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/cadernos')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className={styles.topbarInfo}>
          <span className={styles.topbarTitulo}>{caderno.nome}</span>
          <span className={styles.topbarMeta}>
            {caderno.questoes?.length || 0} questões
          </span>
        </div>
        <button className={styles.btnPrimary} onClick={() => { setPickerAberto(true); setBuscaPicker('') }}>
          <Plus size={15} /> Adicionar questões
        </button>
      </div>

      {caderno.descricao && <p className={styles.descricao}>{caderno.descricao}</p>}

      {/* Questões do caderno */}
      {(!caderno.questoes || caderno.questoes.length === 0) ? (
        <div className={styles.vazio}>
          <Layers size={36} strokeWidth={1.5} />
          <p>Este caderno ainda não tem questões</p>
          <button className={styles.btnPrimary} onClick={() => setPickerAberto(true)}>
            <Plus size={14} /> Adicionar questões
          </button>
        </div>
      ) : (
        <div className={styles.lista}>
          {caderno.questoes.map((q, idx) => {
            const expandida = expandidas.has(q.id)
            return (
              <div key={q.id} className={styles.questaoCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.qNum}>{idx + 1}</span>
                  <button className={styles.expandBtn} onClick={() => toggleExpandir(q.id)}>
                    {expandida ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  <div className={styles.cardInfo} onClick={() => navigate(`/questoes/${q.id}`)}>
                    <h3 className={styles.cardTitulo}>
                      {[q.bancas?.nome, q.orgaos?.nome, q.cargo].filter(Boolean).join(' · ') || 'Questão'}
                    </h3>
                    <div className={styles.cardMeta}>
                      {q.ano && <span className={styles.badge}>{q.ano}</span>}
                      {q.disciplinas && <span className={styles.badge}>{q.disciplinas.nome}</span>}
                      {q.assuntos && <span className={styles.badge}>{q.assuntos.nome}</span>}
                      <span className={styles.badge}>
                        {q.tipo === 'multipla_escolha' ? 'Múltipla escolha' : 'Certo/Errado'}
                      </span>
                    </div>
                  </div>
                  <button className={styles.iconBtnDanger}
                    onClick={() => remover.mutate(q.id)}
                    disabled={remover.isPending}
                    title="Remover do caderno">
                    <Trash2 size={15} />
                  </button>
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
                    {q.tipo === 'certo_errado' && (
                      <div className={styles.alternativas}>
                        <div className={styles.altItem} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          Gabarito:&nbsp;
                          {q.gabarito_certo
                            ? <><CheckCircle size={14} style={{ color: '#059669' }} /> Certo</>
                            : <><XCircle size={14} style={{ color: '#dc2626' }} /> Errado</>}
                        </div>
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
                placeholder="Buscar por enunciado, banca, disciplina, assunto..."
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
                      <span className={styles.candidataTitulo}>{resumoEnunciado(q.enunciado, 90) || rotuloQuestao(q)}</span>
                      <span className={styles.candidataMeta}>
                        {rotuloQuestao(q)}
                        {q.disciplinas?.nome ? ` · ${q.disciplinas.nome}` : ''}
                        {q.tipo === 'multipla_escolha' ? ' · Múltipla escolha' : ' · Certo/Errado'}
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
