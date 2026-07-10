import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { criarDestaque, atualizarDestaque, buscarDestaque } from '../../services/destaques'
import { listarSimulados } from '../../services/simulados'
import { listarAulas } from '../../services/aulas'
import CardDestaque from '../../components/CardDestaque'
import { ChevronLeft, Save, Sparkles, ClipboardList, GraduationCap, Link2, Wand2, CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './DestaqueForm.module.css'

// Conversão entre ISO (banco) e o valor do <input type="datetime-local"> (hora local)
function isoParaLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}
function localParaIso(local) {
  if (!local) return null
  return new Date(local).toISOString()
}

// Sugestões de texto prontas (o professor clica e preenche o card)
const MODELOS = [
  {
    nome: 'Desafio do professor',
    etiqueta: 'Desafio do professor',
    texto: 'Encare este desafio e descubra como você se sai. Bora testar seus conhecimentos? 🚀',
    cta_texto: 'Resolver agora',
  },
  {
    nome: 'Novidade',
    etiqueta: '✨ Novidade',
    texto: 'Conteúdo novo no ar! Seja um dos primeiros a conferir e saia na frente. 🔥',
    cta_texto: 'Conferir agora',
  },
  {
    nome: 'Simulado da semana',
    etiqueta: '🎯 Simulado da semana',
    texto: 'Separe um tempo, cronometre e simule o dia da prova. Vamos ver quantos pontos você faz!',
    cta_texto: 'Fazer o simulado',
  },
  {
    nome: 'Aula nova',
    etiqueta: '🎓 Aula nova',
    texto: 'Teoria direto ao ponto + questões comentadas do mesmo tema. Comece agora e domine o assunto.',
    cta_texto: 'Assistir à aula',
  },
  {
    nome: 'Reta final',
    etiqueta: '⏳ Reta final',
    texto: 'A prova está chegando! Revise os pontos que mais caem e garanta seus pontos. Você consegue! 💪',
    cta_texto: 'Bora revisar',
  },
]

const TIPOS = [
  { valor: 'simulado', label: 'Simulado', icon: ClipboardList },
  { valor: 'aula',     label: 'Aula',     icon: GraduationCap },
  { valor: 'livre',    label: 'Card livre', icon: Link2 },
]

