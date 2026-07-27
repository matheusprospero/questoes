import { useMemo, useState } from 'react'
import { Target, Flame, X, Crosshair, ChevronDown, ChevronUp, Bell } from 'lucide-react'
import styles from './ModalMeta.module.css'

export const CFG_META_DEFAULT = {
  metaDiaria: 20, metaDias: 7, objetivo: { banca_id: null, assuntos: [] }, porDisciplina: {},
  lembreteAtivo: true, diasSemana: [1, 2, 3, 4, 5], semanas: 0, inicioMeta: null,
}

const DIAS = [['D', 0], ['S', 1], ['T', 2], ['Q', 3], ['Q', 4], ['S', 5], ['S', 6]]
const DIAS_NOME = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function lerCfgMeta() {
  try {
    const c = JSON.parse(localStorage.getItem('config-meta') || '{}')
    return {
      ...CFG_META_DEFAULT, ...c,
      objetivo: { banca_id: null, assuntos: [], ...(c.objetivo || {}) },
      porDisciplina: c.porDisciplina || {},
    }
  } catch { return { ...CFG_META_DEFAULT } }
}
export function salvarCfgMeta(c) { localStorage.setItem('config-meta', JSON.stringify(c)) }

function distintos(facetas, rel, pred = () => true) {
  const m = new Map()
  for (const q of facetas) {
    if (!pred(q)) continue
    const r = q[rel]
    if (!r) continue
    const g = m.get(r.id) ?? { id: String(r.id), nome: r.nome, cor: r.cor, total: 0 }
    g.total += 1; m.set(r.id, g)
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export default function ModalMeta({ cfgInicial, facetas = [], onFechar, onSalvar }) {
  const [metaDiaria, setMetaDiaria] = useState(cfgInicial.metaDiaria || 20)
  const [metaDias, setMetaDias] = useState(cfgInicial.metaDias || 7)
  const [banca, setBanca] = useState(cfgInicial.objetivo?.banca_id || '')
  const [porDisc, setPorDisc] = useState(() => {
    const o = {}; for (const [k, v] of Object.entries(cfgInicial.porDisciplina || {})) o[String(k)] = Number(v) || 0; return o
  })
  const [assuntos, setAssuntos] = useState(() => new Set((cfgInicial.objetivo?.assuntos || []).map(String)))
  const [lembreteAtivo, setLembreteAtivo] = useState(cfgInicial.lembreteAtivo !== false)
  const [diasSemana, setDiasSemana] = useState(() => new Set((cfgInicial.diasSemana ?? [1,2,3,4,5]).map(Number)))
  const [semanas, setSemanas] = useState(cfgInicial.semanas ?? 0)
  const toggleDia = (d) => setDiasSemana(s => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n })
  const [abertos, setAbertos] = useState(() => new Set())
  const toggleGrupo = (id) => setAbertos(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const bancas = useMemo(() => distintos(facetas, 'bancas'), [facetas])
  const facBanca = useMemo(() => facetas.filter(q => !banca || String(q.banca_id) === String(banca)), [facetas, banca])
  const disciplinas = useMemo(() => distintos(facBanca, 'disciplinas'), [facBanca])
  const discsSel = new Set(Object.keys(porDisc))
  const chaveDiscs = Object.keys(porDisc).join(',')

  // Assuntos AGRUPADOS por disciplina escolhida (não misturados)
  const assuntosPorDisc = useMemo(() =>
    disciplinas.filter(d => discsSel.has(d.id)).map(d => ({
      disc: d,
      itens: distintos(facBanca, 'assuntos', q => String(q.disciplina_id) === d.id),
    })).filter(g => g.itens.length > 0),
    [facBanca, chaveDiscs]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDisc(id) {
    setPorDisc(p => { const n = { ...p }; if (id in n) delete n[id]; else n[id] = 0; return n })
  }
  function setGoal(id, v) { setPorDisc(p => ({ ...p, [id]: Number(v) || 0 })) }
  function toggleAssunto(id) {
    setAssuntos(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function salvar() {
    const validos = new Set(assuntosPorDisc.flatMap(g => g.itens.map(a => a.id)))
    onSalvar({
      metaDiaria: Number(metaDiaria) || 0, metaDias: Number(metaDias) || 0,
      objetivo: { banca_id: banca || null, assuntos: [...assuntos].filter(a => validos.has(a)) },
      porDisciplina: { ...porDisc },
      lembreteAtivo,
      diasSemana: [...diasSemana].sort((a, b) => a - b),
      semanas: Math.max(0, Number(semanas) || 0),
      inicioMeta: cfgInicial.inicioMeta ?? null,
    })
  }

  const comGoal = Object.keys(porDisc).map(id => disciplinas.find(d => d.id === id)).filter(Boolean)
  const somaDisc = Object.values(porDisc).reduce((a, b) => a + (Number(b) || 0), 0)
  const metaEfetiva = Math.max(Number(metaDiaria) || 0, somaDisc)

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <h3>Meu objetivo e metas</h3>
          <button className={styles.fechar} onClick={onFechar}><X size={18} /></button>
        </div>

        <div className={styles.body}>
          <div className={styles.secao}>
            <p className={styles.secaoTitulo}><Crosshair size={14} /> Meu objetivo</p>

            <label className={styles.campoFull}>
              <span className={styles.label}>Banca (opcional)</span>
              <select className={styles.input} value={banca} onChange={e => setBanca(e.target.value)}>
                <option value="">Todas as bancas</option>
                {bancas.map(b => <option key={b.id} value={b.id}>{b.nome} ({b.total})</option>)}
              </select>
            </label>

            <span className={styles.blocoLabel}>Disciplinas</span>
            <div className={styles.chips}>
              {disciplinas.length === 0 && <span className={styles.vazio}>Sem disciplinas para essa banca.</span>}
              {disciplinas.map(d => (
                <button key={d.id} type="button"
                  className={`${styles.chip} ${discsSel.has(d.id) ? styles.chipOn : ''}`}
                  onClick={() => toggleDisc(d.id)}>
                  <span className={styles.chipCor} style={{ background: d.cor || 'var(--color-primary)' }} />
                  {d.nome} ({d.total})
                </button>
              ))}
            </div>

            {discsSel.size === 0 ? (
              <p className={styles.dica}>Escolha as disciplinas para poder filtrar por assunto.</p>
            ) : assuntosPorDisc.length > 0 && (
              <>
                <span className={styles.blocoLabel}>Assuntos (opcional)</span>
                {assuntosPorDisc.map(g => {
                  const aberto = abertos.has(g.disc.id)
                  const nSel = g.itens.filter(a => assuntos.has(a.id)).length
                  return (
                    <div key={g.disc.id} className={styles.grupoAssunto}>
                      <button type="button" className={styles.grupoTitulo} onClick={() => toggleGrupo(g.disc.id)}>
                        {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span className={styles.chipCor} style={{ background: g.disc.cor || 'var(--color-primary)' }} />
                        {g.disc.nome}
                        <span className={styles.grupoContagem}>{nSel > 0 ? `${nSel} selecionado(s)` : `${g.itens.length}`}</span>
                      </button>
                      {aberto && (
                        <div className={styles.chips}>
                          {g.itens.map(a => (
                            <button key={a.id} type="button"
                              className={`${styles.chipMini} ${assuntos.has(a.id) ? styles.chipOn : ''}`}
                              onClick={() => toggleAssunto(a.id)}>
                              {a.nome} ({a.total})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>

          <div className={styles.secao}>
            <div className={styles.linha}>
              <label className={styles.campo}>
                <span className={styles.label}><Target size={14} /> Questões por dia</span>
                <input className={styles.input} type="number" min="1" value={metaDiaria} onChange={e => setMetaDiaria(e.target.value)} />
              </label>
              <label className={styles.campo}>
                <span className={styles.label}><Flame size={14} /> Meta de dias seguidos</span>
                <input className={styles.input} type="number" min="1" value={metaDias} onChange={e => setMetaDias(e.target.value)} />
              </label>
            </div>
            {comGoal.length > 0 && (
              <div className={styles.metasDisc}>
                <span className={styles.label}>Meta por disciplina (opcional):</span>
                {comGoal.map(d => (
                  <div key={d.id} className={styles.discRow}>
                    <span className={styles.discCor} style={{ background: d.cor || 'var(--color-primary)' }} />
                    <span className={styles.discNome}>{d.nome}</span>
                    <input className={styles.inputMini} type="number" min="0"
                      value={porDisc[d.id] || ''} placeholder="0"
                      onChange={e => setGoal(d.id, e.target.value)} />
                    <span className={styles.qDia}>q/dia</span>
                  </div>
                ))}
                <p className={somaDisc > (Number(metaDiaria) || 0) ? styles.avisoMeta : styles.dica}>
                  Soma por disciplina: <strong>{somaDisc}</strong> q/dia.
                  {somaDisc > (Number(metaDiaria) || 0)
                    ? ` Sua meta do dia será ${metaEfetiva} (o maior valor).`
                    : ` O restante (${Math.max(0, metaEfetiva - somaDisc)}) vem de revisão e pontos fracos.`}
                </p>
              </div>
            )}
          </div>

          <div className={styles.secao}>
            <p className={styles.secaoTitulo}><Bell size={14} /> Lembrete de meta por e-mail</p>
            <label className={styles.checkLembrete}>
              <input type="checkbox" checked={lembreteAtivo} onChange={e => setLembreteAtivo(e.target.checked)} />
              Receber lembrete por e-mail quando eu não bater a meta do dia
            </label>
            {lembreteAtivo && (
              <>
                <span className={styles.label}>Em quais dias da semana a meta vale:</span>
                <div className={styles.diasRow}>
                  {DIAS.map(([letra, d]) => (
                    <button key={d} type="button" title={DIAS_NOME[d]}
                      className={`${styles.diaBtn} ${diasSemana.has(d) ? styles.diaBtnOn : ''}`}
                      onClick={() => toggleDia(d)}>{letra}</button>
                  ))}
                </div>
                <label className={styles.campoFull}>
                  <span className={styles.label}>Por quantas semanas manter a meta ativa</span>
                  <input className={styles.input} type="number" min="0" value={semanas}
                    onChange={e => setSemanas(e.target.value)} />
                  <span className={styles.dica}>
                    {Number(semanas) > 0
                      ? `A cobrança por e-mail para após ${semanas} semana(s).`
                      : '0 = sem prazo (a meta fica ativa por tempo indeterminado).'}
                  </span>
                </label>
              </>
            )}
          </div>
        </div>

        <div className={styles.botoes}>
          <button className={styles.btnCancel} onClick={onFechar}>Cancelar</button>
          <button className={styles.btnSalvar} onClick={salvar}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
