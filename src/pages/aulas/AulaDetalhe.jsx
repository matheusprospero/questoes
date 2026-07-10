import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { buscarAula } from '../../services/aulas'
import { resumoEnunciado, rotuloQuestao } from '../../services/questoes'
import { useAuth } from '../../contexts/AuthContext'
import VideoYouTube from '../../components/VideoYouTube'
import BloqueioAssinante from '../../components/BloqueioAssinante'
import {
  ChevronLeft, Pencil, Play, ChevronDown, ChevronUp, CheckCircle, XCircle,
  GraduationCap, PlayCircle,
} from 'lucide-react'
import styles from './AulaDetalhe.module.css'

const temGabarito = (q) =>
  q.tipo === 'certo_errado' ? q.gabarito_certo !== null : q.alternativas?.some(a => a.correta)

export default function AulaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin, isAssinante } = useAuth()
  const [expandida, setExpandida] = useState(new Set())

  const { data: aula, isLoading, error } = useQuery({
    queryKey: ['aula', id],
    queryFn: () => buscarAula(id),
    enabled: isAssinante,
  })

  function toggle(qid) {
    setExpandida(s => {
      const n = new Set(s)
      n.has(qid) ? n.delete(qid) : n.add(qid)
      return n
    })
  }

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

          <div className={styles.lista}>
            {aula.questoes.map((q, i) => {
              const aberta = expandida.has(q.id)
              const correta = q.alternativas?.find(a => a.correta)
              return (
                <div key={q.id} className={styles.qCard}>
                  <button className={styles.qHead} onClick={() => toggle(q.id)}>
                    <span className={styles.qNum}>{i + 1}</span>
                    <span className={styles.qResumo}>{resumoEnunciado(q.enunciado, 110) || rotuloQuestao(q)}</span>
                    {aberta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {aberta && (
                    <div className={styles.qBody}>
                      <div className={styles.enunciado} dangerouslySetInnerHTML={{ __html: q.enunciado }} />
                      {q.tipo === 'multipla_escolha' ? (
                        <div className={styles.alternativas}>
                          {q.alternativas.map(alt => (
                            <div key={alt.id} className={`${styles.alt} ${alt.correta ? styles.altOk : ''}`}>
                              <span className={styles.altLetra}>{alt.letra})</span>
                              <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
                              {alt.correta && <CheckCircle size={14} className={styles.altIcon} />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.gabCe}>
                          Gabarito: {q.gabarito_certo
                            ? <><CheckCircle size={15} className={styles.iconOk} /> Certo</>
                            : <><XCircle size={15} className={styles.iconErr} /> Errado</>}
                        </p>
                      )}
                      {q.comentario && (
                        <div className={styles.comentario}>
                          <p className={styles.comentLabel}>Comentário</p>
                          <div dangerouslySetInnerHTML={{ __html: q.comentario }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
