import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { buscarTurmaComConteudo, progressoTurma, disciplinasDaTurma } from '../../services/turmas'
import { ChevronLeft, GraduationCap, BookOpen, ClipboardList, TrendingUp } from 'lucide-react'
import styles from './TurmaDetalhe.module.css'

export default function TurmaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['turma-conteudo', id],
    queryFn: () => buscarTurmaComConteudo(id),
  })
  const { data: prog } = useQuery({
    queryKey: ['turma-progresso', id],
    queryFn: () => progressoTurma(id),
  })

  if (isLoading) return <div className={styles.loading}>Carregando turma…</div>
  if (error || !data) return (
    <div className={styles.page}>
      <button className={styles.voltar} onClick={() => navigate(-1)}><ChevronLeft size={16} /> Voltar</button>
      <div className={styles.vazio}><p>Turma não encontrada ou sem acesso.</p></div>
    </div>
  )

  const { turma, aulas, simulados } = data
  const discs = disciplinasDaTurma(turma)

  const renderAula = (a) => (
    <button key={a.id} className={styles.item} onClick={() => navigate(`/aulas/${a.id}`)}>
      <div className={styles.itemInfo}>
        <span className={styles.itemNome}>{a.titulo}</span>
        {a.descricao && <span className={styles.itemDesc}>{a.descricao}</span>}
      </div>
      <span className={styles.itemQtd}>{a.aula_questoes?.[0]?.count ?? 0} questões</span>
    </button>
  )

  return (
    <div className={styles.page}>
      <button className={styles.voltar} onClick={() => navigate(-1)}><ChevronLeft size={16} /> Voltar</button>

      <div className={styles.head}>
        <h1 className={styles.titulo}><GraduationCap size={20} /> {turma.nome}</h1>
        {turma.descricao && <p className={styles.subtitulo}>{turma.descricao}</p>}
        <div className={styles.discChips}>
          {discs.map(d => <span key={d.id} className={styles.discChip} style={{ borderColor: d.cor, color: d.cor }}>{d.nome}</span>)}
        </div>
      </div>

      {/* Barra de progresso no conteúdo da turma */}
      {prog && (
        <div className={styles.progCard}>
          <div className={styles.progTopo}>
            <span className={styles.progTitulo}><TrendingUp size={15} /> Seu progresso na turma</span>
            <span className={styles.progPct}>{prog.pct}%</span>
          </div>
          <div className={styles.progTrack}>
            <div className={styles.progFill} style={{ width: `${prog.pct}%` }} />
          </div>
          <div className={styles.progInfo}>
            <span>{prog.feitas} de {prog.total} questões do conteúdo respondidas</span>
            {prog.feitas > 0 && <span>· {prog.pctAcerto}% de acerto</span>}
          </div>
        </div>
      )}

      {/* Aulas — agrupadas por disciplina (curso → disciplina → aula) */}
      <h2 className={styles.secTitulo}><BookOpen size={16} /> Aulas ({aulas.length})</h2>
      {aulas.length === 0 ? <p className={styles.semDados}>Nenhuma aula disponível para você nesta turma.</p> : (
        <>
          {discs.map(d => {
            const doDisc = aulas.filter(a => a.disciplina_id === d.id)
            if (doDisc.length === 0) return null
            return (
              <div key={d.id} className={styles.discGrupo}>
                <h3 className={styles.discGrupoTitulo}>
                  <span className={styles.dot} style={{ background: d.cor || 'var(--color-primary)' }} />
                  {d.nome} <span className={styles.discGrupoCount}>({doDisc.length})</span>
                </h3>
                <div className={styles.lista}>{doDisc.map(renderAula)}</div>
              </div>
            )
          })}
          {(() => {
            const outras = aulas.filter(a => !discs.some(d => d.id === a.disciplina_id))
            if (outras.length === 0) return null
            return (
              <div className={styles.discGrupo}>
                <h3 className={styles.discGrupoTitulo}><span className={styles.dot} style={{ background: 'var(--text-tertiary)' }} /> Outras</h3>
                <div className={styles.lista}>{outras.map(renderAula)}</div>
              </div>
            )
          })()}
        </>
      )}

      {/* Simulados */}
      <h2 className={styles.secTitulo}><ClipboardList size={16} /> Simulados ({simulados.length})</h2>
      {simulados.length === 0 ? <p className={styles.semDados}>Nenhum simulado disponível para você nesta turma.</p> : (
        <div className={styles.lista}>
          {simulados.map(s => (
            <button key={s.id} className={styles.item} onClick={() => navigate(`/simulados/${s.id}`)}>
              <div className={styles.itemInfo}>
                <span className={styles.itemNome}>{s.titulo}</span>
                {s.descricao && <span className={styles.itemDesc}>{s.descricao}</span>}
              </div>
              <span className={styles.itemQtd}>{s.simulado_questoes?.[0]?.count ?? 0} questões</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
