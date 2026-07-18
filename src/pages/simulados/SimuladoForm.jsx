import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { criarSimulado, atualizarSimulado, buscarSimulado } from '../../services/simulados'
import { listarTurmas } from '../../services/turmas'
import {
  listarQuestoes, listarDisciplinas, resumoEnunciado, rotuloQuestao,
  listarFacetas, listarProvas, opcoesDisponiveis,
} from '../../services/questoes'
import { Plus, Trash2, ChevronLeft, Save, GripVertical, FileText } from 'lucide-react'
import SimuladoHeader, { CABECALHO_PADRAO } from '../../components/SimuladoHeader'
import toast from 'react-hot-toast'
import styles from './SimuladoForm.module.css'

export default function SimuladoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdicao = !!id

  const [form, setForm] = useState({ titulo: '', descricao: '', instrucoes: '', turma_id: '' })
  const [cabecalho, setCabecalho] = useState(CABECALHO_PADRAO)
  const [cabecalhoAberto, setCabecalhoAberto] = useState(false)
  const [cfgImpressao, setCfgImpressao] = useState({
    tamanhoFonte: 11,
    separadorQuestoes: true,
    quebrarPagina: false,
    questoesPorFolha: 0,      // 0 = todas (padrão); 1, 2 ou 3 = por folha
    espacoResolucao: false,   // reserva espaço em branco para resolver
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
        turma_id: simuladoExistente.turma_id || '',
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
  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: listarTurmas })

  // Provas (Órgão+Ano+Cargo) para adicionar em bloco
  const { data: facetas = [] } = useQuery({ queryKey: ['facetas'], queryFn: listarFacetas })
  const provas = useMemo(() => listarProvas(facetas), [facetas])
  const [provaSel, setProvaSel] = useState('')
  const [discProva, setDiscProva] = useState(new Set())
  const provaObj = provas.find(p => p.chave === provaSel) || null
  const disciplinasProva = useMemo(() => {
    if (!provaObj) return []
    const f = { orgao_id: provaObj.orgao_id, ano: provaObj.ano ?? undefined, cargo: provaObj.cargo ?? undefined }
    return (opcoesDisponiveis(facetas, f).disciplina_id || []).slice().sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
  }, [provaObj, facetas])

  function escolherProva(chave) {
    setProvaSel(chave)
    const p = provas.find(x => x.chave === chave)
    const f = p ? { orgao_id: p.orgao_id, ano: p.ano ?? undefined, cargo: p.cargo ?? undefined } : null
    setDiscProva(new Set(f ? (opcoesDisponiveis(facetas, f).disciplina_id || []).map(d => d.valor) : []))
  }
  function toggleDiscProva(idDisc) {
    setDiscProva(s => { const n = new Set(s); n.has(idDisc) ? n.delete(idDisc) : n.add(idDisc); return n })
  }

  const addProva = useMutation({
    mutationFn: async () => {
      if (!provaObj) throw new Error('Escolha uma prova')
      if (discProva.size === 0) throw new Error('Marque ao menos uma disciplina')
      const qs = await listarQuestoes({ orgao_id: provaObj.orgao_id, ano: provaObj.ano ?? undefined, cargo: provaObj.cargo ?? undefined })
      return qs.filter(q => discProva.has(q.disciplina_id)).map(q => q.id)
    },
    onSuccess: (ids) => {
      const novos = ids.filter(x => !questoes.includes(x))
      if (novos.length === 0) { toast.error('Essas questões já estão no simulado.'); return }
      setQuestoes(qs => [...qs, ...novos])
      toast.success(`${novos.length} questão(ões) adicionada(s).`)
    },
    onError: (err) => toast.error(err.message),
  })

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
        <button className={styles.btnBack} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/simulados'))}>
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
            <label className={styles.label} style={{ marginTop: 12 }}>Turma (opcional — só matriculados veem este simulado proposto)</label>
            <select className={styles.input}
              value={form.turma_id}
              onChange={e => setForm(f => ({ ...f, turma_id: e.target.value }))}>
              <option value="">Pública (todos os alunos, se proposto)</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
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

              <div className={styles.field}>
                <label className={styles.label}>Questões por folha (PDF)</label>
                <div className={styles.cfgFonteRow}>
                  {[{v:0,l:'Todas'},{v:1,l:'1'},{v:2,l:'2'},{v:3,l:'3'}].map(o => (
                    <button key={o.v} type="button"
                      className={`${styles.cfgFonteBtn} ${(cfgImpressao.questoesPorFolha ?? 0) === o.v ? styles.cfgFonteBtnOn : ''}`}
                      onClick={() => setCfgImpressao(c => ({...c, questoesPorFolha: o.v}))}>
                      {o.l}
                    </button>
                  ))}
                </div>
                <span className={styles.cfgHint}>Para aulas/gravação: 1 ou 2 questões por folha.</span>
              </div>

              <div className={styles.cfgOpcoes}>
                <label className={styles.cfgCheck}>
                  <input type="checkbox" checked={cfgImpressao.espacoResolucao}
                    onChange={e => setCfgImpressao(c => ({...c, espacoResolucao: e.target.checked}))} />
                  Reservar espaço para resolução (aulas/gravação)
                </label>
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
            <p className={styles.cardTitulo}><FileText size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Adicionar uma prova</p>
            <select className={styles.select ?? styles.input}
              value={provaSel} onChange={e => escolherProva(e.target.value)}
              style={{ marginBottom: 8, width: '100%' }}>
              <option value="">Escolha uma prova…</option>
              {provas.map(p => (
                <option key={p.chave} value={p.chave}>
                  {[p.banca, p.orgao, p.cargo, p.ano].filter(Boolean).join(' · ')} — {p.total}
                </option>
              ))}
            </select>
            {provaObj && (
              <>
                <p className={styles.provaHint}>Disciplinas (todas = prova inteira):</p>
                <div className={styles.provaChips}>
                  {disciplinasProva.map(d => (
                    <button key={d.valor} type="button"
                      className={`${styles.provaChip} ${discProva.has(d.valor) ? styles.provaChipOn : ''}`}
                      onClick={() => toggleDiscProva(d.valor)}>
                      {d.rotulo} ({d.total})
                    </button>
                  ))}
                </div>
                <button className={styles.btnAddProva}
                  onClick={() => addProva.mutate()} disabled={addProva.isPending}>
                  <Plus size={13} /> {addProva.isPending ? 'Adicionando...'
                    : `Adicionar ${discProva.size >= disciplinasProva.length ? 'a prova inteira' : `${discProva.size} disciplina(s)`}`}
                </button>
              </>
            )}
          </div>

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
