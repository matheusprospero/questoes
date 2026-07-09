import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarTodasDisciplinas, criarDisciplina, atualizarDisciplina, deletarDisciplina,
  listarTodasHabilidades, criarHabilidade, atualizarHabilidade, deletarHabilidade, contarUsoHabilidades,
} from '../../services/matriz'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, Search, Pencil, Trash2, X, BookOpen, Target, Check,
} from 'lucide-react'
import styles from './Matriz.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']
const CORES = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#e11d48','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b']

export default function Matriz() {
  const { isAdmin, isFormador } = useAuth()
  const podeEditar = isAdmin || isFormador
  const [aba, setAba] = useState('disciplinas')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Matriz Curricular</h1>
          <p className={styles.subtitulo}>Disciplinas e habilidades da rede</p>
        </div>
      </div>

      <div className={styles.abas}>
        <button className={`${styles.aba} ${aba === 'disciplinas' ? styles.abaAtiva : ''}`} onClick={() => setAba('disciplinas')}>
          <BookOpen size={14} /> Disciplinas
        </button>
        <button className={`${styles.aba} ${aba === 'habilidades' ? styles.abaAtiva : ''}`} onClick={() => setAba('habilidades')}>
          <Target size={14} /> Habilidades
        </button>
      </div>

      {aba === 'disciplinas'
        ? <AbaDisciplinas podeEditar={podeEditar} />
        : <AbaHabilidades podeEditar={podeEditar} />}
    </div>
  )
}

/* ───────────────────────── DISCIPLINAS ───────────────────────── */

