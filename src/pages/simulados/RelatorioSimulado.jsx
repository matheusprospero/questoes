import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { relatorioSimulado } from '../../services/simulados'
import { resumoEnunciado } from '../../services/questoes'
import {
  ChevronLeft, Users, CheckCircle2, Target, ClipboardList,
  TrendingDown, TrendingUp, Download,
} from 'lucide-react'
import styles from './RelatorioSimulado.module.css'

export default function RelatorioSimulado() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: rel, isLoading, error } = useQuery({
    queryKey: ['relatorio-simulado', id],
    queryFn: () => relatorioSimulado(id),
  })

  function exportarCSV() {
    if (!rel) return
    const linhas = [['Aluno', 'E-mail', 'Respondidas', 'Total', 'Acertos', 'Taxa (%)', 'Concluiu']]
    for (const a of rel.porAluno) {
      linhas.push([a.nome, a.email, a.respondidas, rel.totalQuestoes, a.acertos, a.taxa, a.completou ? 'Sim' : 'Não'])
    }
    const csv = linhas.map(l => l.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-${(rel.simulado.titulo || 'simulado').replace(/[^\w]+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/simulados'))}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <h1 className={styles.titulo}>Relatório · {rel?.simulado.titulo ?? 'Simulado'}</h1>
        {rel?.participantes > 0 && (
          <button className={styles.btnExport} onClick={exportarCSV}>
            <Download size={14} /> Exportar CSV
          </button>
        )}
      </div>

      {isLoading ? (
        <div className={styles.loading}>Carregando relatório...</div>
      ) : error ? (
        <div className={styles.vazio}>Não foi possível carregar o relatório: {error.message}</div>
      ) : rel.participantes === 0 ? (
        <div className={styles.vazio}>
          <ClipboardList size={40} strokeWidth={1.5} />
          <p>Nenhum aluno respondeu este simulado online ainda.</p>
          <span className={styles.vazioHint}>
            O relatório considera as respostas feitas em “Resolver online”. Respostas anteriores
            à criação do relatório não são contabilizadas.
          </span>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <Users size={18} className={styles.kpiIcon} />
              <span className={styles.kpiValor}>{rel.participantes}</span>
              <span className={styles.kpiLabel}>Alunos que responderam</span>
            </div>
            <div className={styles.kpi}>
              <CheckCircle2 size={18} className={styles.kpiIcon} />
              <span className={styles.kpiValor}>{rel.concluintes}</span>
              <span className={styles.kpiLabel}>Concluíram todas as {rel.totalQuestoes}</span>
            </div>
            <div className={styles.kpi}>
              <Target size={18} className={styles.kpiIcon} />
              <span className={styles.kpiValor}>{rel.taxaAcertoGeral ?? '—'}%</span>
              <span className={styles.kpiLabel}>Taxa de acerto geral</span>
            </div>
            <div className={styles.kpi}>
              <ClipboardList size={18} className={styles.kpiIcon} />
              <span className={styles.kpiValor}>{rel.totalRespostas}</span>
              <span className={styles.kpiLabel}>Respostas ({rel.totalAcertos} acertos · {rel.totalErros} erros)</span>
            </div>
          </div>

          {/* Destaques */}
          <div className={styles.destaques}>
            <div className={styles.destaqueCard}>
              <h3 className={styles.destaqueTitulo}><TrendingDown size={15} /> Questões mais difíceis</h3>
              {rel.maisDificeis.length === 0 ? <p className={styles.semDado}>Sem dados.</p> : (
                <ul className={styles.destaqueLista}>
                  {rel.maisDificeis.map(q => (
                    <li key={q.id}>
                      <span className={`${styles.pill} ${styles.pillErro}`}>{q.taxaAcerto}%</span>
                      Q{q.numero} — {resumoEnunciado(q.enunciado, 60)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.destaqueCard}>
              <h3 className={styles.destaqueTitulo}><TrendingUp size={15} /> Questões mais fáceis</h3>
              {rel.maisFaceis.length === 0 ? <p className={styles.semDado}>Sem dados.</p> : (
                <ul className={styles.destaqueLista}>
                  {rel.maisFaceis.map(q => (
                    <li key={q.id}>
                      <span className={`${styles.pill} ${styles.pillOk}`}>{q.taxaAcerto}%</span>
                      Q{q.numero} — {resumoEnunciado(q.enunciado, 60)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Ranking de alunos */}
          <h2 className={styles.secaoTitulo}>Desempenho por aluno</h2>
          <div className={styles.tabelaWrap}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>#</th><th>Aluno</th><th>Respondidas</th><th>Acertos</th><th>Taxa</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rel.porAluno.map((a, i) => (
                  <tr key={a.id}>
                    <td className={styles.tdPos}>{i + 1}</td>
                    <td>
                      <div className={styles.alunoNome}>{a.nome}</div>
                      {a.email && <div className={styles.alunoEmail}>{a.email}</div>}
                    </td>
                    <td>{a.respondidas}/{rel.totalQuestoes}</td>
                    <td>{a.acertos}</td>
                    <td><span className={styles.taxaBadge} data-nivel={a.taxa >= 70 ? 'alto' : a.taxa >= 40 ? 'medio' : 'baixo'}>{a.taxa}%</span></td>
                    <td>{a.completou
                      ? <span className={styles.statusOk}>Concluído</span>
                      : <span className={styles.statusParcial}>Parcial</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Por questão */}
          <h2 className={styles.secaoTitulo}>Análise por questão</h2>
          <div className={styles.questoes}>
            {rel.porQuestao.map(q => {
              const letras = q.tipo === 'certo_errado'
                ? ['C', 'E']
                : q.alternativas.map(a => a.letra)
              const maxQtd = Math.max(1, ...letras.map(l => q.distribuicao[l] || 0))
              return (
                <div key={q.id} className={styles.qCard}>
                  <div className={styles.qHead}>
                    <span className={styles.qNum}>Q{q.numero}</span>
                    <span className={styles.qEnun}>{resumoEnunciado(q.enunciado, 130)}</span>
                    {q.disciplina && <span className={styles.qDisc}>{q.disciplina}</span>}
                  </div>
                  <div className={styles.qMeta}>
                    {q.total > 0 ? (
                      <>
                        <span>{q.total} respostas</span>
                        <span className={styles.qTaxa}>{q.taxaAcerto}% de acerto</span>
                        <span className={styles.qGab}>Gabarito: <strong>{q.letraCorreta ?? '—'}</strong></span>
                        {q.maisMarcada && (
                          <span>Mais marcada: <strong>{q.maisMarcada.letra}</strong> ({q.maisMarcada.qtd})</span>
                        )}
                      </>
                    ) : <span className={styles.semDado}>Ninguém respondeu ainda.</span>}
                  </div>
                  {q.total > 0 && (
                    <div className={styles.barras}>
                      {letras.map(l => {
                        const qtd = q.distribuicao[l] || 0
                        const pct = Math.round((qtd / q.total) * 100)
                        const correta = l === q.letraCorreta
                        return (
                          <div key={l} className={styles.barraRow}>
                            <span className={`${styles.barraLetra} ${correta ? styles.barraLetraOk : ''}`}>{l}</span>
                            <div className={styles.barraTrilho}>
                              <div
                                className={`${styles.barraFill} ${correta ? styles.barraFillOk : ''}`}
                                style={{ width: `${(qtd / maxQtd) * 100}%` }}
                              />
                            </div>
                            <span className={styles.barraVal}>{qtd} · {pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
