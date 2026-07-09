import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listarProvas, listarDisciplinas, criarProva } from '../../services/provas'
import { buscarDisciplinasFormador } from '../../services/usuarios'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Search, Eye, Pencil, FileText, ChevronDown, Users, Lock, Copy } from 'lucide-react'
import styles from './Provas.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']

export default function Provas() {
  const navigate = useNavigate()
  const { usuario, isFormador, isAdmin } = useAuth()
  const podeEditar = isFormador || isAdmin
  const queryClient = useQueryClient()

  const copiarProva = useMutation({
    mutationFn: async (prova) => {
      const dados = {
        titulo: `${prova.titulo} (cópia)`,
        descricao: prova.descricao || null,
        disciplina_id: prova.disciplina_id || null,
        disciplinas_ids: prova.disciplinas_ids || [],
        tipo_prova: prova.tipo_prova || 'disciplina',
        ano_escolar: prova.ano_escolar || null,
        instrucoes: prova.instrucoes || null,
        visibilidade: 'pessoal',
        cabecalho: prova.cabecalho || '',
        cfg_impressao: prova.cfg_impressao || {},
        autor_id: usuario.id,
      }
      return criarProva(dados, (prova.questoes_ids || []))
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['provas'])
      toast.success('Prova copiada para "Minhas provas"!')
    },
    onError: (err) => toast.error('Erro ao copiar: ' + err.message),
  })

  const [aba, setAba] = useState('minhas')       // 'minhas' | 'rede'
  const [filtros, setFiltros] = useState({})
  const [buscaTexto, setBuscaTexto] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  // Provas pessoais do usuário atual
  const { data: minhasProvas = [], isLoading: loadingMinhas } = useQuery({
    queryKey: ['provas', 'minhas', filtros],
    queryFn: () => listarProvas({ ...filtros, visibilidade: 'pessoal', autor_id: usuario?.id }),
  })

  // Disciplinas vinculadas ao formador logado
  const { data: minhasDisciplinas = [] } = useQuery({
    queryKey: ['formador-disciplinas', usuario?.id],
    queryFn: () => buscarDisciplinasFormador(usuario?.id),
    enabled: !!usuario?.id && podeEditar,
  })

  // Provas em revisão (para formadores/admin) — filtradas pela disciplina do formador
  const { data: todasProvasRevisao = [], isLoading: loadingRevisao } = useQuery({
    queryKey: ['provas', 'revisao'],
    queryFn: () => listarProvas({ status_revisao: 'em_revisao' }),
    enabled: podeEditar,
  })

  const provasRevisao = minhasDisciplinas.length > 0
    ? todasProvasRevisao.filter(p =>
        p.disciplina_id && minhasDisciplinas.includes(p.disciplina_id) ||
        (p.disciplinas_ids || []).some(d => minhasDisciplinas.includes(d))
      )
    : todasProvasRevisao

  // Provas da rede (todas com visibilidade=rede)
  const { data: provasRede = [], isLoading: loadingRede } = useQuery({
    queryKey: ['provas', 'rede', filtros],
    queryFn: () => listarProvas({ ...filtros, visibilidade: 'rede' }),
  })

  const { data: disciplinas = [] } = useQuery({
    queryKey: ['disciplinas'],
    queryFn: listarDisciplinas,
  })

  function setFiltro(key, val) {
    setFiltros(f => { const n = {...f}; if (val) n[key] = val; else delete n[key]; return n })
  }

  const provas = aba === 'minhas' ? minhasProvas : aba === 'revisao' ? provasRevisao : provasRede
  const isLoading = aba === 'minhas' ? loadingMinhas : aba === 'revisao' ? loadingRevisao : loadingRede

  const provasFiltradas = provas.filter(p =>
    !buscaTexto || p.titulo?.toLowerCase().includes(buscaTexto.toLowerCase())
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Provas e Avaliações</h1>
          <p className={styles.subtitulo}>{provasFiltradas.length} prova(s)</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/provas/nova')}>
          <Plus size={15} /> Nova prova
        </button>
      </div>

      {/* Abas */}
      <div className={styles.abas}>
        <button
          className={`${styles.aba} ${aba === 'minhas' ? styles.abaAtiva : ''}`}
          onClick={() => setAba('minhas')}
        >
          <Lock size={14} /> Minhas provas
          <span className={styles.abaBadge}>{minhasProvas.length}</span>
        </button>
        <button
          className={`${styles.aba} ${aba === 'rede' ? styles.abaAtiva : ''}`}
          onClick={() => setAba('rede')}
        >
          <Users size={14} /> Provas da rede
          <span className={styles.abaBadge}>{provasRede.length}</span>
        </button>
        {podeEditar && (
          <button
            className={`${styles.aba} ${aba === 'revisao' ? styles.abaAtiva : ''}`}
            onClick={() => setAba('revisao')}
          >
            🔍 Em revisão
            {provasRevisao.length > 0 && (
              <span className={`${styles.abaBadge} ${styles.abaBadgeAlerta}`}>{provasRevisao.length}</span>
            )}
          </button>
        )}
      </div>

      {/* Descrição da aba */}
      <p className={styles.abaDesc}>
        {aba === 'minhas'
          ? 'Provas criadas por você. Visíveis apenas para você.'
          : aba === 'revisao'
          ? 'Provas enviadas por professores aguardando sua avaliação para serem publicadas na rede.'
          : 'Provas compartilhadas para toda a rede. Qualquer professor pode usar.'}
      </p>

      {/* Busca e filtros */}
      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por título..."
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

      {/* Lista */}
      {isLoading ? (
        <div className={styles.loading}>Carregando provas...</div>
      ) : provasFiltradas.length === 0 ? (
        <div className={styles.vazio}>
          <FileText size={36} strokeWidth={1.5} />
          <p>
            {aba === 'minhas'
              ? 'Você ainda não criou nenhuma prova'
              : 'Nenhuma prova da rede disponível'}
          </p>
          <button className={styles.btnPrimary} onClick={() => navigate('/provas/nova')}>
            <Plus size={14} /> Criar prova
          </button>
        </div>
      ) : (
        <div className={styles.lista}>
          {provasFiltradas.map(p => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardInfo}>
                  <div className={styles.cardTituloRow}>
                    <h3 className={styles.cardTitulo} onClick={() => navigate(`/provas/${p.id}`)}>
                      {p.titulo}
                    </h3>
                    <span className={`${styles.tipoBadge} ${p.visibilidade === 'rede' ? styles.tipoRede : styles.tipoPessoal}`}>
                      {p.visibilidade === 'rede'
                        ? <><Users size={11} /> Rede</>
                        : <><Lock size={11} /> Pessoal</>}
                    </span>
                  </div>
                  {p.descricao && <p className={styles.cardDesc}>{p.descricao.slice(0, 100)}</p>}
                </div>
                <div className={styles.cardAcoes}>
                  <button className={styles.iconBtn} onClick={() => navigate(`/provas/${p.id}`)} title="Ver">
                    <Eye size={15} />
                  </button>
                  {/* Só autor ou admin pode editar */}
                  {(p.autor_id === usuario?.id || isAdmin) && (
                    <button className={styles.iconBtn} onClick={() => navigate(`/provas/${p.id}/editar`)} title="Editar">
                      <Pencil size={15} />
                    </button>
                  )}
                  {/* Copiar prova da rede */}
                  {aba === 'rede' && p.autor_id !== usuario?.id && (
                    <button className={styles.iconBtn}
                      onClick={() => copiarProva.mutate(p)}
                      title="Copiar para minhas provas"
                      disabled={copiarProva.isPending}>
                      <Copy size={15} />
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.cardBadges}>
                {p.disciplinas && <span className={styles.badgeDisc}>{p.disciplinas.nome}</span>}
                {p.ano_escolar && <span className={styles.badgeGray}>{p.ano_escolar}</span>}
                <span className={styles.badgeQuestoes}>{p.total_questoes} questões</span>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.autor}>
                  {p.visibilidade === 'rede' ? `Por ${p.perfis?.nome}` : 'Minha prova'}
                </span>
                <span className={styles.data}>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