function AbaDisciplinas({ podeEditar }) {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)   // null | {} | disciplina
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: disciplinas = [], isLoading } = useQuery({
    queryKey: ['matriz', 'disciplinas'],
    queryFn: listarTodasDisciplinas,
  })

  const excluir = useMutation({
    mutationFn: (id) => deletarDisciplina(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matriz'] })
      queryClient.invalidateQueries({ queryKey: ['disciplinas'] })
      toast.success('Disciplina excluída.')
      setConfirmDelete(null)
    },
    onError: (err) => toast.error('Erro: ' + err.message + ' (pode haver questões/habilidades vinculadas)'),
  })

  if (isLoading) return <div className={styles.loading}>Carregando...</div>

  return (
    <>
      {podeEditar && (
        <div className={styles.toolbar}>
          <button className={styles.btnPrimary} onClick={() => setModal({})}>
            <Plus size={15} /> Nova disciplina
          </button>
        </div>
      )}

      {disciplinas.length === 0 ? (
        <div className={styles.vazio}><BookOpen size={36} strokeWidth={1.5} /><p>Nenhuma disciplina cadastrada</p></div>
      ) : (
        <div className={styles.discGrid}>
          {disciplinas.map(d => (
            <div key={d.id} className={`${styles.discCard} ${!d.ativo ? styles.inativo : ''}`}>
              <div className={styles.discCor} style={{ background: d.cor || '#94a3b8' }} />
              <div className={styles.discInfo}>
                <div className={styles.discNome}>
                  {d.nome}
                  {!d.ativo && <span className={styles.inativoBadge}>inativa</span>}
                </div>
                {d.codigo && <div className={styles.discCodigo}>{d.codigo}</div>}
              </div>
              {podeEditar && (
                <div className={styles.discAcoes}>
                  <button className={styles.iconBtn} onClick={() => setModal(d)} title="Editar"><Pencil size={14} /></button>
                  <button className={`${styles.iconBtn} ${styles.btnDangerIcon}`} onClick={() => setConfirmDelete(d)} title="Excluir"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <DisciplinaModal
          disciplina={modal.id ? modal : null}
          ordemSugerida={disciplinas.length}
          onClose={() => setModal(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['matriz'] })
            queryClient.invalidateQueries({ queryKey: ['disciplinas'] })
            setModal(null)
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmBox
          titulo="Excluir disciplina?"
          desc={<>"<strong>{confirmDelete.nome}</strong>" e suas habilidades serão removidas. Questões vinculadas podem impedir a exclusão.</>}
          loading={excluir.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => excluir.mutate(confirmDelete.id)}
        />
      )}
    </>
  )
}

function DisciplinaModal({ disciplina, ordemSugerida, onClose, onSaved }) {
  const isEdicao = !!disciplina
  const [form, setForm] = useState({
    nome: disciplina?.nome ?? '',
    codigo: disciplina?.codigo ?? '',
    cor: disciplina?.cor ?? CORES[0],
    ordem: disciplina?.ordem ?? ordemSugerida,
    ativo: disciplina?.ativo ?? true,
  })

  const salvar = useMutation({
    mutationFn: () => {
      if (!form.nome.trim()) throw new Error('Nome é obrigatório')
      const dados = {
        nome: form.nome.trim(),
        codigo: form.codigo.trim() || null,
        cor: form.cor,
        ordem: Number(form.ordem) || 0,
        ativo: form.ativo,
      }
      return isEdicao ? atualizarDisciplina(disciplina.id, dados) : criarDisciplina(dados)
    },
    onSuccess: () => { toast.success(isEdicao ? 'Disciplina atualizada!' : 'Disciplina criada!'); onSaved() },
    onError: (err) => toast.error(err.message),
  })

  const set = (c, v) => setForm(p => ({ ...p, [c]: v }))

  return (
    <Modal titulo={isEdicao ? 'Editar disciplina' : 'Nova disciplina'} onClose={onClose}
      onSave={() => salvar.mutate()} saving={salvar.isPending} isEdicao={isEdicao}>
      <div className={styles.campo}>
        <label className={styles.label}>Nome <span className={styles.req}>*</span></label>
        <input className={styles.input} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Matemática" />
      </div>
      <div className={styles.linha2}>
        <div className={styles.campo}>
          <label className={styles.label}>Código</label>
          <input className={styles.input} value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="Ex: MAT" />
        </div>
        <div className={styles.campo}>
          <label className={styles.label}>Ordem</label>
          <input className={styles.input} type="number" min="0" value={form.ordem} onChange={e => set('ordem', e.target.value)} />
        </div>
      </div>
      <div className={styles.campo}>
        <label className={styles.label}>Cor</label>
        <div className={styles.coresGrid}>
          {CORES.map(c => (
            <button key={c} type="button"
              className={`${styles.corOpcao} ${form.cor === c ? styles.corSelecionada : ''}`}
              style={{ background: c }} onClick={() => set('cor', c)}>
              {form.cor === c && <Check size={14} color="white" />}
            </button>
          ))}
        </div>
      </div>
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
        Disciplina ativa (aparece nos formulários)
      </label>
    </Modal>
  )
}

/* ───────────────────────── HABILIDADES ───────────────────────── */

function AbaHabilidades({ podeEditar }) {
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [filtroDisc, setFiltroDisc] = useState('')
  const [filtroAno, setFiltroAno] = useState('')
  const [modal, setModal] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: disciplinas = [] } = useQuery({
    queryKey: ['matriz', 'disciplinas'],
    queryFn: listarTodasDisciplinas,
  })

  const { data: habilidades = [], isLoading } = useQuery({
    queryKey: ['matriz', 'habilidades', filtroDisc, filtroAno],
    queryFn: () => listarTodasHabilidades({
      disciplina_id: filtroDisc || undefined,
      ano_escolar: filtroAno || undefined,
    }),
  })

  const { data: usoMap = {} } = useQuery({
    queryKey: ['matriz', 'uso-habilidades'],
    queryFn: contarUsoHabilidades,
  })

  const excluir = useMutation({
    mutationFn: (id) => deletarHabilidade(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matriz'] })
      toast.success('Habilidade excluída.')
      setConfirmDelete(null)
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  const filtradas = habilidades.filter(h => {
    const t = busca.toLowerCase()
    return !busca || [h.codigo, h.descricao].some(v => v?.toLowerCase().includes(t))
  })

  return (
    <>
      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Buscar por código ou descrição..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className={styles.filtroSelect} value={filtroDisc} onChange={e => setFiltroDisc(e.target.value)}>
          <option value="">Todas disciplinas</option>
          {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <select className={styles.filtroSelect} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
          <option value="">Todos os anos</option>
          {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {podeEditar && (
          <button className={styles.btnPrimary} onClick={() => setModal({})}>
            <Plus size={15} /> Nova
          </button>
        )}
      </div>

      {isLoading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className={styles.vazio}><Target size={36} strokeWidth={1.5} /><p>Nenhuma habilidade encontrada</p></div>
      ) : (
        <div className={styles.habLista}>
          {filtradas.map(h => {
            const uso = usoMap[h.id] || 0
            return (
              <div key={h.id} className={`${styles.habCard} ${!h.ativo ? styles.inativo : ''}`}>
                <div className={styles.habTopo}>
                  <span className={styles.habCodigo} style={{ background: (h.disciplinas?.cor || '#64748b') + '22', color: h.disciplinas?.cor || '#64748b' }}>
                    {h.codigo}
                  </span>
                  {h.disciplinas?.nome && <span className={styles.habDisc}>{h.disciplinas.nome}</span>}
                  {h.ano_escolar && <span className={styles.habAno}>{h.ano_escolar}</span>}
                  {!h.ativo && <span className={styles.inativoBadge}>inativa</span>}
                  <span className={styles.habUso}>{uso} questão(ões)</span>
                  {podeEditar && (
                    <div className={styles.habAcoes}>
                      <button className={styles.iconBtn} onClick={() => setModal(h)} title="Editar"><Pencil size={13} /></button>
                      <button className={`${styles.iconBtn} ${styles.btnDangerIcon}`} onClick={() => setConfirmDelete(h)} title="Excluir"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                <p className={styles.habDescricao}>{h.descricao}</p>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <HabilidadeModal
          habilidade={modal.id ? modal : null}
          disciplinas={disciplinas}
          discPadrao={filtroDisc}
          anoPadrao={filtroAno}
          onClose={() => setModal(null)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['matriz'] }); setModal(null) }}
        />
      )}

      {confirmDelete && (
        <ConfirmBox
          titulo="Excluir habilidade?"
          desc={<>"<strong>{confirmDelete.codigo}</strong>" será removida.{(usoMap[confirmDelete.id] || 0) > 0 && ` Está vinculada a ${usoMap[confirmDelete.id]} questão(ões).`}</>}
          loading={excluir.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => excluir.mutate(confirmDelete.id)}
        />
      )}
    </>
  )
}

function HabilidadeModal({ habilidade, disciplinas, discPadrao, anoPadrao, onClose, onSaved }) {
  const isEdicao = !!habilidade
  const [form, setForm] = useState({
    disciplina_id: habilidade?.disciplina_id ?? discPadrao ?? '',
    codigo: habilidade?.codigo ?? '',
    descricao: habilidade?.descricao ?? '',
    ano_escolar: habilidade?.ano_escolar ?? anoPadrao ?? '',
    ativo: habilidade?.ativo ?? true,
  })

  const salvar = useMutation({
    mutationFn: () => {
      if (!form.disciplina_id) throw new Error('Selecione a disciplina')
      if (!form.codigo.trim()) throw new Error('Código é obrigatório')
      if (!form.descricao.trim()) throw new Error('Descrição é obrigatória')
      const dados = {
        disciplina_id: form.disciplina_id,
        codigo: form.codigo.trim(),
        descricao: form.descricao.trim(),
        ano_escolar: form.ano_escolar || null,
        ativo: form.ativo,
      }
      return isEdicao ? atualizarHabilidade(habilidade.id, dados) : criarHabilidade(dados)
    },
    onSuccess: () => { toast.success(isEdicao ? 'Habilidade atualizada!' : 'Habilidade criada!'); onSaved() },
    onError: (err) => toast.error(err.message),
  })

  const set = (c, v) => setForm(p => ({ ...p, [c]: v }))

  return (
    <Modal titulo={isEdicao ? 'Editar habilidade' : 'Nova habilidade'} onClose={onClose}
      onSave={() => salvar.mutate()} saving={salvar.isPending} isEdicao={isEdicao}>
      <div className={styles.linha2}>
        <div className={styles.campo}>
          <label className={styles.label}>Disciplina <span className={styles.req}>*</span></label>
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
        <label className={styles.label}>Código <span className={styles.req}>*</span></label>
        <input className={styles.input} value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="Ex: EF05MA01" />
      </div>
      <div className={styles.campo}>
        <label className={styles.label}>Descrição <span className={styles.req}>*</span></label>
        <textarea className={styles.textarea} rows={4} value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Descrição da habilidade conforme a BNCC ou o currículo municipal" />
      </div>
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
        Habilidade ativa (aparece nos formulários)
      </label>
    </Modal>
  )
}

/* ───────────────────────── COMPARTILHADOS ───────────────────────── */

function Modal({ titulo, children, onClose, onSave, saving, isEdicao }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitulo}>{titulo}</h2>
          <button className={styles.btnClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        <div className={styles.modalBotoes}>
          <button className={styles.btnCancel} onClick={onClose}>Cancelar</button>
          <button className={styles.btnConfirm} onClick={onSave} disabled={saving}>
            {saving ? 'Salvando...' : isEdicao ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmBox({ titulo, desc, loading, onCancel, onConfirm }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.confirmBox}>
        <p className={styles.confirmTitulo}>{titulo}</p>
        <p className={styles.confirmDesc}>{desc}</p>
        <div className={styles.confirmBotoes}>
          <button className={styles.btnCancel} onClick={onCancel}>Cancelar</button>
          <button className={styles.btnDanger} onClick={onConfirm} disabled={loading}>
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}
