import { useState } from 'react'
import { supabase } from '../../services/supabase'
import { X, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './NovoUsuarioModal.module.css'

export default function NovoUsuarioModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ nome: '', email: '', papel: 'professor', senha: '' })
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (!form.nome || !form.email || !form.senha) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }
    if (form.senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setCarregando(true)
    try {
      // Cria o usuário via Supabase Auth usando signUp
      // O trigger fn_criar_perfil_usuario cuida do perfil automaticamente
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.senha,
        options: {
          data: { nome: form.nome, papel: form.papel },
        },
      })

      if (error) throw error

      // Atualiza o nome e papel no perfil (caso o trigger não pegue os metadados)
      if (data.user) {
        await supabase
          .from('perfis')
          .upsert({
            id: data.user.id,
            nome: form.nome,
            email: form.email,
            papel: form.papel,
          })
      }

      toast.success(`Usuário ${form.nome} criado com sucesso!`)
      onSuccess()
    } catch (err) {
      setErro(err.message || 'Erro ao criar usuário.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitulo}>
            <UserPlus size={18} aria-hidden />
            Novo usuário
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label className={styles.label}>Nome completo *</label>
            <input
              name="nome"
              className={styles.input}
              placeholder="Ex: Maria Silva"
              value={form.nome}
              onChange={handleChange}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>E-mail institucional *</label>
            <input
              name="email"
              type="email"
              className={styles.input}
              placeholder="professor@sme.edu.br"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Perfil de acesso *</label>
            <select
              name="papel"
              className={styles.input}
              value={form.papel}
              onChange={handleChange}
            >
              <option value="professor">Professor</option>
              <option value="formador">Formador</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Senha provisória *</label>
            <input
              name="senha"
              type="password"
              className={styles.input}
              placeholder="Mínimo 6 caracteres"
              value={form.senha}
              onChange={handleChange}
            />
            <span className={styles.hint}>O usuário poderá alterar a senha após o primeiro acesso.</span>
          </div>

          {erro && <div className={styles.erro}>{erro}</div>}

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={carregando}>
              {carregando ? 'Criando...' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
