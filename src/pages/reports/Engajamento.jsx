import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { engajamentoTurma } from '../../services/feedback'
import { resumoEnunciado } from '../../services/questoes'
import { BarChart3, Flag, Star } from 'lucide-react'
import styles from './Engajamento.module.css'

const DIF_EMOJI = ['', '😴', '🙂', '😐', '😰', '🤯']
const rotulo = (q) => [q?.bancas?.nome, q?.orgaos?.nome, q?.cargo, q?.ano].filter(Boolean).join(' · ')

function Lista({ titulo, Icon, itens, vazio, render }) {
  return (
    <div className={styles.card}>
      <p className={styles.secTitulo}><Icon size={14} /> {titulo}</p>
      {itens.length === 0 ? <p className={styles.vazio}>{vazio}</p> : (
        <div className={styles.lista}>{itens.map(render)}</div>
      )}
    </div>
  )
}

export default function Engajamento() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['engajamento'], queryFn: engajamentoTurma })

  if (isLoading) return <div className={styles.loading}>Carregando engajamento...</div>
  const { maisDificeis = [], piorAvaliadas = [], maisReportadas = [] } = data || {}

  const linha = (extra) => (x) => (
    <button key={x.questao.id} className={styles.item} onClick={() => navigate(`/questoes/${x.questao.id}`)}>
      <span className={styles.destaque}>{extra(x)}</span>
      <span className={styles.info}>
        <span className={styles.resumo}>{resumoEnunciado(x.questao.enunciado, 90)}</span>
        <span className={styles.origem}>{rotulo(x.questao)}</span>
      </span>
    </button>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.titulo}><BarChart3 size={20} /> Engajamento da turma</h1>
        <p className={styles.subtitulo}>Onde os alunos travam — te ajuda a decidir onde gravar vídeo/aula</p>
      </div>

      <div className={styles.grid}>
        <Lista titulo="Mais reportadas" Icon={Flag} itens={maisReportadas}
          vazio="Nenhum report ainda."
          render={linha(x => <span className={styles.badgeReport}>{x.abertos > 0 ? `${x.abertos} aberto(s)` : `${x.total}×`}</span>)} />

        <Lista titulo="Mais difíceis (voto dos alunos)" Icon={Star} itens={maisDificeis}
          vazio="Poucos votos de dificuldade ainda."
          render={linha(x => <span className={styles.emoji}>{DIF_EMOJI[Math.round(x.difMedia)]} {x.difMedia.toFixed(1)}</span>)} />

        <Lista titulo="Resoluções pior avaliadas" Icon={Star} itens={piorAvaliadas}
          vazio="Poucas avaliações ainda."
          render={linha(x => <span className={styles.estrelas}>{x.estMedia.toFixed(1)} ★</span>)} />
      </div>
    </div>
  )
}
