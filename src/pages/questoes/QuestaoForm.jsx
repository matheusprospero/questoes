import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  criarQuestao, atualizarQuestao, buscarQuestao, buscarVideoQuestao,
  listarDisciplinas, listarAssuntos, listarBancas, listarOrgaos,
  criarAssunto, criarBanca, criarOrgao,
} from '../../services/questoes'
import RichEditor from '../../components/RichEditor'
import VideoYouTube, { extrairIdYouTube } from '../../components/VideoYouTube'
import { Plus, Trash2, ChevronLeft, Save, CheckCircle, XCircle, Youtube, Check, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './QuestaoForm.module.css'

const LETRAS = ['A','B','C','D','E']
const ALTERNATIVA_VAZIA = { letra: '', texto: '', correta: false }

function novasAlternativas() {
  return LETRAS.slice(0, 5).map(l => ({ letra: l, texto: '', correta: false }))
}

export default function QuestaoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdicao = !!id

  const [form, setForm] = useState({
    tipo: 'multipla_escolha', enunciado: '', comentario: '', video_url: '',
    disciplina_id: '', assunto_id: '', banca_id: '', orgao_id: '',
    ano: '', cargo: '', nivel: '', dificuldade: 3, gabarito_certo: null,
    revisada: false, liberada: true,
  })
  const [alternativas, setAlternativas] = useState(novasAlternativas())

  // Carregar questão para edição
  const { data: questaoExistente } = useQuery({
    queryKey: ['questao', id],
    queryFn: () => buscarQuestao(id),
    enabled: isEdicao,
  })
  // A URL do vídeo vem separada (tabela protegida); admin sempre consegue ler
  const { data: videoUrl } = useQuery({
    queryKey: ['questao-video', id],
    queryFn: () => buscarVideoQuestao(id),
    enabled: isEdicao,
  })

  useEffect(() => {
    if (questaoExistente) {
      setForm({
        tipo: questaoExistente.tipo,
        enunciado: questaoExistente.enunciado,
        comentario: questaoExistente.comentario || '',
        video_url: videoUrl || '',
        disciplina_id: questaoExistente.disciplina_id || '',
        assunto_id: questaoExistente.assunto_id || '',
        banca_id: questaoExistente.banca_id || '',
        orgao_id: questaoExistente.orgao_id || '',
        ano: questaoExistente.ano || '',
        cargo: questaoExistente.cargo || '',
        nivel: questaoExistente.nivel || '',
        dificuldade: questaoExistente.dificuldade || 3,
        gabarito_certo: questaoExistente.gabarito_certo,
        revisada: !!questaoExistente.revisada,
        liberada: questaoExistente.liberada ?? true,
      })
      if (questaoExistente.alternativas?.length) {
        setAlternativas(questaoExistente.alternativas.map((a, i) => ({
          letra: a.letra || LETRAS[i],
          texto: a.texto || '',
          correta: !!a.correta,
        })))
      }
    }
  }, [questaoExistente, videoUrl])

  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: listarDisciplinas })
  const { data: assuntos = [] } = useQuery({
    queryKey: ['assuntos', form.disciplina_id],
    queryFn: () => listarAssuntos(form.disciplina_id),
    enabled: !!form.disciplina_id,
  })
  const { data: bancas = [] } = useQuery({ queryKey: ['bancas'], queryFn: listarBancas })
  const { data: orgaos = [] } = useQuery({ queryKey: ['orgaos'], queryFn: listarOrgaos })

  // Criação inline de assunto / banca / órgão
  const [novoAssunto, setNovoAssunto] = useState('')
  const [criandoAssunto, setCriandoAssunto] = useState(false)

  async function handleCriarAssunto() {
    if (!form.disciplina_id) { toast.error('Escolha a disciplina primeiro'); return }
    if (!novoAssunto.trim()) return
    try {
      const assunto = await criarAssunto(form.disciplina_id, novoAssunto)
      queryClient.invalidateQueries({ queryKey: ['assuntos'] })
      setForm(f => ({ ...f, assunto_id: assunto.id }))
      setNovoAssunto('')
      setCriandoAssunto(false)
      toast.success('Assunto criado!')
    } catch (err) {
      toast.error('Erro ao criar assunto: ' + err.message)
    }
  }

  async function handleCriarBanca() {
    const nome = window.prompt('Nome da nova banca:')
    if (!nome?.trim()) return
    try {
      const banca = await criarBanca(nome)
      queryClient.invalidateQueries({ queryKey: ['bancas'] })
      setForm(f => ({ ...f, banca_id: banca.id }))
      toast.success('Banca criada!')
    } catch (err) {
      toast.error('Erro ao criar banca: ' + err.message)
    }
  }

  async function handleCriarOrgao() {
    const nome = window.prompt('Nome do novo órgão (ex: Polícia Federal):')
    if (!nome?.trim()) return
    try {
      const orgao = await criarOrgao(nome)
      queryClient.invalidateQueries({ queryKey: ['orgaos'] })
      setForm(f => ({ ...f, orgao_id: orgao.id }))
      toast.success('Órgão criado!')
    } catch (err) {
      toast.error('Erro ao criar órgão: ' + err.message)
    }
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const textoEnunciado = form.enunciado.replace(/<[^>]*>/g, '').trim()
      if (!textoEnunciado) throw new Error('Enunciado é obrigatório')

      if (form.tipo === 'multipla_escolha') {
        if (!alternativas.some(a => a.correta)) throw new Error('Marque a alternativa correta')
        if (alternativas.some(a => !a.texto.replace(/<[^>]*>/g, '').trim()))
          throw new Error('Preencha todas as alternativas')
      }
      if (form.tipo === 'certo_errado' && form.gabarito_certo === null)
        throw new Error('Defina o gabarito: Certo ou Errado')

      const dados = {
        tipo: form.tipo,
        enunciado: form.enunciado,
        comentario: form.comentario || null,
        video_url: form.video_url.trim() || null,
        disciplina_id: form.disciplina_id || null,
        assunto_id: form.assunto_id || null,
        banca_id: form.banca_id || null,
        orgao_id: form.orgao_id || null,
        ano: form.ano ? Number(form.ano) : null,
        cargo: form.cargo || null,
        nivel: form.nivel || null,
        dificuldade: form.dificuldade,
        gabarito_certo: form.tipo === 'certo_errado' ? form.gabarito_certo : null,
        revisada: form.revisada,
        liberada: form.liberada,
      }

      if (isEdicao) {
        return atualizarQuestao(id, dados, alternativas)
      } else {
        return criarQuestao(dados, alternativas)
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['questoes'] })
      queryClient.invalidateQueries({ queryKey: ['questao', data.id] })
      queryClient.invalidateQueries({ queryKey: ['questao-video', data.id] })
      toast.success(isEdicao ? 'Questão atualizada!' : 'Questão criada!')
      navigate(`/questoes/${data.id}`)
    },
    onError: (err) => toast.error(err.message || 'Erro ao salvar'),
  })

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
    setAlternativas(alts => alts.filter((_, idx) => idx !== i).map((a, idx) => ({ ...a, letra: LETRAS[idx] })))
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/questoes')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <h1 className={styles.titulo}>{isEdicao ? 'Editar questão' : 'Nova questão'}</h1>
        <div className={styles.topbarAcoes}>
          <button type="button"
            className={`${styles.btnRevisada} ${form.revisada ? styles.btnRevisadaOn : ''}`}
            onClick={() => setForm(f => ({ ...f, revisada: !f.revisada }))}
            title="Marca a questão como conferida (salva ao clicar em Salvar questão)">
            <Check size={14} /> {form.revisada ? 'Revisada' : 'Marcar como revisada'}
          </button>
          <button type="button"
            className={`${styles.btnRevisada} ${form.liberada ? styles.btnRevisadaOn : ''}`}
            onClick={() => setForm(f => ({ ...f, liberada: !f.liberada }))}
            title="Questão visível para os alunos (desmarque para deixá-la oculta até liberar)">
            {form.liberada ? <Eye size={14} /> : <EyeOff size={14} />} {form.liberada ? 'Liberada' : 'Não liberada'}
          </button>
          <button className={styles.btnPrimary}
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}>
            <Save size={14} /> {salvar.isPending ? 'Salvando...' : 'Salvar questão'}
          </button>
        </div>
      </div>

      <div className={styles.grid} key={questaoExistente?.id ?? 'novo'}>
        {/* Coluna principal */}
        <div className={styles.colMain}>

          {/* Enunciado */}
          <div className={styles.card}>
            <RichEditor
              label="Enunciado *"
              placeholder="Digite o enunciado da questão..."
              value={form.enunciado}
              onChange={(html) => setForm(f => ({...f, enunciado: html}))}
            />
          </div>

          {/* Tipo + alternativas / certo-errado */}
          <div className={styles.card}>
            <div className={styles.tipoSwitch}>
              <span className={styles.label}>Tipo de questão</span>
              <div className={styles.switchGroup}>
                {['multipla_escolha','certo_errado'].map(t => (
                  <button key={t}
                    className={`${styles.switchBtn} ${form.tipo === t ? styles.switchBtnOn : ''}`}
                    onClick={() => setForm(f => ({...f, tipo: t}))}>
                    {t === 'multipla_escolha' ? 'Múltipla escolha' : 'Certo / Errado'}
                  </button>
                ))}
              </div>
            </div>

            {form.tipo === 'multipla_escolha' ? (
              <div className={styles.alternativas}>
                <label className={styles.label}>Alternativas *</label>
                <p className={styles.hint}>Marque a alternativa correta clicando no círculo.</p>
                {alternativas.map((alt, i) => (
                  <div key={i} className={styles.altRow} data-alt-index={i}>
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
              <div className={styles.alternativas}>
                <label className={styles.label}>Gabarito *</label>
                <p className={styles.hint}>No estilo Cebraspe: a afirmação do enunciado está certa ou errada?</p>
                <div className={styles.switchGroup}>
                  <button type="button"
                    className={`${styles.switchBtn} ${form.gabarito_certo === true ? styles.switchBtnOn : ''}`}
                    onClick={() => setForm(f => ({...f, gabarito_certo: true}))}>
                    <CheckCircle size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} /> Certo
                  </button>
                  <button type="button"
                    className={`${styles.switchBtn} ${form.gabarito_certo === false ? styles.switchBtnOn : ''}`}
                    onClick={() => setForm(f => ({...f, gabarito_certo: false}))}>
                    <XCircle size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} /> Errado
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Comentário / justificativa */}
          <div className={styles.card}>
            <RichEditor
              label="Comentário / justificativa do gabarito"
              placeholder="Explique por que o gabarito é esse — fundamentação, lei, jurisprudência, macete..."
              value={form.comentario}
              onChange={(html) => setForm(f => ({...f, comentario: html}))}
            />
          </div>

          {/* Resolução em vídeo */}
          <div className={styles.card}>
            <label className={styles.label}>
              <Youtube size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Resolução em vídeo (YouTube)
            </label>
            <p className={styles.hint}>
              Cole o link do vídeo (recomendado: vídeo "não listado"). O aluno vê o player após responder a questão.
            </p>
            <input className={styles.input}
              placeholder="https://youtu.be/... ou https://www.youtube.com/watch?v=..."
              value={form.video_url}
              onChange={e => setForm(f => ({...f, video_url: e.target.value}))}
            />
            {form.video_url.trim() && !extrairIdYouTube(form.video_url) && (
              <p className={styles.hint} style={{ color: '#dc2626', marginTop: 6 }}>
                Não reconheci esse link como um vídeo do YouTube.
              </p>
            )}
            {extrairIdYouTube(form.video_url) && (
              <div style={{ marginTop: 10 }}>
                <VideoYouTube url={form.video_url} />
              </div>
            )}
          </div>
        </div>

        {/* Coluna lateral */}
        <div className={styles.colSide}>

          {/* Classificação */}
          <div className={styles.card}>
            <p className={styles.cardTitulo}>Classificação</p>

            <div className={styles.field}>
              <label className={styles.label}>Disciplina</label>
              <select className={styles.select ?? styles.input}
                value={form.disciplina_id}
                onChange={e => setForm(f => ({...f, disciplina_id: e.target.value, assunto_id: ''}))}>
                <option value="">Selecione...</option>
                {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Assunto</label>
              <select className={styles.select ?? styles.input}
                value={form.assunto_id}
                onChange={e => setForm(f => ({...f, assunto_id: e.target.value}))}
                disabled={!form.disciplina_id}>
                <option value="">{form.disciplina_id ? 'Selecione...' : 'Escolha a disciplina antes'}</option>
                {assuntos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              {criandoAssunto ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input className={styles.input}
                    placeholder="Nome do novo assunto"
                    value={novoAssunto}
                    autoFocus
                    onChange={e => setNovoAssunto(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCriarAssunto() }}
                  />
                  <button type="button" className={styles.btnAddAlt} onClick={handleCriarAssunto}>OK</button>
                </div>
              ) : (
                <button type="button" className={styles.btnAddAlt} style={{ marginTop: 6 }}
                  onClick={() => setCriandoAssunto(true)}
                  disabled={!form.disciplina_id}>
                  <Plus size={12} /> Novo assunto
                </button>
              )}
            </div>
          </div>

          {/* Origem da questão */}
          <div className={styles.card}>
            <p className={styles.cardTitulo}>Origem</p>

            <div className={styles.field}>
              <label className={styles.label}>Banca</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className={styles.select ?? styles.input} style={{ flex: 1 }}
                  value={form.banca_id}
                  onChange={e => setForm(f => ({...f, banca_id: e.target.value}))}>
                  <option value="">Selecione...</option>
                  {bancas.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
                <button type="button" className={styles.btnAddAlt} onClick={handleCriarBanca} title="Nova banca">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Órgão</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className={styles.select ?? styles.input} style={{ flex: 1 }}
                  value={form.orgao_id}
                  onChange={e => setForm(f => ({...f, orgao_id: e.target.value}))}>
                  <option value="">Selecione...</option>
                  {orgaos.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
                <button type="button" className={styles.btnAddAlt} onClick={handleCriarOrgao} title="Novo órgão">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Ano</label>
              <input className={styles.input} type="number" min="1990" max="2100"
                placeholder="Ex: 2023"
                value={form.ano}
                onChange={e => setForm(f => ({...f, ano: e.target.value}))}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Cargo</label>
              <input className={styles.input}
                placeholder="Ex: Agente Administrativo"
                value={form.cargo}
                onChange={e => setForm(f => ({...f, cargo: e.target.value}))}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Nível</label>
              <select className={styles.select ?? styles.input}
                value={form.nivel}
                onChange={e => setForm(f => ({...f, nivel: e.target.value}))}>
                <option value="">Selecione...</option>
                <option value="fundamental">Fundamental</option>
                <option value="medio">Médio</option>
                <option value="superior">Superior</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Dificuldade</label>
              <div className={styles.dificuldadeRow}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button"
                    className={`${styles.difBtn} ${form.dificuldade >= n ? styles.difBtnOn : ''}`}
                    onClick={() => setForm(f => ({...f, dificuldade: n}))}>
                    {n}
                  </button>
                ))}
                <span className={styles.difLabel}>
                  {['','Muito fácil','Fácil','Média','Difícil','Muito difícil'][form.dificuldade]}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
