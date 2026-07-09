import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listarPlanos, deletarPlano } from '../../services/planos'
import { listarDisciplinas } from '../../services/questoes'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Search, Eye, Pencil, Trash2, BookOpen, Clock, Filter } from 'lucide-react'
import styles from './Planos.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']

const STATUS_LABEL = { rascunho: 'Rascunho', publicado: 'Publicado', arquivado: 'Arquivado' }

export default function Planos() {
  const navigate = useNavigate()
  const { usuario, isFormador, isAdmin } = useAuth()
  const podeEditar = isFormador || isAdmin
  const queryClient = useQueryClient()

  const [aba, setAba] = useState('meus')
  const [buscaTexto, setBuscaTexto] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [filtros, setFiltros] = useState({ disciplina_id: '', ano_escolar: '' })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: meusPlanos = [], isLoading: loadingMeus } = useQuery({
    queryKey: ['planos', 'meus', filtros, usuario?.id],
    queryFn: () => listarPlanos({ ...filtros, autor_id: usuario?.id }),
    enabled: !!usuario,
  })

  const { data: planosRede = [], isLoading: loadingRede } = useQuery({
    queryKey: ['planos', 'rede', filtros],
    queryFn: () => listarPlanos({ ...filtros, status: 'publicado' }),
  })

  const { data: disciplinas = [] } = useQuery({
    queryKey: ['disciplinas'],
    queryFn: listarDisciplinas,
  })

  const excluir = useMutation({
    mutationFn: (id) => deletarPlano(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos'] })
      toast.success('Plano excluído.')
      setConfirmDelete(null)
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  const lista = aba === 'meus' ? meusPlanos : planosRede
  const isLoading = aba === 'meus' ? loadingMeus : loadingRede

  const filtrado = lista.filter(p => {
    const t = buscaTexto.toLowerCase()
    return !buscaTexto || [p.titulo, p.disciplinas?.nome, p.ano_escolar, p.descricao]
      .some(v => v?.toLowerCase().includes(t))
  })

  function setFiltro(campo, valor) {
    setFiltros(prev => ({ ...prev, [campo]: valor }))
  }

  function limparFiltros() {
    setFiltros({ disciplina_id: '', ano_escolar: '' })
    setBuscaTexto('')
  }

  const temFiltro = filtros.disciplina_id || filtros.ano_escolar

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Planos de Aula</h1>
          <p className={styles.subtitulo}>
            {aba === 'meus' ? `${meusPlanos.length} plano(s) criado(s) por você` : `${planosRede.length} plano(s) compartilhado(s) na rede`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/planos/novo')}>
          <Plus size={15} /> Novo plano
        </button>
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por título, disciplina, ano..."
            value={buscaTexto}
            onChange={e => setBuscaTexto(e.target.value)}
          />
        </div>
        <button
          className={`${styles.btnFiltro} ${temFiltro ? styles.btnFiltroAtivo : ''}`}
          onClick={() => setMostrarFiltros(p => !p)}
        >
          <Filter size={14} /> Filtros {temFiltro && '●'}
        </button>
      </div>

      {mostrarFiltros && (
        <div className={styles.filtrosPanel}>
          <select className={styles.filtroSelect} value={filtros.disciplina_id} onChange={e => setFiltro('disciplina_id', e.target.value)}>
            <option value="">Todas as disciplinas</option>
            {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <select className={styles.filtroSelect} value={filtros.ano_escolar} onChange={e => setFiltro('ano_escolar', e.target.value)}>
            <option value="">Todos os anos</option>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {temFiltro && (
            <button className={styles.btnLimpar} onClick={limparFiltros}>Limpar filtros</button>
          )}
        </div>
      )}

      <div className={styles.abas}>
        <button className={`${styles.aba} ${aba === 'meus' ? styles.abaAtiva : ''}`} onClick={() => setAba('meus')}>
          <BookOpen size={14} /> Meus planos
          <span className={styles.abaBadge}>{meusPlanos.length}</span>
        </button>
        <button className={`${styles.aba} ${aba === 'rede' ? styles.abaAtiva : ''}`} onClick={() => setAba('rede')}>
          Rede
          <span className={styles.abaBadge}>{planosRede.length}</span>
        </button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Carregando planos...</div>
      ) : filtrado.length === 0 ? (
        <div className={styles.vazio}>
          <BookOpen size={36} strokeWidth={1.5} />
          <p>{buscaTexto || temFiltro ? 'Nenhum plano encontrado para esta busca' : aba === 'meus' ? 'Você ainda não criou nenhum plano de aula' : 'Nenhum plano publicado na rede ainda'}</p>
          {!buscaTexto && !temFiltro && aba === 'meus' && (
            <button className={styles.btnPrimary} onClick={() => navigate('/planos/novo')}>
              Criar meu primeiro plano
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtrado.map(p => (
            <PlanoCard
              key={p.id}
              plano={p}
              mostrarAutor={aba === 'rede'}
              podeEditar={podeEditar || p.autor_id === usuario?.id}
              ehDono={p.autor_id === usuario?.id}
              onView={() => navigate(`/planos/${p.id}`)}
              onEdit={() => navigate(`/planos/${p.id}/editar`)}
              onDelete={() => setConfirmDelete(p)}
            />
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className={styles.overlay}>
          <div className={styles.confirmBox}>
            <p className={styles.confirmTitulo}>Excluir plano?</p>
            <p className={styles.confirmDesc}>
              "<strong>{confirmDelete.titulo}</strong>" será permanentemente excluído.
            </p>
            <div className={styles.confirmBotoes}>
              <button className={styles.btnCancel} onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button
                className={styles.btnDanger}
                onClick={() => excluir.mutate(confirmDelete.id)}
                disabled={excluir.isPending}
              >
                {excluir.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlanoCard({ plano, mostrarAutor, podeEditar, ehDono, onView, onEdit, onDelete }) {
  return (
    <div className={styles.card} onClick={onView}>
      <div className={styles.cardTop}>
        <div className={styles.cardMeta}>
          {plano.disciplinas && (
            <span className={styles.discBadge} style={{ background: plano.disciplinas.cor + '22', color: plano.disciplinas.cor }}>
              {plano.disciplinas.nome}
            </span>
          )}
          {plano.ano_escolar && <span className={styles.badge}>{plano.ano_escolar}</span>}
          <span className={`${styles.badge} ${styles['status_' + plano.status]}`}>
            {STATUS_LABEL[plano.status] ?? plano.status}
          </span>
        </div>
        <div className={styles.cardAcoes} onClick={e => e.stopPropagation()}>
          {(podeEditar || ehDono) && (
            <button className={styles.iconBtn} onClick={onEdit} title="Editar">
              <Pencil size={14} />
            </button>
          )}
          <button className={styles.iconBtn} onClick={onView} title="Ver">
            <Eye size={14} />
          </button>
          {ehDono && (
            <button className={`${styles.iconBtn} ${styles.btnDangerIcon}`} onClick={onDelete} title="Excluir">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <h3 className={styles.cardTitulo}>{plano.titulo}</h3>
      {plano.descricao && <p className={styles.cardDesc}>{plano.descricao}</p>}

      <div className={styles.cardFooter}>
        {plano.duracao_aulas && (
          <span className={styles.footerItem}><Clock size={12} /> {plano.duracao_aulas} aula(s)</span>
        )}
        {mostrarAutor && plano.perfis?.nome && (
          <span className={styles.footerItem}>{plano.perfis.nome}</span>
        )}
      </div>
    </div>
  )
}
