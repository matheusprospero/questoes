import { useMemo, useState } from 'react'
import { Target, Flame, X, Crosshair } from 'lucide-react'
import styles from './ModalMeta.module.css'

export const CFG_META_DEFAULT = { metaDiaria: 20, metaDias: 7, objetivo: { banca_id: null, assuntos: [] }, porDisciplina: {} }

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
    })
  }

  const comGoal = Object.keys(porDisc).map(id => disciplinas.find(d => d.id === id)).filter(Boolean)

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
                {assuntosPorDisc.map(g => (
                  <div key={g.disc.id} className={styles.grupoAssunto}>
                    <div className={styles.grupoTitulo}>
                      <span className={styles.chipCor} style={{ background: g.disc.cor || 'var(--color-primary)' }} />
                      {g.disc.nome}
                    </div>
                    <div className={styles.chips}>
                      {g.itens.map(a => (
                        <button key={a.id} type="button"
                          className={`${styles.chipMini} ${assuntos.has(a.id) ? styles.chipOn : ''}`}
                          onClick={() => toggleAssunto(a.id)}>
                          {a.nome} ({a.total})
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
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
              </div>
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
