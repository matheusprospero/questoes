import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarPlanos, criarPlano, listarItens, adicionarItens,
  atualizarItem, incrementarCiclo, removerItem,
} from '../../services/plano'
import { listarFacetas } from '../../services/questoes'
import { listarRespostas } from '../../services/estudo'
import {
  ListChecks, Plus, BookOpen, Target, CheckCircle2, Trash2,
  RotateCw, ChevronDown, ChevronRight, X, Layers,
} from 'lucide-react'
import styles from './PlanoEstudos.module.css'

const PESOS = [1, 2, 3, 4, 5]

// Nº de questões distintas que o aluno já respondeu, indexado por assunto e por disciplina.
function contarRespostas(respostas) {
  const porAssunto = new Map()
  const porDisciplina = new Map()
  const vistosA = new Map()
  const vistosD = new Map()
  for (const r of respostas) {
    const aId = r.questoes?.assuntos?.id
    const dId = r.questoes?.disciplinas?.id
    const qid = r.questao_id
    if (aId != null) {
      const chave = `${aId}`
      if (!vistosA.has(chave)) vistosA.set(chave, new Set())
      const set = vistosA.get(chave)
      if (!set.has(qid)) { set.add(qid); porAssunto.set(aId, (porAssunto.get(aId) || 0) + 1) }
    }
    if (dId != null) {
      const chave = `${dId}`
      if (!vistosD.has(chave)) vistosD.set(chave, new Set())
      const set = vistosD.get(chave)
      if (!set.has(qid)) { set.add(qid); porDisciplina.set(dId, (porDisciplina.get(dId) || 0) + 1) }
    }
  }
  return { porAssunto, porDisciplina }
}

