import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listarRespostas, agruparDesempenho, evolucaoMensal, questoesMaisErradas, idsUltimaErrada,
} from '../../services/estudo'
import { BarChart2, RotateCcw, BookOpen, TrendingUp, Target, XCircle, HelpCircle, Sparkles } from 'lucide-react'
import styles from './Estatisticas.module.css'

function corPct(pct) {
  if (pct >= 80) return '#059669'
  if (pct >= 60) return '#0284c7'
  if (pct >= 40) return '#d97706'
  return '#dc2626'
}

function BarraDesempenho({ item }) {
  return (
    <div className={styles.barraRow}>
      <span className={styles.barraNome} title={item.nome}>{item.nome}</span>
      <div className={styles.barraTrack}>
        <div className={styles.barraFill}
          style={{ width: `${item.percentual}%`, background: corPct(item.percentual) }} />
      </div>
      <span className={styles.barraPct} style={{ color: corPct(item.percentual) }}>
        {item.percentual}%
      </span>
      <span className={styles.barraTotal}>{item.acertos}/{item.total}</span>
    </div>
  )
}

export default function Estatisticas() {
  const navigate = useNavigate()

  const { data: respostas = [], isLoading } = useQuery({
    queryKey: ['respostas'],
    queryFn: listarRespostas,
  })

  if (isLoading) return <div className={styles.loading}>Carregando estatísticas...</div>

  if (respostas.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.titulo}>Estatísticas</h1>
        <div className={styles.vazio}>
          <BarChart2 size={36} strokeWidth={1.5} />
          <p>Você ainda não respondeu nenhuma questão</p>
          <button className={styles.btnPrimary} onClick={() => navigate('/estudo')}>
            <BookOpen size={14} /> Começar a resolver
          </button>
        </div>
      </div>
    )
  }

  const total = respostas.length
  const acertos = respostas.filter(r => r.acertou).length
  const pctGeral = Math.round((acertos / total) * 100)
  const distintas = new Set(respostas.map(r => r.questao_id)).size
  const pendentesErradas = idsUltimaErrada(respostas).size

  const trintaDias = new Date()
  trintaDias.setDate(trintaDias.getDate() - 30)
  const recentes = respostas.filter(r => new Date(r.respondido_em) >= trintaDias)
  const pctRecente = recentes.length
    ? Math.round((recentes.filter(r => r.acertou).length / recentes.length) * 100)
    : null

  const porDisciplina = agruparDesempenho(respostas, r => r.questoes?.disciplinas?.nome)
  const porAssunto = agruparDesempenho(respostas, r => {
    const a = r.questoes?.assuntos?.nome
    const d = r.questoes?.disciplinas?.nome
    return a ? (d ? `${a} (${d})` : a) : null
  }).slice(0, 12)
  const porBanca = agruparDesempenho(respostas, r => r.questoes?.bancas?.nome)
  const evolucao = evolucaoMensal(respostas)
  const maisErradas = questoesMaisErradas(respostas, 10)
  const maxMes = Math.max(...evolucao.map(e => e.total), 1)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Estatísticas</h1>
          <p className={styles.subtitulo}>Seu desempenho no estudo de questões</p>
        </div>
        <div className={styles.headerBotoes}>
          {pendentesErradas > 0 && (
            <button className={styles.btnGhost} onClick={() => navigate('/estudo?erradas=1')}>
              <RotateCcw size={14} /> Refazer {pendentesErradas} errada(s)
            </button>
          )}
          {pendentesErradas > 0 && (
            <button className={styles.btnGhost} onClick={() => navigate('/estudo?similares=1')}>
              <Sparkles size={14} /> Treinar similares
            </button>
          )}
          <button className={styles.btnPrimary} onClick={() => navigate('/estudo')}>
            <BookOpen size={14} /> Resolver questões
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className={styles.cardsResumo}>
        <div className={styles.cardResumo}>
          <Target size={16} className={styles.cardIcon} />
          <span className={styles.cardValor} style={{ color: corPct(pctGeral) }}>{pctGeral}%</span>
          <span className={styles.cardLabel}>Acerto geral</span>
        </div>
        <div className={styles.cardResumo}>
          <HelpCircle size={16} className={styles.cardIcon} />
          <span className={styles.cardValor}>{total}</span>
          <span className={styles.cardLabel}>Respostas registradas</span>
        </div>
        <div className={styles.cardResumo}>
          <BookOpen size={16} className={styles.cardIcon} />
          <span className={styles.cardValor}>{distintas}</span>
          <span className={styles.cardLabel}>Questões distintas</span>
        </div>
        <div className={styles.cardResumo}>
          <TrendingUp size={16} className={styles.cardIcon} />
          <span className={styles.cardValor} style={pctRecente !== null ? { color: corPct(pctRecente) } : undefined}>
            {pctRecente !== null ? `${pctRecente}%` : '—'}
          </span>
          <span className={styles.cardLabel}>Últimos 30 dias ({recentes.length})</span>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Evolução mensal */}
        <div className={styles.card}>
          <p className={styles.secTitulo}><TrendingUp size={13} /> Evolução ao longo do tempo</p>
          <div className={styles.evolucao}>
            {evolucao.map(e => (
              <div key={e.mes} className={styles.evoCol} title={`${e.acertos}/${e.total} (${e.percentual}%)`}>
                <span className={styles.evoPct} style={{ color: corPct(e.percentual) }}>{e.percentual}%</span>
                <div className={styles.evoTrack}>
                  <div className={styles.evoFill}
                    style={{
                      height: `${Math.max((e.total / maxMes) * 100, 6)}%`,
                      background: corPct(e.percentual),
                    }} />
                </div>
                <span className={styles.evoLabel}>{e.label}</span>
                <span className={styles.evoTotal}>{e.total}q</span>
              </div>
            ))}
          </div>
        </div>

        {/* Por disciplina */}
        <div className={styles.card}>
          <p className={styles.secTitulo}>Desempenho por disciplina</p>
          {porDisciplina.length === 0
            ? <p className={styles.semDados}>Sem questões classificadas por disciplina.</p>
            : porDisciplina.map(d => <BarraDesempenho key={d.nome} item={d} />)}
        </div>

        {/* Por assunto */}
        <div className={styles.card}>
          <p className={styles.secTitulo}>Desempenho por assunto</p>
          {porAssunto.length === 0
            ? <p className={styles.semDados}>Sem questões classificadas por assunto.</p>
            : porAssunto.map(a => <BarraDesempenho key={a.nome} item={a} />)}
        </div>

        {/* Por banca */}
        <div className={styles.card}>
          <p className={styles.secTitulo}>Desempenho por banca</p>
          {porBanca.length === 0
            ? <p className={styles.semDados}>Sem questões classificadas por banca.</p>
            : porBanca.map(b => <BarraDesempenho key={b.nome} item={b} />)}
        </div>

        {/* Mais erradas */}
        <div className={`${styles.card} ${styles.cardWide}`}>
          <p className={styles.secTitulo}><XCircle size={13} /> Questões que você mais erra</p>
          {maisErradas.length === 0 ? (
            <p className={styles.semDados}>Nenhum erro registrado. 🎉</p>
          ) : (
            <div className={styles.erradasLista}>
              {maisErradas.map(({ questao, erros, total: tq }) => (
                <div key={questao.id} className={styles.erradaItem}
                  onClick={() => navigate(`/questoes/${questao.id}`)}>
                  <span className={styles.erradaBadge}>{erros}× errada</span>
                  <span className={styles.erradaTexto}>
                    {(questao.enunciado || '').replace(/<[^>]*>/g, ' ').slice(0, 110)}…
                  </span>
                  <span className={styles.erradaMeta}>
                    {[questao.disciplinas?.nome, questao.bancas?.nome, questao.ano].filter(Boolean).join(' · ')}
                    {' · '}{tq - erros}/{tq} acertos
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
