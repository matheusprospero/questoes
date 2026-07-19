import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarTurmas, criarTurma, atualizarTurma, excluirTurma, definirDisciplinas,
  listarMatriculas, matricular, decidirMatricula, removerMatricula, disciplinasDaTurma, precosDaTurma,
  atualizarPeriodoMatricula,
} from '../../services/turmas'
import { listarDisciplinas } from '../../services/questoes'
import { listarAlunosComEmail } from '../../services/comunicacao'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap, Plus, Pencil, Trash2, Check, X, Users, Search,
  UserPlus, Power, Clock, Eye, CalendarClock,
} from 'lucide-react'
import styles from './CentralMatriculas.module.css'

const fmt = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

// ISO → 'AAAA-MM-DD' no fuso local (para <input type="date">)
const toDateInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
// Texto do período de acesso de uma matrícula
function acessoLabel(m) {
  if (!m.acesso_ate) return { txt: 'Vitalício', tone: 'vital' }
  const fim = new Date(m.acesso_ate)
  const expirado = fim.getTime() <= Date.now()
  const ini = m.acesso_desde ? fmt(m.acesso_desde) + ' → ' : 'até '
  return { txt: ini + fmt(m.acesso_ate), tone: expirado ? 'exp' : 'ok' }
}

// número de um input de preço: '' → null, senão Number (aceita vírgula)
const numOuNull = (v) => {
  if (v == null || String(v).trim() === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}
const paraCampo = (v) => (v == null ? '' : String(v))

// ── Modal criar/editar turma ──────────────────────────────────
function ModalTurma({ turma, disciplinas, onFechar, onSalvar, salvando }) {
  const [nome, setNome] = useState(turma?.nome || '')
  const [descricao, setDescricao] = useState(turma?.descricao || '')
  const [sel, setSel] = useState(() => new Set(disciplinasDaTurma(turma).map(d => d.id)))
  // preços do "conteúdo completo" (turma inteira)
  const [compMensal, setCompMensal] = useState(paraCampo(turma?.preco_mensal))
  const [compVital, setCompVital] = useState(paraCampo(turma?.preco_vitalicio))
  // preços por disciplina avulsa: { [id]: { mensal, vitalicio } }
  const [precos, setPrecos] = useState(() => {
    const base = {}
    const mapa = precosDaTurma(turma)
    for (const [id, p] of mapa) base[id] = { mensal: paraCampo(p.preco_mensal), vitalicio: paraCampo(p.preco_vitalicio) }
    return base
  })
  const toggle = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const setPreco = (id, campo, v) => setPrecos(p => ({ ...p, [id]: { ...p[id], [campo]: v } }))

  const salvar = () => {
    const dados = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      preco_mensal: numOuNull(compMensal),
      preco_vitalicio: numOuNull(compVital),
    }
    const linhas = [...sel].map(id => ({
      disciplina_id: id,
      preco_mensal: numOuNull(precos[id]?.mensal),
      preco_vitalicio: numOuNull(precos[id]?.vitalicio),
    }))
    onSalvar(dados, linhas)
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTopo}>
          <p className={styles.modalTitulo}><GraduationCap size={16} /> {turma ? 'Editar turma' : 'Nova turma'}</p>
          <button className={styles.iconBtn} onClick={onFechar}><X size={18} /></button>
        </div>
        <div className={styles.modalCorpo}>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Nome da turma</span>
            <input className={styles.input} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Turma TJSP 2026" />
          </label>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Descrição (opcional)</span>
            <input className={styles.input} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </label>

          <div className={styles.campo}>
            <span className={styles.campoLabel}>Preço do conteúdo completo (todas as disciplinas)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <PrecoInput label="Mensal" value={compMensal} onChange={setCompMensal} />
              <PrecoInput label="Vitalício" value={compVital} onChange={setCompVital} />
            </div>
            <span className={styles.dica} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Deixe em branco o plano que você não quiser vender.
            </span>
          </div>

          <div className={styles.campo}>
            <span className={styles.campoLabel}>Disciplinas da turma e preço avulso</span>
            <div className={styles.checkGrid}>
              {disciplinas.map(d => (
                <div key={d.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className={styles.checkItem}>
                    <input type="checkbox" checked={sel.has(d.id)} onChange={() => toggle(d.id)} />
                    <span className={styles.dot} style={{ background: d.cor || 'var(--color-primary)' }} />
                    {d.nome}
                  </label>
                  {sel.has(d.id) && (
                    <div style={{ display: 'flex', gap: 8, paddingLeft: 24 }}>
                      <PrecoInput label="Mensal" value={precos[d.id]?.mensal || ''} onChange={v => setPreco(d.id, 'mensal', v)} />
                      <PrecoInput label="Vitalício" value={precos[d.id]?.vitalicio || ''} onChange={v => setPreco(d.id, 'vitalicio', v)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.modalRodape}>
          <button className={styles.btnGhost} onClick={onFechar}>Cancelar</button>
          <button className={styles.btnPrimary} disabled={salvando || !nome.trim()} onClick={salvar}>
            <Check size={14} /> {salvando ? 'Salvando…' : 'Salvar turma'}
          </button>
        </div>
      </div>
    </div>
  )
}

// input de preço compacto (R$)
function PrecoInput({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>R$</span>
        <input className={styles.input} inputMode="decimal" placeholder="—"
          value={value} onChange={e => onChange(e.target.value)} style={{ padding: '6px 8px' }} />
      </div>
    </label>
  )
}

// ── Modal matricular alunos ───────────────────────────────────
function ModalMatricular({ turmas, turmaInicial, alunos, onFechar, onConfirmar, salvando }) {
  const [turmaId, setTurmaId] = useState(turmaInicial || turmas[0]?.id || '')
  const turma = turmas.find(t => t.id === turmaId)
  const discs = disciplinasDaTurma(turma)
  const [selDisc, setSelDisc] = useState(() => new Set(discs.map(d => d.id)))
  const [selAlunos, setSelAlunos] = useState(new Set())
  const [busca, setBusca] = useState('')

  // ao trocar de turma, remarca todas as disciplinas dela
  function trocarTurma(id) {
    setTurmaId(id)
    const t = turmas.find(x => x.id === id)
    setSelDisc(new Set(disciplinasDaTurma(t).map(d => d.id)))
  }
  const filtrados = alunos.filter(a => {
    const t = busca.toLowerCase()
    return !t || (a.nome || '').toLowerCase().includes(t) || (a.email || '').toLowerCase().includes(t)
  })
  const toggleAluno = (id) => setSelAlunos(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleDisc = (id) => setSelDisc(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTopo}>
          <p className={styles.modalTitulo}><UserPlus size={16} /> Matricular alunos</p>
          <button className={styles.iconBtn} onClick={onFechar}><X size={18} /></button>
        </div>
        <div className={styles.modalCorpo}>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Turma</span>
            <select className={styles.input} value={turmaId} onChange={e => trocarTurma(e.target.value)}>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
          <div className={styles.campo}>
            <span className={styles.campoLabel}>Disciplinas a liberar</span>
            {discs.length === 0 ? <p className={styles.semDados}>Esta turma ainda não tem disciplinas. Edite a turma primeiro.</p> : (
              <div className={styles.checkGrid}>
                {discs.map(d => (
                  <label key={d.id} className={styles.checkItem}>
                    <input type="checkbox" checked={selDisc.has(d.id)} onChange={() => toggleDisc(d.id)} />
                    <span className={styles.dot} style={{ background: d.cor || 'var(--color-primary)' }} />{d.nome}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className={styles.campo}>
            <span className={styles.campoLabel}><Users size={13} /> Alunos ({selAlunos.size} selecionado{selAlunos.size === 1 ? '' : 's'})</span>
            <div className={styles.buscaBox}><Search size={13} />
              <input className={styles.buscaInput} placeholder="Buscar aluno…" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <div className={styles.alunoLista}>
              {filtrados.map(a => (
                <label key={a.id} className={styles.alunoItem}>
                  <input type="checkbox" checked={selAlunos.has(a.id)} onChange={() => toggleAluno(a.id)} />
                  <span className={styles.alunoNome}>{a.nome || '(sem nome)'}</span>
                  <span className={styles.alunoEmail}>{a.email}</span>
                </label>
              ))}
              {filtrados.length === 0 && <p className={styles.semDados}>Nenhum aluno.</p>}
            </div>
          </div>
        </div>
        <div className={styles.modalRodape}>
          <button className={styles.btnGhost} onClick={onFechar}>Cancelar</button>
          <button className={styles.btnPrimary}
            disabled={salvando || selAlunos.size === 0 || selDisc.size === 0}
            onClick={() => onConfirmar(turmaId, [...selAlunos], [...selDisc])}>
            <Check size={14} /> {salvando ? 'Matriculando…' : `Matricular ${selAlunos.size} aluno(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal editar período de acesso ────────────────────────────
function ModalPeriodo({ matricula, onFechar, onSalvar, salvando }) {
  const [desde, setDesde] = useState(toDateInput(matricula.acesso_desde))
  const [ate, setAte] = useState(toDateInput(matricula.acesso_ate))

  const salvar = () => onSalvar(matricula.id, {
    acesso_desde: desde ? `${desde}T00:00:00` : null,
    acesso_ate: ate ? `${ate}T23:59:59` : null,
  })

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTopo}>
          <p className={styles.modalTitulo}><CalendarClock size={16} /> Período de acesso</p>
          <button className={styles.iconBtn} onClick={onFechar}><X size={18} /></button>
        </div>
        <div className={styles.modalCorpo}>
          <p className={styles.semDados} style={{ margin: 0 }}>
            {matricula.aluno?.nome || matricula.aluno?.email} · {matricula.turmas?.nome} · {matricula.disciplinas?.nome}
          </p>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Início do acesso</span>
            <input type="date" className={styles.input} value={desde} onChange={e => setDesde(e.target.value)} />
            <span className={styles.dica} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Em branco = vale desde já.</span>
          </label>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Fim do acesso (vencimento)</span>
            <input type="date" className={styles.input} value={ate} onChange={e => setAte(e.target.value)} />
            <span className={styles.dica} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Em branco = sem vencimento (vitalício).</span>
          </label>
        </div>
        <div className={styles.modalRodape}>
          <button className={styles.btnGhost} onClick={onFechar}>Cancelar</button>
          <button className={styles.btnPrimary} disabled={salvando} onClick={salvar}>
            <Check size={14} /> {salvando ? 'Salvando…' : 'Salvar período'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────
export default function CentralMatriculas() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [modalTurma, setModalTurma] = useState(null)     // {turma}|{novo:true}
  const [modalMatricular, setModalMatricular] = useState(null) // turmaId|true
  const [modalPeriodo, setModalPeriodo] = useState(null) // matricula
  const [fTurma, setFTurma] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [busca, setBusca] = useState('')

  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: listarTurmas })
  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: listarDisciplinas })
  const { data: alunos = [] } = useQuery({ queryKey: ['comunicacao-alunos'], queryFn: listarAlunosComEmail })
  const { data: matriculas = [], isLoading } = useQuery({ queryKey: ['matriculas'], queryFn: () => listarMatriculas() })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['matriculas'] })
    qc.invalidateQueries({ queryKey: ['matriculas-pendentes'] })
    qc.invalidateQueries({ queryKey: ['turmas'] })
  }

  const mCriarTurma = useMutation({
    mutationFn: async ({ dados, linhas }) => {
      const t = await criarTurma(dados)
      await definirDisciplinas(t.id, linhas)
    },
    onSuccess: () => { invalidar(); setModalTurma(null); toast.success('Turma criada!') },
    onError: (e) => toast.error('Erro: ' + e.message),
  })
  const mEditarTurma = useMutation({
    mutationFn: async ({ id, dados, linhas }) => {
      await atualizarTurma(id, dados)
      await definirDisciplinas(id, linhas)
    },
    onSuccess: () => { invalidar(); setModalTurma(null); toast.success('Turma atualizada!') },
    onError: (e) => toast.error('Erro: ' + e.message),
  })
  const mAtiva = useMutation({
    mutationFn: ({ id, ativa }) => atualizarTurma(id, { ativa }),
    onSuccess: invalidar,
  })
  const mExcluir = useMutation({
    mutationFn: excluirTurma,
    onSuccess: () => { invalidar(); toast.success('Turma excluída.') },
    onError: (e) => toast.error('Erro: ' + e.message),
  })
  const mMatricular = useMutation({
    mutationFn: async ({ turmaId, alunoIds, discIds }) => {
      for (const a of alunoIds) await matricular(a, turmaId, discIds)
      return alunoIds.length
    },
    onSuccess: (n) => { invalidar(); setModalMatricular(null); toast.success(`${n} aluno(s) matriculado(s)!`) },
    onError: (e) => toast.error('Erro: ' + e.message),
  })
  const mDecidir = useMutation({
    mutationFn: ({ id, aprovar }) => decidirMatricula(id, aprovar),
    onSuccess: invalidar,
    onError: (e) => toast.error('Erro: ' + e.message),
  })
  const mRemover = useMutation({
    mutationFn: removerMatricula,
    onSuccess: () => { invalidar(); toast.success('Matrícula removida.') },
    onError: (e) => toast.error('Erro: ' + e.message),
  })
  const mPeriodo = useMutation({
    mutationFn: ({ id, periodo }) => atualizarPeriodoMatricula(id, periodo),
    onSuccess: () => { invalidar(); setModalPeriodo(null); toast.success('Período atualizado.') },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  const pendentes = useMemo(() => matriculas.filter(m => m.status === 'pendente'), [matriculas])
  const ativasPorTurma = useMemo(() => {
    const m = new Map()
    for (const mt of matriculas) if (mt.status === 'ativa') m.set(mt.turma_id, (m.get(mt.turma_id) || 0) + 1)
    return m
  }, [matriculas])

  const listaFiltrada = useMemo(() => matriculas.filter(m => {
    if (fTurma && m.turma_id !== fTurma) return false
    if (fStatus && m.status !== fStatus) return false
    const t = busca.toLowerCase()
    if (t && !`${m.aluno?.nome || ''} ${m.aluno?.email || ''}`.toLowerCase().includes(t)) return false
    return true
  }), [matriculas, fTurma, fStatus, busca])

  const chipStatus = (s) => s === 'ativa' ? styles.chipOk : s === 'pendente' ? styles.chipPend : styles.chipErr
  const labelStatus = (s) => s === 'ativa' ? 'Ativa' : s === 'pendente' ? 'Pendente' : 'Recusada'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}><GraduationCap size={20} /> Central de Matrículas</h1>
          <p className={styles.subtitulo}>Turmas, disciplinas e acesso dos alunos ao conteúdo</p>
        </div>
        <div className={styles.headerBtns}>
          <button className={styles.btnGhost} onClick={() => setModalMatricular(true)} disabled={turmas.length === 0}>
            <UserPlus size={14} /> Matricular
          </button>
          <button className={styles.btnPrimary} onClick={() => setModalTurma({ novo: true })}>
            <Plus size={14} /> Nova turma
          </button>
        </div>
      </div>

      {/* Solicitações pendentes */}
      {pendentes.length > 0 && (
        <div className={styles.pendBox}>
          <p className={styles.pendTitulo}><Clock size={15} /> Solicitações aguardando aprovação ({pendentes.length})</p>
          <div className={styles.pendLista}>
            {pendentes.map(m => (
              <div key={m.id} className={styles.pendItem}>
                <div className={styles.pendInfo}>
                  <strong>{m.aluno?.nome || m.aluno?.email || 'Aluno'}</strong>
                  <span>{m.turmas?.nome} · {m.disciplinas?.nome} · {fmt(m.criado_em)}</span>
                </div>
                <div className={styles.pendAcoes}>
                  <button className={styles.btnAprovar} onClick={() => mDecidir.mutate({ id: m.id, aprovar: true })}><Check size={13} /> Aprovar</button>
                  <button className={styles.btnRecusar} onClick={() => mDecidir.mutate({ id: m.id, aprovar: false })}><X size={13} /> Recusar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Turmas */}
      <h2 className={styles.secTitulo}>Turmas</h2>
      {turmas.length === 0 ? (
        <div className={styles.vazio}><GraduationCap size={30} strokeWidth={1.5} /><p>Nenhuma turma criada ainda.</p></div>
      ) : (
        <div className={styles.turmasGrid}>
          {turmas.map(t => {
            const discs = disciplinasDaTurma(t)
            return (
              <div key={t.id} className={`${styles.turmaCard} ${!t.ativa ? styles.turmaInativa : ''}`}>
                <div className={styles.turmaTopo}>
                  <span className={styles.turmaNome}>{t.nome}</span>
                  {!t.ativa && <span className={styles.badgeInativa}>Inativa</span>}
                </div>
                {t.descricao && <p className={styles.turmaDesc}>{t.descricao}</p>}
                <div className={styles.turmaDiscs}>
                  {discs.length === 0 ? <span className={styles.semDisc}>Sem disciplinas</span> :
                    discs.map(d => <span key={d.id} className={styles.discChip} style={{ borderColor: d.cor, color: d.cor }}>{d.nome}</span>)}
                </div>
                <div className={styles.turmaRodape}>
                  <span className={styles.turmaMat}><Users size={13} /> {ativasPorTurma.get(t.id) || 0} matriculados</span>
                  <div className={styles.turmaAcoes}>
                    <button className={styles.iconBtn} title="Ver conteúdo da turma" onClick={() => navigate(`/turmas/${t.id}`)}><Eye size={15} /></button>
                    <button className={styles.iconBtn} title="Matricular alunos" onClick={() => setModalMatricular(t.id)}><UserPlus size={15} /></button>
                    <button className={styles.iconBtn} title="Editar" onClick={() => setModalTurma({ turma: t })}><Pencil size={15} /></button>
                    <button className={styles.iconBtn} title={t.ativa ? 'Desativar' : 'Ativar'} onClick={() => mAtiva.mutate({ id: t.id, ativa: !t.ativa })}><Power size={15} /></button>
                    <button className={styles.iconBtn} title="Excluir" onClick={() => { if (window.confirm('Excluir esta turma? As matrículas dela serão apagadas.')) mExcluir.mutate(t.id) }}><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Matrículas */}
      <h2 className={styles.secTitulo}>Matrículas</h2>
      <div className={styles.filtros}>
        <div className={styles.buscaBox}><Search size={13} />
          <input className={styles.buscaInput} placeholder="Buscar aluno…" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className={styles.filtroSel} value={fTurma} onChange={e => setFTurma(e.target.value)}>
          <option value="">Turma (todas)</option>
          {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select className={styles.filtroSel} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Status (todos)</option>
          <option value="ativa">Ativa</option>
          <option value="pendente">Pendente</option>
          <option value="recusada">Recusada</option>
        </select>
      </div>

      {isLoading ? <div className={styles.vazio}>Carregando…</div> :
        listaFiltrada.length === 0 ? <div className={styles.vazio}><p>Nenhuma matrícula com esses filtros.</p></div> : (
          <div className={styles.tabelaScroll}>
            <table className={styles.tabela}>
              <thead><tr><th>Aluno</th><th>Turma</th><th>Disciplina</th><th>Status</th><th>Acesso</th><th>Data</th><th></th></tr></thead>
              <tbody>
                {listaFiltrada.map(m => {
                  const ac = acessoLabel(m)
                  return (
                  <tr key={m.id}>
                    <td><strong>{m.aluno?.nome || '—'}</strong><br /><span className={styles.tdEmail}>{m.aluno?.email}</span></td>
                    <td>{m.turmas?.nome}</td>
                    <td><span className={styles.discChip} style={{ borderColor: m.disciplinas?.cor, color: m.disciplinas?.cor }}>{m.disciplinas?.nome}</span></td>
                    <td><span className={chipStatus(m.status)}>{labelStatus(m.status)}</span></td>
                    <td className={styles.tdData}>
                      <span className={ac.tone === 'exp' ? styles.acessoExp : ac.tone === 'vital' ? styles.acessoVital : ''}>{ac.txt}</span>
                    </td>
                    <td className={styles.tdData}>{fmt(m.criado_em)}</td>
                    <td className={styles.tdAcoes}>
                      {m.status === 'recusada' && (
                        <button className={styles.linkAcao} onClick={() => mDecidir.mutate({ id: m.id, aprovar: true })}>Reativar</button>
                      )}
                      <button className={styles.iconBtn} title="Editar período de acesso" onClick={() => setModalPeriodo(m)}><CalendarClock size={14} /></button>
                      <button className={styles.iconBtn} title="Remover" onClick={() => mRemover.mutate(m.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}

      {modalTurma && (
        <ModalTurma
          turma={modalTurma.turma}
          disciplinas={disciplinas}
          salvando={mCriarTurma.isPending || mEditarTurma.isPending}
          onFechar={() => setModalTurma(null)}
          onSalvar={(dados, linhas) => modalTurma.turma
            ? mEditarTurma.mutate({ id: modalTurma.turma.id, dados, linhas })
            : mCriarTurma.mutate({ dados, linhas })}
        />
      )}
      {modalMatricular && (
        <ModalMatricular
          turmas={turmas.filter(t => t.ativa)}
          turmaInicial={typeof modalMatricular === 'string' ? modalMatricular : null}
          alunos={alunos}
          salvando={mMatricular.isPending}
          onFechar={() => setModalMatricular(null)}
          onConfirmar={(turmaId, alunoIds, discIds) => mMatricular.mutate({ turmaId, alunoIds, discIds })}
        />
      )}
      {modalPeriodo && (
        <ModalPeriodo
          matricula={modalPeriodo}
          salvando={mPeriodo.isPending}
          onFechar={() => setModalPeriodo(null)}
          onSalvar={(id, periodo) => mPeriodo.mutate({ id, periodo })}
        />
      )}
    </div>
  )
}
