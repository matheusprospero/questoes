import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listarMateriais, criarMaterial, atualizarMaterial, deletarMaterial } from '../../services/materiais'
import { uploadArquivo, deletarArquivo } from '../../services/upload'
import { listarDisciplinas } from '../../services/questoes'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, Search, Filter, Trash2, Pencil, ExternalLink, Download,
  FileText, Link2, Video, File, Folder, X, Upload,
} from 'lucide-react'
import styles from './Materiais.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']

// Formato de entrega (como o material é acessado) — coluna `formato`
const FORMATOS = [
  { valor: 'arquivo',   label: 'Arquivo',   icone: FileText },
  { valor: 'link',      label: 'Link',      icone: Link2 },
  { valor: 'video',     label: 'Vídeo',     icone: Video },
]

// Classificação pedagógica — coluna `tipo`
const TIPOS_PEDAGOGICOS = [
  { valor: 'sequencia_didatica',   label: 'Sequência didática' },
  { valor: 'apresentacao',         label: 'Apresentação' },
  { valor: 'guia_pedagogico',      label: 'Guia pedagógico' },
  { valor: 'video',                label: 'Vídeo' },
  { valor: 'material_apoio',       label: 'Material de apoio' },
  { valor: 'arquivo_complementar', label: 'Arquivo complementar' },
  { valor: 'outro',                label: 'Outro' },
]

function iconePorFormato(formato) {
  const f = FORMATOS.find(x => x.valor === formato)
  return f ? f.icone : File
}

function labelTipo(tipo) {
  return TIPOS_PEDAGOGICOS.find(x => x.valor === tipo)?.label ?? null
}

// Extrai o caminho dentro do bucket "midia" a partir da URL pública
function caminhoDaUrl(url) {
  const marca = '/midia/'
  const i = url?.indexOf(marca)
  return i >= 0 ? url.slice(i + marca.length) : null
}

