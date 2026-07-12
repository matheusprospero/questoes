import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import RotaProtegida from './components/layout/RotaProtegida'
import Login from './pages/auth/Login'
import Inicio from './pages/inicio/Inicio'
import Questoes from './pages/questoes/Questoes'
import QuestaoForm from './pages/questoes/QuestaoForm'
import QuestaoDetalhe from './pages/questoes/QuestaoDetalhe'
import Revisao from './pages/questoes/Revisao'
import Simulados from './pages/simulados/Simulados'
import SimuladoForm from './pages/simulados/SimuladoForm'
import SimuladoDetalhe from './pages/simulados/SimuladoDetalhe'
import RelatorioSimulado from './pages/simulados/RelatorioSimulado'
import Cadernos from './pages/cadernos/Cadernos'
import CadernoDetalhe from './pages/cadernos/CadernoDetalhe'
import Aulas from './pages/aulas/Aulas'
import AulaForm from './pages/aulas/AulaForm'
import AulaDetalhe from './pages/aulas/AulaDetalhe'
import Favoritos from './pages/favoritos/Favoritos'
import Estudo from './pages/estudo/Estudo'
import Estatisticas from './pages/estudo/Estatisticas'
import Alunos from './pages/alunos/Alunos'
import Destaques from './pages/destaques/Destaques'
import DestaqueForm from './pages/destaques/DestaqueForm'
import Reports from './pages/reports/Reports'
import Engajamento from './pages/reports/Engajamento'
import Perfil from './pages/perfil/Perfil'

const base = import.meta.env.BASE_URL

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <RotaProtegida><AppLayout /></RotaProtegida>,
    children: [
      { index: true, element: <Inicio /> },
      { path: 'questoes',            element: <Questoes /> },
      { path: 'questoes/nova',       element: <RotaProtegida somenteAdmin><QuestaoForm /></RotaProtegida> },
      { path: 'questoes/:id',        element: <QuestaoDetalhe /> },
      { path: 'questoes/:id/editar', element: <RotaProtegida somenteAdmin><QuestaoForm /></RotaProtegida> },
      { path: 'revisao',             element: <RotaProtegida somenteAdmin><Revisao /></RotaProtegida> },
      { path: 'simulados',            element: <Simulados /> },
      { path: 'simulados/novo',       element: <SimuladoForm /> },
      { path: 'simulados/:id',           element: <SimuladoDetalhe /> },
      { path: 'simulados/:id/editar',    element: <SimuladoForm /> },
      { path: 'simulados/:id/relatorio', element: <RotaProtegida somenteAdmin><RelatorioSimulado /></RotaProtegida> },
      { path: 'cadernos',             element: <Cadernos /> },
      { path: 'cadernos/:id',         element: <CadernoDetalhe /> },
      { path: 'aulas',                element: <Aulas /> },
      { path: 'aulas/nova',           element: <RotaProtegida somenteAdmin><AulaForm /></RotaProtegida> },
      { path: 'aulas/:id',            element: <AulaDetalhe /> },
      { path: 'aulas/:id/editar',     element: <RotaProtegida somenteAdmin><AulaForm /></RotaProtegida> },
      { path: 'favoritos',           element: <Favoritos /> },
      { path: 'estudo',              element: <Estudo /> },
      { path: 'estatisticas',        element: <Estatisticas /> },
      { path: 'alunos',              element: <RotaProtegida somenteAdmin><Alunos /></RotaProtegida> },
      { path: 'destaques',           element: <RotaProtegida somenteAdmin><Destaques /></RotaProtegida> },
      { path: 'destaques/novo',      element: <RotaProtegida somenteAdmin><DestaqueForm /></RotaProtegida> },
      { path: 'destaques/:id/editar',element: <RotaProtegida somenteAdmin><DestaqueForm /></RotaProtegida> },
      { path: 'reports',             element: <RotaProtegida somenteAdmin><Reports /></RotaProtegida> },
      { path: 'engajamento',         element: <RotaProtegida somenteAdmin><Engajamento /></RotaProtegida> },
      { path: 'perfil',              element: <Perfil /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
], { basename: base })

export default function AppRouter() {
  return <RouterProvider router={router} />
}
