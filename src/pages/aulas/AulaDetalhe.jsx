import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { buscarAula } from '../../services/aulas'
import { resumoEnunciado, rotuloQuestao } from '../../services/questoes'
import { useAuth } from '../../contexts/AuthContext'
import VideoYouTube from '../../components/VideoYouTube'
import BloqueioAssinante from '../../components/BloqueioAssinante'
import {
  ChevronLeft, Pencil, Play, GraduationCap, PlayCircle,
} from 'lucide-react'
import styles from './AulaDetalhe.module.css'

const temGabarito = (q) =>
  q.tipo === 'certo_errado' ? q.gabarito_certo !== null : q.alternativas?.some(a => a.correta)

export default function AulaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin, isAssinante } = useAuth()

  const { data: aula, isLoading, error } = useQuery({
    queryKey: ['aula', id],
    queryFn: () => buscarAula(id),
    enabled: isAssinante,
  })

  if (!isAssinante) {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.btnBack} onClick={() => navigate('/aulas')}>
            <ChevronLeft size={16} /> Voltar
          </button>
        </div>
        <BloqueioAssinante />
      </div>
    )
  }
  if (isLoading) return <div className={styles.loading}>Carregando aula...</div>
  if (error) return <div className={styles.vazio}>Não foi possível abrir a aula: {error.message}</div>

  const questoesResolviveis = (aula.questoes || []).filter(temGabarito)

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/aulas')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        {isAdmin && (
          <button className={styles.btnEdit} onClick={() => navigate(`/aulas/${id}/editar`)}>
            <Pencil size={14} /> Editar
          </button>
        )}
      </div>

      {/* Cabeçalho da aula */}
      <header className={styles.hero}>
        <span className={styles.heroTag}><GraduationCap size={14} /> Aula</span>
        <h1 className={styles.heroTitulo}>{aula.titulo}</h1>
        {aula.descricao && <p className={styles.heroDesc}>{aula.descricao}</p>}
        <div className={styles.heroMeta}>
          {aula.disciplinas && (
            <span className={styles.metaChip} style={{ '--cor': aula.disciplinas.cor || 'var(--color-primary)' }}>
              {aula.disciplinas.nome}
            </span>
          )}
          {aula.assuntos && <span className={styles.metaChip}>{aula.assuntos.nome}</span>}
          <span className={styles.metaChip}>{aula.questoes.length} questões</span>
        </div>
      </header>

      {/* Teoria */}
      {aula.conteudo?.length > 0 && (
        <section className={styles.teoria}>
          {aula.conteudo.map((b, i) => (
            b.tipo === 'texto' ? (
              <div key={i} className={styles.texto} dangerouslySetInnerHTML={{ __html: b.html }} />
            ) : (
              <div key={i} className={styles.videoBloco}>
                {b.titulo && <p className={styles.videoTitulo}><PlayCircle size={15} /> {b.titulo}</p>}
                <VideoYouTube url={b.url} titulo={b.titulo} />
              </div>
            )
          ))}
        </section>
      )}

      {/* Questões */}
      {aula.questoes.length > 0 && (
        <section className={styles.questoesSec}>
          <div className={styles.questoesHead}>
            <h2 className={styles.secaoTitulo}>Questões do tema</h2>
            {questoesResolviveis.length > 0 && (
              <button className={styles.btnResolver} onClick={() => navigate(`/estudo?aula=${id}`)}>
                <Play size={15} /> Resolver as {questoesResolviveis.length} questões
              </button>
            )}
          </div>
          <p className={styles.questoesHint}>
            Clique em “Resolver” para responder as questões sem ver o gabarito e conferir seu desempenho no final.
          </p>

          <div className={styles.lista}>
            {aula.questoes.map((q, i) => (
              <div key={q.id}
                className={`${styles.qLinha} ${isAdmin ? styles.qLinhaAdmin : ''}`}
                onClick={isAdmin ? () => navigate(`/questoes/${q.id}`) : undefined}
                title={isAdmin ? 'Ver questão (revisão)' : undefined}>
                <span className={styles.qNum}>{i + 1}</span>
                <span className={styles.qResumo}>{resumoEnunciado(q.enunciado, 120) || rotuloQuestao(q)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
