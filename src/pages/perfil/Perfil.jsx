import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../services/supabase'
import { User, Mail, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Perfil.module.css'

export default function Perfil() {
  const { usuario } = useAuth()

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  const iniciais = usuario?.email?.slice(0, 2).toUpperCase() ?? '?'

  async function handleAlterarSenha(e) {
    e.preventDefault()
    if (novaSenha.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return }
    if (novaSenha !== confirmarSenha) { toast.error('As senhas não coincidem'); return }
    setSalvandoSenha(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error
      toast.success('Senha alterada com sucesso!')
      setNovaSenha('')
      setConfirmarSenha('')
    } catch (err) {
      toast.error(err.message || 'Erro ao alterar senha')
    } finally {
      setSalvandoSenha(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.titulo}>Meu perfil</h1>

      <div className={styles.grid}>
        {/* Card — conta */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <User size={16} aria-hidden />
            Conta
          </div>

          <div className={styles.avatarArea}>
            <div className={styles.avatarGrande}>{iniciais}</div>
            <div>
              <div className={styles.nomeAtual}>{usuario?.email}</div>
            </div>
          </div>

          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>E-mail</label>
              <div className={styles.inputReadonly}>
                <Mail size={14} aria-hidden />
                {usuario?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Card — alterar senha */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <KeyRound size={16} aria-hidden />
            Alterar senha
          </div>

          <form onSubmit={handleAlterarSenha} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Nova senha</label>
              <input
                type="password"
                className={styles.input}
                placeholder="Mínimo 6 caracteres"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Confirmar nova senha</label>
              <input
                type="password"
                className={styles.input}
                placeholder="Repita a nova senha"
                value={confirmarSenha}
                onChange={e => setConfirmarSenha(e.target.value)}
              />
            </div>

            <button type="submit" className={styles.btnPrimary} disabled={salvandoSenha}>
              <KeyRound size={14} aria-hidden />
              {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
