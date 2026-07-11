import { useState } from 'react'
import { Target, Flame, X, Plus, Trash2 } from 'lucide-react'
import styles from './ModalMeta.module.css'

export const CFG_META_DEFAULT = { metaDiaria: 20, metaDias: 7, porDisciplina: {} }

export function lerCfgMeta() {
  try { return { ...CFG_META_DEFAULT, ...JSON.parse(localStorage.getItem('config-meta') || '{}') } }
  catch { return { ...CFG_META_DEFAULT } }
}
export function salvarCfgMeta(c) { localStorage.setItem('config-meta', JSON.stringify(c)) }

// Modal de ajustes das metas de estudo
export default function ModalMeta({ cfgInicial, disciplinas, onFechar, onSalvar }) {
  const [metaDiaria, setMetaDiaria] = useState(cfgInicial.metaDiaria || 20)
  const [metaDias, setMetaDias] = useState(cfgInicial.metaDias || 7)
  const [porDisc, setPorDisc] = useState({ ...(cfgInicial.porDisciplina || {}) })
  const [addDisc, setAddDisc] = useState('')

  const comMeta = disciplinas.filter(d => porDisc[d.id] != null)
  const semMeta = disciplinas.filter(d => porDisc[d.id] == null)

  function adicionar() {
    if (!addDisc) return
    setPorDisc(p => ({ ...p, [addDisc]: 5 }))
    setAddDisc('')
  }
  function remover(id) {
    setPorDisc(p => { const n = { ...p }; delete n[id]; return n })
  }
  function salvar() {
    const limpo = {}
    for (const [id, v] of Object.entries(porDisc)) if (Number(v) > 0) limpo[id] = Number(v)
    onSalvar({ metaDiaria: Number(metaDiaria) || 0, metaDias: Number(metaDias) || 0, porDisciplina: limpo })
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <h3>Minhas metas de estudo</h3>
          <button className={styles.fechar} onClick={onFechar}><X size={18} /></button>
        </div>

        <div className={styles.linha}>
          <label className={styles.campo}>
            <span className={styles.label}><Target size={14} /> Questões por dia</span>
            <input className={styles.input} type="number" min="1"
              value={metaDiaria} onChange={e => setMetaDiaria(e.target.value)} />
          </label>
          <label className={styles.campo}>
            <span className={styles.label}><Flame size={14} /> Meta de dias seguidos</span>
            <input className={styles.input} type="number" min="1"
              value={metaDias} onChange={e => setMetaDias(e.target.value)} />
          </label>
        </div>

        <div className={styles.secao}>
          <p className={styles.secaoTitulo}>Metas diárias por disciplina</p>
          {comMeta.length === 0 && <p className={styles.vazio}>Nenhuma meta por disciplina ainda.</p>}
          {comMeta.map(d => (
            <div key={d.id} className={styles.discRow}>
              <span className={styles.discCor} style={{ background: d.cor || 'var(--color-primary)' }} />
              <span className={styles.discNome}>{d.nome}</span>
              <input className={styles.inputMini} type="number" min="1"
                value={porDisc[d.id]} onChange={e => setPorDisc(p => ({ ...p, [d.id]: e.target.value }))} />
              <span className={styles.qDia}>q/dia</span>
              <button className={styles.removerBtn} onClick={() => remover(d.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          {semMeta.length > 0 && (
            <div className={styles.addRow}>
              <select className={styles.select} value={addDisc} onChange={e => setAddDisc(e.target.value)}>
                <option value="">Adicionar disciplina…</option>
                {semMeta.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
              <button className={styles.addBtn} onClick={adicionar} disabled={!addDisc}><Plus size={15} /></button>
            </div>
          )}
        </div>

        <div className={styles.botoes}>
          <button className={styles.btnCancel} onClick={onFechar}>Cancelar</button>
          <button className={styles.btnSalvar} onClick={salvar}>Salvar metas</button>
        </div>
      </div>
    </div>
  )
}
