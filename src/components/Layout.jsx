import { NavLink, Outlet } from 'react-router-dom'
import {
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Stethoscope,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/pacientes', label: 'Pacientes', icon: Users, end: false },
  { to: '/doctores', label: 'Doctores', icon: Stethoscope, end: false },
]

export default function Layout() {
  const { role, user, signOut } = useAuth()
  const roleLabel = role === 'admin' ? 'Admin' : 'Doctor'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <HeartPulse size={22} />
          <span>Telemonitorización médica</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-column">
        <header className="topbar">
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