export default function Materiais() {
  const { usuario, isFormador, isAdmin } = useAuth()
  const podeEditar = isFormador || isAdmin
  const queryClient = useQueryClient()

  const [aba, setAba] = useState('rede')
  const [buscaTexto, setBuscaTexto] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [filtros, setFiltros] = useState({ formato: '', tipo: '', disciplina_id: '', ano_escolar: '' })
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: meus = [], isLoading: loadingMeus } = useQuery({
    queryKey: ['materiais', 'meus', filtros, usuario?.id],
    queryFn: () => listarMateriais({ ...filtros, autor_id: usuario?.id }),
    enabled: !!usuario,
  })

  const { data: rede = [], isLoading: loadingRede } = useQuery({
    queryKey: ['materiais', 'rede', filtros],
    queryFn: () => listarMateriais(filtros),
  })

  const { data: disciplinas = [] } = useQuery({
    queryKey: ['disciplinas'],
    queryFn: listarDisciplinas,
  })

  const excluir = useMutation({
    mutationFn: async (material) => {
      if (material.formato === 'arquivo') {
        const path = caminhoDaUrl(material.url)
        if (path) { try { await deletarArquivo(path) } catch { /* arquivo já removido */ } }
      }
      await deletarMaterial(material.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiais'] })
      toast.success('Material excluído.')
      setConfirmDelete(null)
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  function abrirNovo() { setEditando(null); setModalAberto(true) }
  function abrirEdicao(m) { setEditando(m); setModalAberto(true) }

  const lista = aba === 'meus' ? meus : rede
  const isLoading = aba === 'meus' ? loadingMeus : loadingRede
  const temFiltro = filtros.formato || filtros.tipo || filtros.disciplina_id || filtros.ano_escolar

  const filtrado = lista.filter(m => {
    const t = buscaTexto.toLowerCase()
    return !buscaTexto || [m.titulo, m.descricao, m.disciplinas?.nome, m.ano_escolar, ...(m.tags || [])]
      .some(v => v?.toLowerCase().includes(t))
  })

  function setFiltro(campo, valor) { setFiltros(prev => ({ ...prev, [campo]: valor })) }
  function limparFiltros() { setFiltros({ formato: '', tipo: '', disciplina_id: '', ano_escolar: '' }); setBuscaTexto('') }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Materiais Pedagógicos</h1>
          <p className={styles.subtitulo}>
            {aba === 'meus' ? `${meus.length} material(is) seu(s)` : `${rede.length} material(is) na rede`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={abrirNovo}>
          <Plus size={15} /> Novo material
        </button>
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por título, descrição, tag..."
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
          <select className={styles.filtroSelect} value={filtros.formato} onChange={e => setFiltro('formato', e.target.value)}>
            <option value="">Todos os formatos</option>
            {FORMATOS.map(f => <option key={f.valor} value={f.valor}>{f.label}</option>)}
          </select>
          <select className={styles.filtroSelect} value={filtros.tipo} onChange={e => setFiltro('tipo', e.target.value)}>
            <option value="">Todos os tipos</option>
            {TIPOS_PEDAGOGICOS.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
          </select>
          <select className={styles.filtroSelect} value={filtros.disciplina_id} onChange={e => setFiltro('disciplina_id', e.target.value)}>
            <option value="">Todas as disciplinas</option>
            {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <select className={styles.filtroSelect} value={filtros.ano_escolar} onChange={e => setFiltro('ano_escolar', e.target.value)}>
            <option value="">Todos os anos</option>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {temFiltro && <button className={styles.btnLimpar} onClick={limparFiltros}>Limpar filtros</button>}
        </div>
      )}

      <div className={styles.abas}>
        <button className={`${styles.aba} ${aba === 'rede' ? styles.abaAtiva : ''}`} onClick={() => setAba('rede')}>
          <Folder size={14} /> Rede
          <span className={styles.abaBadge}>{rede.length}</span>
        </button>
        <button className={`${styles.aba} ${aba === 'meus' ? styles.abaAtiva : ''}`} onClick={() => setAba('meus')}>
          Meus materiais
          <span className={styles.abaBadge}>{meus.length}</span>
        </button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Carregando materiais...</div>
      ) : filtrado.length === 0 ? (
        <div className={styles.vazio}>
          <Folder size={36} strokeWidth={1.5} />
          <p>{buscaTexto || temFiltro ? 'Nenhum material encontrado' : aba === 'meus' ? 'Você ainda não adicionou materiais' : 'Nenhum material na rede ainda'}</p>
          {!buscaTexto && !temFiltro && (
            <button className={styles.btnPrimary} onClick={abrirNovo}>Adicionar material</button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtrado.map(m => {
            const Icone = iconePorFormato(m.formato)
            const ehDono = m.autor_id === usuario?.id
            return (
              <div key={m.id} className={styles.card}>
                <div className={styles.cardIcone}><Icone size={20} /></div>
                <div className={styles.cardBody}>
                  <div className={styles.cardMeta}>
                    {labelTipo(m.tipo) && <span className={styles.tipoBadge}>{labelTipo(m.tipo)}</span>}
                    {m.disciplinas && (
                      <span className={styles.discBadge} style={{ background: m.disciplinas.cor + '22', color: m.disciplinas.cor }}>
                        {m.disciplinas.nome}
                      </span>
                    )}
                    {m.ano_escolar && <span className={styles.badge}>{m.ano_escolar}</span>}
                  </div>
                  <h3 className={styles.cardTitulo}>{m.titulo}</h3>
                  {m.descricao && <p className={styles.cardDesc}>{m.descricao}</p>}
                  {m.tags?.length > 0 && (
                    <div className={styles.tags}>
                      {m.tags.map((tag, i) => <span key={i} className={styles.tag}>#{tag}</span>)}
                    </div>
                  )}
                  <div className={styles.cardFooter}>
                    <a className={styles.btnAbrir} href={m.url} target="_blank" rel="noopener noreferrer">
                      {m.formato === 'arquivo' ? <><Download size={13} /> Baixar</> : <><ExternalLink size={13} /> Abrir</>}
                    </a>
                    <div className={styles.cardAcoes}>
                      {(podeEditar || ehDono) && (
                        <button className={styles.iconBtn} onClick={() => abrirEdicao(m)} title="Editar"><Pencil size={13} /></button>
                      )}
                      {ehDono && (
                        <button className={`${styles.iconBtn} ${styles.btnDangerIcon}`} onClick={() => setConfirmDelete(m)} title="Excluir"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalAberto && (
        <MaterialModal
          material={editando}
          disciplinas={disciplinas}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['materiais'] })
            setModalAberto(false)
          }}
        />
      )}

      {confirmDelete && (
        <div className={styles.overlay}>
          <div className={styles.confirmBox}>
            <p className={styles.confirmTitulo}>Excluir material?</p>
            <p className={styles.confirmDesc}>"<strong>{confirmDelete.titulo}</strong>" será removido.</p>
            <div className={styles.confirmBotoes}>
              <button className={styles.btnCancel} onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={() => excluir.mutate(confirmDelete)} disabled={excluir.isPending}>
                {excluir.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MaterialModal({ material, disciplinas, onClose, onSaved }) {
  const isEdicao = !!material
  const [form, setForm] = useState({
    titulo: material?.titulo ?? '',
    descricao: material?.descricao ?? '',
    formato: material?.formato ?? 'arquivo',
    tipo: material?.tipo ?? 'outro',
    url: material?.url ?? '',
    disciplina_id: material?.disciplina_id ?? '',
    ano_escolar: material?.ano_escolar ?? '',
    tags: material?.tags?.join(', ') ?? '',
  })
  const [arquivo, setArquivo] = useState(null)
  const [arquivoNome, setArquivoNome] = useState(material?.formato === 'arquivo' && material?.url ? 'Arquivo atual mantido' : '')

  function set(campo, valor) { setForm(prev => ({ ...prev, [campo]: valor })) }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error('Título é obrigatório')

      let url = form.url.trim()
      if (form.formato === 'arquivo') {
        if (arquivo) {
          const res = await uploadArquivo(arquivo, 'materiais')
          url = res.url
        } else if (!url) {
          throw new Error('Selecione um arquivo para enviar')
        }
      } else {
        if (!url) throw new Error('Informe a URL do material')
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url
      }

      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      const dados = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        formato: form.formato,
        tipo: form.tipo,
        url,
        disciplina_id: form.disciplina_id || null,
        ano_escolar: form.ano_escolar || null,
        tags: tags.length ? tags : null,
      }
      return isEdicao ? atualizarMaterial(material.id, dados) : criarMaterial(dados)
    },
    onSuccess: () => {
      toast.success(isEdicao ? 'Material atualizado!' : 'Material adicionado!')
      onSaved()
    },
    onError: (err) => toast.error(err.message),
  })

  function escolherArquivo(e) {
    const f = e.target.files?.[0]
    if (f) { setArquivo(f); setArquivoNome(f.name) }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitulo}>{isEdicao ? 'Editar material' : 'Novo material'}</h2>
          <button className={styles.btnClose} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.campo}>
            <label className={styles.label}>Formato</label>
            <div className={styles.tipoSelector}>
              {FORMATOS.map(f => {
                const Icone = f.icone
                return (
                  <button
                    key={f.valor}
                    className={`${styles.tipoBtn} ${form.formato === f.valor ? styles.tipoBtnAtivo : ''}`}
                    onClick={() => set('formato', f.valor)}
                    type="button"
                  >
                    <Icone size={16} /> {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.campo}>
            <label className={styles.label}>Título <span className={styles.req}>*</span></label>
            <input className={styles.input} value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Nome do material" />
          </div>

          <div className={styles.campo}>
            <label className={styles.label}>Descrição</label>
            <textarea className={styles.textarea} rows={2} value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Para que serve este material" />
          </div>

          {form.formato === 'arquivo' ? (
            <div className={styles.campo}>
              <label className={styles.label}>Arquivo {!isEdicao && <span className={styles.req}>*</span>}</label>
              <label className={styles.uploadBox}>
                <Upload size={16} />
                <span>{arquivoNome || 'Selecionar arquivo (PDF, DOC, imagem… máx 20 MB)'}</span>
                <input type="file" className={styles.uploadInput} onChange={escolherArquivo} />
              </label>
            </div>
          ) : (
            <div className={styles.campo}>
              <label className={styles.label}>URL <span className={styles.req}>*</span></label>
              <input className={styles.input} value={form.url} onChange={e => set('url', e.target.value)} placeholder={form.formato === 'video' ? 'https://youtube.com/...' : 'https://...'} />
            </div>
          )}

          <div className={styles.campo}>
            <label className={styles.label}>Tipo pedagógico</label>
            <select className={styles.select} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              {TIPOS_PEDAGOGICOS.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>

          <div className={styles.linha2}>
            <div className={styles.campo}>
              <label className={styles.label}>Disciplina</label>
              <select className={styles.select} value={form.disciplina_id} onChange={e => set('disciplina_id', e.target.value)}>
                <option value="">Selecionar</option>
                {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
            <div className={styles.campo}>
              <label className={styles.label}>Ano escolar</label>
              <select className={styles.select} value={form.ano_escolar} onChange={e => set('ano_escolar', e.target.value)}>
                <option value="">Selecionar</option>
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.campo}>
            <label className={styles.label}>Tags</label>
            <input className={styles.input} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="Separadas por vírgula: avaliação, jogo, leitura" />
          </div>
        </div>

        <div className={styles.modalBotoes}>
          <button className={styles.btnCancel} onClick={onClose}>Cancelar</button>
          <button className={styles.btnConfirm} onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando...' : isEdicao ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}
