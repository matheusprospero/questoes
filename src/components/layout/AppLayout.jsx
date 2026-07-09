import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  HelpCircle, ClipboardList, Layers, Heart,
  LogOut, Menu, X, BookMarked, UserCircle
} from 'lucide-react'
import styles from './AppLayout.module.css'

const NAV_ITEMS = [
  {
    section: 'Questões',
    items: [
      { to: '/questoes',  label: 'Banco de Questões', icon: HelpCircle    },
      { to: '/favoritos', label: 'Favoritos',         icon: Heart         },
    ]
  },
  {
    section: 'Organização',
    items: [
      { to: '/colecoes', label: 'Cadernos',  icon: Layers        },
      { to: '/provas',   label: 'Simulados', icon: ClipboardList },
    ]
  },
]

function NavItem({ to, label, Icon }) {
  return (
    <NavLink
      to={to}
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
  const { usuario, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const iniciais = usuario?.email?.slice(0, 2).toUpperCase() ?? '?'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const sidebar = (
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
      <div className={styles.sidebarHeader}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <BookMarked size={16} />
          </div>
          <div>
            <div className={styles.logoText}>Questões</div>
            <div className={styles.logoSub}>Concursos Públicos</div>
          </div>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Navegação principal">
        {NAV_ITEMS.map(group => (
          <div key={group.section}>
            <div className={styles.navSection}>{group.section}</div>
            {group.items.map(item => (
              <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} />
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <NavLink to="/perfil" className={styles.userChip}>
          <div className={styles.avatar}>{iniciais}</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{usuario?.email ?? 'Carregando...'}</div>
            <div className={styles.userRole}>Concurseiro</div>
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
          <div className={styles.mobileLogo}>Questões de Concursos</div>
        </header>

        <main className={styles.content} id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
