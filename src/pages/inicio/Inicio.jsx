import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  BookOpen, HelpCircle, Layers, ClipboardList, Heart, BarChart2,
  ArrowRight, PlayCircle, Search, FolderPlus, TrendingUp,
} from 'lucide-react'
import styles from './Inicio.module.css'

const PASSOS = [
  {
    icon: Search,
    titulo: 'Explore o banco',
    texto: 'Filtre as questões por disciplina, banca, órgão, cargo e ano.',
  },
  {
    icon: FolderPlus,
    titulo: 'Organize em cadernos',
    texto: 'Agrupe as questões por tema ou edital para revisar depois.',
  },
  {
    icon: PlayCircle,
    titulo: 'Resolva e assista',
    texto: 'Responda no modo Estudo com correção na hora e resolução em vídeo.',
  },
  {
    icon: TrendingUp,
    titulo: 'Acompanhe a evolução',
    texto: 'Veja seu desempenho por disciplina e refaça o que errou.',
  },
]

const MODULOS = [
  {
    to: '/estudo',
    icon: BookOpen,
    titulo: 'Resolver Questões',
    texto: 'O coração do estudo: responda questão por questão, receba a correção imediata e assista à resolução em vídeo.',
    dica: 'Use "Refazer erradas" e "Similares às erradas" para atacar seus pontos fracos.',
    cta: 'Começar a resolver',
    destaque: true,
  },
  {
    to: '/questoes',
    icon: HelpCircle,
    titulo: 'Banco de Questões',
    texto: 'Todas as questões de concursos reais, organizadas por disciplina, assunto, banca, órgão, cargo e ano.',
    dica: 'Combine filtros para achar exatamente o que cai na sua prova.',
    cta: 'Explorar o banco',
  },
  {
    to: '/cadernos',
    icon: Layers,
    titulo: 'Cadernos',
    texto: 'Suas pastas de questões. Crie um caderno por matéria ou edital e adicione questões direto do banco.',
    dica: 'No banco, expanda uma questão e toque em "+ Adicionar a um caderno".',
    cta: 'Criar um caderno',
  },
  {
    to: '/simulados',
    icon: ClipboardList,
    titulo: 'Simulados',
    texto: 'Monte provas completas com questões do banco e exporte para Word ou impressão — treine como no dia da prova.',
    dica: 'Imprima e cronometre o tempo para simular a prova de verdade.',
    cta: 'Montar um simulado',
  },
  {
    to: '/favoritos',
    icon: Heart,
    titulo: 'Favoritos',
    texto: 'Marque com um coração as questões que você quer rever — pegadinhas, temas difíceis, clássicos de banca.',
    dica: 'Favorite durante o estudo e revise na véspera da prova.',
    cta: 'Ver favoritos',
  },
  {
    to: '/estatisticas',
    icon: BarChart2,
    titulo: 'Estatísticas',
    texto: 'Percentual de acerto por disciplina, assunto e banca, além da sua evolução ao longo do tempo.',
    dica: 'Foque nos assuntos com menor percentual de acerto.',
    cta: 'Ver desempenho',
  },
]

export default function Inicio() {
  const { usuario, perfil } = useAuth()
  const primeiroNome = (perfil?.nome || usuario?.email || '')
    .split(' ')[0].split('@')[0]

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroConteudo}>
          <h1 className={styles.heroTitulo}>
            Olá{primeiroNome ? `, ${primeiroNome}` : ''}! 👋
          </h1>
          <p className={styles.heroTexto}>
            Questões de concursos reais, comentadas e com resolução em vídeo.
            O que vamos estudar hoje?
          </p>
          <div className={styles.heroBotoes}>
            <Link to="/estudo" className={styles.heroBtnPrimario}>
              <BookOpen size={16} /> Resolver questões
            </Link>
            <Link to="/questoes" className={styles.heroBtnGhost}>
              Explorar o banco <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section>
        <h2 className={styles.secaoTitulo}>Como funciona</h2>
        <div className={styles.passos}>
          {PASSOS.map((p, i) => (
            <div key={i} className={styles.passo}>
              <div className={styles.passoNum}>{i + 1}</div>
              <div className={styles.passoIcone}><p.icon size={18} /></div>
              <div>
                <div className={styles.passoTitulo}>{p.titulo}</div>
                <p className={styles.passoTexto}>{p.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Módulos */}
      <section>
        <h2 className={styles.secaoTitulo}>Conheça as ferramentas</h2>
        <div className={styles.grid}>
          {MODULOS.map(m => (
            <Link
              key={m.to}
              to={m.to}
              className={`${styles.card} ${m.destaque ? styles.cardDestaque : ''}`}
            >
              <div className={styles.cardIcone}><m.icon size={20} /></div>
              <h3 className={styles.cardTitulo}>{m.titulo}</h3>
              <p className={styles.cardTexto}>{m.texto}</p>
              <p className={styles.cardDica}>💡 {m.dica}</p>
              <span className={styles.cardCta}>
                {m.cta} <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
