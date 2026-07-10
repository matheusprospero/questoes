import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  listarQuestoes, listarDisciplinas, listarAssuntos, listarBancas, gabaritoQuestao, buscarVideoQuestao,
} from '../../services/questoes'
import {
  registrarResposta, listarRespostas, idsUltimaErrada,
  montarRecomendadas, amostraDiversificada,
} from '../../services/estudo'
import { buscarSimulado } from '../../services/simulados'
import { buscarAula } from '../../services/aulas'
import VideoYouTube from '../../components/VideoYouTube'
import {
  Play, CheckCircle, XCircle, ChevronRight, RotateCcw, BarChart2, BookOpen, Youtube, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Estudo.module.css'

function embaralhar(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A questão tem gabarito definido? (sem gabarito não dá para corrigir)
function temGabarito(q) {
  if (q.tipo === 'certo_errado') return q.gabarito_certo !== null && q.gabarito_certo !== undefined
  return (q.alternativas || []).some(a => a.correta)
}

export default function Estudo() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  // fase: config | resolvendo | resultado
  const [fase, setFase] = useState('config')
  const [filtros, setFiltros] = useState({})
  // modo: todas | erradas (refazer o que errou) | similares (sugestões)
  const [modo, setModo] = useState(
    searchParams.get('erradas') === '1' ? 'erradas'
    : searchParams.get('similares') === '1' ? 'similares'
    : 'todas'
  )
  const [quantidade, setQuantidade] = useState('')

  // sessão
  const [sessao, setSessao] = useState([])          // questões da sessão
  const [indice, setIndice] = useState(0)
  const [selecionada, setSelecionada] = useState(null) // letra ou 'C'/'E'
  const [respondida, setRespondida] = useState(false)
  const [historico, setHistorico] = useState([])    // { questao, resposta, acertou }
  const [origemSessao, setOrigemSessao] = useState('estudo') // estudo | simulado

  // ?simulado=<id> → resolve online as questões daquele simulado, na ordem
  const simuladoId = searchParams.get('simulado')
  const [carregandoSimulado, setCarregandoSimulado] = useState(!!simuladoId)
  const [tituloSimulado, setTituloSimulado] = useState(null)
  useEffect(() => {
    if (!simuladoId) return
    ;(async () => {
      try {
        const sim = await buscarSimulado(simuladoId)
        const questoes = (sim.questoes || []).filter(temGabarito)
        if (questoes.length === 0) {
          toast.error('Este simulado não tem questões com gabarito para resolver.')
          return
        }
        setTituloSimulado(sim.titulo)
        await comecar(questoes, 'simulado')
      } catch (err) {
        toast.error('Não foi possível abrir o simulado: ' + err.message)
      } finally {
        setCarregandoSimulado(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simuladoId])

  // ?aula=<id> → resolve as questões daquela aula
  const aulaId = searchParams.get('aula')
  const [carregandoAula, setCarregandoAula] = useState(!!aulaId)
  const [aulaCtx, setAulaCtx] = useState(null) // { titulo, assunto_id, disciplina_id }
  useEffect(() => {
    if (!aulaId) return
    ;(async () => {
      try {
        const aula = await buscarAula(aulaId)
        const questoes = (aula.questoes || []).filter(temGabarito)
        if (questoes.length === 0) {
          toast.error('Esta aula não tem questões com gabarito para resolver.')
          return
        }
        setAulaCtx({ titulo: aula.titulo, assunto_id: aula.assunto_id, disciplina_id: aula.disciplina_id })
        await comecar(questoes, 'estudo')
      } catch (err) {
        toast.error('Não foi possível abrir a aula: ' + err.message)
      } finally {
        setCarregandoAula(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulaId])

  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: listarDisciplinas })
  const { data: assuntos = [] } = useQuery({
    queryKey: ['assuntos', filtros.disciplina_id],
    queryFn: () => listarAssuntos(filtros.disciplina_id),
    enabled: !!filtros.disciplina_id,
  })
  const { data: bancas = [] } = useQuery({ queryKey: ['bancas'], queryFn: listarBancas })

  function setFiltro(key, val) {
    setFiltros(f => {
      const n = { ...f }
      if (val) n[key] = val; else delete n[key]
      if (key === 'disciplina_id') delete n.assunto_id
      return n
    })
  }

  const [carregando, setCarregando] = useState(false)

  async function comecar(questoesBase = null, origem = 'estudo') {
    setCarregando(true)
    try {
      setOrigemSessao(origem)
      let questoes = questoesBase
      if (!questoes) {
        questoes = await listarQuestoes(filtros)
        questoes = questoes.filter(temGabarito)
        const qtd = Number(quantidade)

        if (modo === 'erradas') {
          const respostas = await listarRespostas()
          const erradas = idsUltimaErrada(respostas)
          questoes = questoes.filter(q => erradas.has(q.id))
          questoes = embaralhar(questoes)
        } else if (modo === 'similares') {
          const respostas = await listarRespostas()
          // Já vem priorizado pelos assuntos com mais erros
          questoes = montarRecomendadas(questoes, respostas, { limite: qtd > 0 ? qtd : 15 })
        } else {
          // Com quantidade definida, diversifica disciplinas/bancas/provas
          questoes = qtd > 0 ? amostraDiversificada(questoes, qtd) : embaralhar(questoes)
        }

        if (qtd > 0) questoes = questoes.slice(0, qtd)
      }

      if (questoes.length === 0) {
        toast.error(
          modo === 'erradas' ? 'Nenhuma questão errada encontrada com esses filtros.'
          : modo === 'similares' ? 'Sem sugestões por enquanto: erre algumas questões primeiro 😉 ou você já respondeu todas as similares.'
          : 'Nenhuma questão com gabarito encontrada com esses filtros.')
        return
      }

      setSessao(questoes)
      setIndice(0)
      setSelecionada(null)
      setRespondida(false)
      setHistorico([])
      setFase('resolvendo')
    } catch (err) {
      toast.error('Erro ao montar a sessão: ' + err.message)
    } finally {
      setCarregando(false)
    }
  }

  const questaoAtual = sessao[indice]

  // Vídeo (protegido) da questão atual, só após responder e se houver vídeo
  const { data: videoAtual } = useQuery({
    queryKey: ['questao-video', questaoAtual?.id],
    queryFn: () => buscarVideoQuestao(questaoAtual.id),
    enabled: !!(respondida && questaoAtual?.tem_video),
  })

  async function responder() {
    if (selecionada === null) { toast.error('Escolha uma resposta'); return }
    const gabarito = questaoAtual.tipo === 'certo_errado'
      ? (questaoAtual.gabarito_certo ? 'C' : 'E')
      : (questaoAtual.alternativas.find(a => a.correta)?.letra ?? null)

    const acertou = selecionada === gabarito
    setRespondida(true)
    setHistorico(h => [...h, { questao: questaoAtual, resposta: selecionada, acertou }])

    try {
      await registrarResposta({
        questao_id: questaoAtual.id,
        resposta: selecionada,
        acertou,
        origem: origemSessao,
        simulado_id: origemSessao === 'simulado' ? simuladoId : null,
      })
      queryClient.invalidateQueries({ queryKey: ['respostas'] })
    } catch (err) {
      toast.error('Erro ao registrar resposta: ' + err.message)
    }
  }

  function proxima() {
    if (indice + 1 >= sessao.length) {
      setFase('resultado')
    } else {
      setIndice(i => i + 1)
      setSelecionada(null)
      setRespondida(false)
    }
  }

  function refazerErradasDaSessao() {
    const erradas = historico.filter(h => !h.acertou).map(h => h.questao)
    comecar(embaralhar(erradas))
  }

  // Mais questões do assunto/disciplina da aula (prioriza as ainda não feitas na sessão)
  async function treinarMaisDoAssunto() {
    if (!aulaCtx) return
    setCarregando(true)
    try {
      const filtro = aulaCtx.assunto_id ? { assunto_id: aulaCtx.assunto_id }
        : aulaCtx.disciplina_id ? { disciplina_id: aulaCtx.disciplina_id } : {}
      const questoes = (await listarQuestoes(filtro)).filter(temGabarito)
      const feitas = new Set(historico.map(h => h.questao.id))
      const inedita = questoes.filter(q => !feitas.has(q.id))
      const base = inedita.length > 0 ? inedita : questoes
      if (base.length === 0) { toast.error('Nenhuma questão deste assunto disponível.'); return }
      await comecar(embaralhar(base))
    } catch (err) {
      toast.error('Erro ao montar as questões: ' + err.message)
    } finally {
      setCarregando(false)
    }
  }

  // Sessão nova com questões inéditas dos assuntos que o usuário errou
  // (as respostas da sessão atual já estão registradas no banco)
  async function treinarSimilares() {
    setCarregando(true)
    try {
      const [questoes, respostas] = await Promise.all([listarQuestoes({}), listarRespostas()])
      const sugeridas = montarRecomendadas(questoes.filter(temGabarito), respostas, { limite: 15 })
      if (sugeridas.length === 0) {
        toast.error('Você já respondeu todas as questões similares disponíveis. 🎉')
        return
      }
      await comecar(sugeridas)
    } catch (err) {
      toast.error('Erro ao montar sugestões: ' + err.message)
    } finally {
      setCarregando(false)
    }
  }

  const acertos = historico.filter(h => h.acertou).length

  // ══════════════ FASE: CONFIG ══════════════
  if (fase === 'config') {
    if (carregandoSimulado || carregandoAula) {
      return (
        <div className={styles.page}>
          <div className={styles.carregandoSimulado}>
            {carregandoAula ? 'Abrindo aula...' : 'Abrindo simulado...'}
          </div>
        </div>
      )
    }
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.titulo}>Resolver Questões</h1>
            <p className={styles.subtitulo}>Monte uma sessão de estudo com filtros e registre seu desempenho</p>
          </div>
          <button className={styles.btnGhost} onClick={() => navigate('/estatisticas')}>
            <BarChart2 size={15} /> Ver estatísticas
          </button>
        </div>

        <div className={styles.configCard}>
          <p className={styles.secTitulo}>Filtros da sessão</p>
          <div className={styles.filtrosGrid}>
            <select className={styles.filtroSelect} value={filtros.disciplina_id ?? ''}
              onChange={e => setFiltro('disciplina_id', e.target.value)}>
              <option value="">Todas as disciplinas</option>
              {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <select className={styles.filtroSelect} value={filtros.assunto_id ?? ''}
              onChange={e => setFiltro('assunto_id', e.target.value)}
              disabled={!filtros.disciplina_id}>
              <option value="">{filtros.disciplina_id ? 'Todos os assuntos' : 'Assunto (escolha a disciplina)'}</option>
              {assuntos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <select className={styles.filtroSelect} value={filtros.banca_id ?? ''}
              onChange={e => setFiltro('banca_id', e.target.value)}>
              <option value="">Todas as bancas</option>
              {bancas.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
            <input className={styles.filtroSelect} type="number" placeholder="Ano (ex: 2023)"
              value={filtros.ano ?? ''}
              onChange={e => setFiltro('ano', e.target.value)}
              min="1990" max="2100"
            />
            <select className={styles.filtroSelect} value={filtros.dificuldade ?? ''}
              onChange={e => setFiltro('dificuldade', e.target.value)}>
              <option value="">Qualquer dificuldade</option>
              {[1,2,3,4,5].map(n => (
                <option key={n} value={n}>
                  {['','Muito fácil','Fácil','Média','Difícil','Muito difícil'][n]}
                </option>
              ))}
            </select>
            <select className={styles.filtroSelect} value={filtros.tipo ?? ''}
              onChange={e => setFiltro('tipo', e.target.value)}>
              <option value="">Todos os tipos</option>
              <option value="multipla_escolha">Múltipla escolha</option>
              <option value="certo_errado">Certo / Errado</option>
            </select>
          </div>

          <div className={styles.configOpcoes}>
            <p className={styles.secTitulo}>Modo da sessão</p>
            <div className={styles.modosGrid}>
              {[
                { valor: 'todas', titulo: 'Novas questões', hint: 'Todas as questões que passarem nos filtros', Icon: BookOpen },
                { valor: 'erradas', titulo: 'Refazer erradas', hint: 'Exatamente as questões cuja última resposta foi errada', Icon: RotateCcw },
                { valor: 'similares', titulo: 'Similares às erradas', hint: 'Sugestões inéditas dos assuntos em que você mais erra', Icon: Sparkles },
              ].map(({ valor, titulo, hint, Icon }) => (
                <button key={valor} type="button"
                  className={`${styles.modoCard} ${modo === valor ? styles.modoCardAtivo : ''}`}
                  onClick={() => setModo(valor)}>
                  <Icon size={17} className={styles.modoIcone} />
                  <span className={styles.modoTitulo}>{titulo}</span>
                  <span className={styles.modoHint}>{hint}</span>
                </button>
              ))}
            </div>

            <div className={styles.qtdRow}>
              <label className={styles.qtdLabel}>Quantidade de questões</label>
              <input className={styles.filtroSelect} type="number" min="1"
                placeholder="Todas"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                style={{ width: 110 }}
              />
            </div>
          </div>

          <button className={styles.btnComecar} onClick={() => comecar()} disabled={carregando}>
            <Play size={16} /> {carregando ? 'Montando sessão...' : 'Começar a resolver'}
          </button>
        </div>
      </div>
    )
  }

  // ══════════════ FASE: RESULTADO ══════════════
  if (fase === 'resultado') {
    const erradasSessao = historico.filter(h => !h.acertou)
    const pct = historico.length ? Math.round((acertos / historico.length) * 100) : 0
    return (
      <div className={styles.page}>
        <div className={styles.resultadoCard}>
          <h1 className={styles.resultadoTitulo}>Sessão concluída!</h1>
          <div className={styles.resultadoPct} data-bom={pct >= 70}>
            {pct}%
          </div>
          <p className={styles.resultadoResumo}>
            Você acertou <strong>{acertos}</strong> de <strong>{historico.length}</strong> questão(ões)
          </p>

          <div className={styles.resultadoBotoes}>
            {aulaCtx && (
              <button className={styles.btnComecar} onClick={treinarMaisDoAssunto} disabled={carregando}>
                <BookOpen size={15} /> {carregando ? 'Buscando...' : `Mais questões ${aulaCtx.assunto_id ? 'deste assunto' : 'deste tema'}`}
              </button>
            )}
            {erradasSessao.length > 0 && (
              <button className={styles.btnComecar} onClick={refazerErradasDaSessao}>
                <RotateCcw size={15} /> Refazer as {erradasSessao.length} erradas
              </button>
            )}
            {erradasSessao.length > 0 && (
              <button className={styles.btnGhost} onClick={treinarSimilares} disabled={carregando}>
                <Sparkles size={15} /> {carregando ? 'Buscando...' : 'Treinar questões similares'}
              </button>
            )}
            <button className={styles.btnGhost} onClick={() => setFase('config')}>
              <BookOpen size={15} /> Nova sessão
            </button>
            <button className={styles.btnGhost} onClick={() => navigate('/estatisticas')}>
              <BarChart2 size={15} /> Ver estatísticas
            </button>
          </div>

          {historico.length > 0 && (
            <div className={styles.resultadoLista}>
              {historico.map((h, i) => (
                <div key={i} className={styles.resultadoItem}
                  onClick={() => navigate(`/questoes/${h.questao.id}`)}>
                  {h.acertou
                    ? <CheckCircle size={15} className={styles.iconOk} />
                    : <XCircle size={15} className={styles.iconErro} />}
                  <span className={styles.resultadoItemTexto}>
                    {i + 1}. {(h.questao.enunciado || '').replace(/<[^>]*>/g, ' ').slice(0, 90)}…
                  </span>
                  <span className={styles.resultadoItemResp}>
                    Você: {h.resposta === 'C' ? 'Certo' : h.resposta === 'E' ? 'Errado' : h.resposta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ══════════════ FASE: RESOLVENDO ══════════════
  const q = questaoAtual
  const gabarito = gabaritoQuestao(q)
  const respostaCerta = q.tipo === 'certo_errado' ? (q.gabarito_certo ? 'C' : 'E')
    : q.alternativas.find(a => a.correta)?.letra

  return (
    <div className={styles.page}>
      {/* Progresso */}
      <div className={styles.progressoBar}>
        <div className={styles.progressoInfo}>
          <span className={styles.progressoTexto}>
            {origemSessao === 'simulado' && tituloSimulado && (
              <span className={styles.tagSimulado}>{tituloSimulado}</span>
            )}
            {aulaCtx && origemSessao !== 'simulado' && (
              <span className={styles.tagSimulado}>{aulaCtx.titulo}</span>
            )}
            Questão <strong>{indice + 1}</strong> de {sessao.length}
          </span>
          <span className={styles.progressoPlacar}>
            <CheckCircle size={13} className={styles.iconOk} /> {acertos}
            <XCircle size={13} className={styles.iconErro} /> {historico.length - acertos}
          </span>
        </div>
        <div className={styles.progressoTrack}>
          <div className={styles.progressoFill}
            style={{ width: `${((indice + (respondida ? 1 : 0)) / sessao.length) * 100}%` }} />
        </div>
      </div>

      <div className={styles.questaoCard}>
        {/* Origem */}
        <div className={styles.qMeta}>
          {q.bancas && <span className={styles.badge}>{q.bancas.nome}</span>}
          {q.orgaos && <span className={styles.badge}>{q.orgaos.nome}</span>}
          {q.ano && <span className={styles.badge}>{q.ano}</span>}
          {q.disciplinas && <span className={styles.badge}>{q.disciplinas.nome}</span>}
          {q.assuntos && <span className={styles.badge}>{q.assuntos.nome}</span>}
        </div>

        {/* Enunciado */}
        <div className={styles.enunciado} dangerouslySetInnerHTML={{ __html: q.enunciado }} />

        {/* Opções */}
        {q.tipo === 'multipla_escolha' ? (
          <div className={styles.opcoes}>
            {q.alternativas.map(alt => {
              let estado = ''
              if (respondida) {
                if (alt.letra === respostaCerta) estado = styles.opcaoCerta
                else if (alt.letra === selecionada) estado = styles.opcaoErrada
              } else if (alt.letra === selecionada) {
                estado = styles.opcaoSelecionada
              }
              return (
                <button key={alt.id}
                  className={`${styles.opcao} ${estado}`}
                  onClick={() => !respondida && setSelecionada(alt.letra)}
                  disabled={respondida}>
                  <span className={styles.opcaoLetra}>{alt.letra}</span>
                  <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
                </button>
              )
            })}
          </div>
        ) : (
          <div className={styles.opcoesCE}>
            {[
              { valor: 'C', label: 'Certo', Icon: CheckCircle },
              { valor: 'E', label: 'Errado', Icon: XCircle },
            ].map(({ valor, label, Icon }) => {
              let estado = ''
              if (respondida) {
                if (valor === respostaCerta) estado = styles.opcaoCerta
                else if (valor === selecionada) estado = styles.opcaoErrada
              } else if (valor === selecionada) {
                estado = styles.opcaoSelecionada
              }
              return (
                <button key={valor}
                  className={`${styles.opcaoCEBtn} ${estado}`}
                  onClick={() => !respondida && setSelecionada(valor)}
                  disabled={respondida}>
                  <Icon size={17} /> {label}
                </button>
              )
            })}
          </div>
        )}

        {/* Feedback pós-resposta */}
        {respondida && (
          <div className={historico[historico.length - 1]?.acertou ? styles.feedbackOk : styles.feedbackErro}>
            {historico[historico.length - 1]?.acertou
              ? <><CheckCircle size={16} /> Você acertou! Gabarito: <strong>{gabarito}</strong></>
              : <><XCircle size={16} /> Você errou. Gabarito: <strong>{gabarito}</strong></>}
          </div>
        )}

        {respondida && q.comentario && (
          <div className={styles.comentarioBox}>
            <p className={styles.comentarioTitulo}>Comentário</p>
            <div dangerouslySetInnerHTML={{ __html: q.comentario }} />
          </div>
        )}

        {respondida && q.tem_video && (
          <div className={styles.comentarioBox}>
            <p className={styles.comentarioTitulo}>
              <Youtube size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Resolução em vídeo
            </p>
            {videoAtual ? (
              <VideoYouTube url={videoAtual} />
            ) : (
              <p className={styles.videoBloqueado}>
                🔒 Resolução em vídeo exclusiva para assinantes.
              </p>
            )}
          </div>
        )}

        {/* Ações */}
        <div className={styles.acoesRow}>
          <button className={styles.btnGhost} onClick={() => {
            if (confirm('Encerrar a sessão? As respostas já dadas ficam registradas.'))
              setFase(historico.length > 0 ? 'resultado' : 'config')
          }}>
            Encerrar
          </button>
          {!respondida ? (
            <button className={styles.btnComecar}
              onClick={responder}
              disabled={selecionada === null}>
              Responder
            </button>
          ) : (
            <button className={styles.btnComecar} onClick={proxima}>
              {indice + 1 >= sessao.length ? 'Ver resultado' : 'Próxima questão'} <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
