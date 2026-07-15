import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import {
  listarRespostas, estudoPorDia, somarPeriodo,
  calcularProntidao, maestriaPorAssunto, evolucaoMensal, agruparDesempenho,
  calcularMarcos, calcularOfensiva,
} from '../../services/estudo'
import {
  FileText, Printer, Target, CheckCircle2, CalendarDays, Clock,
  Gauge, Award, TrendingUp, AlertTriangle, Layers, ArrowUp, ArrowDown, Trophy, Lock,
} from 'lucide-react'
import styles from './Boletim.module.css'

// ── Helpers de data ───────────────────────────────────────────
const hojeStr = () => new Date().toLocaleDateString('en-CA')
function diasAtras(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}
const diaLocal = (iso) => new Date(iso).toLocaleDateString('en-CA')

const PERIODOS = {
  semana: { label: 'Esta semana', dias: 7 },
  mes: { label: 'Este mês', dias: 30 },
  tudo: { label: 'Tudo', dias: null },
}

function corPct(pct) {
  if (pct >= 80) return '#059669'
  if (pct >= 60) return '#0284c7'
  if (pct >= 40) return '#d97706'
  return '#dc2626'
}
function nivelMaestria(pct) {
  if (pct >= 80) return 'alto'
  if (pct >= 60) return 'medio'
  return 'baixo'
}
function formatarTempo(seg) {
  if (!seg) return '—'
  const h = Math.floor(seg / 3600)
  const m = Math.round((seg % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function Delta({ atual, anterior, suffix = '' }) {
  if (anterior === null || anterior === undefined) return null
  const diff = atual - anterior
  if (diff === 0) return <span className={styles.deltaFlat}>= igual</span>
  const up = diff > 0
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={up ? styles.deltaUp : styles.deltaDown}>
      <Icon size={12} /> {Math.abs(diff)}{suffix}
    </span>
  )
}

function BarraMaestria({ item }) {
  return (
    <div className={styles.barraRow}>
      <span className={styles.barraNome} title={item.nome}>{item.nome}</span>
      <div className={styles.barraTrack}>
        <div className={styles.barraFill}
          style={{ width: `${item.pct}%`, background: corPct(item.pct) }} />
      </div>
      <span className={styles.barraPct} style={{ color: corPct(item.pct) }}>{item.pct}%</span>
      <span className={styles.barraTotal}>{item.acertos}/{item.total}</span>
    </div>
  )
}

export default function Boletim() {
  const { usuario, perfil } = useAuth()
  const [periodo, setPeriodo] = useState('mes')

  const { data: respostas = [], isLoading: loadR } = useQuery({
    queryKey: ['respostas'],
    queryFn: () => listarRespostas(),
  })
  const { data: porDia = [], isLoading: loadD } = useQuery({
    queryKey: ['estudo-dia'],
    queryFn: () => estudoPorDia({}),
  })

  if (loadR || loadD) return <div className={styles.loading}>Gerando boletim...</div>

  const nomeAluno = perfil?.nome || usuario?.email || 'Aluno(a)'
  const cfg = PERIODOS[periodo]
  const ate = hojeStr()
  // de: início do período (inclusivo). Para "tudo" não há corte.
  const de = cfg.dias ? diasAtras(cfg.dias - 1) : null

  // Período anterior de igual duração (para comparação), quando aplicável
  let deAnt = null, ateAnt = null
  if (cfg.dias) {
    ateAnt = diasAtras(cfg.dias)
    deAnt = diasAtras(cfg.dias * 2 - 1)
  }

  // Respostas filtradas no cliente pelo período
  const noPeriodo = (r) => {
    if (!de) return true
    const d = diaLocal(r.respondido_em)
    return d >= de && d <= ate
  }
  const respFiltradas = respostas.filter(noPeriodo)

  // KPIs do período (via série por dia)
  const resumo = somarPeriodo(porDia, de, ate)
  const resumoAnt = cfg.dias ? somarPeriodo(porDia, deAnt, ateAnt) : null
  const semDados = resumo.total === 0

  // Prontidão (usa as respostas do período)
  const prontidao = calcularProntidao(respFiltradas)

  // Maestria por assunto (mínimo 3 respostas)
  const maestria = maestriaPorAssunto(respFiltradas).filter(a => a.total >= 3)
  const dominados = maestria.filter(a => a.pct >= 80).length
  const emProgresso = maestria.filter(a => a.pct >= 60 && a.pct < 80).length
  const aReforcarN = maestria.filter(a => a.pct < 60).length
  const topMaestria = [...maestria].sort((a, b) => b.pct - a.pct).slice(0, 10)
  const pontosFracos = maestria.filter(a => a.pct < 60).sort((a, b) => a.pct - b.pct).slice(0, 6)

  // Tendência: evolução mensal (sempre no histórico completo, dá contexto)
  const evolucao = evolucaoMensal(respostas)
  const maxMes = Math.max(...evolucao.map(e => e.total), 1)

  // Aderência: distribuição estudo vs simulado no período
  const porOrigem = agruparDesempenho(respFiltradas, r => {
    const o = r.origem === 'simulado' ? 'Simulado' : 'Estudo'
    return o
  })
  const totalOrigem = porOrigem.reduce((s, o) => s + o.total, 0)

  const dataEmissao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const periodoTexto = de ? `${new Date(de + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(ate + 'T00:00:00').toLocaleDateString('pt-BR')}` : 'Todo o histórico'

  // Medidor circular de prontidão
  const R = 52, C = 2 * Math.PI * R
  const geral = prontidao.geral
  const dash = (geral / 100) * C

  // Conquistas / marcos (gamificação) — sobre o histórico completo
  const streak = calcularOfensiva(respostas).streak
  const marcos = calcularMarcos(respostas, streak)
  const conquistados = marcos.filter(m => m.ok).length

  return (
    <div className={styles.page}>
      {/* Controles (não vão para a impressão) */}
      <div className={`${styles.header} ${styles.naoImprimir}`}>
        <div>
          <h1 className={styles.titulo}>Boletim de Desempenho</h1>
          <p className={styles.subtitulo}>Seu relatório de estudos, pronto para imprimir ou salvar em PDF</p>
        </div>
        <div className={styles.headerBotoes}>
          <div className={styles.segmented}>
            {Object.entries(PERIODOS).map(([k, v]) => (
              <button key={k}
                className={`${styles.segBtn} ${periodo === k ? styles.segAtivo : ''}`}
                onClick={() => setPeriodo(k)}>
                {v.label}
              </button>
            ))}
          </div>
          <button className={styles.btnPrimary} onClick={() => window.print()}>
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Boletim (o que é impresso) */}
      <div className={styles.boletim}>
        {/* Cabeçalho do boletim */}
        <div className={styles.boletimHead}>
          <div className={styles.boletimBrand}>
            <FileText size={22} />
            <div>
              <span className={styles.boletimTitulo}>Boletim de Desempenho</span>
              <span className={styles.boletimAluno}>{nomeAluno}</span>
            </div>
          </div>
          <div className={styles.boletimMeta}>
            <span><strong>Período:</strong> {cfg.label} ({periodoTexto})</span>
            <span><strong>Emitido em:</strong> {dataEmissao}</span>
          </div>
        </div>

        {/* Conquistas / marcos (gamificação) */}
        <div style={{ margin: '18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Trophy size={16} style={{ color: 'var(--color-primary)' }} />
            <strong style={{ color: 'var(--text-primary)' }}>Conquistas</strong>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{conquistados}/{marcos.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {marcos.map(m => {
              const pct = Math.min(100, Math.round((m.valor / m.alvo) * 100))
              return (
                <div key={m.chave} style={{
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
                  padding: '10px 12px', background: m.ok ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--bg-surface)',
                  opacity: m.ok ? 1 : 0.7,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {m.ok ? <Award size={15} style={{ color: 'var(--color-primary)' }} /> : <Lock size={13} style={{ color: 'var(--text-tertiary)' }} />}
                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{m.nome}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>{m.detalhe}</div>
                  {!m.ok && (
                    <div style={{ height: 5, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {semDados && (
          <div className={styles.aviso}>
            Nenhuma questão respondida neste período. Troque o período ou volte a estudar
            para preencher o boletim.
          </div>
        )}

        {/* KPIs */}
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <Target size={16} className={styles.kpiIcon} />
            <span className={styles.kpiValor}>{semDados ? '—' : resumo.total}</span>
            <span className={styles.kpiLabel}>Questões resolvidas</span>
            {!semDados && resumoAnt && <Delta atual={resumo.total} anterior={resumoAnt.total} />}
          </div>
          <div className={styles.kpi}>
            <CheckCircle2 size={16} className={styles.kpiIcon} />
            <span className={styles.kpiValor} style={semDados ? undefined : { color: corPct(resumo.percentual) }}>
              {semDados ? '—' : `${resumo.percentual}%`}
            </span>
            <span className={styles.kpiLabel}>Taxa de acerto</span>
            {!semDados && resumoAnt && resumoAnt.total > 0 &&
              <Delta atual={resumo.percentual} anterior={resumoAnt.percentual} suffix=" p.p." />}
          </div>
          <div className={styles.kpi}>
            <CalendarDays size={16} className={styles.kpiIcon} />
            <span className={styles.kpiValor}>{semDados ? '—' : resumo.dias}</span>
            <span className={styles.kpiLabel}>Dias estudados</span>
            {!semDados && resumoAnt && <Delta atual={resumo.dias} anterior={resumoAnt.dias} />}
          </div>
          <div className={styles.kpi}>
            <Clock size={16} className={styles.kpiIcon} />
            <span className={styles.kpiValor}>{formatarTempo(resumo.tempo)}</span>
            <span className={styles.kpiLabel}>Tempo total</span>
          </div>
        </div>

        {/* Prontidão geral + por disciplina */}
        <div className={styles.secao}>
          <p className={styles.secTitulo}><Gauge size={13} /> Prontidão para a prova</p>
          <div className={styles.prontidaoWrap}>
            <div className={styles.medidor}>
              <svg width="130" height="130" viewBox="0 0 130 130">
                <circle cx="65" cy="65" r={R} fill="none" stroke="var(--bg-subtle)" strokeWidth="11" />
                <circle cx="65" cy="65" r={R} fill="none" stroke={corPct(geral)} strokeWidth="11"
                  strokeLinecap="round" strokeDasharray={`${dash} ${C}`}
                  transform="rotate(-90 65 65)" />
                <text x="65" y="61" textAnchor="middle" className={styles.medidorNum}>{geral}</text>
                <text x="65" y="80" textAnchor="middle" className={styles.medidorUnid}>/ 100</text>
              </svg>
              <span className={styles.medidorLabel}>Prontidão geral</span>
            </div>
            <div className={styles.prontidaoInfo}>
              <p className={styles.explicacao}>
                A <strong>prontidão</strong> combina três fatores, de forma transparente:
                a sua <strong>taxa de acerto</strong> (45%), a <strong>cobertura</strong> de
                assuntos praticados a fundo (35%) e a <strong>recência</strong> do estudo (20%).
                Um número alto significa acertar bem, ter estudado vários assuntos e ter feito isso há pouco tempo.
              </p>
              <div className={styles.prontidaoDiscs}>
                {prontidao.disciplinas.length === 0
                  ? <p className={styles.semDados}>Sem disciplinas classificadas neste período.</p>
                  : prontidao.disciplinas.map(d => (
                    <div key={d.id} className={styles.discRow}>
                      <span className={styles.discNome} title={d.nome}>{d.nome}</span>
                      <div className={styles.barraTrack}>
                        <div className={styles.barraFill}
                          style={{ width: `${d.prontidao}%`, background: corPct(d.prontidao) }} />
                      </div>
                      <span className={styles.discPront} style={{ color: corPct(d.prontidao) }}>{d.prontidao}</span>
                      <span className={styles.discDetalhe}>acerto {d.pct}% · cobertura {d.cobertura}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Maestria por assunto */}
        <div className={styles.secao}>
          <p className={styles.secTitulo}><Award size={13} /> Maestria por assunto</p>
          <div className={styles.maestriaTiles}>
            <div className={styles.maestriaTile} data-nivel="alto">
              <span className={styles.maestriaNum}>{dominados}</span>
              <span className={styles.maestriaLabel}>Dominados (≥80%)</span>
            </div>
            <div className={styles.maestriaTile} data-nivel="medio">
              <span className={styles.maestriaNum}>{emProgresso}</span>
              <span className={styles.maestriaLabel}>Em progresso (60–79%)</span>
            </div>
            <div className={styles.maestriaTile} data-nivel="baixo">
              <span className={styles.maestriaNum}>{aReforcarN}</span>
              <span className={styles.maestriaLabel}>A reforçar (&lt;60%)</span>
            </div>
          </div>
          {topMaestria.length === 0
            ? <p className={styles.semDados}>Responda ao menos 3 questões de um assunto para medir a maestria.</p>
            : topMaestria.map(a => <BarraMaestria key={a.id} item={a} />)}
        </div>

        {/* Pontos fracos */}
        {pontosFracos.length > 0 && (
          <div className={styles.secao}>
            <p className={styles.secTitulo}><AlertTriangle size={13} /> Pontos fracos (foco recomendado)</p>
            <div className={styles.fracos}>
              {pontosFracos.map(a => (
                <span key={a.id} className={styles.fracoChip} data-nivel={nivelMaestria(a.pct)}>
                  {a.nome} <strong>{a.pct}%</strong>
                  <span className={styles.fracoDisc}>{a.acertos}/{a.total}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tendência */}
        <div className={styles.secao}>
          <p className={styles.secTitulo}><TrendingUp size={13} /> Tendência ao longo dos meses</p>
          {evolucao.length === 0
            ? <p className={styles.semDados}>Ainda não há histórico suficiente.</p>
            : (
              <div className={styles.evolucao}>
                {evolucao.map(e => (
                  <div key={e.mes} className={styles.evoCol} title={`${e.acertos}/${e.total} (${e.percentual}%)`}>
                    <span className={styles.evoPct} style={{ color: corPct(e.percentual) }}>{e.percentual}%</span>
                    <div className={styles.evoTrack}>
                      <div className={styles.evoFill}
                        style={{ height: `${Math.max((e.total / maxMes) * 100, 6)}%`, background: corPct(e.percentual) }} />
                    </div>
                    <span className={styles.evoLabel}>{e.label}</span>
                    <span className={styles.evoTotal}>{e.total}q</span>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Aderência: estudo vs simulado */}
        <div className={styles.secao}>
          <p className={styles.secTitulo}><Layers size={13} /> Como você praticou no período</p>
          {totalOrigem === 0
            ? <p className={styles.semDados}>Sem prática registrada neste período.</p>
            : (
              <>
                <div className={styles.origemBar}>
                  {porOrigem.map(o => (
                    <div key={o.nome}
                      className={styles.origemSeg}
                      data-tipo={o.nome === 'Simulado' ? 'sim' : 'est'}
                      style={{ width: `${Math.round((o.total / totalOrigem) * 100)}%` }}
                      title={`${o.nome}: ${o.total} questões`} />
                  ))}
                </div>
                <div className={styles.origemLegenda}>
                  {porOrigem.map(o => (
                    <span key={o.nome} className={styles.origemItem}>
                      <span className={styles.origemDot} data-tipo={o.nome === 'Simulado' ? 'sim' : 'est'} />
                      {o.nome}: <strong>{o.total}</strong> ({Math.round((o.total / totalOrigem) * 100)}%) · {o.percentual}% de acerto
                    </span>
                  ))}
                </div>
              </>
            )}
        </div>

        <div className={styles.rodape}>
          Boletim gerado automaticamente a partir do seu histórico de respostas · {dataEmissao}
        </div>
      </div>
    </div>
  )
}
