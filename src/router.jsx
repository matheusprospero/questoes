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
import Boletim from './pages/estudo/Boletim'
import Calendario from './pages/estudo/Calendario'
import PlanoEstudos from './pages/plano/PlanoEstudos'
import Acompanhamento from './pages/acompanhamento/Acompanhamento'
import Comunicacao from './pages/comunicacao/Comunicacao'
import CentralMatriculas from './pages/matriculas/CentralMatriculas'
import MinhasTurmas from './pages/turmas/MinhasTurmas'
import TurmaDetalhe from './pages/turmas/TurmaDetalhe'
import Alunos from './pages/alunos/Alunos'
import Destaques from './pages/destaques/Destaques'
import DestaqueForm from './pages/destaques/DestaqueForm'
import Reports from './pages/reports/Reports'
import Engajamento from './pages/reports/Engajamento'
import Perfil from './pages/perfil/Perfil'
import PagamentoRetorno from './pages/pagamento/PagamentoRetorno'
import PagamentosConfig from './pages/pagamentos/PagamentosConfig'
import Vendas from './pages/vendas/Vendas'

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
      { path: 'boletim',             element: <Boletim /> },
      { path: 'calendario',          element: <Calendario /> },
      { path: 'plano',               element: <PlanoEstudos /> },
      { path: 'acompanhamento',      element: <RotaProtegida somenteAdmin><Acompanhamento /></RotaProtegida> },
      { path: 'comunicacao',         element: <RotaProtegida somenteAdmin><Comunicacao /></RotaProtegida> },
      { path: 'matriculas',          element: <RotaProtegida somenteAdmin><CentralMatriculas /></RotaProtegida> },
      { path: 'pagamentos',          element: <RotaProtegida somenteAdmin><PagamentosConfig /></RotaProtegida> },
      { path: 'vendas',              element: <RotaProtegida somenteAdmin><Vendas /></RotaProtegida> },
      { path: 'turmas',              element: <MinhasTurmas /> },
      { path: 'turmas/:id',          element: <TurmaDetalhe /> },
      { path: 'alunos',              element: <RotaProtegida somenteAdmin><Alunos /></RotaProtegida> },
      { path: 'destaques',           element: <RotaProtegida somenteAdmin><Destaques /></RotaProtegida> },
      { path: 'destaques/novo',      element: <RotaProtegida somenteAdmin><DestaqueForm /></RotaProtegida> },
      { path: 'destaques/:id/editar',element: <RotaProtegida somenteAdmin><DestaqueForm /></RotaProtegida> },
      { path: 'reports',             element: <RotaProtegida somenteAdmin><Reports /></RotaProtegida> },
      { path: 'engajamento',         element: <RotaProtegida somenteAdmin><Engajamento /></RotaProtegida> },
      { path: 'perfil',              element: <Perfil /> },
      { path: 'pagamento/retorno',   element: <PagamentoRetorno /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
], { basename: base })

export default function AppRouter() {
  return <RouterProvider router={router} />
}
