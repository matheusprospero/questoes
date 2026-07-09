import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import RotaProtegida from './components/layout/RotaProtegida'
import Login from './pages/auth/Login'
import Questoes from './pages/questoes/Questoes'
import QuestaoForm from './pages/questoes/QuestaoForm'
import QuestaoDetalhe from './pages/questoes/QuestaoDetalhe'
import Simulados from './pages/simulados/Simulados'
import SimuladoForm from './pages/simulados/SimuladoForm'
import SimuladoDetalhe from './pages/simulados/SimuladoDetalhe'
import Cadernos from './pages/cadernos/Cadernos'
import CadernoDetalhe from './pages/cadernos/CadernoDetalhe'
import Favoritos from './pages/favoritos/Favoritos'
import Estudo from './pages/estudo/Estudo'
import Estatisticas from './pages/estudo/Estatisticas'
import Perfil from './pages/perfil/Perfil'

const base = import.meta.env.BASE_URL

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <RotaProtegida><AppLayout /></RotaProtegida>,
    children: [
      { index: true, element: <Navigate to="/questoes" replace /> },
      { path: 'questoes',            element: <Questoes /> },
      { path: 'questoes/nova',       element: <QuestaoForm /> },
      { path: 'questoes/:id',        element: <QuestaoDetalhe /> },
      { path: 'questoes/:id/editar', element: <QuestaoForm /> },
      { path: 'simulados',            element: <Simulados /> },
      { path: 'simulados/novo',       element: <SimuladoForm /> },
      { path: 'simulados/:id',        element: <SimuladoDetalhe /> },
      { path: 'simulados/:id/editar', element: <SimuladoForm /> },
      { path: 'cadernos',             element: <Cadernos /> },
      { path: 'cadernos/:id',         element: <CadernoDetalhe /> },
      { path: 'favoritos',           element: <Favoritos /> },
      { path: 'estudo',              element: <Estudo /> },
      { path: 'estatisticas',        element: <Estatisticas /> },
      { path: 'perfil',              element: <Perfil /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
], { basename: base })

export default function AppRouter() {
  return <RouterProvider router={router} />
}
