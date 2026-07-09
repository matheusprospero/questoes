import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  buscarQuestao, excluirQuestao, toggleFavorito, listarFavoritos,
} from '../../services/questoes'
import { listarSimulados, adicionarQuestaoSimulado } from '../../services/simulados'
import { listarCadernos, adicionarQuestaoCaderno } from '../../services/cadernos'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, Pencil, Heart, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './QuestaoDetalhe.module.css'

const NIVEIS = { fundamental: 'Fundamental', medio: 'Médio', superior: 'Superior' }

export default function QuestaoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [favoritoId, setFavoritoId] = useState(null)
  const [modalSimulado, setModalSimulado] = useState(false)
  const [simuladoSelecionado, setSimuladoSelecionado] = useState(null)
  const [modalCaderno, setModalCaderno] = useState(false)
  const [cadernoSelecionado, setCadernoSelecionado] = useState(null)

  const { data: questao, isLoading } = useQuery({
    queryKey: ['questao', id],
    queryFn: () => buscarQuestao(id),
  })

  const { data: favoritos = [] } = useQuery({
    queryKey: ['favoritos'],
    queryFn: listarFavoritos,
  })

  const { data: simulados = [] } = useQuery({ queryKey: ['simulados'], queryFn: listarSimulados })
  const { data: cadernos = [] } = useQuery({ queryKey: ['cadernos'], queryFn: listarCadernos })

  useEffect(() => {
    const fav = favoritos.find(f => f.questao_id === id)
    setFavoritoId(fav?.id ?? null)
  }, [favoritos, id])

  const mutarFavorito = useMutation({
    mutationFn: () => toggleFavorito(id, favoritoId),
    onSuccess: (novoId) => {
      setFavoritoId(novoId)
      queryClient.invalidateQueries({ queryKey: ['favoritos'] })
      toast.success(novoId ? 'Adicionado aos favoritos' : 'Removido dos favoritos')
    },
  })

  const excluir = useMutation({
    mutationFn: () => excluirQuestao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questoes'] })
      toast.success('Questão excluída.')
      navigate('/questoes')
    },
    onError: (err) => toast.error('Erro ao excluir: ' + err.message),
  })

  const addAoSimulado = useMutation({
    mutationFn: () => {
      if (!simuladoSelecionado) throw new Error('Selecione um simulado')
      return adicionarQuestaoSimulado(simuladoSelecionado, id)
    },
    onSuccess: () => {
      setModalSimulado(false)
      setSimuladoSelecionado(null)
      queryClient.invalidateQueries({ queryKey: ['simulados'] })
      toast.success('Questão adicionada ao simulado!')
    },
    onError: (err) => toast.error(err.message),
  })

  const addAoCaderno = useMutation({
    mutationFn: () => {
      if (!cadernoSelecionado) throw new Error('Selecione um caderno')
      return adicionarQuestaoCaderno(cadernoSelecionado, id)
    },
    onSuccess: () => {
      setModalCaderno(false)
      setCadernoSelecionado(null)
      queryClient.invalidateQueries({ queryKey: ['cadernos'] })
      toast.success('Questão adicionada ao caderno!')
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <div className={styles.loading}>Carregando questão...</div>
  if (!questao) return <div className={styles.loading}>Questão não encontrada.</div>

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/questoes')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className={styles.topbarAcoes}>
          <button className={`${styles.favBtn} ${favoritoId ? styles.favOn : ''}`}
            onClick={() => mutarFavorito.mutate()}
            title={favoritoId ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
            <Heart size={15} /> {favoritoId ? 'Favoritada' : 'Favoritar'}
          </button>
          <button className={styles.btnSecondary} onClick={() => setModalSimulado(true)}>
            + Simulado
          </button>
          <button className={styles.btnSecondary} onClick={() => setModalCaderno(true)}>
            + Caderno
          </button>
          {isAdmin && (
            <>
              <button className={styles.btnSecondary} onClick={() => navigate(`/questoes/${id}/editar`)}>
                <Pencil size={14} /> Editar
              </button>
              <button className={styles.btnSecondary}
                onClick={() => {
                  if (confirm('Excluir esta questão? As respostas registradas também serão apagadas.'))
                    excluir.mutate()
                }}>
                <Trash2 size={14} /> Excluir
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.colMain}>
          {/* Cabeçalho */}
          <div className={styles.card}>
            <div className={styles.badgeRow}>
              <span className={`${styles.badge} ${styles['tipo_' + questao.tipo] ?? ''}`}>
                {questao.tipo === 'multipla_escolha' ? 'Múltipla escolha' : 'Certo / Errado'}
              </span>
              {questao.disciplinas && <span className={styles.badgeGray}>{questao.disciplinas.nome}</span>}
              {questao.assuntos && <span className={styles.badgeGray}>{questao.assuntos.nome}</span>}
              {questao.nivel && <span className={styles.badgeGray}>Nível {NIVEIS[questao.nivel]}</span>}
            </div>
            <div className={styles.meta}>
              {questao.bancas && <span><strong>{questao.bancas.nome}</strong></span>}
              {questao.orgaos && <><span>·</span><span>{questao.orgaos.nome}</span></>}
              {questao.ano && <><span>·</span><span>{questao.ano}</span></>}
              {questao.cargo && <><span>·</span><span>{questao.cargo}</span></>}
            </div>
            <div className={styles.meta}>
              <span>Cadastrada em {new Date(questao.criado_em).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {/* Enunciado */}
          <div className={styles.card}>
            <p className={styles.secTitulo}>Enunciado</p>
            <div className={styles.enunciado}
              dangerouslySetInnerHTML={{ __html: questao.enunciado }} />
          </div>

          {/* Alternativas ou gabarito Certo/Errado */}
          {questao.tipo === 'multipla_escolha' && questao.alternativas?.length > 0 && (
            <div className={styles.card}>
              <p className={styles.secTitulo}>Alternativas</p>
              <div className={styles.alternativas}>
                {questao.alternativas.map(alt => (
                  <div key={alt.id}
                    className={`${styles.altItem} ${alt.correta ? styles.altCorreta : ''}`}>
                    <span className={`${styles.altLetra} ${alt.correta ? styles.altLetraCorreta : ''}`}>
                      {alt.letra}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
                    {alt.correta && <CheckCircle size={14} className={styles.checkIcon} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {questao.tipo === 'certo_errado' && (
            <div className={styles.card}>
              <p className={styles.secTitulo}>Gabarito</p>
              <div className={styles.gabarito} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {questao.gabarito_certo
                  ? <><CheckCircle size={18} style={{ color: '#059669' }} /> <strong>Certo</strong></>
                  : <><XCircle size={18} style={{ color: '#dc2626' }} /> <strong>Errado</strong></>}
              </div>
            </div>
          )}

          {/* Comentário / justificativa */}
          {questao.comentario && (
            <div className={styles.card}>
              <p className={styles.secTitulo}>Comentário / justificativa</p>
              <div className={styles.gabarito}
                dangerouslySetInnerHTML={{ __html: questao.comentario }} />
            </div>
          )}
        </div>

        {/* Lateral */}
        <div className={styles.colSide}>
          {/* Dificuldade */}
          <div className={styles.card}>
            <p className={styles.secTitulo}>Dificuldade</p>
            <div className={styles.dificuldade}>
              {Array.from({length:5}).map((_,i) => (
                <span key={i} className={i < (questao.dificuldade ?? 0) ? styles.dotOn : styles.dotOff} />
              ))}
              <span className={styles.difLabel}>
                {['','Muito fácil','Fácil','Média','Difícil','Muito difícil'][questao.dificuldade ?? 0]}
              </span>
            </div>
          </div>

          {/* Ficha da questão */}
          <div className={styles.card}>
            <p className={styles.secTitulo}>Ficha</p>
            <div className={styles.habilidades}>
              <div className={styles.habilidadeItem}>
                <span className={styles.habilidadeCodigo}>Banca</span>
                <span className={styles.habilidadeDesc}>{questao.bancas?.nome ?? '—'}</span>
              </div>
              <div className={styles.habilidadeItem}>
                <span className={styles.habilidadeCodigo}>Órgão</span>
                <span className={styles.habilidadeDesc}>{questao.orgaos?.nome ?? '—'}</span>
              </div>
              <div className={styles.habilidadeItem}>
                <span className={styles.habilidadeCodigo}>Ano</span>
                <span className={styles.habilidadeDesc}>{questao.ano ?? '—'}</span>
              </div>
              <div className={styles.habilidadeItem}>
                <span className={styles.habilidadeCodigo}>Cargo</span>
                <span className={styles.habilidadeDesc}>{questao.cargo ?? '—'}</span>
              </div>
              <div className={styles.habilidadeItem}>
                <span className={styles.habilidadeCodigo}>Nível</span>
                <span className={styles.habilidadeDesc}>{NIVEIS[questao.nivel] ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal adicionar ao simulado */}
      {modalSimulado && (
        <div className={styles.modalOverlay} onClick={() => setModalSimulado(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitulo}>Adicionar a um simulado</h3>
            <p className={styles.modalSub}>Selecione qual simulado receberá esta questão:</p>
            <div className={styles.provasList}>
              {simulados.length === 0 ? (
                <p className={styles.vazioModal}>Nenhum simulado criado ainda.</p>
              ) : simulados.map(s => (
                <button key={s.id}
                  className={`${styles.provaItem} ${simuladoSelecionado === s.id ? styles.provaItemOn : ''}`}
                  onClick={() => setSimuladoSelecionado(s.id)}>
                  <span>{s.titulo}</span>
                  <span className={styles.provaSub}>{s.total_questoes} questões</span>
                </button>
              ))}
            </div>
            <div className={styles.modalBotoes}>
              <button className={styles.btnCancel} onClick={() => setModalSimulado(false)}>Cancelar</button>
              <button className={styles.btnConfirm}
                onClick={() => addAoSimulado.mutate()}
                disabled={addAoSimulado.isPending || !simuladoSelecionado}>
                {addAoSimulado.isPending ? 'Adicionando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal adicionar ao caderno */}
      {modalCaderno && (
        <div className={styles.modalOverlay} onClick={() => setModalCaderno(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitulo}>Adicionar a um caderno</h3>
            <p className={styles.modalSub}>Selecione qual caderno receberá esta questão:</p>
            <div className={styles.provasList}>
              {cadernos.length === 0 ? (
                <p className={styles.vazioModal}>Nenhum caderno criado ainda.</p>
              ) : cadernos.map(c => (
                <button key={c.id}
                  className={`${styles.provaItem} ${cadernoSelecionado === c.id ? styles.provaItemOn : ''}`}
                  onClick={() => setCadernoSelecionado(c.id)}>
                  <span>{c.nome}</span>
                  <span className={styles.provaSub}>{c.total_questoes} questões</span>
                </button>
              ))}
            </div>
            <div className={styles.modalBotoes}>
              <button className={styles.btnCancel} onClick={() => setModalCaderno(false)}>Cancelar</button>
              <button className={styles.btnConfirm}
                onClick={() => addAoCaderno.mutate()}
                disabled={addAoCaderno.isPending || !cadernoSelecionado}>
                {addAoCaderno.isPending ? 'Adicionando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
