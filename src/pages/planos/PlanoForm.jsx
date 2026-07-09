import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buscarPlano, criarPlano, atualizarPlano } from '../../services/planos'
import { listarDisciplinas } from '../../services/questoes'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { ChevronLeft, Save } from 'lucide-react'
import styles from './PlanoForm.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']

const FORM_VAZIO = {
  titulo: '', descricao: '',
  disciplina_id: '', ano_escolar: '', duracao_aulas: '',
  status: 'rascunho',
  objetivos: '', conteudo: '', desenvolvimento: '', metodologia: '', recursos: '', avaliacao: '',
}

export default function PlanoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const queryClient = useQueryClient()
  const isEdicao = !!id

  const [form, setForm] = useState(FORM_VAZIO)

  const { data: planoExistente, isLoading: loadingPlano } = useQuery({
    queryKey: ['plano', id],
    queryFn: () => buscarPlano(id),
    enabled: isEdicao,
  })

  const { data: disciplinas = [] } = useQuery({
    queryKey: ['disciplinas'],
    queryFn: listarDisciplinas,
  })

  useEffect(() => {
    if (planoExistente) {
      setForm({
        titulo:       planoExistente.titulo ?? '',
        descricao:    planoExistente.descricao ?? '',
        disciplina_id: planoExistente.disciplina_id ?? '',
        ano_escolar:  planoExistente.ano_escolar ?? '',
        duracao_aulas: planoExistente.duracao_aulas ?? '',
        status:       planoExistente.status ?? 'rascunho',
        objetivos:    planoExistente.objetivos ?? '',
        conteudo:     planoExistente.conteudo ?? '',
        desenvolvimento: planoExistente.desenvolvimento ?? '',
        metodologia:  planoExistente.metodologia ?? '',
        recursos:     planoExistente.recursos ?? '',
        avaliacao:    planoExistente.avaliacao ?? '',
      })
    }
  }, [planoExistente])

  const salvar = useMutation({
    mutationFn: () => {
      if (!form.titulo.trim()) throw new Error('Título é obrigatório')
      const dados = {
        titulo:       form.titulo.trim(),
        descricao:    form.descricao.trim() || null,
        disciplina_id: form.disciplina_id || null,
        ano_escolar:  form.ano_escolar || null,
        duracao_aulas: form.duracao_aulas ? Number(form.duracao_aulas) : null,
        status:       form.status,
        objetivos:    form.objetivos.trim() || null,
        conteudo:     form.conteudo.trim() || null,
        desenvolvimento: form.desenvolvimento.trim() || null,
        metodologia:  form.metodologia.trim() || null,
        recursos:     form.recursos.trim() || null,
        avaliacao:    form.avaliacao.trim() || null,
      }
      return isEdicao ? atualizarPlano(id, dados) : criarPlano(dados)
    },
    onSuccess: (plano) => {
      queryClient.invalidateQueries({ queryKey: ['planos'] })
      if (isEdicao) queryClient.invalidateQueries({ queryKey: ['plano', id] })
      toast.success(isEdicao ? 'Plano atualizado!' : 'Plano criado!')
      navigate(`/planos/${plano.id}`)
    },
    onError: (err) => toast.error(err.message),
  })

  function set(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  if (isEdicao && loadingPlano) {
    return <div className={styles.loading}>Carregando plano...</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/planos')}>
          <ChevronLeft size={16} /> Planos de Aula
        </button>
        <h1 className={styles.titulo}>{isEdicao ? 'Editar plano' : 'Novo plano de aula'}</h1>
        <button
          className={styles.btnSave}
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending}
        >
          <Save size={15} /> {salvar.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className={styles.form}>
        {/* Informações básicas */}
        <section className={styles.secao}>
          <h2 className={styles.secaoTitulo}>Informações básicas</h2>

          <div className={styles.campo}>
            <label className={styles.label}>Título <span className={styles.req}>*</span></label>
            <input
              className={styles.input}
              placeholder="Ex: Frações no cotidiano — 5º ano"
              value={form.titulo}
              onChange={e => set('titulo', e.target.value)}
            />
          </div>

          <div className={styles.campo}>
            <label className={styles.label}>Descrição breve</label>
            <input
              className={styles.input}
              placeholder="Resumo do plano em uma ou duas frases"
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
            />
          </div>

          <div className={styles.linha3}>
            <div className={styles.campo}>
              <label className={styles.label}>Disciplina</label>
              <select className={styles.select} value={form.disciplina_id} onChange={e => set('disciplina_id', e.target.value)}>
                <option value="">Selecionar</option>
                {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
            <div className={styles.campo}>
              <label className={styles.label}>Ano escolar</label>
              <select className={styles.select} value={form.ano_escolar} onChange={e => set('ano_escolar', e.target.value)}>
                <option value="">Selecionar</option>
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className={styles.campo}>
              <label className={styles.label}>Duração (nº de aulas)</label>
              <input
                className={styles.input}
                type="number" min="1" max="99"
                placeholder="Ex: 2"
                value={form.duracao_aulas}
                onChange={e => set('duracao_aulas', e.target.value)}
              />
            </div>
          </div>

          <div className={styles.campo} style={{ maxWidth: 220 }}>
            <label className={styles.label}>Status</label>
            <select className={styles.select} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="rascunho">Rascunho</option>
              <option value="publicado">Publicado (visível na rede)</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </div>
        </section>

        {/* Conteúdo pedagógico */}
        <section className={styles.secao}>
          <h2 className={styles.secaoTitulo}>Conteúdo pedagógico</h2>

          <TextareaField label="Objetivos" hint="O que os alunos serão capazes de fazer ao final da aula" value={form.objetivos} onChange={v => set('objetivos', v)} rows={4} />
          <TextareaField label="Conteúdo" hint="Tópicos, conceitos e conhecimentos trabalhados" value={form.conteudo} onChange={v => set('conteudo', v)} rows={4} />
          <TextareaField label="Desenvolvimento" hint="Sequência das atividades durante a aula" value={form.desenvolvimento} onChange={v => set('desenvolvimento', v)} rows={6} />
          <TextareaField label="Metodologia" hint="Estratégias, abordagens e dinâmicas utilizadas" value={form.metodologia} onChange={v => set('metodologia', v)} rows={4} />
        </section>

        {/* Recursos e avaliação */}
        <section className={styles.secao}>
          <h2 className={styles.secaoTitulo}>Recursos e avaliação</h2>
          <TextareaField label="Recursos necessários" hint="Materiais, tecnologias, espaços e equipamentos" value={form.recursos} onChange={v => set('recursos', v)} rows={3} />
          <TextareaField label="Avaliação" hint="Como a aprendizagem será verificada" value={form.avaliacao} onChange={v => set('avaliacao', v)} rows={3} />
        </section>
      </div>
    </div>
  )
}

function TextareaField({ label, hint, value, onChange, rows = 4 }) {
  return (
    <div className={styles.campo}>
      <label className={styles.label}>{label}</label>
      {hint && <p className={styles.hint}>{hint}</p>}
      <textarea
        className={styles.textarea}
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={hint}
      />
    </div>
  )
}