export default function DestaqueForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdicao = !!id

  const [form, setForm] = useState({
    tipo: 'simulado', ref_id: '', etiqueta: 'Desafio do professor',
    titulo: '', texto: '', cta_texto: 'Resolver agora', link: '', ativo: true,
    publicar_em: '', expira_em: '', // strings do input datetime-local
  })

  const { data: existente } = useQuery({
    queryKey: ['destaque', id], queryFn: () => buscarDestaque(id), enabled: isEdicao,
  })
  useEffect(() => {
    if (existente) {
      setForm({
        tipo: existente.tipo || 'livre',
        ref_id: existente.ref_id || '',
        etiqueta: existente.etiqueta || '',
        titulo: existente.titulo || '',
        texto: existente.texto || '',
        cta_texto: existente.cta_texto || '',
        link: existente.link || '',
        ativo: existente.ativo ?? true,
        publicar_em: isoParaLocal(existente.publicar_em),
        expira_em: isoParaLocal(existente.expira_em),
      })
    }
  }, [existente])

  const { data: simulados = [] } = useQuery({ queryKey: ['simulados'], queryFn: listarSimulados })
  const { data: aulas = [] } = useQuery({ queryKey: ['aulas'], queryFn: listarAulas })

  const set = (patch) => setForm(f => ({ ...f, ...patch }))

  function escolherTipo(tipo) {
    set({ tipo, ref_id: '' })
  }

  // Ao escolher um simulado/aula, sugere o título se ainda estiver vazio
  function escolherRef(ref_id) {
    const lista = form.tipo === 'simulado' ? simulados : aulas
    const item = lista.find(x => String(x.id) === String(ref_id))
    set({
      ref_id,
      titulo: form.titulo?.trim() ? form.titulo : (item?.titulo || ''),
      cta_texto: form.cta_texto?.trim() ? form.cta_texto : (form.tipo === 'aula' ? 'Assistir à aula' : 'Resolver agora'),
    })
  }

  function aplicarModelo(m) {
    set({ etiqueta: m.etiqueta, texto: m.texto, cta_texto: m.cta_texto })
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error('Dê um título ao card')
      if (form.tipo !== 'livre' && !form.ref_id) throw new Error('Escolha o simulado/aula que o card vai abrir')
      if (form.tipo === 'livre' && !form.link.trim()) throw new Error('Informe o link de destino do card livre')
      if (form.publicar_em && form.expira_em && new Date(form.expira_em) <= new Date(form.publicar_em))
        throw new Error('A data de saída precisa ser depois da data de publicação')
      const dados = {
        ...form,
        publicar_em: localParaIso(form.publicar_em),
        expira_em: localParaIso(form.expira_em),
      }
      return isEdicao ? atualizarDestaque(id, dados) : criarDestaque(dados)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destaques'] })
      queryClient.invalidateQueries({ queryKey: ['destaques-ativos'] })
      toast.success(isEdicao ? 'Destaque atualizado!' : 'Destaque criado!')
      navigate('/destaques')
    },
    onError: (err) => toast.error(err.message || 'Erro ao salvar'),
  })

  const refLista = form.tipo === 'simulado' ? simulados : aulas

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/destaques')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <h1 className={styles.titulo}>{isEdicao ? 'Editar destaque' : 'Novo destaque'}</h1>
        <button className={styles.btnPrimary} onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          <Save size={14} /> {salvar.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* Preview ao vivo */}
      <div className={styles.previewWrap}>
        <span className={styles.previewLabel}>Prévia do card</span>
        <CardDestaque destaque={form} onClick={() => {}} />
      </div>

      <div className={styles.card}>
        {/* Tipo */}
        <div className={styles.field}>
          <label className={styles.label}>O card vai abrir…</label>
          <div className={styles.tipos}>
            {TIPOS.map(t => (
              <button key={t.valor} type="button"
                className={`${styles.tipoBtn} ${form.tipo === t.valor ? styles.tipoBtnOn : ''}`}
                onClick={() => escolherTipo(t.valor)}>
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Referência (simulado/aula) ou link livre */}
        {form.tipo === 'livre' ? (
          <div className={styles.field}>
            <label className={styles.label}>Link de destino</label>
            <input className={styles.input}
              placeholder="/simulados  ·  /aulas  ·  https://..."
              value={form.link}
              onChange={e => set({ link: e.target.value })}
            />
            <span className={styles.hint}>Uma rota interna (ex: <code>/aulas</code>) ou um link externo (https://…).</span>
          </div>
        ) : (
          <div className={styles.field}>
            <label className={styles.label}>{form.tipo === 'simulado' ? 'Simulado' : 'Aula'}</label>
            <select className={styles.input} value={form.ref_id} onChange={e => escolherRef(e.target.value)}>
              <option value="">Selecione...</option>
              {refLista.map(x => <option key={x.id} value={x.id}>{x.titulo}</option>)}
            </select>
          </div>
        )}

        {/* Sugestões de texto */}
        <div className={styles.field}>
          <label className={styles.label}><Wand2 size={13} /> Sugestões de texto</label>
          <div className={styles.modelos}>
            {MODELOS.map(m => (
              <button key={m.nome} type="button" className={styles.modeloBtn} onClick={() => aplicarModelo(m)}>
                {m.nome}
              </button>
            ))}
          </div>
        </div>

        {/* Textos */}
        <div className={styles.field}>
          <label className={styles.label}><Sparkles size={13} /> Etiqueta</label>
          <input className={styles.input} placeholder="Ex: Desafio do professor"
            value={form.etiqueta} onChange={e => set({ etiqueta: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Título</label>
          <input className={styles.input} placeholder="Ex: Primeiro Simulado"
            value={form.titulo} onChange={e => set({ titulo: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Texto de chamada</label>
          <textarea className={styles.textarea} rows={3}
            placeholder="A frase que vai gerar interesse dos alunos..."
            value={form.texto} onChange={e => set({ texto: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Texto do botão</label>
          <input className={styles.input} placeholder="Ex: Resolver agora"
            value={form.cta_texto} onChange={e => set({ cta_texto: e.target.value })} />
        </div>

        {/* Agendamento */}
        <div className={styles.agenda}>
          <div className={styles.field}>
            <label className={styles.label}><CalendarClock size={13} /> Publicar em (opcional)</label>
            <input type="datetime-local" className={styles.input}
              value={form.publicar_em} onChange={e => set({ publicar_em: e.target.value })} />
            <span className={styles.hint}>Deixe vazio para entrar no ar assim que ativar.</span>
          </div>
          <div className={styles.field}>
            <label className={styles.label}><CalendarClock size={13} /> Sair do ar em (opcional)</label>
            <input type="datetime-local" className={styles.input}
              value={form.expira_em} onChange={e => set({ expira_em: e.target.value })} />
            <span className={styles.hint}>Deixe vazio para ficar no ar por tempo indeterminado.</span>
          </div>
        </div>

        <label className={styles.checkAtivo}>
          <input type="checkbox" checked={form.ativo} onChange={e => set({ ativo: e.target.checked })} />
          Card ativo (se desmarcar, não aparece mesmo dentro do prazo)
        </label>
      </div>
    </div>
  )
}