// Disciplinas com seus assuntos e contagem de questões, a partir das facetas.
function montarCatalogo(facetas) {
  const discMap = new Map()
  for (const f of facetas) {
    const d = f.disciplinas
    if (!d) continue
    let disc = discMap.get(d.id)
    if (!disc) {
      disc = { id: d.id, nome: d.nome, cor: d.cor, total: 0, assuntos: new Map() }
      discMap.set(d.id, disc)
    }
    disc.total += 1
    const a = f.assuntos
    if (a) {
      let ass = disc.assuntos.get(a.id)
      if (!ass) { ass = { id: a.id, nome: a.nome, total: 0 }; disc.assuntos.set(a.id, ass) }
      ass.total += 1
    }
  }
  return [...discMap.values()]
    .map(d => ({ ...d, assuntos: [...d.assuntos.values()].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function corProgresso(pct) {
  if (pct >= 100) return 'var(--color-success)'
  if (pct >= 60) return 'var(--color-primary)'
  if (pct >= 30) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

// ── Painel "Adicionar matérias" ───────────────────────────────
function PainelMaterias({ catalogo, onFechar, onAdicionar, salvando }) {
  const [expandida, setExpandida] = useState(null)
  const [selDisc, setSelDisc] = useState(new Set())      // disciplinas marcadas (assunto null)
  const [selAssunto, setSelAssunto] = useState(new Set())// assuntos marcados (chave `${discId}:${assId}`)

  function toggleDisc(id) {
    setSelDisc(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function toggleAssunto(discId, assId) {
    const chave = `${discId}:${assId}`
    setSelAssunto(prev => {
      const n = new Set(prev)
      n.has(chave) ? n.delete(chave) : n.add(chave)
      return n
    })
  }

  const totalSel = selDisc.size + selAssunto.size

  function confirmar() {
    const itens = []
    for (const chave of selAssunto) {
      const [discId, assId] = chave.split(':')
      itens.push({ disciplina_id: discId, assunto_id: assId })
    }
    for (const discId of selDisc) {
      itens.push({ disciplina_id: discId })
    }
    if (!itens.length) { toast.error('Marque ao menos uma matéria'); return }
    onAdicionar(itens)
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.painel} onClick={e => e.stopPropagation()}>
        <div className={styles.painelTopo}>
          <p className={styles.painelTitulo}><Layers size={16} /> Adicionar matérias</p>
          <button className={styles.iconBtn} onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className={styles.painelLista}>
          {catalogo.length === 0 && <p className={styles.semDados}>Nenhuma disciplina disponível.</p>}
          {catalogo.map(d => {
            const aberta = expandida === d.id
            return (
              <div key={d.id} className={styles.discBloco}>
                <div className={styles.discLinha}>
                  <label className={styles.check}>
                    <input type="checkbox" checked={selDisc.has(d.id)} onChange={() => toggleDisc(d.id)} />
                    <span className={styles.dot} style={{ background: d.cor || 'var(--color-primary)' }} />
                    <span className={styles.discNome}>{d.nome}</span>
                    <span className={styles.contagem}>{d.total}q</span>
                  </label>
                  {d.assuntos.length > 0 && (
                    <button className={styles.expandBtn} onClick={() => setExpandida(aberta ? null : d.id)}>
                      {aberta ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      {d.assuntos.length} assunto(s)
                    </button>
                  )}
                </div>
                {aberta && (
                  <div className={styles.assuntos}>
                    {d.assuntos.map(a => (
                      <label key={a.id} className={styles.check}>
                        <input
                          type="checkbox"
                          checked={selAssunto.has(`${d.id}:${a.id}`)}
                          onChange={() => toggleAssunto(d.id, a.id)}
                        />
                        <span className={styles.assuntoNome}>{a.nome}</span>
                        <span className={styles.contagem}>{a.total}q</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.painelRodape}>
          <span className={styles.selInfo}>{totalSel} selecionada(s)</span>
          <div className={styles.painelBotoes}>
            <button className={styles.btnGhost} onClick={onFechar}>Cancelar</button>
            <button className={styles.btnPrimary} onClick={confirmar} disabled={salvando || totalSel === 0}>
              <Plus size={14} /> {salvando ? 'Adicionando…' : 'Adicionar ao plano'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────
export default function PlanoEstudos() {
  const qc = useQueryClient()
  const [planoId, setPlanoId] = useState(null)
  const [novoNome, setNovoNome] = useState('')
  const [novoBanca, setNovoBanca] = useState('')
  const [painelAberto, setPainelAberto] = useState(false)

  const { data: planos = [], isLoading: carregandoPlanos } = useQuery({
    queryKey: ['planos'],
    queryFn: listarPlanos,
  })
  const { data: facetas = [] } = useQuery({ queryKey: ['facetas'], queryFn: listarFacetas })
  const { data: respostas = [] } = useQuery({ queryKey: ['respostas'], queryFn: () => listarRespostas() })

  // Plano ativo: o selecionado ou o primeiro da lista
  const planoAtivo = planoId ?? planos[0]?.id ?? null

  const { data: itens = [], isLoading: carregandoItens } = useQuery({
    queryKey: ['plano-itens', planoAtivo],
    queryFn: () => listarItens(planoAtivo),
    enabled: !!planoAtivo,
  })

  const catalogo = useMemo(() => montarCatalogo(facetas), [facetas])
  const bancas = useMemo(() => {
    const m = new Map()
    for (const f of facetas) if (f.bancas) m.set(f.bancas.id, f.bancas.nome)
    return [...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [facetas])
  const { porAssunto, porDisciplina } = useMemo(() => contarRespostas(respostas), [respostas])

  const invalidarItens = () => qc.invalidateQueries({ queryKey: ['plano-itens', planoAtivo] })

  const mCriar = useMutation({
    mutationFn: criarPlano,
    onSuccess: (plano) => {
      qc.invalidateQueries({ queryKey: ['planos'] })
      setPlanoId(plano.id)
      setNovoNome(''); setNovoBanca('')
      toast.success('Plano criado!')
    },
    onError: () => toast.error('Não foi possível criar o plano'),
  })

  const mAdicionar = useMutation({
    mutationFn: (novos) => adicionarItens(planoAtivo, novos),
    onSuccess: (add) => {
      invalidarItens()
      setPainelAberto(false)
      toast.success(`${add.length} matéria(s) adicionada(s)`)
    },
    onError: () => toast.error('Erro ao adicionar matérias'),
  })

  const mAtualizar = useMutation({
    mutationFn: ({ id, patch }) => atualizarItem(id, patch),
    onSuccess: invalidarItens,
    onError: () => toast.error('Erro ao salvar'),
  })

  const mCiclo = useMutation({
    mutationFn: ({ id, ciclos }) => incrementarCiclo(id, ciclos),
    onSuccess: () => { invalidarItens(); toast.success('Mais uma volta registrada!') },
    onError: () => toast.error('Erro ao registrar ciclo'),
  })

  const mRemover = useMutation({
    mutationFn: removerItem,
    onSuccess: () => { invalidarItens(); toast.success('Item removido') },
    onError: () => toast.error('Erro ao remover'),
  })

  // Resumo do cabeçalho
  const resumo = useMemo(() => {
    const total = itens.length
    const estudados = itens.filter(i => i.estudado).length
    const revisados = itens.filter(i => i.revisado).length
    const metaTotal = itens.reduce((s, i) => s + (i.meta_questoes || 0), 0)
    return {
      total,
      pctEstudado: total ? Math.round((estudados / total) * 100) : 0,
      pctRevisado: total ? Math.round((revisados / total) * 100) : 0,
      metaTotal,
    }
  }, [itens])

  function progressoDoItem(item) {
    const meta = item.meta_questoes || 0
    if (meta <= 0) return null
    const feitas = item.assunto_id
      ? (porAssunto.get(item.assunto_id) || 0)
      : (porDisciplina.get(item.disciplina_id) || 0)
    const pct = Math.min(Math.round((feitas / meta) * 100), 100)
    return { feitas, meta, pct }
  }

  if (carregandoPlanos) return <div className={styles.loading}>Carregando plano de estudos…</div>

  // ── Sem plano: tela de criação ──
  if (planos.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.titulo}>Plano de Estudos</h1>
        <div className={styles.criarVazio}>
          <ListChecks size={40} strokeWidth={1.5} />
          <p className={styles.criarTexto}>Monte seu edital verticalizado e organize seu ciclo de estudos.</p>
          <div className={styles.criarForm}>
            <input
              className={styles.input}
              placeholder="Nome do plano (ex.: Concurso TRT 2026)"
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && novoNome.trim()) mCriar.mutate({ nome: novoNome.trim(), banca_id: novoBanca || null }) }}
            />
            {bancas.length > 0 && (
              <select className={styles.select} value={novoBanca} onChange={e => setNovoBanca(e.target.value)}>
                <option value="">Banca (opcional)</option>
                {bancas.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
              </select>
            )}
            <button
              className={styles.btnPrimary}
              disabled={!novoNome.trim() || mCriar.isPending}
              onClick={() => mCriar.mutate({ nome: novoNome.trim(), banca_id: novoBanca || null })}
            >
              <Plus size={14} /> Criar meu plano
            </button>
          </div>
        </div>
      </div>
    )
  }

  const nomeNovoPlano = () => {
    const nome = window.prompt('Nome do novo plano:')
    if (nome?.trim()) mCriar.mutate({ nome: nome.trim() })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Plano de Estudos</h1>
          <p className={styles.subtitulo}>Edital verticalizado e ciclo de estudos</p>
        </div>
        <div className={styles.headerBotoes}>
          {planos.length > 1 && (
            <select
              className={styles.select}
              value={planoAtivo || ''}
              onChange={e => setPlanoId(e.target.value)}
            >
              {planos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
          <button className={styles.btnGhost} onClick={nomeNovoPlano}>
            <Plus size={14} /> Novo plano
          </button>
          <button className={styles.btnPrimary} onClick={() => setPainelAberto(true)}>
            <Layers size={14} /> Adicionar matérias
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className={styles.cardsResumo}>
        <div className={styles.cardResumo}>
          <BookOpen size={16} className={styles.cardIcon} />
          <span className={styles.cardValor}>{resumo.total}</span>
          <span className={styles.cardLabel}>Matérias no plano</span>
        </div>
        <div className={styles.cardResumo}>
          <CheckCircle2 size={16} className={styles.cardIcon} />
          <span className={styles.cardValor}>{resumo.pctEstudado}%</span>
          <span className={styles.cardLabel}>Estudadas</span>
        </div>
        <div className={styles.cardResumo}>
          <RotateCw size={16} className={styles.cardIcon} />
          <span className={styles.cardValor}>{resumo.pctRevisado}%</span>
          <span className={styles.cardLabel}>Revisadas</span>
        </div>
        <div className={styles.cardResumo}>
          <Target size={16} className={styles.cardIcon} />
          <span className={styles.cardValor}>{resumo.metaTotal}</span>
          <span className={styles.cardLabel}>Questões-meta</span>
        </div>
      </div>

      {/* Tabela do edital verticalizado */}
      <div className={styles.card}>
        {carregandoItens ? (
          <p className={styles.semDados}>Carregando matérias…</p>
        ) : itens.length === 0 ? (
          <div className={styles.vazio}>
            <ListChecks size={32} strokeWidth={1.5} />
            <p>Seu plano ainda não tem matérias.</p>
            <button className={styles.btnPrimary} onClick={() => setPainelAberto(true)}>
              <Layers size={14} /> Adicionar matérias
            </button>
          </div>
        ) : (
          <div className={styles.tabelaScroll}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th className={styles.thNome}>Disciplina / Assunto</th>
                  <th>Peso</th>
                  <th>Meta</th>
                  <th>Estudei</th>
                  <th>Revisei</th>
                  <th>Ciclos</th>
                  <th className={styles.thProgresso}>Progresso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itens.map(item => {
                  const prog = progressoDoItem(item)
                  return (
                    <tr key={item.id}>
                      <td className={styles.tdNome}>
                        <span className={styles.dot} style={{ background: item.disciplinas?.cor || 'var(--color-primary)' }} />
                        <div className={styles.nomeCol}>
                          <span className={styles.disc}>{item.disciplinas?.nome || 'Disciplina'}</span>
                          <span className={styles.assunto}>{item.assuntos?.nome || 'Disciplina inteira'}</span>
                        </div>
                      </td>
                      <td>
                        <select
                          className={styles.pesoSelect}
                          value={item.peso ?? 3}
                          onChange={e => mAtualizar.mutate({ id: item.id, patch: { peso: Number(e.target.value) } })}
                          title="Prioridade (1 = baixa, 5 = alta)"
                        >
                          {PESOS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className={styles.metaInput}
                          defaultValue={item.meta_questoes ?? 0}
                          onBlur={e => {
                            const v = Math.max(0, Number(e.target.value) || 0)
                            if (v !== (item.meta_questoes ?? 0)) mAtualizar.mutate({ id: item.id, patch: { meta_questoes: v } })
                          }}
                        />
                      </td>
                      <td className={styles.tdCheck}>
                        <input
                          type="checkbox"
                          checked={!!item.estudado}
                          onChange={e => mAtualizar.mutate({ id: item.id, patch: { estudado: e.target.checked } })}
                        />
                      </td>
                      <td className={styles.tdCheck}>
                        <input
                          type="checkbox"
                          checked={!!item.revisado}
                          onChange={e => mAtualizar.mutate({ id: item.id, patch: { revisado: e.target.checked } })}
                        />
                      </td>
                      <td>
                        <div className={styles.cicloCol}>
                          <span className={styles.cicloNum}>{item.ciclos || 0}×</span>
                          <button
                            className={styles.cicloBtn}
                            onClick={() => mCiclo.mutate({ id: item.id, ciclos: item.ciclos })}
                            title="Registrar mais uma volta"
                          >
                            <RotateCw size={12} /> +1 volta
                          </button>
                        </div>
                      </td>
                      <td className={styles.tdProgresso}>
                        {prog ? (
                          <div className={styles.progWrap} title={`${prog.feitas} de ${prog.meta} questões`}>
                            <div className={styles.progTrack}>
                              <div className={styles.progFill} style={{ width: `${prog.pct}%`, background: corProgresso(prog.pct) }} />
                            </div>
                            <span className={styles.progLabel}>{prog.feitas}/{prog.meta}</span>
                          </div>
                        ) : (
                          <span className={styles.semMeta}>—</span>
                        )}
                      </td>
                      <td className={styles.tdCheck}>
                        <button
                          className={styles.lixeira}
                          onClick={() => mRemover.mutate(item.id)}
                          title="Remover do plano"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {painelAberto && (
        <PainelMaterias
          catalogo={catalogo}
          salvando={mAdicionar.isPending}
          onFechar={() => setPainelAberto(false)}
          onAdicionar={(novos) => mAdicionar.mutate(novos)}
        />
      )}
    </div>
  )
}
