import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  Mail, Lock, AlertCircle, ChevronDown,
  Target, RotateCcw, GraduationCap, BarChart2, ClipboardList, CheckCircle2,
} from 'lucide-react'
import styles from './Login.module.css'

const RECURSOS = [
  { Icon: Target, titulo: 'Meta do dia pronta pra você', texto: 'Escolha banca, disciplinas e assuntos — o sistema monta sua sessão diária com o que importa.' },
  { Icon: RotateCcw, titulo: 'Revisão espaçada', texto: 'As questões que você erra voltam na hora certa para fixar de verdade.' },
  { Icon: GraduationCap, titulo: 'Aulas com teoria e questões', texto: 'Estude o conteúdo e treine no mesmo tema, com resolução em vídeo.' },
  { Icon: BarChart2, titulo: 'Estatísticas e maestria', texto: 'Veja seu desempenho por assunto e saiba exatamente onde focar.' },
  { Icon: ClipboardList, titulo: 'Simulados', texto: 'Monte simulados, resolva online ou imprima para treinar como na prova.' },
]

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

export default function Login() {
  const { signIn, signInGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = location.state?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [entrandoGoogle, setEntrandoGoogle] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  async function handleGoogle() {
    setErro('')
    setEntrandoGoogle(true)
    try {
      await signInGoogle() // redireciona para o Google; ao voltar, a sessão é detectada
    } catch (err) {
      setErro('Não foi possível entrar com o Google. Tente novamente.')
      setEntrandoGoogle(false)
    }
  }

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
      <div className={styles.shell}>
        {/* Vitrine: o que dá pra fazer */}
        <div className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.heroLogo}>MP</div>
            <div>
              <p className={styles.heroKicker}>Prof. Matheus Próspero</p>
              <p className={styles.heroBrand}>Banco de Questões · Concursos</p>
            </div>
          </div>
          <h1 className={styles.heroTitulo}>Estude para concursos do jeito certo.</h1>
          <p className={styles.heroTexto}>
            Resolva questões de provas reais, receba sua meta diária personalizada e
            acompanhe sua evolução até a aprovação.
          </p>
          <ul className={styles.features}>
            {RECURSOS.map(({ Icon, titulo, texto }) => (
              <li key={titulo} className={styles.feature}>
                <span className={styles.featureIcon}><Icon size={17} /></span>
                <span>
                  <strong className={styles.featureTitulo}>{titulo}</strong>
                  <span className={styles.featureTexto}>{texto}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.heroRodape}>
            <CheckCircle2 size={15} /> Acesso gratuito — basta entrar com o Google.
          </p>
        </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitulo}>Comece a estudar agora</h2>
          <p className={styles.cardSub}>Entre para montar sua meta do dia.</p>
        </div>

        {/* Entrar com Google (aluno) */}
        <button
          type="button"
          className={styles.btnGoogle}
          onClick={handleGoogle}
          disabled={entrandoGoogle}
        >
          <GoogleIcon />
          {entrandoGoogle ? 'Redirecionando...' : 'Entrar com Google'}
        </button>
        <p className={styles.googleHint}>
          Acesso completo e gratuito. Basta entrar com sua conta Google.
        </p>

        {erro && (
          <div className={styles.erro} role="alert">
            <AlertCircle size={14} aria-hidden />
            {erro}
          </div>
        )}

        {/* Acesso do professor (e-mail e senha) — recolhido */}
        <button
          type="button"
          className={styles.toggleProfessor}
          onClick={() => setMostrarSenha(v => !v)}
        >
          Acesso do professor
          <ChevronDown size={13} className={mostrarSenha ? styles.chevronOpen : ''} />
        </button>

        {mostrarSenha && (
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
                  autoComplete="email"
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
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={carregando}
            >
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
      </div>
    </div>
  )
}
