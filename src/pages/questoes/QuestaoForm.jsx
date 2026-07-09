import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  criarQuestao, atualizarQuestao, buscarQuestao,
  listarDisciplinas, listarHabilidades
} from '../../services/questoes'
import { useAuth } from '../../contexts/AuthContext'
import RichEditor from '../../components/RichEditor'
import { Plus, Trash2, ChevronLeft, Save, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './QuestaoForm.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']
const LETRAS = ['A','B','C','D','E']

const ALTERNATIVA_VAZIA = { letra: '', texto: '', correta: false }

function novasAlternativas() {
  return LETRAS.slice(0, 4).map(l => ({ letra: l, texto: '', correta: false }))
}

export default function QuestaoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const isEdicao = !!id

  const [form, setForm] = useState({
    titulo: '', tipo: 'multipla_escolha', enunciado: '',
    comentario_pedagogico: '', nivel_dificuldade: 3,
    fonte: '', disciplina_id: '', ano_escolar: '', status: 'rascunho',
  })
  const [alternativas, setAlternativas] = useState(novasAlternativas())
  const [gabarito, setGabarito] = useState({ texto: '', criterios: '' })
  const [habilidadeIds, setHabilidadeIds] = useState([])
  const [habilidadeFiltroAno, setHabilidadeFiltroAno] = useState('')

  // Carregar questão para edição
  const { data: questaoExistente } = useQuery({
    queryKey: ['questao', id],
    queryFn: () => buscarQuestao(id),
    enabled: isEdicao,
  })

  useEffect(() => {
    if (questaoExistente) {
      setForm({
        titulo: questaoExistente.titulo,
        tipo: questaoExistente.tipo,
        enunciado: questaoExistente.enunciado,
        comentario_pedagogico: questaoExistente.comentario_pedagogico || '',
        nivel_dificuldade: questaoExistente.nivel_dificuldade || 3,
        fonte: questaoExistente.fonte || '',
        disciplina_id: questaoExistente.disciplina_id || '',
        ano_escolar: questaoExistente.ano_escolar || '',
        status: questaoExistente.status,
      })
      if (questaoExistente.alternativas?.length) {
        const alts = questaoExistente.alternativas.map((a, i) => ({
          letra: a.letra || LETRAS[i],
          texto: a.texto || '',
          correta: !!a.correta,
        }))
        setAlternativas(alts)
      }
      if (questaoExistente.gabarito) setGabarito({
        texto: questaoExistente.gabarito.texto || '',
        criterios: questaoExistente.gabarito.criterios || '',
      })
      setHabilidadeIds(questaoExistente.habilidades?.map(h => h.id) || [])
    }
  }, [questaoExistente])

  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: listarDisciplinas })

  const { data: habilidades = [] } = useQuery({
    queryKey: ['habilidades', form.disciplina_id, habilidadeFiltroAno],
    queryFn: () => listarHabilidades({ disciplina_id: form.disciplina_id || undefined, ano_escolar: habilidadeFiltroAno || undefined }),
    enabled: true,
  })

  const salvar = useMutation({
    mutationFn: async (statusFinal) => {
      if (!form.titulo.trim()) throw new Error('Título é obrigatório')
      const textoEnunciado = form.enunciado.replace(/<[^>]*>/g, '').trim()
      if (!textoEnunciado) throw new Error('Enunciado é obrigatório')
      if (form.tipo === 'multipla_escolha') {
        const temCorreta = alternativas.some(a => a.correta)
        if (!temCorreta) throw new Error('Marque pelo menos uma alternativa correta')
        if (alternativas.some(a => !a.texto.replace(/<[^>]*>/g,'').trim())) throw new Error('Preencha todas as alternativas')
      }

      const dados = {
        ...form,
        disciplina_id: form.disciplina_id || null,
        status: statusFinal,
        autor_id: usuario.id,
        versao_atual: (questaoExistente?.versao_atual ?? 0) + 1,
      }

      if (isEdicao) {
        return atualizarQuestao(id, dados, alternativas, gabarito, habilidadeIds)
      } else {
        return criarQuestao(dados, alternativas, gabarito, habilidadeIds)
      }
    },
    onSuccess: (data) => {
      toast.success(isEdicao ? 'Questão atualizada!' : 'Questão criada!')
      navigate(`/questoes/${data.id}`)
    },
    onError: (err) => toast.error(err.message || 'Erro ao salvar'),
  })

  function handleAltTab(e, i) {
    if (e.key === 'Tab' && !e.shiftKey) {
      const proxima = document.querySelector(`[data-alt-index="${i + 1}"] [contenteditable]`)
      if (proxima) {
        e.preventDefault()
        proxima.focus()
      }
    }
    if (e.key === 'Tab' && e.shiftKey) {
      const anterior = document.querySelector(`[data-alt-index="${i - 1}"] [contenteditable]`)
      if (anterior) {
        e.preventDefault()
        anterior.focus()
      }
    }
  }

  function setAlt(i, field, value) {
    setAlternativas(alts => alts.map((a, idx) =>
      idx === i
        ? { ...a, [field]: value }
        : field === 'correta' && value ? { ...a, correta: false } : a
    ))
  }

  function addAlternativa() {
    if (alternativas.length >= 5) return
    setAlternativas(alts => [...alts, { ...ALTERNATIVA_VAZIA, letra: LETRAS[alts.length] }])
  }

  function removeAlternativa(i) {
    if (alternativas.length <= 2) return
    setAlternativas(alts => alts.filter((_, idx) => idx !== i))
  }

  function toggleHabilidade(hid) {
    setHabilidadeIds(ids =>
      ids.includes(hid) ? ids.filter(i => i !== hid) : [...ids, hid]
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/questoes')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <h1 className={styles.titulo}>{isEdicao ? 'Editar questão' : 'Nova questão'}</h1>
        <div className={styles.topbarAcoes}>
          <button className={styles.btnSecondary}
            onClick={() => salvar.mutate('rascunho')}
            disabled={salvar.isPending}>
            <Save size={14} /> Salvar rascunho
          </button>
          <button className={styles.btnPrimary}
            onClick={() => salvar.mutate('em_revisao')}
            disabled={salvar.isPending}>
            <Send size={14} /> {salvar.isPending ? 'Salvando...' : 'Enviar para revisão'}
          </button>
        </div>
      </div>

      <div className={styles.grid} key={questaoExistente?.id ?? 'novo'}>
        {/* Coluna principal */}
        <div className={styles.colMain}>

          {/* Título */}
          <div className={styles.card}>
            <label className={styles.label}>Título da questão *</label>
            <input className={styles.input}
              placeholder="Ex: Expressões numéricas — ordem das operações"
              value={form.titulo}
              onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
            />
          </div>

          {/* Enunciado com Editor Avançado */}
          <div className={styles.card}>
            <RichEditor
              label="Enunciado *"
              placeholder="Digite o enunciado da questão..."
              value={form.enunciado}
              onChange={(html) => setForm(f => ({...f, enunciado: html}))}
            />
          </div>

          {/* Alternativas ou Gabarito */}
          <div className={styles.card}>
            <div className={styles.tipoSwitch}>
              <span className={styles.label}>Tipo de questão</span>
              <div className={styles.switchGroup}>
                {['multipla_escolha','dissertativa'].map(t => (
                  <button key={t}
                    className={`${styles.switchBtn} ${form.tipo === t ? styles.switchBtnOn : ''}`}
                    onClick={() => setForm(f => ({...f, tipo: t}))}>
                    {t === 'multipla_escolha' ? 'Múltipla escolha' : 'Dissertativa'}
                  </button>
                ))}
              </div>
            </div>

            {form.tipo === 'multipla_escolha' ? (
              <div className={styles.alternativas}>
                <label className={styles.label}>Alternativas *</label>
                <p className={styles.hint}>Marque a alternativa correta clicando no círculo.</p>
                {alternativas.map((alt, i) => (
                  <div key={i} className={styles.altRow} data-alt-index={i} onKeyDown={e => handleAltTab(e, i)}>
                    <button
                      className={`${styles.altRadio} ${alt.correta ? styles.altRadioOn : ''}`}
                      onClick={() => setAlt(i, 'correta', true)}
                      title="Marcar como correta"
                      type="button"
                    >
                      {alt.correta && <span className={styles.altRadioDot} />}
                    </button>
                    <span className={styles.altLetra}>{LETRAS[i]}</span>
                    <div className={styles.altEditorWrap}>
                      <RichEditor
                        compact
                        placeholder={`Alternativa ${LETRAS[i]}`}
                        value={alt.texto}
                        onChange={(html) => setAlt(i, 'texto', html)}
                      />
                    </div>
                    {alternativas.length > 2 && (
                      <button className={styles.altRemove} onClick={() => removeAlternativa(i)} type="button">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
                {alternativas.length < 5 && (
                  <button className={styles.btnAddAlt} onClick={addAlternativa} type="button">
                    <Plus size={13} /> Adicionar alternativa
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.gabarito}>
                <RichEditor
                  label="Gabarito / Resposta esperada"
                  placeholder="Descreva a resposta esperada..."
                  value={gabarito.texto}
                  onChange={(html) => setGabarito(g => ({...g, texto: html}))}
                />
                <RichEditor
                  label="Critérios de correção"
                  placeholder="Critérios para avaliação da resposta..."
                  value={gabarito.criterios}
                  onChange={(html) => setGabarito(g => ({...g, criterios: html}))}
                />
              </div>
            )}
          </div>

          {/* Comentário pedagógico com Editor Avançado */}
          <div className={styles.card}>
            <RichEditor
              label="Comentário pedagógico"
              placeholder="Observações para o professor sobre o uso desta questão..."
              value={form.comentario_pedagogico}
              onChange={(html) => setForm(f => ({...f, comentario_pedagogico: html}))}
            />
          </div>
        </div>

        {/* Coluna lateral */}
        <div className={styles.colSide}>

          {/* Classificação */}
          <div className={styles.card}>
            <p className={styles.cardTitulo}>Classificação</p>

            <div className={styles.field}>
              <label className={styles.label}>Disciplina</label>
              <select className={styles.select}
                value={form.disciplina_id}
                onChange={e => setForm(f => ({...f, disciplina_id: e.target.value}))}>
                <option value="">Selecione...</option>
                {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Ano escolar</label>
              <select className={styles.select}
                value={form.ano_escolar}
                onChange={e => setForm(f => ({...f, ano_escolar: e.target.value}))}>
                <option value="">Selecione...</option>
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Dificuldade</label>
              <div className={styles.dificuldadeRow}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button"
                    className={`${styles.difBtn} ${form.nivel_dificuldade >= n ? styles.difBtnOn : ''}`}
                    onClick={() => setForm(f => ({...f, nivel_dificuldade: n}))}>
                    {n}
                  </button>
                ))}
                <span className={styles.difLabel}>
                  {['','Muito fácil','Fácil','Médio','Difícil','Muito difícil'][form.nivel_dificuldade]}
                </span>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Fonte / Referência</label>
              <input className={styles.input}
                placeholder="Ex: SAEB 2019, livro didático..."
                value={form.fonte}
                onChange={e => setForm(f => ({...f, fonte: e.target.value}))}
              />
            </div>
          </div>

          {/* Habilidades */}
          <div className={styles.card}>
            <p className={styles.cardTitulo}>Habilidades da matriz</p>
            <select className={styles.select} style={{marginBottom: 8}}
              value={habilidadeFiltroAno}
              onChange={e => setHabilidadeFiltroAno(e.target.value)}>
              <option value="">Todos os anos</option>
              {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>

            <div className={styles.habilidadesList}>
              {habilidades.length === 0 ? (
                <p className={styles.hint}>Selecione uma disciplina para ver as habilidades.</p>
              ) : (
                habilidades.map(h => (
                  <label key={h.id} className={styles.habilidadeItem}>
                    <input type="checkbox"
                      checked={habilidadeIds.includes(h.id)}
                      onChange={() => toggleHabilidade(h.id)}
                    />
                    <span className={styles.habilidadeCodigo}>{h.codigo}</span>
                    <span className={styles.habilidadeDesc}>{h.descricao}</span>
                  </label>
                ))
              )}
            </div>

            {habilidadeIds.length > 0 && (
              <p className={styles.hint} style={{marginTop: 8}}>
                {habilidadeIds.length} habilidade(s) selecionada(s)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
