import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import RotaProtegida from './components/layout/RotaProtegida'
import Login from './pages/auth/Login'
import Questoes from './pages/questoes/Questoes'
import QuestaoForm from './pages/questoes/QuestaoForm'
import QuestaoDetalhe from './pages/questoes/QuestaoDetalhe'
import Provas from './pages/provas/Provas'
import ProvaForm from './pages/provas/ProvaForm'
import ProvaDetalhe from './pages/provas/ProvaDetalhe'
import Colecoes from './pages/colecoes/Colecoes'
import ColecaoDetalhe from './pages/colecoes/ColecaoDetalhe'
import Favoritos from './pages/favoritos/Favoritos'
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
      { path: 'provas',              element: <Provas /> },
      { path: 'provas/nova',         element: <ProvaForm /> },
      { path: 'provas/:id',          element: <ProvaDetalhe /> },
      { path: 'provas/:id/editar',   element: <ProvaForm /> },
      { path: 'colecoes',            element: <Colecoes /> },
      { path: 'colecoes/:id',        element: <ColecaoDetalhe /> },
      { path: 'favoritos',           element: <Favoritos /> },
      { path: 'perfil',              element: <Perfil /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
], { basename: base })

export default function AppRouter() {
  return <RouterProvider router={router} />
}
