import { useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import styles from './GuiaUso.module.css'

/**
 * Card de orientação "como usar" exibido no topo de uma página.
 * Dispensável: ao fechar, grava no localStorage e não aparece mais.
 *
 * <GuiaUso id="cadernos" titulo="Como usar os cadernos" passos={[{titulo, texto}]} />
 */
export default function GuiaUso({ id, titulo, passos }) {
  const chave = `guia-oculto-${id}`
  const [visivel, setVisivel] = useState(() => {
    try { return localStorage.getItem(chave) !== '1' } catch { return true }
  })

  if (!visivel) return null

  function fechar() {
    try { localStorage.setItem(chave, '1') } catch { /* sem storage, só fecha */ }
    setVisivel(false)
  }

  return (
    <div className={styles.guia}>
      <div className={styles.header}>
        <div className={styles.tituloRow}>
          <span className={styles.icone}><Lightbulb size={14} /></span>
          <span className={styles.titulo}>{titulo}</span>
        </div>
        <button className={styles.fechar} onClick={fechar} aria-label="Ocultar guia" title="Entendi, ocultar">
          <X size={14} />
        </button>
      </div>
      <ol className={styles.passos}>
        {passos.map((p, i) => (
          <li key={i} className={styles.passo}>
            <span className={styles.num}>{i + 1}</span>
            <div>
              <strong className={styles.passoTitulo}>{p.titulo}</strong>
              <p className={styles.passoTexto}>{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
