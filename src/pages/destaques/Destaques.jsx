import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listarDestaques, alternarDestaqueAtivo, deletarDestaque, trocarOrdem, statusDestaque,
} from '../../services/destaques'
import CardDestaque from '../../components/CardDestaque'
import {
  Plus, Sparkles, Pencil, Trash2, Eye, EyeOff, ArrowUp, ArrowDown,
  ClipboardList, GraduationCap, Link2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Destaques.module.css'

const ICONE_TIPO = { simulado: ClipboardList, aula: GraduationCap, livre: Link2 }
const LABEL_TIPO = { simulado: 'Simulado', aula: 'Aula', livre: 'Card livre' }
const STATUS = {
  no_ar:    { label: 'No ar',    cls: 'statusNoAr' },
  agendado: { label: 'Agendado', cls: 'statusAgendado' },
  expirado: { label: 'Expirado', cls: 'statusExpirado' },
  oculto:   { label: 'Oculto',   cls: 'statusOculto' },
}
const fmtData = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function Destaques() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: destaques = [], isLoading } = useQuery({ queryKey: ['destaques'], queryFn: listarDestaques })
  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['destaques'] })
    queryClient.invalidateQueries({ queryKey: ['destaques-ativos'] })
  }

  const ativar = useMutation({
    mutationFn: ({ id, ativo }) => alternarDestaqueAtivo(id, ativo),
    onSuccess: (_, { ativo }) => { invalidar(); toast.success(ativo ? 'Card publicado na página inicial.' : 'Card ocultado.') },
    onError: (err) => toast.error('Erro: ' + err.message),
  })
  const excluir = useMutation({
    mutationFn: (id) => deletarDestaque(id),
    onSuccess: () => { invalidar(); toast.success('Destaque excluído.') },
    onError: (err) => toast.error('Erro: ' + err.message),
  })
  const reordenar = useMutation({
    mutationFn: ({ a, b }) => trocarOrdem(a, b),
    onSuccess: invalidar,
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Destaques da página inicial</h1>
          <p className={styles.subtitulo}>Cards de propaganda que os alunos veem ao entrar.</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/destaques/novo')}>
          <Plus size={15} /> Novo destaque
        </button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : destaques.length === 0 ? (
        <div className={styles.vazio}>
          <Sparkles size={40} strokeWidth={1.5} />
          <p>Nenhum destaque criado ainda.</p>
          <button className={styles.btnPrimary} onClick={() => navigate('/destaques/novo')}>
            <Plus size={14} /> Criar primeiro destaque
          </button>
        </div>
      ) : (
        <div className={styles.lista}>
          {destaques.map((d, i) => {
            const IconeTipo = ICONE_TIPO[d.tipo] || Link2
            const st = STATUS[statusDestaque(d)]
            return (
              <div key={d.id} className={`${styles.item} ${!d.ativo ? styles.itemInativo : ''}`}>
                <div className={styles.ordem}>
                  <button className={styles.ordemBtn} disabled={i === 0}
                    onClick={() => reordenar.mutate({ a: d, b: destaques[i - 1] })} title="Subir">
                    <ArrowUp size={14} />
                  </button>
                  <button className={styles.ordemBtn} disabled={i === destaques.length - 1}
                    onClick={() => reordenar.mutate({ a: d, b: destaques[i + 1] })} title="Descer">
                    <ArrowDown size={14} />
                  </button>
                </div>

                <div className={styles.previewMini}>
                  <CardDestaque destaque={d} onClick={() => {}} />
                </div>

                <div className={styles.meta}>
                  <span className={styles.tipoTag}><IconeTipo size={12} /> {LABEL_TIPO[d.tipo]}</span>
                  <span className={`${styles.status} ${styles[st.cls]}`}>{st.label}</span>
                  {(d.publicar_em || d.expira_em) && (
                    <span className={styles.agendaInfo}>
                      {d.publicar_em && <>de {fmtData(d.publicar_em)}</>}
                      {d.expira_em && <> até {fmtData(d.expira_em)}</>}
                    </span>
                  )}
                  <div className={styles.acoes}>
                    <button className={`${styles.iconBtn} ${d.ativo ? styles.iconBtnOn : ''}`}
                      onClick={() => ativar.mutate({ id: d.id, ativo: !d.ativo })}
                      title={d.ativo ? 'Ocultar da página inicial' : 'Publicar na página inicial'}>
                      {d.ativo ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button className={styles.iconBtn} onClick={() => navigate(`/destaques/${d.id}/editar`)} title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button className={styles.iconBtn}
                      onClick={() => { if (confirm(`Excluir o destaque "${d.titulo}"?`)) excluir.mutate(d.id) }}
                      title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
