import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registrarResposta } from '../services/estudo'
import { listarQuestoes, buscarVideoQuestao, gabaritoQuestao } from '../services/questoes'
import VideoYouTube from './VideoYouTube'
import { CheckCircle, XCircle, ChevronRight, RotateCcw, BookOpen, Youtube } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './QuestaoResolver.module.css'

function embaralhar(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const temGabarito = (q) =>
  q.tipo === 'certo_errado' ? (q.gabarito_certo !== null && q.gabarito_certo !== undefined)
    : (q.alternativas || []).some(a => a.correta)

// Resolvedor interativo embutido: responde → feedback → próxima → resultado.
// `contexto` = { assunto_id, disciplina_id } para o botão "mais questões deste assunto".
export default function QuestaoResolver({ questoes, contexto }) {
  const queryClient = useQueryClient()
  const [sessao, setSessao] = useState(questoes)
  const [indice, setIndice] = useState(0)
  const [selecionada, setSelecionada] = useState(null)
  const [respondida, setRespondida] = useState(false)
  const [historico, setHistorico] = useState([])
  const [fase, setFase] = useState('resolvendo') // resolvendo | resultado
  const [carregando, setCarregando] = useState(false)

  const q = sessao[indice]
  const { data: videoAtual } = useQuery({
    queryKey: ['questao-video', q?.id],
    queryFn: () => buscarVideoQuestao(q.id),
    enabled: !!(respondida && q?.tem_video),
  })

  const acertos = historico.filter(h => h.acertou).length

  async function responder() {
    if (selecionada === null) { toast.error('Escolha uma resposta'); return }
    const gab = q.tipo === 'certo_errado' ? (q.gabarito_certo ? 'C' : 'E')
      : (q.alternativas.find(a => a.correta)?.letra ?? null)
    const acertou = selecionada === gab
    setRespondida(true)
    setHistorico(h => [...h, { questao: q, resposta: selecionada, acertou }])
    try {
      await registrarResposta({ questao_id: q.id, resposta: selecionada, acertou, origem: 'estudo' })
      queryClient.invalidateQueries({ queryKey: ['respostas'] })
    } catch (err) {
      toast.error('Erro ao registrar resposta: ' + err.message)
    }
  }

  function proxima() {
    if (indice + 1 >= sessao.length) setFase('resultado')
    else { setIndice(i => i + 1); setSelecionada(null); setRespondida(false) }
  }

  function iniciar(lista) {
    setSessao(lista); setIndice(0); setSelecionada(null); setRespondida(false)
    setHistorico([]); setFase('resolvendo')
  }

  function refazerErradas() {
    iniciar(embaralhar(historico.filter(h => !h.acertou).map(h => h.questao)))
  }

  async function maisDoAssunto() {
    setCarregando(true)
    try {
      const filtro = contexto?.assunto_id ? { assunto_id: contexto.assunto_id }
        : contexto?.disciplina_id ? { disciplina_id: contexto.disciplina_id } : {}
      const qs = (await listarQuestoes(filtro)).filter(temGabarito)
      const feitas = new Set(historico.map(h => h.questao.id))
      const inedita = qs.filter(x => !feitas.has(x.id))
      const base = inedita.length > 0 ? inedita : qs
      if (base.length === 0) { toast.error('Nenhuma questão deste assunto disponível.'); return }
      iniciar(embaralhar(base))
    } catch (err) {
      toast.error('Erro ao montar as questões: ' + err.message)
    } finally {
      setCarregando(false)
    }
  }

  // ── Resultado ──
  if (fase === 'resultado') {
    const pct = historico.length ? Math.round((acertos / historico.length) * 100) : 0
    const erradas = historico.filter(h => !h.acertou)
    return (
      <div className={styles.resultado}>
        <h3 className={styles.resultadoTitulo}>Questões concluídas!</h3>
        <div className={styles.resultadoPct} data-bom={pct >= 70}>{pct}%</div>
        <p className={styles.resultadoResumo}>
          Você acertou <strong>{acertos}</strong> de <strong>{historico.length}</strong> questão(ões)
        </p>
        <div className={styles.resultadoBotoes}>
          {(contexto?.assunto_id || contexto?.disciplina_id) && (
            <button className={styles.btnPrimario} onClick={maisDoAssunto} disabled={carregando}>
              <BookOpen size={15} /> {carregando ? 'Buscando...' : `Mais questões ${contexto.assunto_id ? 'deste assunto' : 'deste tema'}`}
            </button>
          )}
          {erradas.length > 0 && (
            <button className={styles.btnGhost} onClick={refazerErradas}>
              <RotateCcw size={15} /> Refazer as {erradas.length} erradas
            </button>
          )}
          <button className={styles.btnGhost} onClick={() => iniciar(questoes)}>
            <RotateCcw size={15} /> Refazer a aula
          </button>
        </div>
        <div className={styles.resultadoLista}>
          {historico.map((h, i) => (
            <div key={i} className={styles.resultadoItem}>
              {h.acertou ? <CheckCircle size={15} className={styles.iconOk} />
                : <XCircle size={15} className={styles.iconErro} />}
              <span className={styles.resultadoItemTexto}>
                {i + 1}. {(h.questao.enunciado || '').replace(/<[^>]*>/g, ' ').slice(0, 80)}…
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Resolvendo ──
  if (!q) return null
  const gabarito = gabaritoQuestao(q)
  const respostaCerta = q.tipo === 'certo_errado' ? (q.gabarito_certo ? 'C' : 'E')
    : q.alternativas.find(a => a.correta)?.letra
  const ultima = historico[historico.length - 1]

  return (
    <div className={styles.wrap}>
      <div className={styles.barra}>
        <span className={styles.barraTexto}>Questão <strong>{indice + 1}</strong> de {sessao.length}</span>
        <span className={styles.placar}>
          <CheckCircle size={13} className={styles.iconOk} /> {acertos}
          <XCircle size={13} className={styles.iconErro} /> {historico.length - acertos}
        </span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${((indice + (respondida ? 1 : 0)) / sessao.length) * 100}%` }} />
      </div>

      <div className={styles.qMeta}>
        {q.bancas && <span className={styles.badge}>{q.bancas.nome}</span>}
        {q.orgaos && <span className={styles.badge}>{q.orgaos.nome}</span>}
        {q.ano && <span className={styles.badge}>{q.ano}</span>}
        {q.assuntos && <span className={styles.badge}>{q.assuntos.nome}</span>}
      </div>

      <div className={styles.enunciado} dangerouslySetInnerHTML={{ __html: q.enunciado }} />

      {q.tipo === 'multipla_escolha' ? (
        <div className={styles.opcoes}>
          {q.alternativas.map(alt => {
            let estado = ''
            if (respondida) {
              if (alt.letra === respostaCerta) estado = styles.certa
              else if (alt.letra === selecionada) estado = styles.errada
            } else if (alt.letra === selecionada) estado = styles.selecionada
            return (
              <button key={alt.id} className={`${styles.opcao} ${estado}`}
                onClick={() => !respondida && setSelecionada(alt.letra)} disabled={respondida}>
                <span className={styles.opcaoLetra}>{alt.letra}</span>
                <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
              </button>
            )
          })}
        </div>
      ) : (
        <div className={styles.opcoesCE}>
          {[{ v: 'C', l: 'Certo', I: CheckCircle }, { v: 'E', l: 'Errado', I: XCircle }].map(({ v, l, I }) => {
            let estado = ''
            if (respondida) {
              if (v === respostaCerta) estado = styles.certa
              else if (v === selecionada) estado = styles.errada
            } else if (v === selecionada) estado = styles.selecionada
            return (
              <button key={v} className={`${styles.opcaoCE} ${estado}`}
                onClick={() => !respondida && setSelecionada(v)} disabled={respondida}>
                <I size={17} /> {l}
              </button>
            )
          })}
        </div>
      )}

      {respondida && (
        <div className={ultima?.acertou ? styles.feedbackOk : styles.feedbackErro}>
          {ultima?.acertou
            ? <><CheckCircle size={16} /> Você acertou! Gabarito: <strong>{gabarito}</strong></>
            : <><XCircle size={16} /> Você errou. Gabarito: <strong>{gabarito}</strong></>}
        </div>
      )}

      {respondida && q.comentario && (
        <div className={styles.comentario}>
          <p className={styles.comentTitulo}>Comentário</p>
          <div dangerouslySetInnerHTML={{ __html: q.comentario }} />
        </div>
      )}

      {respondida && q.tem_video && (
        <div className={styles.comentario}>
          <p className={styles.comentTitulo}>
            <Youtube size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} /> Resolução em vídeo
          </p>
          {videoAtual ? <VideoYouTube url={videoAtual} />
            : <p className={styles.videoBloqueado}>🔒 Resolução em vídeo exclusiva para assinantes.</p>}
        </div>
      )}

      <div className={styles.acoes}>
        {!respondida ? (
          <button className={styles.btnPrimario} onClick={responder} disabled={selecionada === null}>
            Responder
          </button>
        ) : (
          <button className={styles.btnPrimario} onClick={proxima}>
            {indice + 1 >= sessao.length ? 'Ver resultado' : 'Próxima questão'} <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
