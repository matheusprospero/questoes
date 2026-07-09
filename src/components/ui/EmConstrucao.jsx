// Placeholder genérico para módulos ainda não implementados
import { Construction } from 'lucide-react'

export default function EmConstrucao({ titulo }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '12px',
      color: 'var(--text-tertiary)',
    }}>
      <Construction size={36} strokeWidth={1.5} />
      <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-secondary)' }}>
        {titulo}
      </p>
      <p style={{ fontSize: '13px' }}>Este módulo está sendo desenvolvido.</p>
    </div>
  )
}
