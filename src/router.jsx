import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import RotaProtegida from './components/layout/RotaProtegida'
import Login from './pages/auth/Login'
import Questoes from './pages/questoes/Questoes'
import QuestaoForm from './pages/questoes/QuestaoForm'
import QuestaoDetalhe from './pages/questoes/QuestaoDetalhe'
import Planos from './pages/planos/Planos'
import PlanoForm from './pages/planos/PlanoForm'
import PlanoDetalhe from './pages/planos/PlanoDetalhe'
import Materiais from './pages/materiais/Materiais'
import Provas from './pages/provas/Provas'
import ProvaForm from './pages/provas/ProvaForm'
import ProvaDetalhe from './pages/provas/ProvaDetalhe'
import Matriz from './pages/matriz/Matriz'
import Colecoes from './pages/colecoes/Colecoes'
import ColecaoDetalhe from './pages/colecoes/ColecaoDetalhe'
import Favoritos from './pages/favoritos/Favoritos'
import Relatorios from './pages/relatorios/Relatorios'
import Cobertura from './pages/cobertura/Cobertura'
import Revisao from './pages/revisao/Revisao'
import Usuarios from './pages/usuarios/Usuarios'
import Perfil from './pages/perfil/Perfil'

const base = import.meta.env.BASE_URL

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <RotaProtegida><AppLayout /></RotaProtegida>,
    children: [
      { index: true, element: <Navigate to="/questoes" replace /> },
      { path: 'questoes',              element: <Questoes /> },
      { path: 'questoes/nova',         element: <QuestaoForm /> },
      { path: 'questoes/:id',          element: <QuestaoDetalhe /> },
      { path: 'questoes/:id/editar',   element: <QuestaoForm /> },
      { path: 'planos',                element: <Planos /> },
      { path: 'planos/novo',          element: <PlanoForm /> },
      { path: 'planos/:id',           element: <PlanoDetalhe /> },
      { path: 'planos/:id/editar',    element: <PlanoForm /> },
      { path: 'materiais',             element: <Materiais /> },
      { path: 'provas',                element: <Provas /> },
      { path: 'provas/nova',           element: <ProvaForm /> },
      { path: 'provas/:id',            element: <ProvaDetalhe /> },
      { path: 'provas/:id/editar',     element: <ProvaForm /> },
      { path: 'matriz',                element: <Matriz /> },
      { path: 'colecoes',              element: <Colecoes /> },
      { path: 'colecoes/:id',          element: <ColecaoDetalhe /> },
      { path: 'favoritos',             element: <Favoritos /> },
      { path: 'relatorios',            element: <Relatorios /> },
      { path: 'cobertura',             element: <Cobertura /> },
      { path: 'perfil',                element: <Perfil /> },
      {
        path: 'revisao',
        element: <RotaProtegida papeis={['formador','administrador']}><Revisao /></RotaProtegida>,
      },
      {
        path: 'usuarios',
        element: <RotaProtegida papeis={['formador','administrador']}><Usuarios /></RotaProtegida>,
      },
      {
        path: 'sem-permissao',
        element: (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <h2 style={{ marginBottom: '8px' }}>Acesso não autorizado</h2>
            <p>Você não tem permissão para acessar esta página.</p>
          </div>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
], { basename: base })

export default function AppRouter() {
  return <RouterProvider router={router} />
}
