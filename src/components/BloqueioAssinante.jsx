import { Lock, Star } from 'lucide-react'
import styles from './BloqueioAssinante.module.css'

// Aviso de conteúdo exclusivo para assinantes (aulas, vídeos, etc.)
export default function BloqueioAssinante({
  titulo = 'Conteúdo exclusivo para assinantes',
  texto = 'As aulas — teoria e questões comentadas — fazem parte do conteúdo para assinantes.',
}) {
  return (
    <div className={styles.box}>
      <div className={styles.icone}><Lock size={26} /></div>
      <h2 className={styles.titulo}>{titulo}</h2>
      <p className={styles.texto}>{texto}</p>
      <p className={styles.contato}>
        <Star size={14} /> Assine para liberar o acesso — fale com o professor.
      </p>
    </div>
  )
}
