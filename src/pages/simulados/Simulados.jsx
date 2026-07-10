import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listarSimulados, deletarSimulado, criarSimulado, buscarSimulado } from '../../services/simulados'
import toast from 'react-hot-toast'
import { Plus, Search, Eye, Pencil, Trash2, FileText, Copy } from 'lucide-react'
import GuiaUso from '../../components/GuiaUso'
import styles from './Simulados.module.css'

export default function Simulados() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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

      {/* Lista */}
      {isLoading ? (
        <div className={styles.loading}>Carregando simulados...</div>
      ) : simuladosFiltrados.length === 0 ? (
        <div className={styles.vazio}>
          <FileText size={36} strokeWidth={1.5} />
          <p>Você ainda não criou nenhum simulado</p>
          <button className={styles.btnPrimary} onClick={() => navigate('/simulados/novo')}>
            <Plus size={14} /> Criar simulado
          </button>
        </div>
      ) : (
        <div className={styles.lista}>
          {simuladosFiltrados.map(s => (
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
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.autor}>Meu simulado</span>
                <span className={styles.data}>{new Date(s.criado_em).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
