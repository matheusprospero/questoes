import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { criarAula, atualizarAula, buscarAula } from '../../services/aulas'
import { listarTurmas, turmasDaAula, setTurmasDaAula } from '../../services/turmas'
import {
  listarQuestoes, listarDisciplinas, listarAssuntos, resumoEnunciado, rotuloQuestao,
} from '../../services/questoes'
import RichEditor from '../../components/RichEditor'
import VideoYouTube, { extrairIdYouTube } from '../../components/VideoYouTube'
import {
  ChevronLeft, Save, Plus, Trash2, Type, Youtube, ArrowUp, ArrowDown,
  Search, GripVertical,
} from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './AulaForm.module.css'

export default function AulaForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdicao = !!id

  const [form, setForm] = useState({ titulo: '', descricao: '', disciplina_id: '', assunto_id: '' })
  const [turmaIds, setTurmaIds] = useState(new Set())  // turmas a que a aula pertence
  const [blocos, setBlocos] = useState([])       // [{tipo:'texto',html} | {tipo:'video',url,titulo}]
  const [questaoIds, setQuestaoIds] = useState([]) // ordem preservada
  const [buscaQuestao, setBuscaQuestao] = useState('')
  const toggleTurma = (tid) => setTurmaIds(s => { const n = new Set(s); n.has(tid) ? n.delete(tid) : n.add(tid); return n })

  const { data: aulaExistente } = useQuery({
    queryKey: ['aula', id],
    queryFn: () => buscarAula(id),
    enabled: isEdicao,
  })
  const { data: turmasDaAulaAtual } = useQuery({
    queryKey: ['turmas-da-aula', id],
    queryFn: () => turmasDaAula(id),
    enabled: isEdicao,
  })

  useEffect(() => {
    if (aulaExistente) {
      setForm({
        titulo: aulaExistente.titulo || '',
        descricao: aulaExistente.descricao || '',
        disciplina_id: aulaExistente.disciplina_id || '',
        assunto_id: aulaExistente.assunto_id || '',
      })
      setBlocos(aulaExistente.conteudo || [])
      setQuestaoIds((aulaExistente.questoes || []).map(q => q.id))
    }
  }, [aulaExistente])
  useEffect(() => { if (turmasDaAulaAtual) setTurmaIds(new Set(turmasDaAulaAtual)) }, [turmasDaAulaAtual])

  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: listarDisciplinas })
  const { data: turmas = [] } = useQuery({ queryKey: ['turmas'], queryFn: listarTurmas })
  const { data: assuntos = [] } = useQuery({
    queryKey: ['assuntos', form.disciplina_id],
    queryFn: () => listarAssuntos(form.disciplina_id),
    enabled: !!form.disciplina_id,
  })
  const { data: questoes = [] } = useQuery({ queryKey: ['questoes', {}], queryFn: () => listarQuestoes({}) })

  const salvar = useMutation({
    mutationFn: async ({ publicar } = {}) => {
      if (!form.titulo.trim()) throw new Error('Dê um título à aula')
      // Limpa blocos vazios
      const conteudo = blocos.filter(b =>
        b.tipo === 'texto'
          ? b.html?.replace(/<[^>]*>/g, '').trim()
          : extrairIdYouTube(b.url))
      const dados = { ...form, conteudo }
      const aula = isEdicao ? await atualizarAula(id, dados, questaoIds) : await criarAula(dados, questaoIds)
      await setTurmasDaAula(aula.id, [...turmaIds])
      return aula
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['aulas'] })
      queryClient.invalidateQueries({ queryKey: ['aula', data.id] })
      queryClient.invalidateQueries({ queryKey: ['turmas-da-aula', data.id] })
      toast.success(isEdicao ? 'Aula atualizada!' : 'Aula criada!')
      navigate(`/aulas/${data.id}`)
    },
    onError: (err) => toast.error(err.message || 'Erro ao salvar'),
  })

  // ── Blocos de teoria ──
  function addBloco(tipo) {
    setBlocos(bs => [...bs, tipo === 'texto' ? { tipo: 'texto', html: '' } : { tipo: 'video', url: '', titulo: '' }])
  }
  function updateBloco(i, patch) {
    setBlocos(bs => bs.map((b, idx) => idx === i ? { ...b, ...patch } : b))
  }
  function removeBloco(i) {
    setBlocos(bs => bs.filter((_, idx) => idx !== i))
  }
  function moverBloco(i, dir) {
    setBlocos(bs => {
      const j = i + dir
      if (j < 0 || j >= bs.length) return bs
      const novo = [...bs]
      ;[novo[i], novo[j]] = [novo[j], novo[i]]
      return novo
    })
  }

  // ── Questões ──
  function toggleQuestao(qid) {
    setQuestaoIds(ids => ids.includes(qid) ? ids.filter(x => x !== qid) : [...ids, qid])
  }

  const questoesSelecionadas = useMemo(
    () => questaoIds.map(qid => questoes.find(q => q.id === qid)).filter(Boolean),
    [questaoIds, questoes]
  )

  const resultadosBusca = useMemo(() => {
    const termo = buscaQuestao.trim().toLowerCase()
    if (!termo) return []
    return questoes.filter(q => {
      if (questaoIds.includes(q.id)) return false
      return [
        q.enunciado?.replace(/<[^>]*>/g, ''),
        q.disciplinas?.nome, q.assuntos?.nome, q.bancas?.nome, q.orgaos?.nome, q.cargo,
      ].some(c => c?.toLowerCase().includes(termo))
    }).slice(0, 20)
  }, [buscaQuestao, questoes, questaoIds])

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/aulas'))}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <h1 className={styles.titulo}>{isEdicao ? 'Editar aula' : 'Nova aula'}</h1>
        <button className={styles.btnPrimary}
          onClick={() => salvar.mutate({})}
          disabled={salvar.isPending}>
          <Save size={14} /> {salvar.isPending ? 'Salvando...' : 'Salvar aula'}
        </button>
      </div>

      {/* Informações */}
      <div className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label}>Título da aula *</label>
          <input className={styles.input}
            placeholder="Ex: Porcentagem — conceitos e aplicações"
            value={form.titulo}
            onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Descrição (opcional)</label>
          <input className={styles.input}
            placeholder="Um resumo curto do que o aluno vai aprender"
            value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
          />
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>Disciplina</label>
            <select className={styles.input}
              value={form.disciplina_id}
              onChange={e => setForm(f => ({ ...f, disciplina_id: e.target.value, assunto_id: '' }))}>
              <option value="">Selecione...</option>
              {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>Assunto</label>
            <select className={styles.input}
              value={form.assunto_id}
              onChange={e => setForm(f => ({ ...f, assunto_id: e.target.value }))}
              disabled={!form.disciplina_id}
              title={form.disciplina_id ? undefined : 'Escolha a disciplina antes'}>
              <option value="">{form.disciplina_id ? 'Selecione...' : 'Escolha a disciplina'}</option>
              {assuntos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Turmas (opcional — sem nenhuma marcada, a aula é pública)</label>
          {turmas.length === 0 ? (
            <p className={styles.turmaDica}>Nenhuma turma criada. A aula fica pública.</p>
          ) : (
            <div className={styles.turmaChips}>
              {turmas.map(t => (
                <label key={t.id} className={`${styles.turmaChip} ${turmaIds.has(t.id) ? styles.turmaChipOn : ''}`}>
                  <input type="checkbox" checked={turmaIds.has(t.id)} onChange={() => toggleTurma(t.id)} />
                  {t.nome}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Teoria */}
      <div className={styles.card}>
        <div className={styles.secaoHead}>
          <h2 className={styles.secaoTitulo}>Teoria</h2>
          <div className={styles.secaoAcoes}>
            <button type="button" className={styles.btnAdd} onClick={() => addBloco('texto')}>
              <Type size={14} /> Texto
            </button>
            <button type="button" className={styles.btnAdd} onClick={() => addBloco('video')}>
              <Youtube size={14} /> Vídeo
            </button>
          </div>
        </div>

        {blocos.length === 0 ? (
          <p className={styles.vazioHint}>
            Monte a teoria adicionando blocos de <strong>texto</strong> e <strong>vídeo</strong> na ordem que quiser.
          </p>
        ) : (
          <div className={styles.blocos}>
            {blocos.map((b, i) => (
              <div key={i} className={styles.bloco}>
                <div className={styles.blocoBarra}>
                  <span className={styles.blocoTipo}>
                    {b.tipo === 'texto' ? <><Type size={13} /> Texto</> : <><Youtube size={13} /> Vídeo</>}
                  </span>
                  <div className={styles.blocoBtns}>
                    <button type="button" className={styles.blocoBtn} onClick={() => moverBloco(i, -1)} disabled={i === 0} title="Subir">
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" className={styles.blocoBtn} onClick={() => moverBloco(i, 1)} disabled={i === blocos.length - 1} title="Descer">
                      <ArrowDown size={14} />
                    </button>
                    <button type="button" className={`${styles.blocoBtn} ${styles.blocoBtnDanger}`} onClick={() => removeBloco(i)} title="Remover bloco">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {b.tipo === 'texto' ? (
                  <RichEditor
                    value={b.html}
                    onChange={html => updateBloco(i, { html })}
                    placeholder="Escreva a teoria deste trecho..."
                  />
                ) : (
                  <div className={styles.videoBloco}>
                    <input className={styles.input}
                      placeholder="Título do vídeo (opcional)"
                      value={b.titulo || ''}
                      onChange={e => updateBloco(i, { titulo: e.target.value })}
                    />
                    <input className={styles.input}
                      placeholder="Link do YouTube (https://youtu.be/...)"
                      value={b.url || ''}
                      onChange={e => updateBloco(i, { url: e.target.value })}
                    />
                    {b.url?.trim() && !extrairIdYouTube(b.url) && (
                      <p className={styles.erroHint}>Não reconheci esse link como um vídeo do YouTube.</p>
                    )}
                    {extrairIdYouTube(b.url) && (
                      <div className={styles.videoPreview}><VideoYouTube url={b.url} titulo={b.titulo} /></div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Questões */}
      <div className={styles.card}>
        <div className={styles.secaoHead}>
          <h2 className={styles.secaoTitulo}>Questões do tema</h2>
          <span className={styles.contador}>{questoesSelecionadas.length} selecionada(s)</span>
        </div>

        {questoesSelecionadas.length > 0 && (
          <div className={styles.selecionadas}>
            {questoesSelecionadas.map((q, i) => (
              <div key={q.id} className={styles.qSelecionada}>
                <GripVertical size={14} className={styles.grip} />
                <span className={styles.qNum}>{i + 1}</span>
                <div className={styles.qInfo}>
                  <span className={styles.qResumo}>{resumoEnunciado(q.enunciado, 90) || rotuloQuestao(q)}</span>
                  <span className={styles.qMeta}>{rotuloQuestao(q)}</span>
                </div>
                <button type="button" className={styles.qRemove} onClick={() => toggleQuestao(q.id)} title="Remover">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.buscaWrap}>
          <Search size={15} className={styles.buscaIcon} />
          <input className={styles.buscaInput}
            placeholder="Buscar questões por enunciado, disciplina, banca..."
            value={buscaQuestao}
            onChange={e => setBuscaQuestao(e.target.value)}
          />
        </div>
        {buscaQuestao.trim() && (
          <div className={styles.resultados}>
            {resultadosBusca.length === 0 ? (
              <p className={styles.vazioHint}>Nenhuma questão nova encontrada para “{buscaQuestao}”.</p>
            ) : resultadosBusca.map(q => (
              <button key={q.id} type="button" className={styles.resultado} onClick={() => toggleQuestao(q.id)}>
                <Plus size={14} className={styles.resultadoAdd} />
                <div className={styles.qInfo}>
                  <span className={styles.qResumo}>{resumoEnunciado(q.enunciado, 90) || rotuloQuestao(q)}</span>
                  <span className={styles.qMeta}>{rotuloQuestao(q)}{q.disciplinas ? ` · ${q.disciplinas.nome}` : ''}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.rodape}>
        <button className={styles.btnPrimary}
          onClick={() => salvar.mutate({})}
          disabled={salvar.isPending}>
          <Save size={14} /> {salvar.isPending ? 'Salvando...' : 'Salvar aula'}
        </button>
      </div>
    </div>
  )
}
