import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { criarSimulado, atualizarSimulado, buscarSimulado } from '../../services/simulados'
import { listarQuestoes, listarDisciplinas, resumoEnunciado, rotuloQuestao } from '../../services/questoes'
import { Plus, Trash2, ChevronLeft, Save, GripVertical } from 'lucide-react'
import SimuladoHeader, { CABECALHO_PADRAO } from '../../components/SimuladoHeader'
import toast from 'react-hot-toast'
import styles from './SimuladoForm.module.css'

export default function SimuladoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdicao = !!id

  const [form, setForm] = useState({ titulo: '', descricao: '', instrucoes: '' })
  const [cabecalho, setCabecalho] = useState(CABECALHO_PADRAO)
  const [cabecalhoAberto, setCabecalhoAberto] = useState(false)
  const [cfgImpressao, setCfgImpressao] = useState({
    tamanhoFonte: 11,
    separadorQuestoes: true,
    quebrarPagina: false,
    rodapeEsquerda: 'Total: {total} questões',
    rodapeDireita: 'Boa prova!',
  })
  const [questoes, setQuestoes] = useState([])
  const [buscaTexto, setBuscaTexto] = useState('')
  const [filtroDisc, setFiltroDisc] = useState('')
  const [dragIndex, setDragIndex] = useState(null)

  const { data: simuladoExistente } = useQuery({
    queryKey: ['simulado', id],
    queryFn: () => buscarSimulado(id),
    enabled: isEdicao,
  })

  useEffect(() => {
    if (simuladoExistente) {
      setForm({
        titulo: simuladoExistente.titulo,
        descricao: simuladoExistente.descricao || '',
        instrucoes: simuladoExistente.instrucoes || '',
      })
      setQuestoes(simuladoExistente.questoes?.map(q => q.id) || [])
      setCabecalho(simuladoExistente.cabecalho || CABECALHO_PADRAO)
      if (simuladoExistente.cfg_impressao) setCfgImpressao({
        tamanhoFonte: 11,
        separadorQuestoes: true,
        quebrarPagina: false,
        rodapeEsquerda: 'Total: {total} questões',
        rodapeDireita: 'Boa prova!',
        ...simuladoExistente.cfg_impressao,
      })
    }
  }, [simuladoExistente])

  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: listarDisciplinas })

  const { data: todasQuestoes = [] } = useQuery({
    queryKey: ['questoes', { disciplina_id: filtroDisc || undefined }],
    queryFn: () => listarQuestoes(filtroDisc ? { disciplina_id: filtroDisc } : {}),
  })

  const questoesBusca = todasQuestoes.filter(q => {
    const t = buscaTexto.toLowerCase()
    return !buscaTexto || [
      q.enunciado?.replace(/<[^>]*>/g, ''),
      q.bancas?.nome, q.orgaos?.nome, q.assuntos?.nome, String(q.ano ?? ''),
    ].some(c => c?.toLowerCase().includes(t))
  })

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error('Título é obrigatório')

      const dados = { ...form, cabecalho, cfg_impressao: cfgImpressao }

      if (isEdicao) {
        return atualizarSimulado(id, dados, questoes)
      } else {
        return criarSimulado(dados, questoes)
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['simulado', data.id] })
      queryClient.invalidateQueries({ queryKey: ['simulados'] })
      toast.success(isEdicao ? 'Simulado atualizado!' : 'Simulado criado!')
      navigate(`/simulados/${data.id}`)
    },
    onError: (err) => toast.error(err.message),
  })

  function addQuestao(qId) {
    if (!questoes.includes(qId)) {
      setQuestoes([...questoes, qId])
      toast.success('Questão adicionada')
    } else {
      toast.error('Questão já está no simulado')
    }
  }

  function removeQuestao(idx) {
    setQuestoes(qs => qs.filter((_, i) => i !== idx))
  }

  function moveQuestao(fromIdx, toIdx) {
    const novas = [...questoes]
    const [removed] = novas.splice(fromIdx, 1)
    novas.splice(toIdx, 0, removed)
    setQuestoes(novas)
  }

  function labelQuestao(qId) {
    const q = todasQuestoes.find(qq => qq.id === qId)
    if (!q) return 'Questão'
    return `${rotuloQuestao(q)} — ${resumoEnunciado(q.enunciado, 60)}`
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/simulados')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <h1 className={styles.titulo}>{isEdicao ? 'Editar simulado' : 'Novo simulado'}</h1>
        <button className={styles.btnPrimary}
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending}>
          <Save size={14} /> {salvar.isPending ? 'Salvando...' : 'Salvar simulado'}
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.colMain}>
          <div className={styles.card}>
            <label className={styles.label}>Título do simulado *</label>
            <input className={styles.input}
              placeholder="Ex: Simulado PF — Agente Administrativo"
              value={form.titulo}
              onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
            />
          </div>

          <div className={styles.card}>
            <label className={styles.label}>Descrição</label>
            <textarea className={styles.textarea}
              placeholder="Contexto ou objetivo do simulado..."
              value={form.descricao}
              onChange={e => setForm(f => ({...f, descricao: e.target.value}))}
              rows={3}
            />
          </div>

          <div className={styles.card}>
            <label className={styles.label}>Cabeçalho do simulado</label>
            <SimuladoHeader value={cabecalho} onChange={setCabecalho} aberto={cabecalhoAberto} setAberto={setCabecalhoAberto} />
          </div>

          <div className={styles.card}>
            <label className={styles.label}>Instruções</label>
            <textarea className={styles.textarea}
              placeholder="Ex: Marque apenas uma alternativa por questão. Tempo sugerido: 2h..."
              value={form.instrucoes}
              onChange={e => setForm(f => ({...f, instrucoes: e.target.value}))}
              rows={2}
            />
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitulo}>Configurações de impressão / PDF</p>

            <div className={styles.cfgGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Tamanho da fonte das questões</label>
                <div className={styles.cfgFonteRow}>
                  {[9,10,11,12,13,14].map(n => (
                    <button key={n} type="button"
                      className={`${styles.cfgFonteBtn} ${cfgImpressao.tamanhoFonte === n ? styles.cfgFonteBtnOn : ''}`}
                      onClick={() => setCfgImpressao(c => ({...c, tamanhoFonte: n}))}>
                      {n}pt
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.cfgOpcoes}>
                <label className={styles.cfgCheck}>
                  <input type="checkbox" checked={cfgImpressao.separadorQuestoes}
                    onChange={e => setCfgImpressao(c => ({...c, separadorQuestoes: e.target.checked}))} />
                  Separador entre questões (linha)
                </label>
                <label className={styles.cfgCheck}>
                  <input type="checkbox" checked={cfgImpressao.quebrarPagina}
                    onChange={e => setCfgImpressao(c => ({...c, quebrarPagina: e.target.checked}))} />
                  Evitar quebra de página dentro de uma questão
                </label>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Rodapé — lado esquerdo</label>
                <input className={styles.input}
                  placeholder="Ex: Total: {total} questões"
                  value={cfgImpressao.rodapeEsquerda ?? 'Total: {total} questões'}
                  onChange={e => setCfgImpressao(c => ({...c, rodapeEsquerda: e.target.value}))}
                />
                <span className={styles.cfgHint}>Use <code>{'{total}'}</code> para número de questões</span>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Rodapé — lado direito</label>
                <input className={styles.input}
                  placeholder="Ex: Boa prova!"
                  value={cfgImpressao.rodapeDireita ?? 'Boa prova!'}
                  onChange={e => setCfgImpressao(c => ({...c, rodapeDireita: e.target.value}))}
                />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitulo}>Questões selecionadas ({questoes.length})</p>
            {questoes.length === 0 ? (
              <p className={styles.vazioQuestoes}>Nenhuma questão adicionada ainda. Use a busca ao lado.</p>
            ) : (
              <div className={styles.questoesList}>
                {questoes.map((qId, idx) => (
                  <div key={qId} className={styles.questaoItem}
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => moveQuestao(dragIndex, idx)}>
                    <GripVertical size={14} className={styles.dragHandle} />
                    <span className={styles.qNum}>{idx + 1}.</span>
                    <span className={styles.qTitulo}>{labelQuestao(qId)}</span>
                    <button className={styles.removeBtn} onClick={() => removeQuestao(idx)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.colSide}>
          <div className={styles.card}>
            <p className={styles.cardTitulo}>Buscar questões</p>
            <select className={styles.select ?? styles.input}
              value={filtroDisc}
              onChange={e => setFiltroDisc(e.target.value)}
              style={{marginBottom: 8, width: '100%'}}>
              <option value="">Todas as disciplinas</option>
              {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <input className={styles.input}
              placeholder="Enunciado, banca, órgão, ano..."
              value={buscaTexto}
              onChange={e => setBuscaTexto(e.target.value)}
              style={{marginBottom: 8}}
            />
            <div className={styles.questoesDisponiveis}>
              {questoesBusca.length === 0 ? (
                <p className={styles.hint}>Nenhuma questão encontrada</p>
              ) : (
                questoesBusca.slice(0, 30).map(q => (
                  <button key={q.id} className={styles.btnAddQuestao}
                    onClick={() => addQuestao(q.id)}>
                    <Plus size={13} /> {`${rotuloQuestao(q)} — ${resumoEnunciado(q.enunciado, 45)}`}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
