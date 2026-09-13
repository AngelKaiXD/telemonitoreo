import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  HeartPulse,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Stethoscope,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/pacientes', label: 'Pacientes', icon: Users, end: false },
  { to: '/doctores', label: 'Doctores', icon: Stethoscope, end: false },
]

const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed'

export default function Layout() {
  const { role, user, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const roleLabel = role === 'admin' ? 'Admin' : 'Doctor'

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // almacenamiento no disponible: se ignora la preferencia
    }
  }, [collapsed])

  const shellClass = `app-shell${collapsed ? ' sidebar-collapsed' : ''}`

  return (
    <div className={shellClass}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <HeartPulse size={22} />
          <span>Telemonitorización médica</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={label}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button
            type="button"
            className="topbar-menu"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            title={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div className="topbar-user">
            <span className="topbar-email" title={user?.email ?? ''}>
              {user?.email ?? ''}
            </span>
            <span className={`role-badge role-${role}`}>{roleLabel}</span>
          </div>
          <button className="topbar-logout" onClick={signOut} title="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}