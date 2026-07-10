import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listarSimulados, deletarSimulado, criarSimulado, buscarSimulado, alternarProposto, alternarDestaque } from '../../services/simulados'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Search, Eye, Pencil, Trash2, FileText, Copy, Play, Megaphone, BarChart3, Sparkles } from 'lucide-react'
import GuiaUso from '../../components/GuiaUso'
import styles from './Simulados.module.css'

export default function Simulados() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { usuario, isAdmin } = useAuth()

  const [buscaTexto, setBuscaTexto] = useState('')

  const { data: simulados = [], isLoading } = useQuery({
    queryKey: ['simulados'],
    queryFn: listarSimulados,
  })

  const excluir = useMutation({
    mutationFn: (id) => deletarSimulado(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulados'] })
      toast.success('Simulado excluído.')
    },
    onError: (err) => toast.error('Erro ao excluir: ' + err.message),
  })

  const propor = useMutation({
    mutationFn: ({ id, proposto }) => alternarProposto(id, proposto),
    onSuccess: (_, { proposto }) => {
      queryClient.invalidateQueries({ queryKey: ['simulados'] })
      toast.success(proposto
        ? 'Simulado proposto! Todos os alunos já podem vê-lo.'
        : 'Proposta retirada — o simulado voltou a ser só seu.')
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  const destacar = useMutation({
    mutationFn: ({ id, destaque }) => alternarDestaque(id, destaque),
    onSuccess: (_, { destaque }) => {
      queryClient.invalidateQueries({ queryKey: ['simulados'] })
      queryClient.invalidateQueries({ queryKey: ['simulados-destaque'] })
      toast.success(destaque
        ? 'Simulado em destaque na página inicial dos alunos!'
        : 'Destaque removido da página inicial.')
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  const duplicar = useMutation({
    mutationFn: async (simulado) => {
      const completo = await buscarSimulado(simulado.id)
      const dados = {
        titulo: `${completo.titulo} (cópia)`,
        descricao: completo.descricao || null,
        instrucoes: completo.instrucoes || null,
        cabecalho: completo.cabecalho || '',
        cfg_impressao: completo.cfg_impressao || {},
      }
      return criarSimulado(dados, (completo.questoes || []).map(q => q.id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulados'] })
      toast.success('Simulado duplicado!')
    },
    onError: (err) => toast.error('Erro ao duplicar: ' + err.message),
  })

  const simuladosFiltrados = simulados.filter(s =>
    !buscaTexto || s.titulo?.toLowerCase().includes(buscaTexto.toLowerCase())
  )
  // Meus x propostos pelo professor (visíveis a todos)
  const meus = simuladosFiltrados.filter(s => s.usuario_id === usuario?.id)
  const propostos = simuladosFiltrados.filter(s => s.proposto && s.usuario_id !== usuario?.id)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Simulados</h1>
          <p className={styles.subtitulo}>{simuladosFiltrados.length} simulado(s)</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/simulados/novo')}>
          <Plus size={15} /> Novo simulado
        </button>
      </div>

      <GuiaUso
        id="simulados"
        titulo="Como usar os simulados"
        passos={[
          { titulo: 'Crie um simulado', texto: 'Clique em "Novo simulado", dê um título e, se quiser, instruções de prova.' },
          { titulo: 'Monte a prova', texto: 'No Banco de Questões, expanda uma questão e clique em "+ Adicionar a um simulado".' },
          { titulo: 'Exporte ou imprima', texto: 'Abra o simulado e exporte para Word ou imprima — cronometre o tempo e treine como no dia da prova.' },
        ]}
      />

      {/* Busca */}
      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por título..."
            value={buscaTexto}
            onChange={e => setBuscaTexto(e.target.value)}
          />
        </div>
      </div>

      {/* Listas */}
      {isLoading ? (
        <div className={styles.loading}>Carregando simulados...</div>
      ) : (
        <>
          {/* Propostos pelo professor (visíveis a todos os alunos) */}
          {propostos.length > 0 && (
            <>
              <h2 className={styles.secaoTitulo}>
                <Megaphone size={14} /> Propostos pelo professor
              </h2>
              <div className={styles.lista}>
                {propostos.map(s => (
                  <div key={s.id} className={`${styles.card} ${styles.cardProposto}`}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardInfo}>
                        <div className={styles.cardTituloRow}>
                          <h3 className={styles.cardTitulo} onClick={() => navigate(`/simulados/${s.id}`)}>
                            {s.titulo}
                          </h3>
                        </div>
                        {s.descricao && <p className={styles.cardDesc}>{s.descricao.slice(0, 100)}</p>}
                      </div>
                      <div className={styles.cardAcoes}>
                        <button className={styles.iconBtn} onClick={() => navigate(`/simulados/${s.id}`)} title="Ver a prova">
                          <Eye size={15} />
                        </button>
                      </div>
                    </div>

                    <div className={styles.cardBadges}>
                      <span className={styles.badgeQuestoes}>{s.total_questoes} questões</span>
                    </div>

                    <button className={styles.btnResolver} onClick={() => navigate(`/estudo?simulado=${s.id}`)}>
                      <Play size={14} /> Resolver online
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {(propostos.length > 0 || isAdmin) && (
            <h2 className={styles.secaoTitulo}>Meus simulados</h2>
          )}

          {meus.length === 0 ? (
            <div className={styles.vazio}>
              <FileText size={36} strokeWidth={1.5} />
              <p>Você ainda não criou nenhum simulado</p>
              <button className={styles.btnPrimary} onClick={() => navigate('/simulados/novo')}>
                <Plus size={14} /> Criar simulado
              </button>
            </div>
          ) : (
            <div className={styles.lista}>
              {meus.map(s => (
                <div key={s.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardInfo}>
                      <div className={styles.cardTituloRow}>
                        <h3 className={styles.cardTitulo} onClick={() => navigate(`/simulados/${s.id}`)}>
                          {s.titulo}
                        </h3>
                      </div>
                      {s.descricao && <p className={styles.cardDesc}>{s.descricao.slice(0, 100)}</p>}
                    </div>
                    <div className={styles.cardAcoes}>
                      {isAdmin && (
                        <button
                          className={`${styles.iconBtn} ${s.proposto ? styles.iconBtnAtivo : ''}`}
                          onClick={() => propor.mutate({ id: s.id, proposto: !s.proposto })}
                          disabled={propor.isPending}
                          title={s.proposto ? 'Retirar proposta (só você verá)' : 'Propor para todos os alunos'}>
                          <Megaphone size={15} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          className={`${styles.iconBtn} ${s.destaque ? styles.iconBtnDestaque : ''}`}
                          onClick={() => destacar.mutate({ id: s.id, destaque: !s.destaque })}
                          disabled={destacar.isPending}
                          title={s.destaque ? 'Remover destaque da página inicial' : 'Destacar na página inicial (vira propaganda p/ os alunos)'}>
                          <Sparkles size={15} />
                        </button>
                      )}
                      {isAdmin && s.proposto && (
                        <button className={styles.iconBtn}
                          onClick={() => navigate(`/simulados/${s.id}/relatorio`)}
                          title="Relatório de desempenho dos alunos">
                          <BarChart3 size={15} />
                        </button>
                      )}
                      <button className={styles.iconBtn} onClick={() => navigate(`/estudo?simulado=${s.id}`)} title="Resolver online">
                        <Play size={15} />
                      </button>
                      <button className={styles.iconBtn} onClick={() => navigate(`/simulados/${s.id}`)} title="Ver">
                        <Eye size={15} />
                      </button>
                      <button className={styles.iconBtn} onClick={() => navigate(`/simulados/${s.id}/editar`)} title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button className={styles.iconBtn}
                        onClick={() => duplicar.mutate(s)}
                        disabled={duplicar.isPending}
                        title="Duplicar">
                        <Copy size={15} />
                      </button>
                      <button className={styles.iconBtn}
                        onClick={() => {
                          if (confirm(`Excluir o simulado "${s.titulo}"? As questões não são apagadas.`))
                            excluir.mutate(s.id)
                        }}
                        title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.cardBadges}>
                    <span className={styles.badgeQuestoes}>{s.total_questoes} questões</span>
                    {s.proposto && (
                      <span className={styles.badgeProposto}>
                        <Megaphone size={11} /> Proposto aos alunos
                      </span>
                    )}
                    {s.destaque && (
                      <span className={styles.badgeDestaque}>
                        <Sparkles size={11} /> Em destaque
                      </span>
                    )}
                  </div>

                  <div className={styles.cardFooter}>
                    <span className={styles.autor}>Meu simulado</span>
                    <span className={styles.data}>{new Date(s.criado_em).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
