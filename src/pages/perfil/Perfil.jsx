import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { atualizarPerfil } from '../../services/usuarios'
import { supabase } from '../../services/supabase'
import { User, Mail, Shield, Save, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Perfil.module.css'

const PAPEL_LABEL = {
  professor: 'Professor',
  formador: 'Formador',
  administrador: 'Administrador',
}

export default function Perfil() {
  const { usuario, perfil, recarregarPerfil } = useAuth()
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  useEffect(() => {
    if (perfil) setNome(perfil.nome || '')
  }, [perfil])

  const iniciais = perfil?.nome
    ? perfil.nome.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()
    : '?'

  async function handleSalvarPerfil(e) {
    e.preventDefault()
    if (!nome.trim()) { toast.error('Nome não pode ser vazio'); return }
    setSalvando(true)
    try {
      await atualizarPerfil(usuario.id, { nome: nome.trim() })
      await recarregarPerfil()
      toast.success('Perfil atualizado!')
    } catch {
      toast.error('Erro ao salvar perfil')
    } finally {
      setSalvando(false)
    }
  }

  async function handleAlterarSenha(e) {
    e.preventDefault()
    if (novaSenha.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return }
    if (novaSenha !== confirmarSenha) { toast.error('As senhas não coincidem'); return }
    setSalvandoSenha(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error
      toast.success('Senha alterada com sucesso!')
      setSenhaAtual('')
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
        {/* Card — dados pessoais */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <User size={16} aria-hidden />
            Dados pessoais
          </div>

          <div className={styles.avatarArea}>
            <div className={styles.avatarGrande}>{iniciais}</div>
            <div>
              <div className={styles.nomeAtual}>{perfil?.nome || '—'}</div>
              <span className={`${styles.papelBadge} ${styles['papel_' + perfil?.papel]}`}>
                {PAPEL_LABEL[perfil?.papel] ?? perfil?.papel}
              </span>
            </div>
          </div>

          <form onSubmit={handleSalvarPerfil} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Nome completo</label>
              <input
                className={styles.input}
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>E-mail</label>
              <div className={styles.inputReadonly}>
                <Mail size={14} aria-hidden />
                {usuario?.email}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Perfil de acesso</label>
              <div className={styles.inputReadonly}>
                <Shield size={14} aria-hidden />
                {PAPEL_LABEL[perfil?.papel] ?? '—'}
              </div>
            </div>

            <button type="submit" className={styles.btnPrimary} disabled={salvando}>
              <Save size={14} aria-hidden />
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
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
