import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listarReports, resolverReport, enfileirarEmailReport } from '../../services/feedback'
import { resumoEnunciado } from '../../services/questoes'
import { Flag, Check, RotateCcw, Eye, AlertTriangle, User, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Reports.module.css'

const TIPO = {
  gabarito: 'Gabarito errado',
  sem_resposta: 'Sem resposta correta',
  enunciado: 'Enunciado / imagem',
  outro: 'Outro',
}
const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Reports() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [soAbertos, setSoAbertos] = useState(true)

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', soAbertos],
    queryFn: () => listarReports({ apenasAbertos: soAbertos }),
  })

  const resolver = useMutation({
    mutationFn: ({ id, resolvido }) => resolverReport(id, resolvido),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['reports-abertos'] })
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  })

  // Coloca o aviso de "questão corrigida" na fila; o Google Apps Script
  // envia pelo Gmail no próximo ciclo (a cada 10 min).
  const enviarEmail = useMutation({
    mutationFn: (report) => enfileirarEmailReport(report),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('E-mail na fila — será enviado em até 10 min.')
    },
    onError: (e) => toast.error('Erro ao enfileirar: ' + e.message),
  })

  function resolverEAvisar(r) {
    resolver.mutate({ id: r.id, resolvido: true })
    if (r.autor?.email && !r.email) enviarEmail.mutate(r)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}><Flag size={20} /> Problemas reportados</h1>
          <p className={styles.subtitulo}>O que os alunos sinalizaram nas questões</p>
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" checked={soAbertos} onChange={e => setSoAbertos(e.target.checked)} />
          Só os abertos
        </label>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : reports.length === 0 ? (
        <div className={styles.vazio}>
          <Check size={40} strokeWidth={1.5} />
          <p>{soAbertos ? 'Nenhum problema em aberto. 🎉' : 'Nenhum report ainda.'}</p>
        </div>
      ) : (
        <div className={styles.lista}>
          {reports.map(r => (
            <div key={r.id} className={`${styles.card} ${r.resolvido ? styles.cardResolvido : ''}`}>
              <div className={styles.cardTop}>
                <span className={`${styles.tipoTag} ${styles['tipo_' + r.tipo]}`}>
                  <AlertTriangle size={12} /> {TIPO[r.tipo] ?? r.tipo}
                </span>
                <span className={styles.data}>{fmt(r.criado_em)}</span>
                {r.resolvido && <span className={styles.resolvidoTag}>Resolvido</span>}
              </div>
              <p className={styles.enunciado}>
                {r.questoes ? resumoEnunciado(r.questoes.enunciado, 160) : '(questão removida)'}
              </p>
              {r.descricao && <p className={styles.descricao}>“{r.descricao}”</p>}
              {r.autor && (
                <p className={styles.autor}>
                  <User size={13} /> Reportado por <strong>{r.autor.nome || r.autor.email}</strong>
                  {r.autor.nome && r.autor.email ? ` (${r.autor.email})` : ''}
                </p>
              )}
              <div className={styles.origem}>
                {[r.questoes?.bancas?.nome, r.questoes?.orgaos?.nome, r.questoes?.cargo, r.questoes?.ano]
                  .filter(Boolean).join(' · ')}
              </div>
              <div className={styles.acoes}>
                {r.questoes && (
                  <button className={styles.btnGhost} onClick={() => navigate(`/questoes/${r.questoes.id}`)}>
                    <Eye size={14} /> Ver questão
                  </button>
                )}
                {r.questoes && (
                  <button className={styles.btnGhost} onClick={() => navigate(`/questoes/${r.questoes.id}/editar`)}>
                    Corrigir
                  </button>
                )}
                {r.email ? (
                  <span className={r.email.status === 'enviado' ? styles.emailOk : r.email.status === 'erro' ? styles.emailErro : styles.emailFila}>
                    <Mail size={13} />
                    {r.email.status === 'enviado' ? 'E-mail enviado' : r.email.status === 'erro' ? 'Erro no envio' : 'E-mail na fila'}
                  </span>
                ) : r.autor?.email && (
                  <button className={styles.btnGhost} onClick={() => enviarEmail.mutate(r)} disabled={enviarEmail.isPending}>
                    <Mail size={14} /> Avisar por e-mail
                  </button>
                )}
                {r.resolvido ? (
                  <button className={styles.btnGhost} onClick={() => resolver.mutate({ id: r.id, resolvido: false })}>
                    <RotateCcw size={14} /> Reabrir
                  </button>
                ) : (
                  <button className={styles.btnResolver} onClick={() => resolverEAvisar(r)}
                    title={r.autor?.email ? 'Marca como resolvido e coloca o aviso por e-mail na fila' : 'Marca como resolvido'}>
                    <Check size={14} /> Resolver{r.autor?.email ? ' + avisar' : ''}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
