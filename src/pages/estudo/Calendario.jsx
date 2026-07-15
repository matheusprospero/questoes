import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { estudoPorDia, somarPeriodo } from '../../services/estudo'
import { CalendarDays, BookOpen, Target, CalendarRange, CalendarClock } from 'lucide-react'
import styles from './Calendario.module.css'

const DIAS_HEATMAP = 182 // ~26 semanas
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const NOMES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// hoje = 'YYYY-MM-DD' local
function hojeStr() {
  return new Date().toLocaleDateString('en-CA')
}
// N dias atrás em 'YYYY-MM-DD' local
function diasAtras(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}

// Formata 'YYYY-MM-DD' -> 'DD/MM/YYYY' (sem depender de fuso)
function formatarBR(iso) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function corPct(pct) {
  if (pct >= 80) return '#059669'
  if (pct >= 60) return '#0284c7'
  if (pct >= 40) return '#d97706'
  return '#dc2626'
}

// Nível de intensidade (0-4) a partir do nº de questões no dia
function nivel(total) {
  if (!total) return 0
  if (total < 10) return 1
  if (total < 20) return 2
  if (total < 40) return 3
  return 4
}

function CardResumo({ icon, label, dados }) {
  const pct = dados.total ? dados.percentual : null
  return (
    <div className={styles.cardResumo}>
      <span className={styles.cardTopo}>{icon} {label}</span>
      <span className={styles.cardValor}>{dados.total}<small> questões</small></span>
      <div className={styles.cardMeta}>
        <span style={pct !== null ? { color: corPct(pct) } : undefined}>
          {pct !== null ? `${pct}% acerto` : '—'}
        </span>
        <span className={styles.cardDias}>{dados.dias} dia(s)</span>
      </div>
    </div>
  )
}

export default function Calendario() {
  const navigate = useNavigate()
  const inicio = useMemo(() => diasAtras(DIAS_HEATMAP - 1), [])

  const { data: porDia = [], isLoading } = useQuery({
    queryKey: ['estudo-dia'],
    queryFn: () => estudoPorDia({ de: inicio }),
  })

  const { mapaDia, resumos, semanas, maxColLabel, ultimos14 } = useMemo(() => {
    const mapa = new Map()
    for (const g of porDia) mapa.set(g.dia, { total: g.total, acertos: g.acertos })

    const hoje = hojeStr()
    const resumos = {
      hoje: somarPeriodo(porDia, hoje, hoje),
      semana: somarPeriodo(porDia, diasAtras(6), hoje),
      mes: somarPeriodo(porDia, diasAtras(29), hoje),
    }

    // Monta a sequência de dias de (hoje - 181) até hoje
    const dias = []
    const base = new Date()
    base.setDate(base.getDate() - (DIAS_HEATMAP - 1))
    for (let i = 0; i < DIAS_HEATMAP; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      const iso = d.toLocaleDateString('en-CA')
      const info = mapa.get(iso) || { total: 0, acertos: 0 }
      const pct = info.total ? Math.round((info.acertos / info.total) * 100) : 0
      dias.push({ iso, dow: d.getDay(), mes: d.getMonth(), diaMes: d.getDate(), ...info, pct })
    }

    // Agrupa em colunas por semana. A 1ª coluna pode começar em qualquer dia
    // da semana; preenche o começo com células vazias (placeholders).
    const semanas = []
    let col = new Array(dias[0].dow).fill(null)
    for (const dia of dias) {
      col.push(dia)
      if (col.length === 7) { semanas.push(col); col = [] }
    }
    if (col.length) { while (col.length < 7) col.push(null); semanas.push(col) }

    // Rótulo de mês por coluna: mostra o nome quando muda de mês (1ª célula real)
    const maxColLabel = semanas.map((sem, i) => {
      const primeira = sem.find(Boolean)
      if (!primeira) return ''
      const anterior = i > 0 ? (semanas[i - 1].find(Boolean)?.mes) : null
      return primeira.mes !== anterior ? MESES[primeira.mes] : ''
    })

    // Últimos 14 dias com atividade (mais recente primeiro)
    const ultimos14 = dias
      .slice(-14)
      .filter(d => d.total > 0)
      .reverse()

    return { mapaDia: mapa, resumos, semanas, maxColLabel, ultimos14 }
  }, [porDia])

  if (isLoading) return <div className={styles.loading}>Carregando calendário...</div>

  const totalAtivo = porDia.reduce((s, g) => s + (g.total > 0 ? 1 : 0), 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Calendário de Estudos</h1>
          <p className={styles.subtitulo}>Sua atividade de resolução de questões ao longo do tempo</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/estudo')}>
          <BookOpen size={14} /> Resolver questões
        </button>
      </div>

      {/* Cards de resumo */}
      <div className={styles.cardsResumo}>
        <CardResumo icon={<Target size={13} />} label="HOJE" dados={resumos.hoje} />
        <CardResumo icon={<CalendarRange size={13} />} label="ESTA SEMANA" dados={resumos.semana} />
        <CardResumo icon={<CalendarClock size={13} />} label="ESTE MÊS" dados={resumos.mes} />
      </div>

      {/* Heatmap */}
      <div className={styles.card}>
        <p className={styles.secTitulo}><CalendarDays size={13} /> Últimas 26 semanas</p>
        {totalAtivo === 0 ? (
          <p className={styles.semDados}>Nenhuma atividade registrada neste período.</p>
        ) : (
          <div className={styles.heatWrap}>
            <div className={styles.heatGrid}>
              {/* Rótulos dos dias da semana (só alguns, à esquerda) */}
              <div className={styles.heatDows}>
                {NOMES_DIA.map((n, i) => (
                  <span key={n} className={styles.heatDow}>{i % 2 === 1 ? n : ''}</span>
                ))}
              </div>
              <div className={styles.heatCols}>
                <div className={styles.heatMeses}>
                  {maxColLabel.map((m, i) => (
                    <span key={i} className={styles.heatMes}>{m}</span>
                  ))}
                </div>
                <div className={styles.heatBody}>
                  {semanas.map((sem, ci) => (
                    <div key={ci} className={styles.heatColuna}>
                      {sem.map((dia, ri) => (
                        dia ? (
                          <div
                            key={dia.iso}
                            className={styles.heatCel}
                            data-nivel={nivel(dia.total)}
                            title={dia.total
                              ? `${dia.total} questões · ${dia.pct}% · ${formatarBR(dia.iso)}`
                              : `Sem atividade · ${formatarBR(dia.iso)}`}
                          />
                        ) : (
                          <div key={`v-${ci}-${ri}`} className={styles.heatVazio} />
                        )
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legenda */}
            <div className={styles.legenda}>
              <span>menos</span>
              {[0, 1, 2, 3, 4].map(n => (
                <span key={n} className={styles.heatCel} data-nivel={n} />
              ))}
              <span>mais</span>
            </div>
          </div>
        )}
      </div>

      {/* Últimos 14 dias */}
      <div className={styles.card} style={{ marginTop: 12 }}>
        <p className={styles.secTitulo}>Últimos 14 dias</p>
        {ultimos14.length === 0 ? (
          <p className={styles.semDados}>Sem atividade nos últimos 14 dias.</p>
        ) : (
          <div className={styles.tabela}>
            {ultimos14.map(d => (
              <div key={d.iso} className={styles.tabelaRow}>
                <span className={styles.tabelaDia}>{formatarBR(d.iso)}</span>
                <span className={styles.tabelaQtd}>{d.total} questões</span>
                <span className={styles.tabelaPct} style={{ color: corPct(d.pct) }}>{d.pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
