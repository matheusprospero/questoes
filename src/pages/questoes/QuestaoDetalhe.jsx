import { useParams, useNavigate } from 'react-router-dom'
import { listarProvas } from '../../services/provas'
import { adicionarQuestaoProva } from '../../services/questoes'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buscarQuestao, avaliarQuestao, toggleFavorito, listarFavoritos, registrarVisualizacao } from '../../services/questoes'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, Pencil, Star, Heart, CheckCircle, XCircle, Clock, Archive, MessageSquare, Send, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './QuestaoDetalhe.module.css'

const STATUS_CONFIG = {
  rascunho:   { label: 'Rascunho',   icon: Clock,        cor: 'gray'  },
  em_revisao: { label: 'Em revisão', icon: Clock,        cor: 'amber' },
  aprovado:   { label: 'Aprovado',   icon: CheckCircle,  cor: 'blue'  },
  publicado:  { label: 'Publicado',  icon: CheckCircle,  cor: 'green' },
  arquivado:  { label: 'Arquivado',  icon: Archive,      cor: 'gray'  },
}

export default function QuestaoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario, isFormador, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const podeAprovar = isFormador || isAdmin
  const isProfessor = !isFormador && !isAdmin
  const [minhaAvaliacao, setMinhaAvaliacao] = useState(0)
  const [favoritoId, setFavoritoId] = useState(null)
  const [modalProva, setModalProva] = useState(false)
  const [provaSelecionada, setProvaSelecionada] = useState(null)

  const { data: questao, isLoading } = useQuery({
    queryKey: ['questao', id],
    queryFn: () => buscarQuestao(id),
  })

  const ehAutor = questao?.autor_id === usuario?.id

  const { data: favoritos = [] } = useQuery({
    queryKey: ['favoritos'],
    queryFn: listarFavoritos,
  })

  const { data: provas = [] } = useQuery({
    queryKey: ['provas', 'minhas', usuario?.id],
    queryFn: () => listarProvas({ autor_id: usuario?.id }),
    enabled: !!usuario,
  })

  const addAProva = useMutation({
    mutationFn: () => {
      if (!provaSelecionada) throw new Error('Selecione uma prova')
      return adicionarQuestaoProva(provaSelecionada, id)
    },
    onSuccess: () => {
      setModalProva(false)
      setProvaSelecionada(null)
      toast.success('Questão adicionada à prova!')
    },
    onError: (err) => toast.error(err.message),
  })

  useEffect(() => {
    if (id) registrarVisualizacao(id)
  }, [id])

  useEffect(() => {
    if (questao && usuario) {
      const minha = questao.avaliacoes?.find(a => a.autor_id === usuario.id)
      if (minha) setMinhaAvaliacao(minha.nota)
    }
  }, [questao, usuario])

  useEffect(() => {
    const fav = favoritos.find(f => f.questao_id === id)
    setFavoritoId(fav?.id ?? null)
  }, [favoritos, id])

  const mutarAvaliacao = useMutation({
    mutationFn: (nota) => avaliarQuestao(id, nota),
    onSuccess: (_, nota) => {
      setMinhaAvaliacao(nota)
      queryClient.invalidateQueries(['questao', id])
      toast.success('Avaliação registrada!')
    },
  })

  const mutarFavorito = useMutation({
    mutationFn: () => toggleFavorito(id, favoritoId),
    onSuccess: (novoId) => {
      setFavoritoId(novoId)
      queryClient.invalidateQueries(['favoritos'])
      toast.success(novoId ? 'Adicionado aos favoritos' : 'Removido dos favoritos')
    },
  })

  if (isLoading) return <div className={styles.loading}>Carregando questão...</div>
  if (!questao) return <div className={styles.loading}>Questão não encontrada.</div>

  const StatusIcon = STATUS_CONFIG[questao.status]?.icon ?? Clock

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
            <Heart size={15} /> {favoritoId ? 'Favoritado' : 'Favoritar'}
          </button>
          <button className={styles.btnSecondary} onClick={() => setModalProva(true)}>
            + Adicionar à prova
          </button>
          {(podeAprovar || (questao && questao.autor_id === usuario?.id)) && (
            <button className={styles.btnSecondary} onClick={() => navigate(`/questoes/${id}/editar`)}>
              <Pencil size={14} /> Editar
            </button>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.colMain}>
          {/* Cabeçalho */}
          <div className={styles.card}>
            <div className={styles.badgeRow}>
              <span className={`${styles.badge} ${styles['tipo_' + questao.tipo]}`}>
                {questao.tipo === 'multipla_escolha' ? 'Múltipla escolha' : 'Dissertativa'}
              </span>
              <span className={`${styles.badge} ${styles['status_' + questao.status]}`}>
                <StatusIcon size={11} /> {STATUS_CONFIG[questao.status]?.label}
              </span>
              {questao.disciplinas && <span className={styles.badgeGray}>{questao.disciplinas.nome}</span>}
              {questao.ano_escolar && <span className={styles.badgeGray}>{questao.ano_escolar}</span>}
            </div>
            <h1 className={styles.titulo}>{questao.titulo}</h1>
            <div className={styles.meta}>
              <span>Criada por <strong>{questao.perfis?.nome ?? '—'}</strong></span>
              <span>·</span>
              <span>{new Date(questao.criado_em).toLocaleDateString('pt-BR')}</span>
              {questao.fonte && <><span>·</span><span>Fonte: {questao.fonte}</span></>}
            </div>
            <div className={styles.autoria}>
              <span className={styles.autoriaItem}>
                <CheckCircle size={13} className={questao.validacao ? styles.autoriaOk : styles.autoriaPend} />
                {questao.validacao ? (
                  <>Validada por <strong>{questao.validacao.nome ?? '—'}</strong>
                  {' em '}{new Date(questao.validacao.em).toLocaleDateString('pt-BR')}</>
                ) : (
                  <span className={styles.autoriaPendTxt}>Ainda não validada</span>
                )}
              </span>
            </div>
          </div>

          {/* Enunciado */}
          <div className={styles.card}>
            <p className={styles.secTitulo}>Enunciado</p>
            <div className={styles.enunciado}
              dangerouslySetInnerHTML={{ __html: questao.enunciado }} />
          </div>

          {/* Alternativas */}
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

          {/* Gabarito dissertativo */}
          {questao.tipo === 'dissertativa' && questao.gabarito && (
            <div className={styles.card}>
              <p className={styles.secTitulo}>Gabarito</p>
              <div className={styles.gabarito}
                dangerouslySetInnerHTML={{ __html: questao.gabarito.texto }} />
              {questao.gabarito.criterios && (
                <>
                  <p className={styles.secTitulo} style={{marginTop:14}}>Critérios de correção</p>
                  <p className={styles.gabCriterios}>{questao.gabarito.criterios}</p>
                </>
              )}
            </div>
          )}

          {/* Comentário pedagógico */}
          {questao.comentario_pedagogico && (
            <div className={styles.card}>
              <p className={styles.secTitulo}>Comentário pedagógico</p>
              <p className={styles.comentarioPed}>{questao.comentario_pedagogico}</p>
            </div>
          )}

        </div>

        {/* Lateral */}
        <div className={styles.colSide}>

          {/* Avaliação */}
          <div className={styles.card}>
            <p className={styles.secTitulo}>Avaliação</p>
            <div className={styles.estrelasRow}>
              {[1,2,3,4,5].map(n => (
                <button key={n} className={styles.estBtn}
                  onClick={() => mutarAvaliacao.mutate(n)}
                  title={`Avaliar com ${n} estrela(s)`}>
                  <Star size={22}
                    className={n <= minhaAvaliacao ? styles.estOn : styles.estOff} />
                </button>
              ))}
            </div>
            {questao.media_avaliacao && (
              <p className={styles.mediaAval}>
                Média: {questao.media_avaliacao.toFixed(1)} ({questao.total_avaliacoes} avaliação{questao.total_avaliacoes !== 1 ? 'ões' : ''})
              </p>
            )}
          </div>

          {/* Habilidades */}
          {questao.habilidades?.length > 0 && (
            <div className={styles.card}>
              <p className={styles.secTitulo}>Habilidades</p>
              <div className={styles.habilidades}>
                {questao.habilidades.map(h => (
                  <div key={h.id} className={styles.habilidadeItem}>
                    <span className={styles.habilidadeCodigo}>{h.codigo}</span>
                    <span className={styles.habilidadeDesc}>{h.descricao}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dificuldade */}
          <div className={styles.card}>
            <p className={styles.secTitulo}>Dificuldade</p>
            <div className={styles.dificuldade}>
              {Array.from({length:5}).map((_,i) => (
                <span key={i} className={i < (questao.nivel_dificuldade ?? 0) ? styles.dotOn : styles.dotOff} />
              ))}
              <span className={styles.difLabel}>
                {['','Muito fácil','Fácil','Médio','Difícil','Muito difícil'][questao.nivel_dificuldade ?? 0]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal adicionar à prova */}
      {modalProva && (
        <div className={styles.modalOverlay} onClick={() => setModalProva(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitulo}>Adicionar a uma prova</h3>
            <p className={styles.modalSub}>Selecione qual prova receberá esta questão:</p>
            <div className={styles.provasList}>
              {provas.length === 0 ? (
                <p className={styles.vazioModal}>Nenhuma prova criada ainda.</p>
              ) : provas.map(p => (
                <button key={p.id}
                  className={`${styles.provaItem} ${provaSelecionada === p.id ? styles.provaItemOn : ''}`}
                  onClick={() => setProvaSelecionada(p.id)}>
                  <span>{p.titulo}</span>
                  <span className={styles.provaSub}>{p.disciplinas?.nome} • {p.ano_escolar}</span>
                </button>
              ))}
            </div>
            <div className={styles.modalBotoes}>
              <button className={styles.btnCancel} onClick={() => setModalProva(false)}>Cancelar</button>
              <button className={styles.btnConfirm}
                onClick={() => addAProva.mutate()}
                disabled={addAProva.isPending || !provaSelecionada}>
                {addAProva.isPending ? 'Adicionando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>  )
}
