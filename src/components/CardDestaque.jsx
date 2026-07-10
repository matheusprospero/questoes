import { Sparkles, Trophy, Play } from 'lucide-react'
import styles from './CardDestaque.module.css'

// Card de "propaganda" da página inicial. Usado na Início e no preview do editor.
export default function CardDestaque({ destaque, onClick, className = '' }) {
  const d = destaque || {}
  const etiqueta = d.etiqueta?.trim() || 'Desafio do professor'
  const titulo = d.titulo?.trim() || 'Título do destaque'
  const texto = d.texto?.trim() || 'Escreva aqui a chamada que vai gerar interesse dos alunos.'
  const cta = d.cta_texto?.trim() || 'Resolver agora'

  return (
    <div className={`${styles.card} ${className}`}>
      <div className={styles.brilho} aria-hidden />
      <div className={styles.conteudo}>
        <span className={styles.tag}><Sparkles size={13} /> {etiqueta}</span>
        <h3 className={styles.titulo}>{titulo}</h3>
        <p className={styles.texto}>{texto}</p>
        <div className={styles.rodape}>
          <button type="button" className={styles.btn} onClick={onClick}>
            <Play size={15} /> {cta}
          </button>
        </div>
      </div>
      <div className={styles.trofeu} aria-hidden>
        <Trophy size={54} strokeWidth={1.4} />
      </div>
    </div>
  )
}
