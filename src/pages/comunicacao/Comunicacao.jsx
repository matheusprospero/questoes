import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { listarEmails, listarAlunosComEmail, enviarEmailManual, CATEGORIAS } from '../../services/comunicacao'
import {
  Mail, Send, Search, X, Check, Clock, AlertTriangle, Users, ChevronDown, ChevronUp,
} from 'lucide-react'
import styles from './Comunicacao.module.css'

const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

const VARIAVEIS = [
  { tag: '{nome}', desc: 'primeiro nome do aluno' },
  { tag: '{nome_completo}', desc: 'nome completo' },
]

// ── Modal "Novo e-mail" ───────────────────────────────────────
function ModalNovoEmail({ alunos, onFechar }) {
  const qc = useQueryClient()
  const [sel, setSel] = useState(new Set())
  const [busca, setBusca] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')

  const filtrados = useMemo(() => {
    const t = busca.toLowerCase()
    return alunos.filter(a => !t || (a.nome || '').toLowerCase().includes(t) || (a.email || '').toLowerCase().includes(t))
  }, [alunos, busca])

  const todosMarcados = filtrados.length > 0 && filtrados.every(a => sel.has(a.id))
  function toggleTodos() {
    setSel(prev => {
      const n = new Set(prev)
      if (todosMarcados) filtrados.forEach(a => n.delete(a.id))
      else filtrados.forEach(a => n.add(a.id))
      return n
    })
  }
  function toggle(id) {
    setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const destinatarios = alunos.filter(a => sel.has(a.id))
  const exemplo = destinatarios[0] || { nome: 'Maria da Silva' }

  const enviar = useMutation({
    mutationFn: () => enviarEmailManual({ alunos: destinatarios, assunto: assunto.trim(), corpo: corpo.trim() }),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['comunicacao-emails'] })
      toast.success(`${n} e-mail(s) na fila — saem em até 10 min.`)
      onFechar()
    },
    onError: (e) => toast.error('Erro ao enfileirar: ' + e.message),
  })

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTopo}>
          <p className={styles.modalTitulo}><Send size={16} /> Novo e-mail para alunos</p>
          <button className={styles.iconBtn} onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className={styles.modalCorpo}>
          <div className={styles.destinatarios}>
            <div className={styles.destTopo}>
              <span className={styles.campoLabel}><Users size={13} /> Destinatários ({sel.size} de {alunos.length})</span>
              <button type="button" className={styles.linkBtn} onClick={toggleTodos}>
                {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>
            <div className={styles.buscaBox}>
              <Search size={13} />
              <input className={styles.buscaInput} placeholder="Buscar aluno…" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <div className={styles.destLista}>
              {filtrados.map(a => (
                <label key={a.id} className={styles.destItem}>
                  <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} />
                  <span className={styles.destNome}>{a.nome || '(sem nome)'}</span>
                  <span className={styles.destEmail}>{a.email}</span>
                </label>
              ))}
              {filtrados.length === 0 && <p className={styles.semDados}>Nenhum aluno encontrado.</p>}
            </div>
          </div>

          <label className={styles.campo}>
            <span className={styles.campoLabel}>Assunto</span>
            <input className={styles.input} value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Ex.: Aula ao vivo neste sábado!" />
          </label>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Mensagem</span>
            <textarea className={styles.textarea} rows={8} value={corpo} onChange={e => setCorpo(e.target.value)}
              placeholder={'Olá {nome}!\n\nEscreva aqui o seu aviso…'} />
          </label>

          <div className={styles.variaveis}>
            {VARIAVEIS.map(v => (
              <button key={v.tag} type="button" className={styles.varChip} title={v.desc}
                onClick={() => setCorpo(c => c + v.tag)}>
                {v.tag}
              </button>
            ))}
            <span className={styles.varDica}>As variáveis são trocadas pelo nome de cada aluno.</span>
          </div>

          {assunto.trim() && corpo.trim() && (
            <div className={styles.previa}>
              <span className={styles.campoLabel}>Prévia ({exemplo.nome ? `para ${exemplo.nome.split(' ')[0]}` : 'exemplo'}):</span>
              <div className={styles.previaBox}>
                <p className={styles.previaAssunto}>{assunto.replaceAll('{nome}', (exemplo.nome || 'aluno(a)').split(' ')[0]).replaceAll('{nome_completo}', exemplo.nome || 'aluno(a)')}</p>
                <pre className={styles.previaCorpo}>{corpo.replaceAll('{nome}', (exemplo.nome || 'aluno(a)').split(' ')[0]).replaceAll('{nome_completo}', exemplo.nome || 'aluno(a)')}</pre>
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalRodape}>
          <span className={styles.rodapeInfo}>Envio pelo Gmail em até 10 min (Apps Script).</span>
          <div className={styles.modalBotoes}>
            <button className={styles.btnGhost} onClick={onFechar}>Cancelar</button>
            <button className={styles.btnPrimary}
              disabled={enviar.isPending || sel.size === 0 || !assunto.trim() || !corpo.trim()}
              onClick={() => {
                if (window.confirm(`Enfileirar este e-mail para ${sel.size} aluno(s)?`)) enviar.mutate()
              }}>
              <Send size={14} /> {enviar.isPending ? 'Enfileirando…' : `Enviar para ${sel.size} aluno(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────
export default function Comunicacao() {
  const [fAluno, setFAluno] = useState('')
  const [fCategoria, setFCategoria] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [modalNovo, setModalNovo] = useState(false)
  const [expandido, setExpandido] = useState(null)

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['comunicacao-emails'],
    queryFn: () => listarEmails(),
  })
  const { data: alunos = [] } = useQuery({
    queryKey: ['comunicacao-alunos'],
    queryFn: listarAlunosComEmail,
  })

  const nomePorEmail = useMemo(() => new Map(alunos.map(a => [a.email, a.nome])), [alunos])

  const filtrados = useMemo(() => emails.filter(e => {
    if (fAluno && e.para !== fAluno) return false
    if (fCategoria && (e.categoria || 'report') !== fCategoria) return false
    if (fStatus && e.status !== fStatus) return false
    const t = busca.toLowerCase()
    if (t && !(`${e.para} ${e.assunto} ${e.corpo}`.toLowerCase().includes(t))) return false
    return true
  }), [emails, fAluno, fCategoria, fStatus, busca])

  const stats = useMemo(() => {
    const seteDias = Date.now() - 7 * 86400000
    return {
      total: emails.length,
      enviados: emails.filter(e => e.status === 'enviado').length,
      pendentes: emails.filter(e => e.status === 'pendente').length,
      erros: emails.filter(e => e.status === 'erro').length,
      semana: emails.filter(e => new Date(e.criado_em).getTime() >= seteDias).length,
    }
  }, [emails])

  const temFiltro = fAluno || fCategoria || fStatus || busca

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}><Mail size={20} /> Comunicação</h1>
          <p className={styles.subtitulo}>Todos os e-mails enviados aos alunos, num lugar só</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setModalNovo(true)}>
          <Send size={14} /> Novo e-mail
        </button>
      </div>

      <div className={styles.cards}>
        <div className={styles.cardStat}><span className={styles.statValor}>{stats.total}</span><span className={styles.statLabel}>No histórico</span></div>
        <div className={styles.cardStat}><span className={`${styles.statValor} ${styles.ok}`}>{stats.enviados}</span><span className={styles.statLabel}>Enviados</span></div>
        <div className={styles.cardStat}><span className={`${styles.statValor} ${styles.pend}`}>{stats.pendentes}</span><span className={styles.statLabel}>Na fila</span></div>
        <div className={styles.cardStat}><span className={`${styles.statValor} ${styles.err}`}>{stats.erros}</span><span className={styles.statLabel}>Com erro</span></div>
        <div className={styles.cardStat}><span className={styles.statValor}>{stats.semana}</span><span className={styles.statLabel}>Últimos 7 dias</span></div>
      </div>

      <div className={styles.filtros}>
        <div className={styles.buscaBox}>
          <Search size={13} />
          <input className={styles.buscaInput} placeholder="Buscar por assunto, texto ou e-mail…" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className={styles.filtroSel} value={fAluno} onChange={e => setFAluno(e.target.value)}>
          <option value="">Aluno (todos)</option>
          {alunos.map(a => <option key={a.id} value={a.email}>{a.nome || a.email}</option>)}
        </select>
        <select className={styles.filtroSel} value={fCategoria} onChange={e => setFCategoria(e.target.value)}>
          <option value="">Tipo (todos)</option>
          {Object.entries(CATEGORIAS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
        <select className={styles.filtroSel} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Status (todos)</option>
          <option value="enviado">Enviado</option>
          <option value="pendente">Na fila</option>
          <option value="erro">Erro</option>
        </select>
        {temFiltro && (
          <button className={styles.filtroLimpar} onClick={() => { setFAluno(''); setFCategoria(''); setFStatus(''); setBusca('') }}>
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className={styles.vazio}>Carregando histórico…</div>
      ) : filtrados.length === 0 ? (
        <div className={styles.vazio}>
          <Mail size={32} strokeWidth={1.5} />
          <p>{emails.length === 0 ? 'Nenhum e-mail no histórico ainda.' : 'Nada com esses filtros.'}</p>
        </div>
      ) : (
        <div className={styles.lista}>
          {filtrados.map(e => {
            const cat = CATEGORIAS[e.categoria || 'report'] || CATEGORIAS.report
            const aberto = expandido === e.id
            return (
              <div key={e.id} className={styles.item}>
                <button className={styles.itemTopo} onClick={() => setExpandido(aberto ? null : e.id)}>
                  <span className={styles.itemData}>{fmt(e.criado_em)}</span>
                  <span className={styles.itemPara}>
                    <strong>{nomePorEmail.get(e.para) || e.para}</strong>
                    {nomePorEmail.get(e.para) && <span className={styles.itemEmail}>{e.para}</span>}
                  </span>
                  <span className={styles.itemAssunto}>{e.assunto}</span>
                  <span className={styles.chipCat} style={{ color: cat.cor, borderColor: cat.cor }}>{cat.label}</span>
                  {e.status === 'enviado' && <span className={styles.chipOk}><Check size={11} /> enviado</span>}
                  {e.status === 'pendente' && <span className={styles.chipPend}><Clock size={11} /> na fila</span>}
                  {e.status === 'erro' && <span className={styles.chipErr}><AlertTriangle size={11} /> erro</span>}
                  {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {aberto && (
                  <div className={styles.itemCorpo}>
                    <pre className={styles.corpoTexto}>{e.corpo}</pre>
                    <div className={styles.itemMeta}>
                      {e.enviado_em && <span>Enviado em {fmt(e.enviado_em)}</span>}
                      {e.erro && <span className={styles.erroTexto}>Erro: {e.erro}</span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalNovo && <ModalNovoEmail alunos={alunos} onFechar={() => setModalNovo(false)} />}
    </div>
  )
}
