import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listarQuestoes, listarDisciplinas, adicionarQuestaoProva } from '../../services/questoes'
import { listarProvas } from '../../services/provas'
import { listarColecoes, adicionarQuestaoColecao } from '../../services/colecoes'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Search, Eye, Pencil, Trash2, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Questoes.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']

export default function Questoes() {
  const navigate = useNavigate()
  const { usuario, isFormador, isAdmin } = useAuth()
  const isProfessor = !isFormador && !isAdmin
  const podeEditar = isFormador || isAdmin
  const queryClient = useQueryClient()

  const [filtros, setFiltros] = useState({})
  const [buscaTexto, setBuscaTexto] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [expandidas, setExpandidas] = useState(new Set())
  const [questaoParaProva, setQuestaoParaProva] = useState(null)
  const [provaSelected, setProvaSelected] = useState(null)
  const [questaoParaColecao, setQuestaoParaColecao] = useState(null)
  const [colecaoSelected, setColecaoSelected] = useState(null)

  // Professor vê: suas próprias questões + questões publicadas de outros
  // Formador/Admin: veem tudo
  const { data: questoesProprias = [], isLoading: loadProprias } = useQuery({
    queryKey: ['questoes', 'proprias', filtros, usuario?.id],
    queryFn: () => listarQuestoes({ ...filtros, autor_id: usuario?.id }),
    enabled: !!usuario,
  })

  const { data: questoesPublicadas = [], isLoading: loadPublicadas } = useQuery({
    queryKey: ['questoes', 'publicadas', filtros],
    queryFn: () => listarQuestoes({ ...filtros, status: 'publicado' }),
    enabled: !!usuario,
  })

  // Mescla e deduplica: proprias + publicadas de outros
  const questoes = isProfessor
    ? [
        ...questoesProprias,
        ...questoesPublicadas.filter(q => q.autor_id !== usuario?.id),
      ]
    : questoesProprias.concat(questoesPublicadas).filter((q, i, arr) =>
        arr.findIndex(x => x.id === q.id) === i
      )

  const isLoading = loadProprias || loadPublicadas

  const { data: disciplinas = [] } = useQuery({
    queryKey: ['disciplinas'],
    queryFn: listarDisciplinas,
  })

  // Modal de adicionar à prova: só mostra as provas do próprio professor
  const { data: provas = [] } = useQuery({
    queryKey: ['provas', 'minhas', usuario?.id],
    queryFn: () => listarProvas({ autor_id: usuario?.id }),
    enabled: !!usuario,
  })

  const addProva = useMutation({
    mutationFn: async () => {
      if (!provaSelected) throw new Error('Selecione uma prova')
      await adicionarQuestaoProva(provaSelected, questaoParaProva.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['provas'])
      setQuestaoParaProva(null)
      setProvaSelected(null)
      toast.success('Questão adicionada à prova!')
    },
    onError: (err) => toast.error(err.message),
  })

  // Modal de adicionar à coleção: coleções do próprio usuário
  const { data: colecoes = [] } = useQuery({
    queryKey: ['colecoes', 'minhas', usuario?.id],
    queryFn: () => listarColecoes({ autor_id: usuario?.id }),
    enabled: !!usuario,
  })

  const addColecao = useMutation({
    mutationFn: async () => {
      if (!colecaoSelected) throw new Error('Selecione uma coleção')
      await adicionarQuestaoColecao(colecaoSelected, questaoParaColecao.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colecoes'] })
      setQuestaoParaColecao(null)
      setColecaoSelected(null)
      toast.success('Questão adicionada à coleção!')
    },
    onError: (err) => toast.error(err.message),
  })

  const [aba, setAba] = useState('banco')  // 'banco' | 'minhas'

  function setFiltro(key, val) {
    setFiltros(f => { const n = {...f}; if (val) n[key] = val; else delete n[key]; return n })
  }

  function toggleExpandir(id) {
    const novas = new Set(expandidas)
    if (novas.has(id)) novas.delete(id)
    else novas.add(id)
    setExpandidas(novas)
  }

  const questoesFiltradas = questoes.filter(q => {
    const termo = buscaTexto.toLowerCase()
    const textoOk = !buscaTexto || [
      q.titulo,
      q.disciplinas?.nome,
      q.ano_escolar,
      q.tipo === 'multipla_escolha' ? 'múltipla escolha multipla' : 'dissertativa',
      q.fonte,
      q.status,
      q.perfis?.nome,                                     // autor
      q.enunciado?.replace(/<[^>]*>/g, ''),               // texto do enunciado sem HTML
      ...(q.alternativas || []).map(a =>                  // texto das alternativas
        a.texto?.replace(/<[^>]*>/g, '')
      ),
      ...(q.habilidades || []).map(h =>                   // códigos de habilidades
        `${h.codigo} ${h.descricao}`
      ),
    ].some(campo => campo?.toLowerCase().includes(termo))
    if (isProfessor) {
      if (aba === 'minhas') return textoOk && q.autor_id === usuario?.id
      return textoOk && q.status === 'publicado' && q.autor_id !== usuario?.id
    }
    return textoOk
  })

  function listarDisciplinas() {
    // Esta função não é usada - já importada acima
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Banco de Questões</h1>
          <p className={styles.subtitulo}>{questoes.length} questão(ões)</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/questoes/nova')}>
          <Plus size={15} /> Nova questão
        </button>
      </div>

      {isProfessor && (
        <>
          <div className={styles.abas}>
            <button
              className={`${styles.aba} ${aba === 'banco' ? styles.abaAtiva : ''}`}
              onClick={() => setAba('banco')}>
              Banco da rede
              <span className={styles.abaBadge}>
                {questoesPublicadas.filter(q => q.autor_id !== usuario?.id).length}
              </span>
            </button>
            <button
              className={`${styles.aba} ${aba === 'minhas' ? styles.abaAtiva : ''}`}
              onClick={() => setAba('minhas')}>
              Minhas questões
              <span className={styles.abaBadge}>{questoesProprias.length}</span>
            </button>
          </div>
          <p className={styles.abaDesc}>
            {aba === 'banco'
              ? 'Questões validadas por formadores — disponíveis para todos.'
              : 'Suas questões. Envie para revisão para que um formador possa publicá-las no banco.'}
          </p>
        </>
      )}

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por título, disciplina, enunciado, alternativas, autor..."
            value={buscaTexto}
            onChange={e => setBuscaTexto(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`${styles.btnFiltro} ${mostrarFiltros ? styles.btnFiltroAtivo : ''}`}
          onClick={() => setMostrarFiltros(v => !v)}
        >
          Filtros <ChevronDown size={13} />
        </button>
      </div>

      {mostrarFiltros && (
        <div className={styles.filtrosPanel}>
          <select className={styles.filtroSelect} value={filtros.disciplina_id ?? ''}
            onChange={e => setFiltro('disciplina_id', e.target.value)}>
            <option value="">Todas as disciplinas</option>
            {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <select className={styles.filtroSelect} value={filtros.status ?? ''}
            onChange={e => setFiltro('status', e.target.value)}>
            <option value="">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="em_revisao">Em revisão</option>
            <option value="publicado">Publicado</option>
          </select>
          <select className={styles.filtroSelect} value={filtros.ano_escolar ?? ''}
            onChange={e => setFiltro('ano_escolar', e.target.value)}>
            <option value="">Todos os anos</option>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className={styles.btnLimpar}
            onClick={() => { setFiltros({}); setBuscaTexto('') }}>
            Limpar
          </button>
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
                    <h3 className={styles.cardTitulo}>{q.titulo}</h3>
                    <div className={styles.cardMeta}>
                      {q.disciplinas && <span className={styles.badge}>{q.disciplinas.nome}</span>}
                      {q.ano_escolar && <span className={styles.badge}>{q.ano_escolar}</span>}
                      {q.tipo === 'multipla_escolha' ? (
                        <span className={styles.badge}>Múltipla escolha</span>
                      ) : (
                        <span className={styles.badge}>Dissertativa</span>
                      )}
                      <span className={`${styles.badge} ${styles.statusBadge} ${styles['status_' + q.status]}`}>
                        {q.status === 'rascunho' ? '📝 Rascunho'
                         : q.status === 'em_revisao' ? '🔍 Em revisão'
                         : q.status === 'publicado' ? '✅ Publicado'
                         : q.status}
                      </span>
                    </div>
                  </div>
                  <div className={styles.cardAcoes}>
                    {(podeEditar || q.autor_id === usuario?.id) && (
                      <button className={styles.iconBtn} onClick={() => navigate(`/questoes/${q.id}/editar`)} title="Editar">
                        <Pencil size={15} />
                      </button>
                    )}
                    <button className={styles.iconBtn} onClick={() => navigate(`/questoes/${q.id}`)} title="Ver">
                      <Eye size={15} />
                    </button>
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

                    {q.gabarito && (
                      <div className={styles.gabarito}>
                        <p className={styles.label}>Gabarito:</p>
                        <p>{q.gabarito.texto}</p>
                      </div>
                    )}

                    <div className={styles.autoriaRow}>
                      <span className={styles.autoriaItem}>
                        Criada por <strong>{q.perfis?.nome ?? '—'}</strong>
                      </span>
                      <span className={styles.autoriaSep}>·</span>
                      <span className={styles.autoriaItem}>
                        {q.validacao ? (
                          <><CheckCircle size={13} className={styles.autoriaOk} /> Validada por <strong>{q.validacao.nome ?? '—'}</strong> em {new Date(q.validacao.em).toLocaleDateString('pt-BR')}</>
                        ) : (
                          <span className={styles.autoriaPend}>Ainda não validada</span>
                        )}
                      </span>
                    </div>

                    <div className={styles.btnAddRow}>
                      <button className={styles.btnAddProva}
                        onClick={() => setQuestaoParaProva(q)}>
                        + Adicionar a uma prova
                      </button>
                      <button className={styles.btnAddColecao}
                        onClick={() => setQuestaoParaColecao(q)}>
                        + Adicionar a uma coleção
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal para selecionar prova */}
      {questaoParaProva && (
        <div className={styles.modalOverlay} onClick={() => setQuestaoParaProva(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitulo}>Selecione uma prova</h3>
            <p className={styles.modalSubtitulo}>Qual prova você quer adicionar esta questão?</p>
            <div className={styles.provasList}>
              {provas.length === 0 ? (
                <p className={styles.vazioModal}>Nenhuma prova criada. <a href="/provas/nova">Criar prova</a></p>
              ) : (
                provas.map(p => (
                  <button key={p.id} className={`${styles.provaItem} ${provaSelected === p.id ? styles.provaItemSelecionada : ''}`}
                    onClick={() => setProvaSelected(p.id)}>
                    <span>{p.titulo}</span>
                    <span className={styles.provaSubtitle}>{p.disciplinas?.nome} • {p.ano_escolar}</span>
                  </button>
                ))
              )}
            </div>
            <div className={styles.modalBotoes}>
              <button className={styles.btnCancel} onClick={() => setQuestaoParaProva(null)}>
                Cancelar
              </button>
              <button className={styles.btnConfirm}
                onClick={() => addProva.mutate()}
                disabled={addProva.isPending || !provaSelected}>
                {addProva.isPending ? 'Adicionando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para selecionar coleção */}
      {questaoParaColecao && (
        <div className={styles.modalOverlay} onClick={() => setQuestaoParaColecao(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitulo}>Selecione uma coleção</h3>
            <p className={styles.modalSubtitulo}>Em qual coleção você quer adicionar esta questão?</p>
            <div className={styles.provasList}>
              {colecoes.length === 0 ? (
                <p className={styles.vazioModal}>Nenhuma coleção criada. <a href="/colecoes">Criar coleção</a></p>
              ) : (
                colecoes.map(c => (
                  <button key={c.id} className={`${styles.provaItem} ${colecaoSelected === c.id ? styles.provaItemSelecionada : ''}`}
                    onClick={() => setColecaoSelected(c.id)}>
                    <span>{c.nome}</span>
                    <span className={styles.provaSubtitle}>{c.total_questoes} questões{c.publica ? ' • pública' : ''}</span>
                  </button>
                ))
              )}
            </div>
            <div className={styles.modalBotoes}>
              <button className={styles.btnCancel} onClick={() => setQuestaoParaColecao(null)}>
                Cancelar
              </button>
              <button className={styles.btnConfirm}
                onClick={() => addColecao.mutate()}
                disabled={addColecao.isPending || !colecaoSelected}>
                {addColecao.isPending ? 'Adicionando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
