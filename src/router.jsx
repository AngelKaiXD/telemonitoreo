import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import AppRoot from './AppRoot'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { FullPageLoader } from './components/ui/Feedback'

const loginPage = lazy(() => import('./pages/LoginPage'))
const accessDeniedPage = lazy(() => import('./pages/AccessDeniedPage'))
const notFoundPage = lazy(() => import('./pages/NotFoundPage'))
const dashboardPage = lazy(() => import('./pages/DashboardPage'))
const patientsPage = lazy(() => import('./pages/PatientsPage'))
const patientFormPage = lazy(() => import('./pages/PatientFormPage'))
const patientDetailPage = lazy(() => import('./pages/PatientDetailPage'))
const doctorsPage = lazy(() => import('./pages/DoctorsPage'))
const doctorFormPage = lazy(() => import('./pages/DoctorFormPage'))

function withSuspense(Component) {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Component />
    </Suspense>
  )
}

export const appRouter = createBrowserRouter([
  { path: '/', element: <AppRoot /> },
  { path: '/login', element: withSuspense(loginPage) },
  { path: '/acceso-denegado', element: withSuspense(accessDeniedPage) },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/dashboard', element: withSuspense(dashboardPage) },
          { path: '/pacientes', element: withSuspense(patientsPage) },
          { path: '/pacientes/nuevo', element: withSuspense(patientFormPage) },
          { path: '/pacientes/:id', element: withSuspense(patientDetailPage) },
          { path: '/pacientes/:id/editar', element: withSuspense(patientFormPage) },
          { path: '/doctores', element: withSuspense(doctorsPage) },
          { path: '/doctores/nuevo', element: withSuspense(doctorFormPage) },
          { path: '/doctores/:id/editar', element: withSuspense(doctorFormPage) },
        ],
      },
    ],
  },
  { path: '*', element: withSuspense(notFoundPage) },
])