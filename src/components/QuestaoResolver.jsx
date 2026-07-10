import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registrarResposta } from '../services/estudo'
import { listarQuestoes, buscarVideoQuestao, gabaritoQuestao } from '../services/questoes'
import VideoYouTube from './VideoYouTube'
import {
  CheckCircle, XCircle, ChevronRight, ChevronDown, ChevronUp,
  RotateCcw, BookOpen, Youtube,
} from 'lucide-react'
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

const letraGabarito = (q) => q.tipo === 'certo_errado'
  ? (q.gabarito_certo ? 'C' : 'E')
  : (q.alternativas.find(a => a.correta)?.letra ?? null)

// Item do relatório final: revisão da questão (gabarito, sua resposta, comentário, vídeo)
function ItemRevisao({ h, numero }) {
  const [aberto, setAberto] = useState(false)
  const q = h.questao
  const { data: videoUrl } = useQuery({
    queryKey: ['questao-video', q.id],
    queryFn: () => buscarVideoQuestao(q.id),
    enabled: aberto && !!q.tem_video,
  })
  const gab = letraGabarito(q)
  const nome = (v) => v === 'C' ? 'Certo' : v === 'E' ? 'Errado' : v

  return (
    <div className={styles.revItem}>
      <button className={styles.revHead} onClick={() => setAberto(a => !a)}>
        {h.acertou ? <CheckCircle size={16} className={styles.iconOk} />
          : <XCircle size={16} className={styles.iconErro} />}
        <span className={styles.revResumo}>
          {numero}. {(q.enunciado || '').replace(/<[^>]*>/g, ' ').slice(0, 80)}…
        </span>
        <span className={styles.revResp} data-ok={h.acertou}>
          {nome(h.resposta)} {h.acertou ? '' : `· gab. ${nome(gab)}`}
        </span>
        {aberto ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {aberto && (
        <div className={styles.revBody}>
          <div className={styles.enunciado} dangerouslySetInnerHTML={{ __html: q.enunciado }} />
          {q.tipo === 'multipla_escolha' && (
            <div className={styles.revAlts}>
              {q.alternativas.map(alt => {
                const correta = alt.correta
                const suaErrada = alt.letra === h.resposta && !h.acertou
                return (
                  <div key={alt.id} className={`${styles.revAlt} ${correta ? styles.certa : suaErrada ? styles.errada : ''}`}>
                    <span className={styles.opcaoLetra}>{alt.letra}</span>
                    <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
                    {correta && <CheckCircle size={13} className={styles.iconOk} style={{ marginLeft: 'auto' }} />}
                  </div>
                )
              })}
            </div>
          )}
          {q.comentario && (
            <div className={styles.comentario}>
              <p className={styles.comentTitulo}>Comentário</p>
              <div dangerouslySetInnerHTML={{ __html: q.comentario }} />
            </div>
          )}
          {q.tem_video && (
            <div className={styles.comentario}>
              <p className={styles.comentTitulo}>
                <Youtube size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} /> Resolução em vídeo
              </p>
              {videoUrl ? <VideoYouTube url={videoUrl} />
                : <p className={styles.videoBloqueado}>🔒 Resolução em vídeo exclusiva para assinantes.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Resolvedor "modo prova": marca a alternativa → próxima (sem gabarito) → relatório no final.
// `contexto` = { assunto_id, disciplina_id } para o botão "mais questões deste assunto".
export default function QuestaoResolver({ questoes, contexto }) {
  const queryClient = useQueryClient()
  const [sessao, setSessao] = useState(questoes)
  const [indice, setIndice] = useState(0)
  const [selecionada, setSelecionada] = useState(null)
  const [historico, setHistorico] = useState([])
  const [fase, setFase] = useState('resolvendo') // resolvendo | resultado
  const [carregando, setCarregando] = useState(false)

  const q = sessao[indice]
  const acertos = historico.filter(h => h.acertou).length

  function iniciar(lista) {
    setSessao(lista); setIndice(0); setSelecionada(null); setHistorico([]); setFase('resolvendo')
  }

  // Marca a resposta e vai para a próxima (sem mostrar o gabarito)
  async function avancar() {
    if (selecionada === null) { toast.error('Marque uma alternativa'); return }
    const acertou = selecionada === letraGabarito(q)
    setHistorico(h => [...h, { questao: q, resposta: selecionada, acertou }])
    try {
      await registrarResposta({ questao_id: q.id, resposta: selecionada, acertou, origem: 'estudo' })
      queryClient.invalidateQueries({ queryKey: ['respostas'] })
    } catch (err) {
      toast.error('Erro ao registrar resposta: ' + err.message)
    }
    if (indice + 1 >= sessao.length) setFase('resultado')
    else { setIndice(i => i + 1); setSelecionada(null) }
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

  // ── Relatório final ──
  if (fase === 'resultado') {
    const pct = historico.length ? Math.round((acertos / historico.length) * 100) : 0
    const erradas = historico.filter(h => !h.acertou)
    return (
      <div className={styles.resultado}>
        <h3 className={styles.resultadoTitulo}>Relatório da aula</h3>
        <div className={styles.resultadoPct} data-bom={pct >= 70}>{pct}%</div>
        <p className={styles.resultadoResumo}>
          <CheckCircle size={15} className={styles.iconOk} /> {acertos} acerto(s)
          &nbsp;&nbsp;
          <XCircle size={15} className={styles.iconErro} /> {erradas.length} erro(s)
          &nbsp;de {historico.length}
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
        <p className={styles.revTitulo}>Revisão — toque para ver o gabarito e o comentário</p>
        <div className={styles.resultadoLista}>
          {historico.map((h, i) => <ItemRevisao key={i} h={h} numero={i + 1} />)}
        </div>
      </div>
    )
  }

  // ── Modo prova (sem gabarito) ──
  if (!q) return null
  const ehUltima = indice + 1 >= sessao.length

  return (
    <div className={styles.wrap}>
      <div className={styles.barra}>
        <span className={styles.barraTexto}>Questão <strong>{indice + 1}</strong> de {sessao.length}</span>
        <span className={styles.placar}>respondidas: {historico.length}/{sessao.length}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${(indice / sessao.length) * 100}%` }} />
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
          {q.alternativas.map(alt => (
            <button key={alt.id}
              className={`${styles.opcao} ${alt.letra === selecionada ? styles.selecionada : ''}`}
              onClick={() => setSelecionada(alt.letra)}>
              <span className={styles.opcaoLetra}>{alt.letra}</span>
              <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.opcoesCE}>
          {[{ v: 'C', l: 'Certo', I: CheckCircle }, { v: 'E', l: 'Errado', I: XCircle }].map(({ v, l, I }) => (
            <button key={v}
              className={`${styles.opcaoCE} ${v === selecionada ? styles.selecionada : ''}`}
              onClick={() => setSelecionada(v)}>
              <I size={17} /> {l}
            </button>
          ))}
        </div>
      )}

      <div className={styles.acoes}>
        <button className={styles.btnPrimario} onClick={avancar} disabled={selecionada === null}>
          {ehUltima ? 'Finalizar' : 'Próxima'} <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
