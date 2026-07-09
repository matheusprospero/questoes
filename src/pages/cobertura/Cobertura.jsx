import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { carregarCobertura } from '../../services/cobertura'
import { listarDisciplinas } from '../../services/questoes'
import { AlertTriangle, CheckCircle2, Circle, FileEdit, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import styles from './Cobertura.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']

const NIVEL = {
  sem:      { label: 'Sem questões',    cor: '#e11d48', Icone: AlertTriangle },
  rascunho: { label: 'Só rascunhos',    cor: '#f59e0b', Icone: FileEdit },
  baixa:    { label: 'Cobertura baixa', cor: '#f59e0b', Icone: Circle },
  ok:       { label: 'Coberta',         cor: '#10b981', Icone: CheckCircle2 },
}

export default function Cobertura() {
  const navigate = useNavigate()
  const [filtroDisc, setFiltroDisc] = useState('')
  const [filtroAno, setFiltroAno] = useState('')
  const [soLacunas, setSoLacunas] = useState(false)
  const [expandidos, setExpandidos] = useState(new Set())

  const { data, isLoading, error } = useQuery({
    queryKey: ['cobertura', filtroDisc, filtroAno],
    queryFn: () => carregarCobertura({
      disciplina_id: filtroDisc || undefined,
      ano_escolar: filtroAno || undefined,
    }),
  })

  const { data: disciplinas = [] } = useQuery({
    queryKey: ['disciplinas'],
    queryFn: listarDisciplinas,
  })

  function toggle(nome) {
    setExpandidos(prev => {
      const n = new Set(prev)
      n.has(nome) ? n.delete(nome) : n.add(nome)
      return n
    })
  }

  if (isLoading) return <div className={styles.loading}>Calculando cobertura...</div>
  if (error) return <div className={styles.loading}>Erro: {error.message}</div>

  const { resumo, porDisciplina } = data

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Cobertura Curricular</h1>
          <p className={styles.subtitulo}>Habilidades cobertas por questões publicadas no banco</p>
        </div>
      </div>

      {/* Resumo */}
      <div className={styles.statsGrid}>
        <StatCard valor={resumo.totalHabilidades} label="Habilidades" cor="#6366f1" />
        <StatCard valor={`${resumo.percentualCobertura}%`} label="Cobertura" cor="#10b981" sub={`${resumo.cobertas} com questões publicadas`} />
        <StatCard valor={resumo.semPublicadas} label="Sem questão publicada" cor="#f59e0b" />
        <StatCard valor={resumo.semQuestoes} label="Sem nenhuma questão" cor="#e11d48" />
      </div>

      {/* Filtros */}
      <div className={styles.filtros}>
        <select className={styles.filtroSelect} value={filtroDisc} onChange={e => setFiltroDisc(e.target.value)}>
          <option value="">Todas as disciplinas</option>
          {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <select className={styles.filtroSelect} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
          <option value="">Todos os anos</option>
          {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <label className={styles.checkLacunas}>
          <input type="checkbox" checked={soLacunas} onChange={e => setSoLacunas(e.target.checked)} />
          Mostrar só lacunas
        </label>
      </div>

      {porDisciplina.length === 0 ? (
        <div className={styles.vazio}><CheckCircle2 size={36} strokeWidth={1.5} /><p>Nenhuma habilidade encontrada para este filtro</p></div>
      ) : (
        <div className={styles.grupos}>
          {porDisciplina.map(grupo => {
            const aberto = expandidos.has(grupo.nome)
            const itensVisiveis = soLacunas ? grupo.itens.filter(i => i.publicadas === 0) : grupo.itens
            if (soLacunas && itensVisiveis.length === 0) return null
            return (
              <div key={grupo.nome} className={styles.grupo}>
                <button className={styles.grupoHeader} onClick={() => toggle(grupo.nome)}>
                  {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span className={styles.grupoCor} style={{ background: grupo.cor }} />
                  <span className={styles.grupoNome}>{grupo.nome}</span>
                  <span className={styles.grupoContagem}>{grupo.cobertas}/{grupo.itens.length} cobertas</span>
                  <div className={styles.grupoBarra}>
                    <div className={styles.grupoBarraFill} style={{ width: `${grupo.percentual}%`, background: grupo.percentual >= 70 ? '#10b981' : grupo.percentual >= 40 ? '#f59e0b' : '#e11d48' }} />
                  </div>
                  <span className={styles.grupoPercent}>{grupo.percentual}%</span>
                </button>

                {aberto && (
                  <div className={styles.habLista}>
                    {itensVisiveis.map(h => {
                      const nivel = NIVEL[h.nivel]
                      const Icone = nivel.Icone
                      return (
                        <div key={h.id} className={styles.habItem}>
                          <Icone size={16} color={nivel.cor} className={styles.habIcone} />
                          <div className={styles.habInfo}>
                            <div className={styles.habTopo}>
                              <span className={styles.habCodigo}>{h.codigo}</span>
                              {h.ano_escolar && <span className={styles.habAno}>{h.ano_escolar}</span>}
                              <span className={styles.habStatus} style={{ color: nivel.cor }}>{nivel.label}</span>
                            </div>
                            <p className={styles.habDescricao}>{h.descricao}</p>
                          </div>
                          <div className={styles.habNums}>
                            <span className={styles.habNumPub} title="Questões publicadas">{h.publicadas} pub.</span>
                            <span className={styles.habNumTotal} title="Total de questões">{h.total} total</span>
                          </div>
                          <button
                            className={styles.btnCriar}
                            onClick={() => navigate('/questoes/nova')}
                            title="Criar questão para esta habilidade"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ valor, label, cor, sub }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statBarra} style={{ background: cor }} />
      <div className={styles.statValor} style={{ color: cor }}>{valor}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}
