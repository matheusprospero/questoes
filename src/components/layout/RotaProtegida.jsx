import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

// Spinner simples enquanto verifica a sessão
function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '12px',
      color: 'var(--text-tertiary)',
      fontSize: '14px',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid var(--border-subtle)',
        borderTopColor: 'var(--color-primary)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      Carregando...
    </div>
  )
}

// Protege rotas que exigem autenticação (usuário único, sem papéis)
export default function RotaProtegida({ children }) {
  const { autenticado, carregando } = useAuth()
  const location = useLocation()

  if (carregando) return <LoadingScreen />

  if (!autenticado) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
