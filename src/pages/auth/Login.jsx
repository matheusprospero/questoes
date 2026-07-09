import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { BookMarked, Mail, Lock, AlertCircle } from 'lucide-react'
import styles from './Login.module.css'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = location.state?.from?.pathname ?? '/questoes'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await signIn(email, senha)
      navigate(destino, { replace: true })
    } catch (err) {
      setErro('E-mail ou senha incorretos. Verifique seus dados e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>
            <BookMarked size={24} />
          </div>
          <h1 className={styles.logoTitle}>Questões de Concursos</h1>
          <p className={styles.logoSub}>Questões comentadas com resolução em vídeo</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>E-mail</label>
            <div className={styles.inputWrap}>
              <Mail size={15} className={styles.inputIcon} aria-hidden />
              <input
                id="email"
                type="email"
                className={styles.input}
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="senha" className={styles.label}>Senha</label>
            <div className={styles.inputWrap}>
              <Lock size={15} className={styles.inputIcon} aria-hidden />
              <input
                id="senha"
                type="password"
                className={styles.input}
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {erro && (
            <div className={styles.erro} role="alert">
              <AlertCircle size={14} aria-hidden />
              {erro}
            </div>
          )}

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={carregando}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className={styles.ajuda}>
          Acesso restrito a alunos cadastrados. Fale com o professor para obter seu acesso.
        </p>
      </div>
    </div>
  )
}
