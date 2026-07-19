import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listarVendas, statusVenda, precoFmt } from '../../services/pagamentos'
import { listarDisciplinas } from '../../services/questoes'
import { listarTurmas } from '../../services/turmas'
import { TrendingUp, Search, Download, DollarSign, ShoppingCart, Receipt, Clock } from 'lucide-react'
import styles from './Vendas.module.css'

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
const mesLabel = (chave) => {
  const [a, m] = chave.split('-')
  return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

const PERIODOS = [
  { v: '30', label: '30 dias' },
  { v: '90', label: '90 dias' },
  { v: '365', label: '12 meses' },
  { v: 'tudo', label: 'Tudo' },
]

export default function Vendas() {
  const { data: vendas = [], isLoading } = useQuery({ queryKey: ['vendas'], queryFn: listarVendas })
  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: listarDisciplinas })
  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: listarTurmas })

  const [periodo, setPeriodo] = useState('30')
  const [fStatus, setFStatus] = useState('')
  const [fTurma, setFTurma] = useState('')
  const [busca, setBusca] = useState('')

  const discNome = useMemo(() => new Map(disciplinas.map(d => [d.id, d.nome])), [disciplinas])
  const conteudoDe = (v) => v.tipo === 'completo'
    ? 'Turma completa'
    : (v.disciplina_ids || []).map(id => discNome.get(id) || '—').join(', ') || 'Disciplina'

  const filtradas = useMemo(() => {
    const cutoff = periodo === 'tudo' ? 0 : Date.now() - Number(periodo) * 864e5
    const q = busca.trim().toLowerCase()
    return vendas.filter(v => {
      if (periodo !== 'tudo' && new Date(v.criado_em).getTime() < cutoff) return false
      if (fStatus && statusVenda(v.status).tone !== fStatus) return false
      if (fTurma && v.turma_id !== fTurma) return false
      if (q && !`${v.aluno?.nome || ''} ${v.aluno?.email || ''} ${v.turmas?.nome || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [vendas, periodo, fStatus, fTurma, busca])

  const resumo = useMemo(() => {
    const aprovadas = filtradas.filter(v => v.status === 'approved')
    const receita = aprovadas.reduce((s, v) => s + (Number(v.valor) || 0), 0)
    const pendentes = filtradas.filter(v => statusVenda(v.status).tone === 'pend')
    return {
      receita,
      qtdAprovadas: aprovadas.length,
      ticket: aprovadas.length ? receita / aprovadas.length : 0,
      qtdPendentes: pendentes.length,
      valorPendente: pendentes.reduce((s, v) => s + (Number(v.valor) || 0), 0),
    }
  }, [filtradas])

  // Receita aprovada por mês (para o gráfico) — respeita os filtros atuais.
  const porMes = useMemo(() => {
    const mapa = new Map()
    for (const v of filtradas) {
      if (v.status !== 'approved') continue
      const d = new Date(v.criado_em)
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      mapa.set(chave, (mapa.get(chave) || 0) + (Number(v.valor) || 0))
    }
    const arr = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const max = Math.max(1, ...arr.map(([, val]) => val))
    return { arr, max }
  }, [filtradas])

  function exportarCSV() {
    const cab = ['Data', 'Aluno', 'Email', 'Turma', 'Conteúdo', 'Plano', 'Valor', 'Status']
    const linhas = filtradas.map(v => [
      fmtData(v.criado_em), v.aluno?.nome || '', v.aluno?.email || '',
      v.turmas?.nome || '', conteudoDe(v), v.plano || '',
      String(Number(v.valor) || 0).replace('.', ','), statusVenda(v.status).label,
    ])
    const csv = [cab, ...linhas]
      .map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'vendas.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}><TrendingUp size={20} /> Relatório de Vendas</h1>
          <p className={styles.subtitulo}>Pagamentos de acesso às turmas e disciplinas via Mercado Pago.</p>
        </div>
        <button className={styles.btnExport} onClick={exportarCSV} disabled={filtradas.length === 0}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* Cartões de resumo */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardIcon} style={{ background: 'rgba(21,128,61,.12)', color: '#15803d' }}><DollarSign size={18} /></span>
          <div><span className={styles.cardValor}>{money(resumo.receita)}</span><span className={styles.cardLabel}>Receita aprovada</span></div>
        </div>
        <div className={styles.card}>
          <span className={styles.cardIcon} style={{ background: 'rgba(79,70,229,.12)', color: 'var(--color-primary)' }}><ShoppingCart size={18} /></span>
          <div><span className={styles.cardValor}>{resumo.qtdAprovadas}</span><span className={styles.cardLabel}>Vendas aprovadas</span></div>
        </div>
        <div className={styles.card}>
          <span className={styles.cardIcon} style={{ background: 'rgba(180,131,9,.12)', color: '#b45309' }}><Receipt size={18} /></span>
          <div><span className={styles.cardValor}>{money(resumo.ticket)}</span><span className={styles.cardLabel}>Ticket médio</span></div>
        </div>
        <div className={styles.card}>
          <span className={styles.cardIcon} style={{ background: 'rgba(120,120,130,.12)', color: 'var(--text-secondary)' }}><Clock size={18} /></span>
          <div><span className={styles.cardValor}>{resumo.qtdPendentes}</span><span className={styles.cardLabel}>Pendentes ({money(resumo.valorPendente)})</span></div>
        </div>
      </div>

      {/* Gráfico de receita por mês */}
      {porMes.arr.length > 0 && (
        <div className={styles.grafico}>
          <span className={styles.graficoTitulo}>Receita aprovada por mês</span>
          <div className={styles.barras}>
            {porMes.arr.map(([chave, val]) => (
              <div key={chave} className={styles.barraCol} title={money(val)}>
                <span className={styles.barraValor}>{money(val)}</span>
                <div className={styles.barra} style={{ height: `${Math.max(4, (val / porMes.max) * 100)}%` }} />
                <span className={styles.barraMes}>{mesLabel(chave)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className={styles.filtros}>
        <div className={styles.periodos}>
          {PERIODOS.map(p => (
            <button key={p.v} className={`${styles.chipPeriodo} ${periodo === p.v ? styles.chipAtivo : ''}`}
              onClick={() => setPeriodo(p.v)}>{p.label}</button>
          ))}
        </div>
        <div className={styles.buscaBox}><Search size={13} />
          <input className={styles.buscaInput} placeholder="Buscar aluno ou turma…" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className={styles.sel} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Status (todos)</option>
          <option value="ok">Aprovado</option>
          <option value="pend">Pendente</option>
          <option value="err">Recusado</option>
          <option value="neutral">Estornado</option>
        </select>
        <select className={styles.sel} value={fTurma} onChange={e => setFTurma(e.target.value)}>
          <option value="">Turma (todas)</option>
          {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>

      {/* Tabela */}
      {isLoading ? <div className={styles.vazio}>Carregando…</div> :
        filtradas.length === 0 ? <div className={styles.vazio}><p>Nenhuma venda com esses filtros.</p></div> : (
          <div className={styles.tabelaScroll}>
            <table className={styles.tabela}>
              <thead><tr><th>Data</th><th>Aluno</th><th>Turma</th><th>Conteúdo</th><th>Plano</th><th className={styles.tdR}>Valor</th><th>Status</th></tr></thead>
              <tbody>
                {filtradas.map(v => {
                  const st = statusVenda(v.status)
                  return (
                    <tr key={v.id}>
                      <td className={styles.tdData}>{fmtData(v.criado_em)}</td>
                      <td><strong>{v.aluno?.nome || '—'}</strong><br /><span className={styles.tdEmail}>{v.aluno?.email}</span></td>
                      <td>{v.turmas?.nome || '—'}</td>
                      <td>{conteudoDe(v)}</td>
                      <td>{v.plano === 'mensal' ? 'Mensal' : v.plano === 'vitalicio' ? 'Vitalício' : '—'}</td>
                      <td className={styles.tdR}>{precoFmt(v.valor) || '—'}</td>
                      <td><span className={`${styles.chip} ${styles['chip_' + st.tone]}`}>{st.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
