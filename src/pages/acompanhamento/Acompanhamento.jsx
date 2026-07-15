import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarAlunosComResumo, resumoAluno,
} from '../../services/acompanhamento'
import {
  listarRespostas, calcularProntidao, agruparDesempenho,
  maestriaPorAssunto, questoesMaisErradas,
} from '../../services/estudo'
import { useAuth } from '../../contexts/AuthContext'
import {
  Users, Search, UserCheck, UserX, X, Target, Calendar, CalendarDays,
  CalendarRange, Award, XCircle, Crown, ChevronRight, ArrowUpDown,
} from 'lucide-react'
import styles from './Acompanhamento.module.css'

function corPct(pct) {
  if (pct >= 80) return '#059669'
  if (pct >= 60) return '#0284c7'
  if (pct >= 40) return '#d97706'
  return '#dc2626'
}

function fmtDia(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a.slice(2)}`
}

function fmtTempo(seg) {
  if (!seg) return '0min'
  const min = Math.round(seg / 60)
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  return `${h}h${String(min % 60).padStart(2, '0')}`
}

function BarraDesempenho({ item }) {
  return (
    <div className={styles.barraRow}>
      <span className={styles.barraNome} title={item.nome}>{item.nome}</span>
      <div className={styles.barraTrack}>
        <div className={styles.barraFill}
          style={{ width: `${item.percentual}%`, background: corPct(item.percentual) }} />
      </div>
      <span className={styles.barraPct} style={{ color: corPct(item.percentual) }}>{item.percentual}%</span>
      <span className={styles.barraTotal}>{item.acertos}/{item.total}</span>
    </div>
  )
}

function Kpi({ Icon, titulo, dados }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiTop}><Icon size={13} /> {titulo}</span>
      <span className={styles.kpiValor} style={{ color: corPct(dados.percentual) }}>
        {dados.total > 0 ? `${dados.percentual}%` : '—'}
      </span>
      <span className={styles.kpiSub}>
        {dados.total} questões · {dados.dias} dia(s) · {fmtTempo(dados.tempo)}
      </span>
    </div>
  )
}

function DetalheAluno({ aluno, onClose }) {
  const id = aluno.id

  const { data: resumo, isLoading: loadResumo } = useQuery({
    queryKey: ['acompanhamento-aluno', id],
    queryFn: () => resumoAluno(id),
    enabled: !!id,
  })
  const { data: respostas = [], isLoading: loadResp } = useQuery({
    queryKey: ['acompanhamento-respostas', id],
    queryFn: () => listarRespostas(id),
    enabled: !!id,
    onError: () => toast.error('Não foi possível carregar as respostas do aluno'),
  })

  const analise = useMemo(() => {
    if (!respostas.length) return null
    const prontidao = calcularProntidao(respostas)
    const porDisciplina = agruparDesempenho(respostas, r => r.questoes?.disciplinas?.nome)
    const pioresAssuntos = maestriaPorAssunto(respostas)
      .filter(a => a.total >= 3)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 6)
    const maisErradas = questoesMaisErradas(respostas, 5)
    return { prontidao, porDisciplina, pioresAssuntos, maisErradas }
  }, [respostas])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside className={styles.painel} onClick={e => e.stopPropagation()}>
        <div className={styles.painelHead}>
          <div className={styles.painelIdent}>
            <h2 className={styles.painelNome}>
              {aluno.nome || 'Aluno'}
              {aluno.assinante && <Crown size={14} className={styles.crown} title="Assinante" />}
            </h2>
            <span className={styles.painelEmail}>{aluno.email}</span>
          </div>
          <button className={styles.fechar} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className={styles.painelBody}>
          {/* KPIs dia / semana / mês */}
          <p className={styles.secTitulo}>Atividade recente</p>
          {loadResumo ? (
            <p className={styles.carregando}>Carregando resumo...</p>
          ) : (
            <div className={styles.kpis}>
              <Kpi Icon={Calendar} titulo="Hoje" dados={resumo?.hoje || {}} />
              <Kpi Icon={CalendarDays} titulo="Semana" dados={resumo?.semana || {}} />
              <Kpi Icon={CalendarRange} titulo="Mês" dados={resumo?.mes || {}} />
            </div>
          )}

          {loadResp ? (
            <p className={styles.carregando}>Carregando desempenho...</p>
          ) : !analise ? (
            <div className={styles.vazioMini}>
              <Users size={30} strokeWidth={1.5} />
              <p>Este aluno ainda não respondeu questões.</p>
            </div>
          ) : (
            <>
              {/* Prontidão */}
              <div className={styles.prontidaoBox}>
                <div className={styles.prontidaoGeral}>
                  <span className={styles.prontidaoNum} style={{ color: corPct(analise.prontidao.geral) }}>
                    {analise.prontidao.geral}
                  </span>
                  <span className={styles.prontidaoLabel}><Target size={13} /> Prontidão geral</span>
                </div>
                <div className={styles.prontidaoDiscs}>
                  {analise.prontidao.disciplinas.slice(0, 6).map(d => (
                    <div key={d.id} className={styles.prontidaoDisc}>
                      <span className={styles.pdNome} title={d.nome}>
                        <span className={styles.pdDot} style={{ background: d.cor || '#94a3b8' }} />
                        {d.nome}
                      </span>
                      <div className={styles.barraTrack}>
                        <div className={styles.barraFill}
                          style={{ width: `${d.prontidao}%`, background: corPct(d.prontidao) }} />
                      </div>
                      <span className={styles.pdMeta} style={{ color: corPct(d.prontidao) }}>{d.prontidao}</span>
                      <span className={styles.pdSub}>{d.pct}% acerto</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pontos fracos */}
              <p className={styles.secTitulo}><Award size={13} /> Assuntos a reforçar</p>
              {analise.pioresAssuntos.length === 0 ? (
                <p className={styles.semDados}>Poucos dados por assunto ainda.</p>
              ) : (
                <div className={styles.chips}>
                  {analise.pioresAssuntos.map(a => (
                    <span key={a.id} className={styles.chip} data-fraco={a.pct < 60}>
                      {a.nome} <strong style={{ color: corPct(a.pct) }}>{a.pct}%</strong>
                      <span className={styles.chipTotal}>{a.acertos}/{a.total}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Questões mais erradas */}
              <p className={styles.secTitulo}><XCircle size={13} /> Questões que mais erra</p>
              {analise.maisErradas.length === 0 ? (
                <p className={styles.semDados}>Nenhum erro recorrente. 🎉</p>
              ) : (
                <div className={styles.erradasLista}>
                  {analise.maisErradas.map(({ questao, erros, total }) => (
                    <div key={questao.id} className={styles.erradaItem}>
                      <span className={styles.erradaBadge}>{erros}× errada</span>
                      <span className={styles.erradaTexto}>
                        {(questao.enunciado || '').replace(/<[^>]*>/g, ' ').slice(0, 120)}…
                      </span>
                      <span className={styles.erradaMeta}>
                        {[questao.disciplinas?.nome, questao.bancas?.nome, questao.ano].filter(Boolean).join(' · ')}
                        {' · '}{total - erros}/{total}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Desempenho por disciplina */}
              <p className={styles.secTitulo}>Desempenho por disciplina</p>
              {analise.porDisciplina.length === 0 ? (
                <p className={styles.semDados}>Sem questões classificadas por disciplina.</p>
              ) : (
                analise.porDisciplina.map(d => <BarraDesempenho key={d.nome} item={d} />)
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

export default function Acompanhamento() {
  const { isAdmin } = useAuth()
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState('atividade')
  const [selecionado, setSelecionado] = useState(null)

  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ['acompanhamento-alunos'],
    queryFn: listarAlunosComResumo,
  })

  const resumoGeral = useMemo(() => ({
    total: alunos.length,
    ativos: alunos.filter(a => !a.inativo).length,
    inativos: alunos.filter(a => a.inativo).length,
  }), [alunos])

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    let lista = alunos
    if (termo) {
      lista = lista.filter(a =>
        (a.nome || '').toLowerCase().includes(termo) ||
        (a.email || '').toLowerCase().includes(termo))
    }
    const ordenada = [...lista]
    if (ordem === 'atividade') ordenada.sort((a, b) => b.diasAtivos30 - a.diasAtivos30 || b.total - a.total)
    else if (ordem === 'nome') ordenada.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    else if (ordem === 'acerto') ordenada.sort((a, b) => b.percentual - a.percentual)
    else if (ordem === 'total') ordenada.sort((a, b) => b.total - a.total)
    return ordenada
  }, [alunos, busca, ordem])

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.vazio}>
          <UserX size={36} strokeWidth={1.5} />
          <p>Esta área é exclusiva para professores.</p>
        </div>
      </div>
    )
  }

  if (isLoading) return <div className={styles.loading}>Carregando alunos...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}><Users size={20} /> Acompanhamento</h1>
          <p className={styles.subtitulo}>Acompanhe cada aluno individualmente e descubra onde ajudar</p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className={styles.cardsResumo}>
        <div className={styles.cardResumo}>
          <Users size={16} className={styles.cardIcon} />
          <span className={styles.cardValor}>{resumoGeral.total}</span>
          <span className={styles.cardLabel}>Alunos</span>
        </div>
        <div className={styles.cardResumo}>
          <UserCheck size={16} className={styles.cardIcon} style={{ color: '#059669' }} />
          <span className={styles.cardValor} style={{ color: '#059669' }}>{resumoGeral.ativos}</span>
          <span className={styles.cardLabel}>Ativos (últimos 7 dias)</span>
        </div>
        <div className={styles.cardResumo}>
          <UserX size={16} className={styles.cardIcon} style={{ color: '#dc2626' }} />
          <span className={styles.cardValor} style={{ color: '#dc2626' }}>{resumoGeral.inativos}</span>
          <span className={styles.cardLabel}>Inativos</span>
        </div>
      </div>

      {/* Controles */}
      <div className={styles.controles}>
        <div className={styles.busca}>
          <Search size={15} className={styles.buscaIcon} />
          <input
            className={styles.buscaInput}
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <label className={styles.ordenar}>
          <ArrowUpDown size={14} />
          <select className={styles.select} value={ordem} onChange={e => setOrdem(e.target.value)}>
            <option value="atividade">Mais ativos</option>
            <option value="total">Mais questões</option>
            <option value="acerto">Maior % de acerto</option>
            <option value="nome">Nome (A–Z)</option>
          </select>
        </label>
      </div>

      {/* Tabela */}
      {listaFiltrada.length === 0 ? (
        <div className={styles.vazio}>
          <Users size={36} strokeWidth={1.5} />
          <p>{alunos.length === 0 ? 'Nenhum aluno cadastrado ainda.' : 'Nenhum aluno encontrado.'}</p>
        </div>
      ) : (
        <div className={styles.tabelaWrap}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Aluno</th>
                <th className={styles.num}>Questões</th>
                <th className={styles.num}>% Acerto</th>
                <th className={styles.num}>Dias ativos (30d)</th>
                <th className={styles.num}>Último estudo</th>
                <th>Status</th>
                <th aria-label="Ver" />
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(a => (
                <tr key={a.id} className={styles.linha} onClick={() => setSelecionado(a)}>
                  <td>
                    <div className={styles.alunoCel}>
                      <span className={styles.alunoNome}>
                        {a.nome || '(sem nome)'}
                        {a.assinante && <Crown size={12} className={styles.crown} title="Assinante" />}
                      </span>
                      <span className={styles.alunoEmail}>{a.email}</span>
                    </div>
                  </td>
                  <td className={styles.num}>{a.total}</td>
                  <td className={styles.num}>
                    {a.total > 0
                      ? <span style={{ color: corPct(a.percentual), fontWeight: 700 }}>{a.percentual}%</span>
                      : <span className={styles.dim}>—</span>}
                  </td>
                  <td className={styles.num}>{a.diasAtivos30}</td>
                  <td className={styles.num}>{fmtDia(a.ultimoDia)}</td>
                  <td>
                    <span className={styles.selo} data-status={a.inativo ? 'inativo' : 'ativo'}>
                      {a.inativo ? 'Inativo' : 'Ativo'}
                    </span>
                  </td>
                  <td><ChevronRight size={16} className={styles.chevron} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selecionado && (
        <DetalheAluno aluno={selecionado} onClose={() => setSelecionado(null)} />
      )}
    </div>
  )
}
