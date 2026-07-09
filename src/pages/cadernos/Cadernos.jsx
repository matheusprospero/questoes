import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listarCadernos, criarCaderno, atualizarCaderno, deletarCaderno,
} from '../../services/cadernos'
import toast from 'react-hot-toast'
import { Plus, Search, Eye, Pencil, Trash2, Layers } from 'lucide-react'
import styles from './Cadernos.module.css'

const FORM_VAZIO = { nome: '', descricao: '' }

export default function Cadernos() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [buscaTexto, setBuscaTexto] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)  // caderno em edição (ou null = novo)
  const [form, setForm] = useState(FORM_VAZIO)

  const { data: cadernos = [], isLoading } = useQuery({
    queryKey: ['cadernos'],
    queryFn: listarCadernos,
  })

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error('Dê um nome ao caderno')
      if (editando) {
        await atualizarCaderno(editando.id, form)
      } else {
        await criarCaderno(form)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadernos'] })
      toast.success(editando ? 'Caderno atualizado!' : 'Caderno criado!')
      fecharModal()
    },
    onError: (err) => toast.error(err.message),
  })

  const excluir = useMutation({
    mutationFn: (id) => deletarCaderno(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadernos'] })
      toast.success('Caderno excluído.')
    },
    onError: (err) => toast.error('Erro ao excluir: ' + err.message),
  })

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModalAberto(true)
  }

  function abrirEdicao(c) {
    setEditando(c)
    setForm({ nome: c.nome, descricao: c.descricao || '' })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
    setForm(FORM_VAZIO)
  }

  const cadernosFiltrados = cadernos.filter(c =>
    !buscaTexto || c.nome?.toLowerCase().includes(buscaTexto.toLowerCase())
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Cadernos</h1>
          <p className={styles.subtitulo}>{cadernosFiltrados.length} caderno(s)</p>
        </div>
        <button className={styles.btnPrimary} onClick={abrirNovo}>
          <Plus size={15} /> Novo caderno
        </button>
      </div>

      <p className={styles.abaDesc}>
        Agrupe questões por edital, matéria ou tema para organizar seu estudo.
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
        <div className={styles.loading}>Carregando cadernos...</div>
      ) : cadernosFiltrados.length === 0 ? (
        <div className={styles.vazio}>
          <Layers size={36} strokeWidth={1.5} />
          <p>Você ainda não criou nenhum caderno</p>
          <button className={styles.btnPrimary} onClick={abrirNovo}>
            <Plus size={14} /> Criar caderno
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {cadernosFiltrados.map(c => (
            <div key={c.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardInfo}>
                  <div className={styles.cardTituloRow}>
                    <h3 className={styles.cardTitulo} onClick={() => navigate(`/cadernos/${c.id}`)}>
                      {c.nome}
                    </h3>
                  </div>
                  {c.descricao && <p className={styles.cardDesc}>{c.descricao.slice(0, 110)}</p>}
                </div>
                <div className={styles.cardAcoes}>
                  <button className={styles.iconBtn} onClick={() => navigate(`/cadernos/${c.id}`)} title="Abrir">
                    <Eye size={15} />
                  </button>
                  <button className={styles.iconBtn} onClick={() => abrirEdicao(c)} title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button className={styles.iconBtn}
                    onClick={() => {
                      if (confirm(`Excluir o caderno "${c.nome}"? As questões não são apagadas.`))
                        excluir.mutate(c.id)
                    }}
                    title="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.autor}>
                  Criado em {new Date(c.criado_em).toLocaleDateString('pt-BR')}
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
            <h3 className={styles.modalTitulo}>{editando ? 'Editar caderno' : 'Novo caderno'}</h3>

            <div className={styles.formGroup}>
              <label className={styles.label}>Nome *</label>
              <input
                className={styles.input}
                placeholder="Ex: Direito Constitucional — PF 2026"
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
                placeholder="Para que serve este caderno (opcional)..."
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>

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
