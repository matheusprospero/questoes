import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarTurmas, minhasMatriculas, solicitarMatricula, cancelarSolicitacao,
  disciplinasDaTurma, precosDaTurma,
} from '../../services/turmas'
import { comprar, precoFmt } from '../../services/pagamentos'
import { GraduationCap, Check, Clock, X, BookOpen, ArrowRight, CreditCard } from 'lucide-react'
import styles from './MinhasTurmas.module.css'

export default function MinhasTurmas() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [comprando, setComprando] = useState('') // chave do item em processamento
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

  // Dispara o checkout do Mercado Pago (redireciona a página).
  async function iniciarCompra(params, chave) {
    if (comprando) return
    setComprando(chave)
    try {
      await comprar(params) // redireciona em caso de sucesso
    } catch (e) {
      toast.error(e.message || 'Não foi possível iniciar o pagamento.')
      setComprando('')
    }
  }

  if (isLoading) return <div className={styles.loading}>Carregando turmas…</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.titulo}><GraduationCap size={20} /> Minhas Turmas</h1>
        <p className={styles.subtitulo}>
          As turmas dão acesso a aulas e simulados exclusivos. Compre o acesso à turma
          completa ou a disciplinas avulsas — a liberação é automática após o pagamento.
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
            const precos = precosDaTurma(t)
            const temAtiva = matriculas.some(m => m.turma_id === t.id && m.status === 'ativa')
            const vendeCompleto = t.preco_mensal != null || t.preco_vitalicio != null
            const jaTemTudo = discs.length > 0 && discs.every(d => porChave.get(`${t.id}:${d.id}`)?.status === 'ativa')
            return (
              <div key={t.id} className={styles.turmaCard}>
                <div className={styles.turmaTopo}>
                  <span className={styles.turmaNome}>{t.nome}</span>
                  {temAtiva && (
                    <button className={styles.verConteudo} onClick={() => navigate(`/turmas/${t.id}`)}>
                      Ver conteúdo <ArrowRight size={13} />
                    </button>
                  )}
                </div>
                {t.descricao && <p className={styles.turmaDesc}>{t.descricao}</p>}

                {/* Acesso completo (todas as disciplinas) */}
                {vendeCompleto && !jaTemTudo && (
                  <div className={styles.completoBox}>
                    <span className={styles.completoTitulo}><GraduationCap size={14} /> Acesso completo à turma</span>
                    <div className={styles.planos}>
                      {t.preco_mensal != null && (
                        <button className={styles.btnComprar} disabled={!!comprando}
                          onClick={() => iniciarCompra({ turmaId: t.id, tipo: 'completo', plano: 'mensal' }, `c:${t.id}:m`)}>
                          <CreditCard size={13} /> {comprando === `c:${t.id}:m` ? 'Abrindo…' : `${precoFmt(t.preco_mensal)}/mês`}
                        </button>
                      )}
                      {t.preco_vitalicio != null && (
                        <button className={styles.btnComprarVital} disabled={!!comprando}
                          onClick={() => iniciarCompra({ turmaId: t.id, tipo: 'completo', plano: 'vitalicio' }, `c:${t.id}:v`)}>
                          <CreditCard size={13} /> {comprando === `c:${t.id}:v` ? 'Abrindo…' : `${precoFmt(t.preco_vitalicio)} vitalício`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className={styles.discLista}>
                  {discs.length === 0 && <span className={styles.semDisc}>Esta turma ainda não tem disciplinas.</span>}
                  {discs.map(d => {
                    const mt = porChave.get(`${t.id}:${d.id}`)
                    const st = mt?.status
                    const pr = precos.get(d.id) || {}
                    const vendeAvulsa = pr.preco_mensal != null || pr.preco_vitalicio != null
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
                        ) : vendeAvulsa ? (
                          <span className={styles.planos}>
                            {pr.preco_mensal != null && (
                              <button className={styles.btnComprar} disabled={!!comprando}
                                onClick={() => iniciarCompra({ turmaId: t.id, tipo: 'disciplina', plano: 'mensal', disciplinaIds: [d.id] }, `d:${d.id}:m`)}>
                                {comprando === `d:${d.id}:m` ? 'Abrindo…' : `${precoFmt(pr.preco_mensal)}/mês`}
                              </button>
                            )}
                            {pr.preco_vitalicio != null && (
                              <button className={styles.btnComprarVital} disabled={!!comprando}
                                onClick={() => iniciarCompra({ turmaId: t.id, tipo: 'disciplina', plano: 'vitalicio', disciplinaIds: [d.id] }, `d:${d.id}:v`)}>
                                {comprando === `d:${d.id}:v` ? 'Abrindo…' : `${precoFmt(pr.preco_vitalicio)} vitalício`}
                              </button>
                            )}
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
