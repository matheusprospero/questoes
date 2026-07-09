import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buscarPlano, deletarPlano } from '../../services/planos'
import { useAuth } from '../../contexts/AuthContext'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { ChevronLeft, Pencil, Printer, Trash2, Clock, BookOpen } from 'lucide-react'
import styles from './PlanoDetalhe.module.css'

const STATUS_LABEL = { rascunho: 'Rascunho', publicado: 'Publicado', arquivado: 'Arquivado' }

const SECOES = [
  { campo: 'objetivos',    titulo: 'Objetivos' },
  { campo: 'conteudo',     titulo: 'Conteúdo' },
  { campo: 'desenvolvimento', titulo: 'Desenvolvimento' },
  { campo: 'metodologia',  titulo: 'Metodologia' },
  { campo: 'recursos',     titulo: 'Recursos necessários' },
  { campo: 'avaliacao',    titulo: 'Avaliação' },
]

export default function PlanoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario, isFormador, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: plano, isLoading, error } = useQuery({
    queryKey: ['plano', id],
    queryFn: () => buscarPlano(id),
  })

  const excluir = useMutation({
    mutationFn: () => deletarPlano(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos'] })
      toast.success('Plano excluído.')
      navigate('/planos')
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  if (isLoading) return <div className={styles.loading}>Carregando plano...</div>
  if (error || !plano) return <div className={styles.loading}>Plano não encontrado.</div>

  const ehDono = plano.autor_id === usuario?.id
  const podeEditar = ehDono || isFormador || isAdmin

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/planos')}>
          <ChevronLeft size={16} /> Planos de Aula
        </button>
        <div className={styles.topbarAcoes}>
          <button className={styles.btnIcon} onClick={() => window.print()} title="Imprimir">
            <Printer size={15} />
          </button>
          {podeEditar && (
            <button className={styles.btnIcon} onClick={() => navigate(`/planos/${id}/editar`)} title="Editar">
              <Pencil size={15} />
            </button>
          )}
          {ehDono && (
            <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => setConfirmDelete(true)} title="Excluir">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className={styles.cabecalho}>
        <div className={styles.metaTags}>
          {plano.disciplinas && (
            <span className={styles.discBadge} style={{ background: plano.disciplinas.cor + '22', color: plano.disciplinas.cor }}>
              <BookOpen size={12} /> {plano.disciplinas.nome}
            </span>
          )}
          {plano.ano_escolar && <span className={styles.badge}>{plano.ano_escolar}</span>}
          {plano.duracao_aulas && (
            <span className={styles.badge}><Clock size={11} /> {plano.duracao_aulas} aula(s)</span>
          )}
          <span className={`${styles.badge} ${styles['status_' + plano.status]}`}>
            {STATUS_LABEL[plano.status] ?? plano.status}
          </span>
        </div>

        <h1 className={styles.titulo}>{plano.titulo}</h1>
        {plano.descricao && <p className={styles.descricao}>{plano.descricao}</p>}

        <div className={styles.autorInfo}>
          {plano.perfis?.nome && <span>Por {plano.perfis.nome}</span>}
          {plano.criado_em && (
            <span>
              {new Date(plano.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <div className={styles.secoes}>
        {SECOES.map(({ campo, titulo }) =>
          plano[campo] ? (
            <section key={campo} className={styles.secao}>
              <h2 className={styles.secaoTitulo}>{titulo}</h2>
              <div className={styles.secaoTexto}>
                {plano[campo].split('\n').map((linha, i) =>
                  linha.trim() ? <p key={i}>{linha}</p> : <br key={i} />
                )}
              </div>
            </section>
          ) : null
        )}
      </div>

      {confirmDelete && (
        <div className={styles.overlay}>
          <div className={styles.confirmBox}>
            <p className={styles.confirmTitulo}>Excluir plano?</p>
            <p className={styles.confirmDesc}>
              "<strong>{plano.titulo}</strong>" será permanentemente excluído.
            </p>
            <div className={styles.confirmBotoes}>
              <button className={styles.btnCancel} onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button
                className={styles.btnDanger}
                onClick={() => excluir.mutate()}
                disabled={excluir.isPending}
              >
                {excluir.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
