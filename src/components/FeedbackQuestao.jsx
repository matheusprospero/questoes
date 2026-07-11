import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  listarComentarios, criarComentario, excluirComentario,
  listarAvaliacoes, salvarAvaliacao, resumoAvaliacoes, criarReport,
} from '../services/feedback'
import { Star, Flag, Trash2, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './FeedbackQuestao.module.css'

const DIF = [
  { n: 1, emoji: '😴', label: 'Muito fácil' },
  { n: 2, emoji: '🙂', label: 'Fácil' },
  { n: 3, emoji: '😐', label: 'Média' },
  { n: 4, emoji: '😰', label: 'Difícil' },
  { n: 5, emoji: '🤯', label: 'Muito difícil' },
]
const TIPOS = [
  { v: 'gabarito', label: 'Gabarito parece errado' },
  { v: 'sem_resposta', label: 'Nenhuma alternativa correta' },
  { v: 'enunciado', label: 'Problema no enunciado / imagem' },
  { v: 'outro', label: 'Outro' },
]
const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

export default function FeedbackQuestao({ questaoId }) {
  const { usuario, perfil, isAdmin } = useAuth()
  const qc = useQueryClient()
  const [hoverEstrela, setHoverEstrela] = useState(0)
  const [texto, setTexto] = useState('')
  const [modalReport, setModalReport] = useState(false)
  const [reportTipo, setReportTipo] = useState('gabarito')
  const [reportDesc, setReportDesc] = useState('')

  const { data: comentarios = [] } = useQuery({ queryKey: ['comentarios', questaoId], queryFn: () => listarComentarios(questaoId) })
  const { data: avaliacoes = [] } = useQuery({ queryKey: ['avaliacoes', questaoId], queryFn: () => listarAvaliacoes(questaoId) })

  const resumo = resumoAvaliacoes(avaliacoes)
  const minha = avaliacoes.find(a => a.usuario_id === usuario?.id) || {}

  const salvarAval = useMutation({
    mutationFn: (patch) => salvarAvaliacao({
      questao_id: questaoId, usuario_id: usuario.id,
      estrelas: minha.estrelas, dificuldade: minha.dificuldade, ...patch,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avaliacoes', questaoId] }),
    onError: (e) => toast.error('Erro: ' + e.message),
  })
  const addComentario = useMutation({
    mutationFn: () => criarComentario({ questao_id: questaoId, texto, autor_nome: perfil?.nome || usuario?.email?.split('@')[0] || 'Aluno' }),
    onSuccess: () => { setTexto(''); qc.invalidateQueries({ queryKey: ['comentarios', questaoId] }); toast.success('Comentário publicado!') },
    onError: (e) => toast.error(e.message),
  })
  const delComentario = useMutation({
    mutationFn: (id) => excluirComentario(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comentarios', questaoId] }),
    onError: (e) => toast.error(e.message),
  })
  const enviarReport = useMutation({
    mutationFn: () => criarReport({ questao_id: questaoId, tipo: reportTipo, descricao: reportDesc }),
    onSuccess: () => { setModalReport(false); setReportDesc(''); setReportTipo('gabarito'); toast.success('Problema reportado. Obrigado!') },
    onError: (e) => toast.error(e.message),
  })

  const difIdx = resumo.difMedia ? Math.round(resumo.difMedia) : 0
  const difMedia = DIF.find(d => d.n === difIdx)

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        {/* Termômetro de dificuldade */}
        <div className={styles.card}>
          <p className={styles.cardTitulo}>Qual a dificuldade pra você?</p>
          <div className={styles.emojis}>
            {DIF.map(d => (
              <button key={d.n}
                className={`${styles.emojiBtn} ${minha.dificuldade === d.n ? styles.emojiOn : ''}`}
                title={d.label}
                onClick={() => salvarAval.mutate({ dificuldade: d.n })}>
                <span className={styles.emoji}>{d.emoji}</span>
                <span className={styles.emojiLabel}>{d.label}</span>
              </button>
            ))}
          </div>
          <p className={styles.resumo}>
            {resumo.difN > 0
              ? <>Média da turma: <strong>{difMedia?.emoji} {difMedia?.label}</strong> · {resumo.difN} voto(s)</>
              : 'Seja o primeiro a classificar 👀'}
          </p>
        </div>

        {/* Estrelas da resolução */}
        <div className={styles.card}>
          <p className={styles.cardTitulo}>Avalie a resolução</p>
          <div className={styles.estrelas} onMouseLeave={() => setHoverEstrela(0)}>
            {[1, 2, 3, 4, 5].map(n => {
              const ativa = (hoverEstrela || minha.estrelas || 0) >= n
              return (
                <button key={n} className={styles.estrelaBtn}
                  onMouseEnter={() => setHoverEstrela(n)}
                  onClick={() => salvarAval.mutate({ estrelas: n })}
                  title={`${n} estrela(s)`}>
                  <Star size={26} fill={ativa ? '#f59e0b' : 'none'} color={ativa ? '#f59e0b' : 'var(--text-tertiary)'} />
                </button>
              )
            })}
          </div>
          <p className={styles.resumo}>
            {resumo.estrelasN > 0
              ? <>Média: <strong>{resumo.estrelasMedia.toFixed(1)}</strong> ★ · {resumo.estrelasN} avaliação(ões)</>
              : 'Ainda sem avaliações'}
          </p>
        </div>
      </div>

      <button className={styles.btnReport} onClick={() => setModalReport(true)}>
        <Flag size={14} /> Reportar um problema nesta questão
      </button>

      {/* Comentários */}
      <div className={styles.comentarios}>
        <p className={styles.cardTitulo}>Comentários ({comentarios.length})</p>
        <div className={styles.novoComentario}>
          <textarea className={styles.textarea} rows={2}
            placeholder="Deixe um comentário, dúvida ou dica sobre esta questão..."
            value={texto} onChange={e => setTexto(e.target.value)} />
          <button className={styles.btnEnviar}
            onClick={() => texto.trim() && addComentario.mutate()}
            disabled={!texto.trim() || addComentario.isPending}>
            <Send size={14} /> Publicar
          </button>
        </div>
        {comentarios.length === 0 ? (
          <p className={styles.vazio}>Nenhum comentário ainda. Comece a conversa!</p>
        ) : (
          <div className={styles.lista}>
            {comentarios.map(c => (
              <div key={c.id} className={styles.comentario}>
                <div className={styles.comentTop}>
                  <span className={styles.autor}>{c.autor_nome || 'Aluno'}</span>
                  <span className={styles.data}>{fmtData(c.criado_em)}</span>
                  {(isAdmin || c.usuario_id === usuario?.id) && (
                    <button className={styles.delBtn} onClick={() => delComentario.mutate(c.id)} title="Excluir">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p className={styles.comentTexto}>{c.texto}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de report */}
      {modalReport && (
        <div className={styles.overlay} onClick={() => setModalReport(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3>Reportar problema</h3>
              <button className={styles.fechar} onClick={() => setModalReport(false)}><X size={16} /></button>
            </div>
            <p className={styles.modalHint}>O que está errado nesta questão?</p>
            <div className={styles.tipos}>
              {TIPOS.map(t => (
                <label key={t.v} className={`${styles.tipoOpt} ${reportTipo === t.v ? styles.tipoOptOn : ''}`}>
                  <input type="radio" name="tipo" value={t.v}
                    checked={reportTipo === t.v} onChange={() => setReportTipo(t.v)} />
                  {t.label}
                </label>
              ))}
            </div>
            <textarea className={styles.textarea} rows={3}
              placeholder="Descreva o problema (opcional)..."
              value={reportDesc} onChange={e => setReportDesc(e.target.value)} />
            <div className={styles.modalBotoes}>
              <button className={styles.btnCancel} onClick={() => setModalReport(false)}>Cancelar</button>
              <button className={styles.btnConfirm} onClick={() => enviarReport.mutate()} disabled={enviarReport.isPending}>
                {enviarReport.isPending ? 'Enviando...' : 'Enviar report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
