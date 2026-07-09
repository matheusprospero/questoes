import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listarColecoes, criarColecao, atualizarColecao, deletarColecao,
} from '../../services/colecoes'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Search, Eye, Pencil, Trash2, Layers, Users, Lock, Globe } from 'lucide-react'
import styles from './Colecoes.module.css'

const FORM_VAZIO = { nome: '', descricao: '', publica: false }

export default function Colecoes() {
  const navigate = useNavigate()
  const { usuario, isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const [aba, setAba] = useState('minhas')        // 'minhas' | 'publicas'
  const [buscaTexto, setBuscaTexto] = useState('')

  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)  // coleção em edição (ou null = nova)
  const [form, setForm] = useState(FORM_VAZIO)

  const { data: minhasColecoes = [], isLoading: loadingMinhas } = useQuery({
    queryKey: ['colecoes', 'minhas', usuario?.id],
    queryFn: () => listarColecoes({ autor_id: usuario?.id }),
    enabled: !!usuario?.id,
  })

  const { data: colecoesPublicas = [], isLoading: loadingPublicas } = useQuery({
    queryKey: ['colecoes', 'publicas'],
    queryFn: () => listarColecoes({ publica: true }),
  })

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error('Dê um nome à coleção')
      if (editando) {
        await atualizarColecao(editando.id, form)
      } else {
        await criarColecao({ ...form, autor_id: usuario.id })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colecoes'] })
      toast.success(editando ? 'Coleção atualizada!' : 'Coleção criada!')
      fecharModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const excluir = useMutation({
    mutationFn: (id) => deletarColecao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colecoes'] })
      toast.success('Coleção excluída.')
    },
    onError: (err) => toast.error('Erro ao excluir: ' + err.message),
  })

  function abrirNova() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModalAberto(true)
  }

  function abrirEdicao(c) {
    setEditando(c)
    setForm({ nome: c.nome, descricao: c.descricao || '', publica: !!c.publica })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
    setForm(FORM_VAZIO)
  }

  const colecoes = aba === 'minhas' ? minhasColecoes : colecoesPublicas
  const isLoading = aba === 'minhas' ? loadingMinhas : loadingPublicas

  const colecoesFiltradas = colecoes.filter(c =>
    !buscaTexto || c.nome?.toLowerCase().includes(buscaTexto.toLowerCase())
  )

  function podeEditar(c) {
    return c.autor_id === usuario?.id || isAdmin
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Minhas Coleções</h1>
          <p className={styles.subtitulo}>{colecoesFiltradas.length} coleção(ões)</p>
        </div>
        <button className={styles.btnPrimary} onClick={abrirNova}>
          <Plus size={15} /> Nova coleção
        </button>
      </div>

      {/* Abas */}
      <div className={styles.abas}>
        <button
          className={`${styles.aba} ${aba === 'minhas' ? styles.abaAtiva : ''}`}
          onClick={() => setAba('minhas')}
        >
          <Lock size={14} /> Minhas coleções
          <span className={styles.abaBadge}>{minhasColecoes.length}</span>
        </button>
        <button
          className={`${styles.aba} ${aba === 'publicas' ? styles.abaAtiva : ''}`}
          onClick={() => setAba('publicas')}
        >
          <Users size={14} /> Coleções públicas
          <span className={styles.abaBadge}>{colecoesPublicas.length}</span>
        </button>
      </div>

      <p className={styles.abaDesc}>
        {aba === 'minhas'
          ? 'Agrupe questões em coleções temáticas para reutilizar depois.'
          : 'Coleções compartilhadas por outros professores da rede.'}
      </p>

      {/* Busca */}
      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por nome..."
            value={buscaTexto}
            onChange={e => setBuscaTexto(e.target.value)}
          />
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className={styles.loading}>Carregando coleções...</div>
      ) : colecoesFiltradas.length === 0 ? (
        <div className={styles.vazio}>
          <Layers size={36} strokeWidth={1.5} />
          <p>
            {aba === 'minhas'
              ? 'Você ainda não criou nenhuma coleção'
              : 'Nenhuma coleção pública disponível'}
          </p>
          {aba === 'minhas' && (
            <button className={styles.btnPrimary} onClick={abrirNova}>
              <Plus size={14} /> Criar coleção
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {colecoesFiltradas.map(c => (
            <div key={c.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardInfo}>
                  <div className={styles.cardTituloRow}>
                    <h3 className={styles.cardTitulo} onClick={() => navigate(`/colecoes/${c.id}`)}>
                      {c.nome}
                    </h3>
                    <span className={`${styles.tipoBadge} ${c.publica ? styles.tipoRede : styles.tipoPessoal}`}>
                      {c.publica
                        ? <><Globe size={11} /> Pública</>
                        : <><Lock size={11} /> Privada</>}
                    </span>
                  </div>
                  {c.descricao && <p className={styles.cardDesc}>{c.descricao.slice(0, 110)}</p>}
                </div>
                <div className={styles.cardAcoes}>
                  <button className={styles.iconBtn} onClick={() => navigate(`/colecoes/${c.id}`)} title="Abrir">
                    <Eye size={15} />
                  </button>
                  {podeEditar(c) && (
                    <>
                      <button className={styles.iconBtn} onClick={() => abrirEdicao(c)} title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button className={styles.iconBtn}
                        onClick={() => {
                          if (confirm(`Excluir a coleção "${c.nome}"? As questões não são apagadas.`))
                            excluir.mutate(c.id)
                        }}
                        title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.autor}>
                  {c.autor_id === usuario?.id ? 'Minha coleção' : `Por ${c.perfis?.nome ?? '—'}`}
                </span>
                <span className={styles.badgeQuestoes}>{c.total_questoes} questões</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      {modalAberto && (
        <div className={styles.modalOverlay} onClick={fecharModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitulo}>{editando ? 'Editar coleção' : 'Nova coleção'}</h3>

            <div className={styles.formGroup}>
              <label className={styles.label}>Nome *</label>
              <input
                className={styles.input}
                placeholder="Ex: Frações — 6º ano"
                value={form.nome}
                autoFocus
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Descrição</label>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="Para que serve esta coleção (opcional)..."
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form.publica}
                onChange={e => setForm(f => ({ ...f, publica: e.target.checked }))}
              />
              <span>
                <strong>Tornar pública</strong>
                <span className={styles.checkboxHint}>Outros professores poderão ver esta coleção</span>
              </span>
            </label>

            <div className={styles.modalBotoes}>
              <button className={styles.btnCancel} onClick={fecharModal}>Cancelar</button>
              <button className={styles.btnConfirm}
                onClick={() => salvar.mutate()}
                disabled={salvar.isPending || !form.nome.trim()}>
                {salvar.isPending ? 'Salvando...' : editando ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
