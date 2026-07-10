import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listarQuestoes, excluirQuestao, listarDisciplinas, listarAssuntos,
  listarBancas, listarOrgaos, listarCargos, listarAnos,
  resumoEnunciado, rotuloQuestao, gabaritoQuestao,
} from '../../services/questoes'
import { listarSimulados, adicionarQuestaoSimulado } from '../../services/simulados'
import { listarCadernos, adicionarQuestaoCaderno } from '../../services/cadernos'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Search, Eye, Pencil, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Questoes.module.css'

const NIVEIS = { fundamental: 'Fundamental', medio: 'Médio', superior: 'Superior' }
const TIPOS = { multipla_escolha: 'Múltipla escolha', certo_errado: 'Certo/Errado' }
const DIFICULDADES = ['', 'Muito fácil', 'Fácil', 'Média', 'Difícil', 'Muito difícil']

export default function Questoes() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()

  const [filtros, setFiltros] = useState({})
  const [buscaTexto, setBuscaTexto] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [expandidas, setExpandidas] = useState(new Set())
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
  const { data: cargos = [] } = useQuery({ queryKey: ['cargos'], queryFn: listarCargos })
  const { data: anos = [] } = useQuery({ queryKey: ['anos'], queryFn: listarAnos })

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

  function toggleExpandir(id) {
    const novas = new Set(expandidas)
    if (novas.has(id)) novas.delete(id)
    else novas.add(id)
    setExpandidas(novas)
  }

  const questoesFiltradas = questoes.filter(q => {
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
          onClick={() => setMostrarFiltros(v => !v)}
        >
          Filtros
          {filtrosAtivos.length > 0 && <span className={styles.filtroBadge}>{filtrosAtivos.length}</span>}
          <ChevronDown size={13} className={mostrarFiltros ? styles.chevronOpen : ''} />
        </button>
      </div>

      {filtrosAtivos.length > 0 && (
        <div className={styles.chipsRow}>
          {filtrosAtivos.map(([key, val]) => (
            <button key={key} className={styles.chip} onClick={() => setFiltro(key, '')} title="Remover filtro">
              {rotuloFiltro(key, val)}
              <X size={12} />
            </button>
          ))}
          <button className={styles.chipLimpar} onClick={() => { setFiltros({}); setBuscaTexto('') }}>
            Limpar tudo
          </button>
        </div>
      )}

      {mostrarFiltros && (
        <div className={styles.filtrosPanel}>
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
          <select className={styles.filtroSelect} value={filtros.orgao_id ?? ''}
            onChange={e => setFiltro('orgao_id', e.target.value)}>
            <option value="">Todos os órgãos</option>
            {orgaos.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <select className={styles.filtroSelect} value={filtros.cargo ?? ''}
            onChange={e => setFiltro('cargo', e.target.value)}>
            <option value="">Todos os cargos</option>
            {cargos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className={styles.filtroSelect} value={filtros.tipo ?? ''}
            onChange={e => setFiltro('tipo', e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="multipla_escolha">Múltipla escolha</option>
            <option value="certo_errado">Certo / Errado</option>
          </select>
          <select className={styles.filtroSelect} value={filtros.nivel ?? ''}
            onChange={e => setFiltro('nivel', e.target.value)}>
            <option value="">Todos os níveis</option>
            <option value="fundamental">Fundamental</option>
            <option value="medio">Médio</option>
            <option value="superior">Superior</option>
          </select>
          <select className={styles.filtroSelect} value={filtros.dificuldade ?? ''}
            onChange={e => setFiltro('dificuldade', e.target.value)}>
            <option value="">Qualquer dificuldade</option>
            {[1,2,3,4,5].map(n => (
              <option key={n} value={n}>
                {['','Muito fácil','Fácil','Média','Difícil','Muito difícil'][n]}
              </option>
            ))}
          </select>
          <select className={styles.filtroSelect} value={filtros.ano ?? ''}
            onChange={e => setFiltro('ano', e.target.value)}>
            <option value="">Todos os anos</option>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {filtrosAtivos.length > 0 && (
            <button className={styles.btnLimpar}
              onClick={() => { setFiltros({}); setBuscaTexto('') }}>
              Limpar
            </button>
          )}
        </div>
      )}

      {isLoading ? (
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
                    <h3 className={styles.cardTitulo}>{resumoEnunciado(q.enunciado, 120) || rotuloQuestao(q)}</h3>
                    <div className={styles.cardMeta}>
                      {q.bancas && <span className={styles.badge}>{q.bancas.nome}</span>}
                      {q.orgaos && <span className={styles.badge}>{q.orgaos.nome}</span>}
                      {q.ano && <span className={styles.badge}>{q.ano}</span>}
                      {q.disciplinas && <span className={styles.badge}>{q.disciplinas.nome}</span>}
                      {q.assuntos && <span className={styles.badge}>{q.assuntos.nome}</span>}
                      <span className={styles.badge}>
                        {q.tipo === 'multipla_escolha' ? 'Múltipla escolha' : 'Certo/Errado'}
                      </span>
                      {q.nivel && <span className={styles.badge}>{NIVEIS[q.nivel]}</span>}
                    </div>
                  </div>
                  <div className={styles.cardAcoes}>
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

                {expandida && (
                  <div className={styles.cardExpanded}>
                    <div className={styles.enunciado}>
                      <p className={styles.label}>Enunciado:</p>
                      <div dangerouslySetInnerHTML={{ __html: q.enunciado }} />
                    </div>

                    {q.tipo === 'multipla_escolha' && q.alternativas?.length > 0 && (
                      <div className={styles.alternativas}>
                        <p className={styles.label}>Alternativas:</p>
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
                      <div className={styles.gabarito}>
                        <p className={styles.label}>Gabarito:</p>
                        <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {q.gabarito_certo
                            ? <><CheckCircle size={15} style={{ color: '#059669' }} /> Certo</>
                            : <><XCircle size={15} style={{ color: '#dc2626' }} /> Errado</>}
                        </p>
                      </div>
                    )}

                    {q.comentario && (
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
                )}
              </div>
            )
          })}
        </div>
      )}

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
