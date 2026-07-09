import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  HelpCircle, FileText, FolderOpen, ClipboardList,
  Network, Layers, Heart, BarChart2, Map, Eye,
  LogOut, Menu, X, BookMarked, Users, UserCircle
} from 'lucide-react'
import styles from './AppLayout.module.css'

const NAV_ITEMS = [
  {
    section: 'Principal',
    items: [
      { to: '/questoes',   label: 'Banco de Questões',     icon: HelpCircle    },
      { to: '/planos',     label: 'Planos de Aula',        icon: FileText      },
      { to: '/materiais',  label: 'Materiais Pedagógicos', icon: FolderOpen    },
      { to: '/provas',     label: 'Provas e Avaliações',   icon: ClipboardList },
    ]
  },
  {
    section: 'Organização',
    items: [
      { to: '/matriz',    label: 'Matriz Curricular', icon: Network },
      { to: '/colecoes',  label: 'Minhas Coleções',   icon: Layers  },
      { to: '/favoritos', label: 'Favoritos',         icon: Heart   },
    ]
  },
  {
    section: 'Gestão',
    items: [
      { to: '/relatorios', label: 'Relatórios',           icon: BarChart2 },
      { to: '/cobertura',  label: 'Cobertura Curricular',  icon: Map       },
      { to: '/revisao',    label: 'Fila de Revisão',       icon: Eye,  papeis: ['formador','administrador'] },
      { to: '/usuarios',   label: 'Usuários',              icon: Users, papeis: ['formador','administrador'] },
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
  const { perfil, papel, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const papelLabel = {
    professor: 'Professor',
    formador: 'Formador',
    administrador: 'Administrador',
  }[papel] ?? ''

  const iniciais = perfil?.nome
    ? perfil.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

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
            <div className={styles.logoText}>SME Digital</div>
            <div className={styles.logoSub}>Repositório Pedagógico</div>
          </div>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Navegação principal">
        {NAV_ITEMS.map(group => (
          <div key={group.section}>
            <div className={styles.navSection}>{group.section}</div>
            {group.items
              .filter(item => !item.papeis || item.papeis.includes(papel))
              .map(item => (
                <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} />
              ))
            }
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <NavLink to="/perfil" className={styles.userChip}>
          <div className={styles.avatar}>{iniciais}</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{perfil?.nome ?? 'Carregando...'}</div>
            <div className={styles.userRole}>{papelLabel}</div>
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
          <div className={styles.mobileLogo}>RepedMunicipal</div>
        </header>

        <main className={styles.content} id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
