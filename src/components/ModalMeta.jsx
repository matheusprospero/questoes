import { useState } from 'react'
import { Target, Flame, X, Plus, Trash2, Crosshair } from 'lucide-react'
import { opcoesDisponiveis } from '../services/questoes'
import styles from './ModalMeta.module.css'

export const CFG_META_DEFAULT = { metaDiaria: 20, metaDias: 7, objetivo: { banca_id: null, cargo: null }, porDisciplina: {} }

export function lerCfgMeta() {
  try {
    const c = JSON.parse(localStorage.getItem('config-meta') || '{}')
    return { ...CFG_META_DEFAULT, ...c, objetivo: { ...CFG_META_DEFAULT.objetivo, ...(c.objetivo || {}) } }
  } catch { return { ...CFG_META_DEFAULT } }
}
export function salvarCfgMeta(c) { localStorage.setItem('config-meta', JSON.stringify(c)) }

// Modal de metas + objetivo (banca, cargo, disciplinas)
export default function ModalMeta({ cfgInicial, facetas = [], onFechar, onSalvar }) {
  const [metaDiaria, setMetaDiaria] = useState(cfgInicial.metaDiaria || 20)
  const [metaDias, setMetaDias] = useState(cfgInicial.metaDias || 7)
  const [banca, setBanca] = useState(cfgInicial.objetivo?.banca_id || '')
  const [cargo, setCargo] = useState(cfgInicial.objetivo?.cargo || '')
  const [porDisc, setPorDisc] = useState({ ...(cfgInicial.porDisciplina || {}) })
  const [addDisc, setAddDisc] = useState('')

  const objetivo = { banca_id: banca || undefined, cargo: cargo || undefined }
  const dispBanca = (opcoesDisponiveis(facetas, { cargo: cargo || undefined }).banca_id || []).slice().sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
  const dispCargo = (opcoesDisponiveis(facetas, { banca_id: banca || undefined }).cargo || []).slice().sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
  const dispDisc = (opcoesDisponiveis(facetas, objetivo).disciplina_id || []).slice().sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))

  const comMeta = dispDisc.filter(d => porDisc[d.valor] != null)
  const semMeta = dispDisc.filter(d => porDisc[d.valor] == null)

  function adicionar() {
    if (!addDisc) return
    setPorDisc(p => ({ ...p, [addDisc]: 5 })); setAddDisc('')
  }
  function remover(id) { setPorDisc(p => { const n = { ...p }; delete n[id]; return n }) }
  function salvar() {
    const limpo = {}
    for (const d of dispDisc) if (Number(porDisc[d.valor]) > 0) limpo[d.valor] = Number(porDisc[d.valor])
    onSalvar({
      metaDiaria: Number(metaDiaria) || 0, metaDias: Number(metaDias) || 0,
      objetivo: { banca_id: banca || null, cargo: cargo || null },
      porDisciplina: limpo,
    })
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <h3>Meu objetivo e metas</h3>
          <button className={styles.fechar} onClick={onFechar}><X size={18} /></button>
        </div>

        {/* Objetivo */}
        <div className={styles.secao}>
          <p className={styles.secaoTitulo}><Crosshair size={14} /> Meu objetivo (o que vai cair na sua prova)</p>
          <div className={styles.linha}>
            <label className={styles.campo}>
              <span className={styles.label}>Banca</span>
              <select className={styles.input} value={banca} onChange={e => setBanca(e.target.value)}>
                <option value="">Todas</option>
                {dispBanca.map(b => <option key={b.valor} value={b.valor}>{b.rotulo} ({b.total})</option>)}
              </select>
            </label>
            <label className={styles.campo}>
              <span className={styles.label}>Cargo</span>
              <select className={styles.input} value={cargo} onChange={e => setCargo(e.target.value)}>
                <option value="">Todos</option>
                {dispCargo.map(c => <option key={c.valor} value={c.valor}>{c.rotulo} ({c.total})</option>)}
              </select>
            </label>
          </div>
          <p className={styles.hint}>As questões da sua meta virão só desse objetivo.</p>
        </div>

        {/* Metas */}
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
        </div>

        {/* Disciplinas do objetivo */}
        <div className={styles.secao}>
          <p className={styles.secaoTitulo}>Metas diárias por disciplina</p>
          {dispDisc.length === 0 && <p className={styles.vazio}>Escolha um objetivo com questões para ver as disciplinas.</p>}
          {comMeta.map(d => (
            <div key={d.valor} className={styles.discRow}>
              <span className={styles.discCor} style={{ background: d.cor || 'var(--color-primary)' }} />
              <span className={styles.discNome}>{d.rotulo}</span>
              <input className={styles.inputMini} type="number" min="1"
                value={porDisc[d.valor]} onChange={e => setPorDisc(p => ({ ...p, [d.valor]: e.target.value }))} />
              <span className={styles.qDia}>q/dia</span>
              <button className={styles.removerBtn} onClick={() => remover(d.valor)}><Trash2 size={14} /></button>
            </div>
          ))}
          {semMeta.length > 0 && (
            <div className={styles.addRow}>
              <select className={styles.select} value={addDisc} onChange={e => setAddDisc(e.target.value)}>
                <option value="">Adicionar disciplina…</option>
                {semMeta.map(d => <option key={d.valor} value={d.valor}>{d.rotulo} ({d.total})</option>)}
              </select>
              <button className={styles.addBtn} onClick={adicionar} disabled={!addDisc}><Plus size={15} /></button>
            </div>
          )}
        </div>

        <div className={styles.botoes}>
          <button className={styles.btnCancel} onClick={onFechar}>Cancelar</button>
          <button className={styles.btnSalvar} onClick={salvar}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
