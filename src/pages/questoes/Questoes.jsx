import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  listarQuestoes, excluirQuestao, marcarRevisada, marcarLiberada, listarDisciplinas, listarAssuntos,
  listarBancas, listarOrgaos, listarFacetas, opcoesDisponiveis,
} from '../../services/questoes'
import { listarSimulados, adicionarQuestaoSimulado } from '../../services/simulados'
import { listarCadernos, adicionarQuestaoCaderno } from '../../services/cadernos'
import { useAuth } from '../../contexts/AuthContext'
import {
  Plus, Search, Eye, Pencil, Trash2, ChevronDown, ChevronUp,
  CheckCircle, XCircle, X, BookOpen, Landmark, LayoutGrid, Image as ImageIcon, Check, Send, EyeOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Questoes.module.css'

const NIVEIS = { fundamental: 'Fundamental', medio: 'Médio', superior: 'Superior' }
const NIVEL_ORDEM = { fundamental: 1, medio: 2, superior: 3 }
const porNome = (a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')
const TIPOS = { multipla_escolha: 'Múltipla escolha', certo_errado: 'Certo/Errado' }
const DIFICULDADES = ['', 'Muito fácil', 'Fácil', 'Média', 'Difícil', 'Muito difícil']

export default function Questoes() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [searchParams] = useSearchParams()

  // ?disciplina=<id> (vindo da página Início) já entra filtrado
  const [filtros, setFiltros] = useState(() => {
    const d = searchParams.get('disciplina')
    return d ? { disciplina_id: d } : {}
  })
  const [buscaTexto, setBuscaTexto] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(true)
  const [verTodas, setVerTodas] = useState(false)
  const [mostrarGabarito, setMostrarGabarito] = useState(false)
  const [soComImagem, setSoComImagem] = useState(false)
  const [ocultarRevisadas, setOcultarRevisadas] = useState(true)
  const [expandidas, setExpandidas] = useState(new Set())
  const [gabVisivel, setGabVisivel] = useState(new Set())
  const [questaoParaSimulado, setQuestaoParaSimulado] = useState(null)
  const [simuladoSelected, setSimuladoSelected] = useState(null)
  const [questaoParaCaderno, setQuestaoParaCaderno] = useState(null)
  const [cadernoSelected, setCadernoSelected] = useState(null)

  const { data: questoes = [], isLoading } = useQuery({
    queryKey: ['questoes', filtros],
    queryFn: () => listarQuestoes(filtros),
  })

  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: listarDisciplinas })
  const { data: assuntos = [] } = useQuery({
    queryKey: ['assuntos', filtros.disciplina_id],
    queryFn: () => listarAssuntos(filtros.disciplina_id),
    enabled: !!filtros.disciplina_id,
  })
  const { data: bancas = [] } = useQuery({ queryKey: ['bancas'], queryFn: listarBancas })
  const { data: orgaos = [] } = useQuery({ queryKey: ['orgaos'], queryFn: listarOrgaos })

  // Filtros dependentes: cada campo só oferece opções que ainda têm questões
  const { data: facetas = [] } = useQuery({ queryKey: ['facetas'], queryFn: listarFacetas })
  const disp = useMemo(() => opcoesDisponiveis(facetas, filtros), [facetas, filtros])

  const { data: simulados = [] } = useQuery({ queryKey: ['simulados'], queryFn: listarSimulados })
  const { data: cadernos = [] } = useQuery({ queryKey: ['cadernos'], queryFn: listarCadernos })

  const excluir = useMutation({
    mutationFn: (id) => excluirQuestao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questoes'] })
      toast.success('Questão excluída.')
    },
    onError: (err) => toast.error('Erro ao excluir: ' + err.message),
  })

  const revisar = useMutation({
    mutationFn: ({ id, revisada }) => marcarRevisada(id, revisada),
    onSuccess: (_data, { revisada }) => {
      queryClient.invalidateQueries({ queryKey: ['questoes'] })
      toast.success(revisada ? 'Marcada como revisada.' : 'Marcação removida.')
    },
    onError: (err) => toast.error('Erro ao marcar: ' + err.message),
  })

  const liberar = useMutation({
    mutationFn: ({ id, liberada }) => marcarLiberada(id, liberada),
    onSuccess: (_data, { liberada }) => {
      queryClient.invalidateQueries({ queryKey: ['questoes'] })
      queryClient.invalidateQueries({ queryKey: ['facetas'] })
      toast.success(liberada ? 'Questão liberada para os alunos!' : 'Questão ocultada dos alunos.')
    },
    onError: (err) => toast.error('Erro ao liberar: ' + err.message),
  })

  const addSimulado = useMutation({
    mutationFn: async () => {
      if (!simuladoSelected) throw new Error('Selecione um simulado')
      await adicionarQuestaoSimulado(simuladoSelected, questaoParaSimulado.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulados'] })
      setQuestaoParaSimulado(null)
      setSimuladoSelected(null)
      toast.success('Questão adicionada ao simulado!')
    },
    onError: (err) => toast.error(err.message),
  })

  const addCaderno = useMutation({
    mutationFn: async () => {
      if (!cadernoSelected) throw new Error('Selecione um caderno')
      await adicionarQuestaoCaderno(cadernoSelected, questaoParaCaderno.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadernos'] })
      setQuestaoParaCaderno(null)
      setCadernoSelected(null)
      toast.success('Questão adicionada ao caderno!')
    },
    onError: (err) => toast.error(err.message),
  })

  function setFiltro(key, val) {
    setFiltros(f => {
      const n = { ...f }
      if (val) n[key] = val; else delete n[key]
      // Trocar de disciplina invalida o assunto selecionado
      if (key === 'disciplina_id') delete n.assunto_id
      return n
    })
  }

  // <option>s de um campo: só as opções com questões (dependentes), com contagem,
  // garantindo que o valor já selecionado continue visível.
  function opcoesCampo(campo, { labelFn = o => `${o.rotulo} (${o.total})`, sortFn = porNome } = {}) {
    const lista = [...(disp[campo] || [])].sort(sortFn)
    const sel = filtros[campo]
    const nodes = lista.map(o => <option key={o.valor} value={o.valor}>{labelFn(o)}</option>)
    if (sel && !lista.some(o => String(o.valor) === String(sel)))
      nodes.unshift(<option key={sel} value={sel}>{rotuloFiltro(campo, sel)}</option>)
    return nodes
  }

  function toggleExpandir(id) {
    const novas = new Set(expandidas)
    if (novas.has(id)) novas.delete(id)
    else novas.add(id)
    setExpandidas(novas)
  }

  function verGabarito(id) {
    setGabVisivel(s => new Set(s).add(id))
  }

  const questaoTemImagem = (q) =>
    q.enunciado?.includes('<img') || (q.alternativas || []).some(a => a.texto?.includes('<img'))

  // No modo "revisar imagens", esconde as já revisadas para o admin ir zerando a pilha
  const modoRevisao = soComImagem && isAdmin
  const revisadasOcultas = modoRevisao && ocultarRevisadas
    ? questoes.filter(q => questaoTemImagem(q) && q.revisada).length
    : 0

  const questoesFiltradas = questoes.filter(q => {
    if (soComImagem && !questaoTemImagem(q)) return false
    if (modoRevisao && ocultarRevisadas && q.revisada) return false
    if (!buscaTexto) return true
    const termo = buscaTexto.toLowerCase()
    return [
      q.enunciado?.replace(/<[^>]*>/g, ''),
      q.comentario?.replace(/<[^>]*>/g, ''),
      q.disciplinas?.nome,
      q.assuntos?.nome,
      q.bancas?.nome,
      q.orgaos?.nome,
      q.cargo,
      String(q.ano ?? ''),
      ...(q.alternativas || []).map(a => a.texto?.replace(/<[^>]*>/g, '')),
    ].some(campo => campo?.toLowerCase().includes(termo))
  })

  // Rótulo legível de cada filtro ativo (para os "chips")
  function rotuloFiltro(key, val) {
    switch (key) {
      case 'disciplina_id': return disciplinas.find(d => String(d.id) === String(val))?.nome ?? 'Disciplina'
      case 'assunto_id':    return assuntos.find(a => String(a.id) === String(val))?.nome ?? 'Assunto'
      case 'banca_id':      return bancas.find(b => String(b.id) === String(val))?.nome ?? 'Banca'
      case 'orgao_id':      return orgaos.find(o => String(o.id) === String(val))?.nome ?? 'Órgão'
      case 'cargo':         return val
      case 'tipo':          return TIPOS[val] ?? val
      case 'nivel':         return NIVEIS[val] ?? val
      case 'dificuldade':   return DIFICULDADES[val] ?? val
      case 'ano':           return `Ano ${val}`
      default:              return String(val)
    }
  }

  const filtrosAtivos = Object.entries(filtros)

  // Tela de exploração: sem filtro, sem busca e sem "ver todas" → cards
  const explorando = filtrosAtivos.length === 0 && !buscaTexto && !verTodas && !soComImagem

  // Contagens para os cards (quando explorando, "questoes" = banco inteiro)
  const contagens = useMemo(() => {
    const disc = new Map(), banc = new Map(), org = new Map()
    for (const q of questoes) {
      if (q.disciplinas) {
        const g = disc.get(q.disciplinas.id) ?? { ...q.disciplinas, total: 0 }
        g.total += 1; disc.set(q.disciplinas.id, g)
      }
      if (q.bancas) {
        const g = banc.get(q.bancas.id) ?? { ...q.bancas, total: 0 }
        g.total += 1; banc.set(q.bancas.id, g)
      }
      if (q.orgaos) {
        const g = org.get(q.orgaos.id) ?? { ...q.orgaos, total: 0 }
        g.total += 1; org.set(q.orgaos.id, g)
      }
    }
    const porTotal = (a, b) => b.total - a.total
    return {
      disciplinas: [...disc.values()].sort(porTotal),
      bancas: [...banc.values()].sort(porTotal),
      orgaos: [...org.values()].sort(porTotal),
    }
  }, [questoes])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Banco de Questões</h1>
          <p className={styles.subtitulo}>{questoesFiltradas.length} questão(ões)</p>
        </div>
        {isAdmin && (
          <button className={styles.btnPrimary} onClick={() => navigate('/questoes/nova')}>
            <Plus size={15} /> Nova questão
          </button>
        )}
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por enunciado, banca, órgão, cargo, assunto..."
            value={buscaTexto}
            onChange={e => setBuscaTexto(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`${styles.btnFiltro} ${(mostrarFiltros || filtrosAtivos.length) ? styles.btnFiltroAtivo : ''}`}
          onClick={() => {
            if (explorando) { setVerTodas(true); setMostrarFiltros(true) }
            else setMostrarFiltros(v => !v)
          }}
        >
          Filtros
          {filtrosAtivos.length > 0 && <span className={styles.filtroBadge}>{filtrosAtivos.length}</span>}
          <ChevronDown size={13} className={mostrarFiltros ? styles.chevronOpen : ''} />
        </button>
      </div>

      {/* ── Exploração: cards para escolher por onde começar ── */}
      {explorando && (
        isLoading ? (
          <div className={styles.loading}>Carregando questões...</div>
        ) : (
        <div className={styles.exploracao}>
          <div>
            <h2 className={styles.expTitulo}><BookOpen size={15} /> Comece por uma disciplina</h2>
            <div className={styles.expGrid}>
              {contagens.disciplinas.map(d => (
                <button key={d.id} className={styles.expCard}
                  onClick={() => setFiltro('disciplina_id', String(d.id))}>
                  <span className={styles.expCor} style={{ background: d.cor || 'var(--color-primary)' }} />
                  <span className={styles.expInfo}>
                    <span className={styles.expNome}>{d.nome}</span>
                    <span className={styles.expTotal}>{d.total} questões</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className={styles.expTitulo}><Landmark size={15} /> Ou por banca</h2>
            <div className={styles.expGrid}>
              {contagens.bancas.map(b => (
                <button key={b.id} className={styles.expCard}
                  onClick={() => setFiltro('banca_id', String(b.id))}>
                  <span className={styles.expInfo}>
                    <span className={styles.expNome}>{b.nome}</span>
                    <span className={styles.expTotal}>{b.total} questões</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className={styles.expTitulo}><Landmark size={15} /> Ou por órgão / prova</h2>
            <div className={styles.expGrid}>
              {contagens.orgaos.map(o => (
                <button key={o.id} className={styles.expCard}
                  onClick={() => setFiltro('orgao_id', String(o.id))}>
                  <span className={styles.expInfo}>
                    <span className={styles.expNome}>{o.nome}</span>
                    <span className={styles.expTotal}>{o.total} questões</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.expAcoes}>
            <button className={styles.expVerTodas} onClick={() => setVerTodas(true)}>
              <LayoutGrid size={15} /> Ver todas as {questoes.length} questões
            </button>
            {isAdmin && (
              <button className={styles.expRevisar} onClick={() => setSoComImagem(true)}>
                <ImageIcon size={15} /> Revisar questões com imagem
              </button>
            )}
          </div>
        </div>
        )
      )}

      {!explorando && filtrosAtivos.length > 0 && (
        <div className={styles.chipsRow}>
          {filtrosAtivos.map(([key, val]) => (
            <button key={key} className={styles.chip} onClick={() => setFiltro(key, '')} title="Remover filtro">
              {rotuloFiltro(key, val)}
              <X size={12} />
            </button>
          ))}
          <button className={styles.chipLimpar}
            onClick={() => { setFiltros({}); setBuscaTexto(''); setVerTodas(false) }}>
            Limpar tudo
          </button>
        </div>
      )}

      {!explorando && mostrarFiltros && (
        <div className={styles.filtrosPanel}>
          <div className={styles.filtroGrupo}>
            <label className={styles.filtroLabel}>Área</label>
            <select className={styles.filtroSelect} value={filtros.area ?? ''}
              onChange={e => setFiltro('area', e.target.value)}>
              <option value="">Todas</option>
              {opcoesCampo('area')}
            </select>
          </div>
          <div className={styles.filtroGrupo}>
            <label className={styles.filtroLabel}>Disciplina</label>
            <select className={styles.filtroSelect} value={filtros.disciplina_id ?? ''}
              onChange={e => setFiltro('disciplina_id', e.target.value)}>
              <option value="">Todas</option>
              {opcoesCampo('disciplina_id')}
            </select>
          </div>
          <div className={styles.filtroGrupo}>
            <label className={styles.filtroLabel}>Assunto</label>
            <select className={styles.filtroSelect} value={filtros.assunto_id ?? ''}
              onChange={e => setFiltro('assunto_id', e.target.value)}
              disabled={!filtros.disciplina_id}
              title={filtros.disciplina_id ? undefined : 'Escolha primeiro a disciplina'}>
              <option value="">{filtros.disciplina_id ? 'Todos' : 'Escolha a disciplina'}</option>
              {opcoesCampo('assunto_id')}
            </select>
          </div>
          <div className={styles.filtroGrupo}>
            <label className={styles.filtroLabel}>Banca</label>
            <select className={styles.filtroSelect} value={filtros.banca_id ?? ''}
              onChange={e => setFiltro('banca_id', e.target.value)}>
              <option value="">Todas</option>
              {opcoesCampo('banca_id')}
            </select>
          </div>
          <div className={styles.filtroGrupo}>
            <label className={styles.filtroLabel}>Órgão</label>
            <select className={styles.filtroSelect} value={filtros.orgao_id ?? ''}
              onChange={e => setFiltro('orgao_id', e.target.value)}>
              <option value="">Todos</option>
              {opcoesCampo('orgao_id')}
            </select>
          </div>
          <div className={`${styles.filtroGrupo} ${styles.filtroGrupoLargo}`}>
            <label className={styles.filtroLabel}>Cargo</label>
            <select className={styles.filtroSelect} value={filtros.cargo ?? ''}
              onChange={e => setFiltro('cargo', e.target.value)}>
              <option value="">Todos</option>
              {opcoesCampo('cargo')}
            </select>
          </div>
          <div className={styles.filtroGrupo}>
            <label className={styles.filtroLabel}>Tipo</label>
            <select className={styles.filtroSelect} value={filtros.tipo ?? ''}
              onChange={e => setFiltro('tipo', e.target.value)}>
              <option value="">Todos</option>
              {opcoesCampo('tipo', { labelFn: o => `${TIPOS[o.valor] ?? o.valor} (${o.total})`, sortFn: (a, b) => a.valor.localeCompare(b.valor) })}
            </select>
          </div>
          <div className={styles.filtroGrupo}>
            <label className={styles.filtroLabel}>Nível</label>
            <select className={styles.filtroSelect} value={filtros.nivel ?? ''}
              onChange={e => setFiltro('nivel', e.target.value)}>
              <option value="">Todos</option>
              {opcoesCampo('nivel', { labelFn: o => `${NIVEIS[o.valor] ?? o.valor} (${o.total})`, sortFn: (a, b) => NIVEL_ORDEM[a.valor] - NIVEL_ORDEM[b.valor] })}
            </select>
          </div>
          <div className={styles.filtroGrupo}>
            <label className={styles.filtroLabel}>Dificuldade</label>
            <select className={styles.filtroSelect} value={filtros.dificuldade ?? ''}
              onChange={e => setFiltro('dificuldade', e.target.value)}>
              <option value="">Qualquer</option>
              {opcoesCampo('dificuldade', { labelFn: o => `${DIFICULDADES[o.valor] ?? o.valor} (${o.total})`, sortFn: (a, b) => a.valor - b.valor })}
            </select>
          </div>
          <div className={styles.filtroGrupo}>
            <label className={styles.filtroLabel}>Ano</label>
            <select className={styles.filtroSelect} value={filtros.ano ?? ''}
              onChange={e => setFiltro('ano', e.target.value)}>
              <option value="">Todos</option>
              {opcoesCampo('ano', { labelFn: o => `${o.rotulo} (${o.total})`, sortFn: (a, b) => b.valor - a.valor })}
            </select>
          </div>
        </div>
      )}

      {!explorando && !isLoading && (
        <div className={styles.checkRow}>
          <label className={styles.checkGabarito}>
            <input
              type="checkbox"
              checked={mostrarGabarito}
              onChange={e => setMostrarGabarito(e.target.checked)}
            />
            Mostrar alternativa correta
          </label>
          {isAdmin && (
            <label className={styles.checkGabarito}>
              <input
                type="checkbox"
                checked={soComImagem}
                onChange={e => setSoComImagem(e.target.checked)}
              />
              <ImageIcon size={13} /> Só questões com imagem
            </label>
          )}
          {modoRevisao && (
            <label className={styles.checkGabarito}>
              <input
                type="checkbox"
                checked={ocultarRevisadas}
                onChange={e => setOcultarRevisadas(e.target.checked)}
              />
              <Check size={13} /> Ocultar já revisadas
              {revisadasOcultas > 0 && <span className={styles.badge}>{revisadasOcultas}</span>}
            </label>
          )}
        </div>
      )}

      {!explorando && (isLoading ? (
        <div className={styles.loading}>Carregando questões...</div>
      ) : questoesFiltradas.length === 0 ? (
        <div className={styles.vazio}>
          <Search size={36} strokeWidth={1.5} />
          <p>Nenhuma questão encontrada</p>
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
                    <h3 className={styles.cardTitulo}>
                      {[q.bancas?.nome, q.orgaos?.nome, q.cargo].filter(Boolean).join(' · ') || 'Questão'}
                    </h3>
                    <div className={styles.cardMeta}>
                      {q.codigo && <span className={styles.badgeCodigo}>{q.codigo}</span>}
                      {q.ano && <span className={styles.badge}>{q.ano}</span>}
                      {q.disciplinas && <span className={styles.badge}>{q.disciplinas.nome}</span>}
                      {q.assuntos && <span className={styles.badge}>{q.assuntos.nome}</span>}
                      <span className={styles.badge}>
                        {q.tipo === 'multipla_escolha' ? 'Múltipla escolha' : 'Certo/Errado'}
                      </span>
                      {q.nivel && <span className={styles.badge}>{NIVEIS[q.nivel]}</span>}
                      {isAdmin && q.revisada && (
                        <span className={styles.badgeRevisada}><Check size={11} /> Revisada</span>
                      )}
                      {isAdmin && !q.liberada && (
                        <span className={styles.badgeNaoLiberada}><EyeOff size={11} /> Não liberada</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.cardAcoes}>
                    {isAdmin && modoRevisao && (
                      <button
                        className={`${styles.iconBtn} ${q.revisada ? styles.iconBtnRevisada : ''}`}
                        onClick={() => revisar.mutate({ id: q.id, revisada: !q.revisada })}
                        disabled={revisar.isPending}
                        title={q.revisada ? 'Desmarcar revisada' : 'Marcar como revisada'}>
                        <Check size={15} />
                      </button>
                    )}
                    {isAdmin && !q.liberada && (
                      <button
                        className={`${styles.iconBtn} ${styles.iconBtnLiberar}`}
                        onClick={() => liberar.mutate({ id: q.id, liberada: true })}
                        disabled={liberar.isPending}
                        title="Liberar para os alunos">
                        <Send size={15} />
                      </button>
                    )}
                    {isAdmin && (
                      <button className={styles.iconBtn} onClick={() => navigate(`/questoes/${q.id}/editar`)} title="Editar">
                        <Pencil size={15} />
                      </button>
                    )}
                    <button className={styles.iconBtn} onClick={() => navigate(`/questoes/${q.id}`)} title="Ver">
                      <Eye size={15} />
                    </button>
                    {isAdmin && (
                      <button className={styles.iconBtn}
                        onClick={() => {
                          if (confirm('Excluir esta questão? As respostas registradas também serão apagadas.'))
                            excluir.mutate(q.id)
                        }}
                        title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {expandida && (() => {
                  const revelado = mostrarGabarito || gabVisivel.has(q.id)
                  return (
                  <div className={styles.cardExpanded}>
                    <div className={styles.enunciado}>
                      <p className={styles.label}>Enunciado:</p>
                      <div dangerouslySetInnerHTML={{ __html: q.enunciado }} />
                    </div>

                    {q.tipo === 'multipla_escolha' && q.alternativas?.length > 0 && (
                      <div className={styles.alternativas}>
                        <p className={styles.label}>Alternativas:</p>
                        {q.alternativas.map(alt => (
                          <div key={alt.id}
                            className={`${styles.altItem} ${revelado && alt.correta ? styles.altCorreta : ''}`}>
                            <span className={styles.altLetra}>{alt.letra})</span>
                            <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
                            {revelado && alt.correta && <CheckCircle size={14} className={styles.checkIcon} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.tipo === 'certo_errado' && revelado && (
                      <div className={styles.gabarito}>
                        <p className={styles.label}>Gabarito:</p>
                        <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {q.gabarito_certo
                            ? <><CheckCircle size={15} style={{ color: '#059669' }} /> Certo</>
                            : <><XCircle size={15} style={{ color: '#dc2626' }} /> Errado</>}
                        </p>
                      </div>
                    )}

                    {!revelado && (
                      <button className={styles.btnVerGabarito} onClick={() => verGabarito(q.id)}>
                        <Eye size={14} /> Ver gabarito
                      </button>
                    )}

                    {revelado && q.comentario && (
                      <div className={styles.gabarito}>
                        <p className={styles.label}>Comentário:</p>
                        <div dangerouslySetInnerHTML={{ __html: q.comentario }} />
                      </div>
                    )}

                    <div className={styles.btnAddRow}>
                      <button className={styles.btnAddProva}
                        onClick={() => setQuestaoParaSimulado(q)}>
                        + Adicionar a um simulado
                      </button>
                      <button className={styles.btnAddColecao}
                        onClick={() => setQuestaoParaCaderno(q)}>
                        + Adicionar a um caderno
                      </button>
                    </div>
                  </div>
                  ) })()}
              </div>
            )
          })}
        </div>
      ))}

      {/* Modal para selecionar simulado */}
      {questaoParaSimulado && (
        <div className={styles.modalOverlay} onClick={() => setQuestaoParaSimulado(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitulo}>Selecione um simulado</h3>
            <p className={styles.modalSubtitulo}>A qual simulado você quer adicionar esta questão?</p>
            <div className={styles.provasList}>
              {simulados.length === 0 ? (
                <p className={styles.vazioModal}>Nenhum simulado criado ainda.</p>
              ) : (
                simulados.map(s => (
                  <button key={s.id} className={`${styles.provaItem} ${simuladoSelected === s.id ? styles.provaItemSelecionada : ''}`}
                    onClick={() => setSimuladoSelected(s.id)}>
                    <span>{s.titulo}</span>
                    <span className={styles.provaSubtitle}>{s.total_questoes} questões</span>
                  </button>
                ))
              )}
            </div>
            <div className={styles.modalBotoes}>
              <button className={styles.btnCancel} onClick={() => setQuestaoParaSimulado(null)}>
                Cancelar
              </button>
              <button className={styles.btnConfirm}
                onClick={() => addSimulado.mutate()}
                disabled={addSimulado.isPending || !simuladoSelected}>
                {addSimulado.isPending ? 'Adicionando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para selecionar caderno */}
      {questaoParaCaderno && (
        <div className={styles.modalOverlay} onClick={() => setQuestaoParaCaderno(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitulo}>Selecione um caderno</h3>
            <p className={styles.modalSubtitulo}>Em qual caderno você quer adicionar esta questão?</p>
            <div className={styles.provasList}>
              {cadernos.length === 0 ? (
                <p className={styles.vazioModal}>Nenhum caderno criado ainda.</p>
              ) : (
                cadernos.map(c => (
                  <button key={c.id} className={`${styles.provaItem} ${cadernoSelected === c.id ? styles.provaItemSelecionada : ''}`}
                    onClick={() => setCadernoSelected(c.id)}>
                    <span>{c.nome}</span>
                    <span className={styles.provaSubtitle}>{c.total_questoes} questões</span>
                  </button>
                ))
              )}
            </div>
            <div className={styles.modalBotoes}>
              <button className={styles.btnCancel} onClick={() => setQuestaoParaCaderno(null)}>
                Cancelar
              </button>
              <button className={styles.btnConfirm}
                onClick={() => addCaderno.mutate()}
                disabled={addCaderno.isPending || !cadernoSelected}>
                {addCaderno.isPending ? 'Adicionando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
