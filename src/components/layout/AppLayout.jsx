import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  HelpCircle, ClipboardList, Layers, Heart, Home,
  LogOut, Menu, X, BookOpen, BarChart2, Users, GraduationCap
} from 'lucide-react'
import styles from './AppLayout.module.css'

const NAV_ITEMS = [
  {
    section: 'Estudo',
    items: [
      { to: '/',              label: 'Início',            icon: Home, end: true },
      { to: '/aulas',         label: 'Aulas',             icon: GraduationCap },
      { to: '/estudo',        label: 'Resolver Questões', icon: BookOpen  },
      { to: '/estatisticas',  label: 'Estatísticas',      icon: BarChart2 },
    ]
  },
  {
    section: 'Banco',
    items: [
      { to: '/questoes',  label: 'Banco de Questões', icon: HelpCircle },
      { to: '/favoritos', label: 'Favoritos',         icon: Heart      },
    ]
  },
  {
    section: 'Organização',
    items: [
      { to: '/cadernos',  label: 'Cadernos',  icon: Layers        },
      { to: '/simulados', label: 'Simulados', icon: ClipboardList },
    ]
  },
]

function NavItem({ to, label, Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
      }
    >
      <Icon size={16} aria-hidden />
      <span>{label}</span>
    </NavLink>
  )
}

export default function AppLayout() {
  const { usuario, perfil, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const nome = perfil?.nome || usuario?.email
  const iniciais = nome
    ? nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const sidebar = (
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
      <div className={styles.sidebarHeader}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>MP</div>
          <div>
            <div className={styles.logoKicker}>Professor</div>
            <div className={styles.logoText}>Matheus Próspero</div>
            <div className={styles.logoSub}>Banco de Questões</div>
          </div>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Navegação principal">
        {NAV_ITEMS.map(group => (
          <div key={group.section}>
            <div className={styles.navSection}>{group.section}</div>
            {group.items.map(item => (
              <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} end={item.end} />
            ))}
          </div>
        ))}
        {isAdmin && (
          <div>
            <div className={styles.navSection}>Gestão</div>
            <NavItem to="/alunos" label="Alunos" Icon={Users} />
          </div>
        )}
      </nav>

      <div className={styles.sidebarFooter}>
        <NavLink to="/perfil" className={styles.userChip}>
          <div className={styles.avatar}>{iniciais}</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{nome ?? 'Carregando...'}</div>
            <div className={styles.userRole}>{isAdmin ? 'Professor' : 'Aluno'}</div>
          </div>
        </NavLink>
        <button
          className={styles.signOutBtn}
          onClick={handleSignOut}
          title="Sair"
          aria-label="Sair da conta"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  )

  return (
    <div className={styles.shell}>
      {sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {sidebar}

      <div className={styles.main}>
        <header className={styles.mobileTopbar}>
          <button
            className={styles.menuBtn}
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Abrir menu"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className={styles.mobileLogo}>Prof. Matheus Próspero</div>
        </header>

        <main className={styles.content} id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
