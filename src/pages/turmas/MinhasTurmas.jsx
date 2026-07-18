import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarTurmas, minhasMatriculas, solicitarMatricula, cancelarSolicitacao, disciplinasDaTurma,
} from '../../services/turmas'
import { GraduationCap, Check, Clock, X, BookOpen, ArrowRight } from 'lucide-react'
import styles from './MinhasTurmas.module.css'

export default function MinhasTurmas() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: turmas = [], isLoading } = useQuery({ queryKey: ['turmas'], queryFn: listarTurmas })
  const { data: matriculas = [] } = useQuery({ queryKey: ['minhas-matriculas'], queryFn: minhasMatriculas })

  // índice por `${turma_id}:${disciplina_id}` -> matrícula
  const porChave = useMemo(() => {
    const m = new Map()
    for (const mt of matriculas) m.set(`${mt.turma_id}:${mt.disciplina_id}`, mt)
    return m
  }, [matriculas])

  const resumo = useMemo(() => ({
    ativas: matriculas.filter(m => m.status === 'ativa').length,
    pendentes: matriculas.filter(m => m.status === 'pendente').length,
  }), [matriculas])

  const invalidar = () => qc.invalidateQueries({ queryKey: ['minhas-matriculas'] })

  const mSolicitar = useMutation({
    mutationFn: ({ turmaId, discId }) => solicitarMatricula(turmaId, discId),
    onSuccess: () => { invalidar(); toast.success('Solicitação enviada — aguarde a aprovação do professor.') },
    onError: (e) => toast.error('Erro: ' + e.message),
  })
  const mCancelar = useMutation({
    mutationFn: (id) => cancelarSolicitacao(id),
    onSuccess: () => { invalidar(); toast.success('Solicitação cancelada.') },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  if (isLoading) return <div className={styles.loading}>Carregando turmas…</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.titulo}><GraduationCap size={20} /> Minhas Turmas</h1>
        <p className={styles.subtitulo}>
          As turmas dão acesso a aulas e simulados exclusivos. Solicite matrícula nas
          disciplinas que quiser cursar — o professor aprova o seu acesso.
        </p>
      </div>

      {matriculas.length > 0 && (
        <div className={styles.resumo}>
          <span className={styles.resumoItem}><Check size={14} /> {resumo.ativas} matrícula(s) ativa(s)</span>
          {resumo.pendentes > 0 && <span className={styles.resumoItem}><Clock size={14} /> {resumo.pendentes} aguardando</span>}
        </div>
      )}

      {turmas.length === 0 ? (
        <div className={styles.vazio}><GraduationCap size={32} strokeWidth={1.5} /><p>Nenhuma turma disponível no momento.</p></div>
      ) : (
        <div className={styles.turmas}>
          {turmas.map(t => {
            const discs = disciplinasDaTurma(t)
            return (
              <div key={t.id} className={styles.turmaCard}>
                <div className={styles.turmaTopo}>
                  <span className={styles.turmaNome}>{t.nome}</span>
                  {matriculas.some(m => m.turma_id === t.id && m.status === 'ativa') && (
                    <button className={styles.verConteudo} onClick={() => navigate(`/turmas/${t.id}`)}>
                      Ver conteúdo <ArrowRight size={13} />
                    </button>
                  )}
                </div>
                {t.descricao && <p className={styles.turmaDesc}>{t.descricao}</p>}
                <div className={styles.discLista}>
                  {discs.length === 0 && <span className={styles.semDisc}>Esta turma ainda não tem disciplinas.</span>}
                  {discs.map(d => {
                    const mt = porChave.get(`${t.id}:${d.id}`)
                    const st = mt?.status
                    return (
                      <div key={d.id} className={styles.discLinha}>
                        <span className={styles.discNome}>
                          <span className={styles.dot} style={{ background: d.cor || 'var(--color-primary)' }} />
                          <BookOpen size={14} /> {d.nome}
                        </span>
                        {st === 'ativa' ? (
                          <span className={styles.chipOk}><Check size={12} /> Matriculado</span>
                        ) : st === 'pendente' ? (
                          <span className={styles.pendGrupo}>
                            <span className={styles.chipPend}><Clock size={12} /> Aguardando</span>
                            <button className={styles.cancelar} onClick={() => mCancelar.mutate(mt.id)}><X size={12} /> Cancelar</button>
                          </span>
                        ) : st === 'recusada' ? (
                          <span className={styles.chipErr}>Não aprovada</span>
                        ) : (
                          <button className={styles.btnSolicitar}
                            disabled={mSolicitar.isPending}
                            onClick={() => mSolicitar.mutate({ turmaId: t.id, discId: d.id })}>
                            Solicitar matrícula
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
