import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listarQuestoes, mudarStatus } from '../../services/questoes'
import { buscarDisciplinasFormador } from '../../services/usuarios'
import { useAuth } from '../../contexts/AuthContext'
import { CheckCircle, XCircle, Clock, ChevronRight, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Revisao.module.css'

export default function Revisao() {
  const { usuario } = useAuth()
  const queryClient = useQueryClient()
  const [questaoSelecionada, setQuestaoSelecionada] = useState(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [mostrarModalRejeitar, setMostrarModalRejeitar] = useState(false)

  // Disciplinas vinculadas ao formador
  const { data: minhasDisciplinas = [] } = useQuery({
    queryKey: ['formador-disciplinas', usuario?.id],
    queryFn: () => buscarDisciplinasFormador(usuario?.id),
    enabled: !!usuario?.id,
  })

  const { data: todasQuestoes = [], isLoading } = useQuery({
    queryKey: ['questoes', { status: 'em_revisao' }],
    queryFn: () => listarQuestoes({ status: 'em_revisao' }),
    refetchInterval: 5000,
  })

  // Filtrar por disciplina se o formador tiver disciplinas vinculadas
  const questoes = minhasDisciplinas.length > 0
    ? todasQuestoes.filter(q => minhasDisciplinas.includes(q.disciplina_id))
    : todasQuestoes

  const publicar = useMutation({
    mutationFn: (questaoId) => mudarStatus(questaoId, 'publicado', 'Aprovada em revisão'),
    onSuccess: () => {
      queryClient.invalidateQueries(['questoes'])
      setQuestaoSelecionada(null)
      toast.success('Questão publicada!')
    },
    onError: () => toast.error('Erro ao publicar'),
  })

  const rejeitar = useMutation({
    mutationFn: (questaoId) =>
      mudarStatus(questaoId, 'rascunho', `Rejeitada: ${motivoRejeicao}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['questoes'])
      setQuestaoSelecionada(null)
      setMotivoRejeicao('')
      setMostrarModalRejeitar(false)
      toast.success('Questão rejeitada e retornada ao rascunho')
    },
    onError: () => toast.error('Erro ao rejeitar'),
  })

  function handleRejeitar() {
    if (!motivoRejeicao.trim()) {
      toast.error('Digite o motivo da rejeição')
      return
    }
    rejeitar.mutate(questaoSelecionada.id)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Fila de Revisão</h1>
          <p className={styles.subtitulo}>{questoes.length} questão(ões) aguardando aprovação</p>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.colLista}>
          {isLoading ? (
            <div className={styles.loading}>Carregando questões...</div>
          ) : questoes.length === 0 ? (
            <div className={styles.vazio}>
              <CheckCircle size={40} strokeWidth={1.5} />
              <p>Nenhuma questão aguardando revisão</p>
              <span className={styles.vazioSub}>Todas as questões foram aprovadas ou rejeitadas</span>
            </div>
          ) : (
            <div className={styles.lista}>
              {questoes.map(q => (
                <button
                  key={q.id}
                  className={`${styles.item} ${questaoSelecionada?.id === q.id ? styles.itemSelecionado : ''}`}
                  onClick={() => setQuestaoSelecionada(q)}
                >
                  <div className={styles.itemHeader}>
                    <h3 className={styles.itemTitulo}>{q.titulo}</h3>
                    <ChevronRight size={16} className={styles.itemIcon} />
                  </div>
                  <p className={styles.itemAutor}>Por {q.perfis?.nome}</p>
                  <div className={styles.itemMeta}>
                    <span className={styles.itemDisciplina}>{q.disciplinas?.nome}</span>
                    <span className={styles.itemAno}>{q.ano_escolar}</span>
                    <span className={styles.itemData}>
                      {new Date(q.criado_em).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.colDetalhe}>
          {questaoSelecionada ? (
            <div className={styles.detalhe}>
              <div className={styles.detalheHeader}>
                <h2 className={styles.detalheTitulo}>{questaoSelecionada.titulo}</h2>
                <span className={styles.detalheStatus}>
                  <Clock size={14} /> Em revisão
                </span>
              </div>

              <div className={styles.detalheMeta}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Autor</span>
                  <span className={styles.metaValor}>{questaoSelecionada.perfis?.nome}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Disciplina</span>
                  <span className={styles.metaValor}>{questaoSelecionada.disciplinas?.nome}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Ano escolar</span>
                  <span className={styles.metaValor}>{questaoSelecionada.ano_escolar}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Dificuldade</span>
                  <span className={styles.metaValor}>
                    {Array.from({ length: questaoSelecionada.nivel_dificuldade }).map((_, i) => (
                      <span key={i} className={styles.dot}>●</span>
                    ))}
                  </span>
                </div>
              </div>

              <div className={styles.detalheEnunciado}>
                <p className={styles.detalheSecTitulo}>Enunciado</p>
                <div dangerouslySetInnerHTML={{ __html: questaoSelecionada.enunciado }} />
              </div>

              {questaoSelecionada.tipo === 'multipla_escolha' && questaoSelecionada.alternativas?.length > 0 && (
                <div className={styles.detalheAlternativas}>
                  <p className={styles.detalheSecTitulo}>Alternativas</p>
                  {questaoSelecionada.alternativas.map(alt => (
                    <div
                      key={alt.id}
                      className={`${styles.altItem} ${alt.correta ? styles.altCorreta : ''}`}
                    >
                      <span className={styles.altLetra}>{alt.letra}</span>
                      <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
                      {alt.correta && <CheckCircle size={14} className={styles.checkIcon} />}
                    </div>
                  ))}
                </div>
              )}

              {questaoSelecionada.habilidades?.length > 0 && (
                <div className={styles.detalheHabilidades}>
                  <p className={styles.detalheSecTitulo}>Habilidades vinculadas</p>
                  <div className={styles.habList}>
                    {questaoSelecionada.habilidades.map(h => (
                      <div key={h.id} className={styles.habItem}>
                        <span className={styles.habCodigo}>{h.codigo}</span>
                        <span className={styles.habDesc}>{h.descricao}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {questaoSelecionada.comentario_pedagogico && (
                <div className={styles.detalheComentario}>
                  <p className={styles.detalheSecTitulo}>Comentário pedagógico</p>
                  <p className={styles.comentarioTexto}>{questaoSelecionada.comentario_pedagogico}</p>
                </div>
              )}

              <div className={styles.detalheBotoes}>
                <button
                  className={styles.btnRejeitar}
                  onClick={() => setMostrarModalRejeitar(true)}
                  disabled={rejeitar.isPending}
                >
                  <XCircle size={14} /> Rejeitar
                </button>
                <button
                  className={styles.btnAprovar}
                  onClick={() => publicar.mutate(questaoSelecionada.id)}
                  disabled={publicar.isPending}
                >
                  <CheckCircle size={14} /> {publicar.isPending ? 'Publicando...' : 'Publicar'}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.vazioDetalhe}>
              <MessageSquare size={40} strokeWidth={1.5} />
              <p>Selecione uma questão para revisar</p>
            </div>
          )}
        </div>
      </div>

      {mostrarModalRejeitar && (
        <div className={styles.modalOverlay} onClick={() => setMostrarModalRejeitar(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitulo}>Motivo da rejeição</h3>
            <p className={styles.modalSubtitulo}>Explique por que a questão foi rejeitada:</p>
            <textarea
              className={styles.modalTextarea}
              placeholder="Ex: Enunciado confuso, alternativa correta não está clara, há erro conceitual, etc."
              value={motivoRejeicao}
              onChange={e => setMotivoRejeicao(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className={styles.modalBotoes}>
              <button
                className={styles.btnCancel}
                onClick={() => {
                  setMostrarModalRejeitar(false)
                  setMotivoRejeicao('')
                }}
              >
                Cancelar
              </button>
              <button
                className={styles.btnConfirm}
                onClick={handleRejeitar}
                disabled={rejeitar.isPending || !motivoRejeicao.trim()}
              >
                {rejeitar.isPending ? 'Rejeitando...' : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
