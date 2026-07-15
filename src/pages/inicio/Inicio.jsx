import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { listarQuestoes } from '../../services/questoes'
import { listarRespostas, calcularOfensiva, contarRevisoesHoje } from '../../services/estudo'
import { listarDisciplinas, listarFacetas } from '../../services/questoes'
import ModalMeta, { lerCfgMeta, salvarCfgMeta } from '../../components/ModalMeta'
import { lerMetas, salvarMetas } from '../../services/metas'
import { listarDestaquesAtivos, destinoDestaque } from '../../services/destaques'
import CardDestaque from '../../components/CardDestaque'
import {
  BookOpen, PlayCircle, BarChart2, ClipboardList,
  ArrowRight, Search, Pencil, ChevronRight, Compass, Lock, Flame, Target, RotateCcw,
} from 'lucide-react'
import styles from './Inicio.module.css'

/* Banner ilustrado (vetor): livro aberto + lupa + ícones flutuantes */
function ArteBanner() {
  return (
    <svg className={styles.arte} viewBox="0 0 520 360" fill="none" aria-hidden>
      {/* brilhos de fundo */}
      <circle cx="420" cy="70" r="110" fill="rgba(139,92,246,0.16)" />
      <circle cx="110" cy="300" r="80" fill="rgba(56,189,248,0.10)" />
      <circle cx="470" cy="290" r="60" fill="rgba(139,92,246,0.12)" />

      {/* pontilhado decorativo */}
      {[0, 1, 2, 3].map(i => (
        <g key={i}>
          <circle cx={455 + (i % 2) * 16} cy={150 + Math.floor(i / 2) * 16} r="2.5" fill="rgba(196,181,253,0.5)" />
        </g>
      ))}

      {/* capa do livro */}
      <path d="M62 216 Q170 168 260 196 Q350 168 458 216 L458 316 Q350 268 260 296 Q170 268 62 316 Z"
        fill="#4c1d95" opacity="0.9" />
      {/* páginas */}
      <path d="M74 204 Q172 160 258 188 L258 284 Q172 256 74 300 Z" fill="#ede9fe" />
      <path d="M446 204 Q348 160 262 188 L262 284 Q348 256 446 300 Z" fill="#f5f3ff" />
      {/* linhas das páginas */}
      <path d="M100 216 Q170 186 240 204 M100 238 Q170 208 240 226 M100 260 Q170 230 240 248"
        stroke="#c4b5fd" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M280 204 Q350 186 420 216 M280 226 Q350 208 420 238 M280 248 Q350 230 420 260"
        stroke="#ddd6fe" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* vinco central */}
      <path d="M260 190 L260 292" stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" />

      {/* lupa */}
      <circle cx="322" cy="176" r="54" fill="rgba(255,255,255,0.10)" stroke="#8b5cf6" strokeWidth="13" />
      <circle cx="322" cy="176" r="54" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <line x1="362" y1="218" x2="404" y2="262" stroke="#8b5cf6" strokeWidth="16" strokeLinecap="round" />
      <path d="M298 156 Q312 142 334 148" stroke="rgba(255,255,255,0.65)" strokeWidth="6" strokeLinecap="round" fill="none" />

      {/* tile: interrogação */}
      <g>
        <rect x="96" y="64" width="76" height="76" rx="20" fill="#7c3aed" />
        <rect x="96" y="64" width="76" height="76" rx="20" fill="url(#gradTile)" opacity="0.35" />
        <path d="M96 140 L112 156 L128 140 Z" fill="#7c3aed" />
        <text x="134" y="118" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif"
          fontSize="40" fontWeight="800" fill="#ffffff">?</text>
      </g>

      {/* tile: play */}
      <g>
        <rect x="330" y="42" width="82" height="82" rx="22" fill="#6d28d9" />
        <rect x="330" y="42" width="82" height="82" rx="22" fill="url(#gradTile)" opacity="0.4" />
        <path d="M362 66 L392 83 L362 100 Z" fill="#ffffff" rx="4" />
      </g>

      {/* tile: gráfico */}
      <g>
        <rect x="428" y="180" width="70" height="70" rx="18" fill="#7c3aed" />
        <rect x="428" y="180" width="70" height="70" rx="18" fill="url(#gradTile)" opacity="0.35" />
        <rect x="444" y="216" width="9" height="18" rx="3" fill="#ffffff" />
        <rect x="458" y="206" width="9" height="28" rx="3" fill="#ffffff" />
        <rect x="472" y="196" width="9" height="38" rx="3" fill="#ffffff" />
      </g>

      <defs>
        <linearGradient id="gradTile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6d28d9" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const RECURSOS = [
  {
    to: '/estudo',
    icon: BookOpen,
    titulo: 'Questões',
    texto: 'Resolva questões filtrando por disciplina, banca, órgão, cargo e ano.',
    cta: 'Começar agora',
  },
  {
    to: '/questoes',
    icon: PlayCircle,
    titulo: 'Resolução em Vídeo',
    texto: 'Assista às resoluções em vídeo e entenda cada questão na prática.',
    cta: 'Ver questões',
    emBreve: true,
    badge: 'Em breve · apenas assinantes',
  },
  {
    to: '/estatisticas',
    icon: BarChart2,
    titulo: 'Estatísticas',
    texto: 'Acompanhe seu desempenho e identifique pontos de melhoria.',
    cta: 'Ver meu desempenho',
  },
  {
    to: '/simulados',
    icon: ClipboardList,
    titulo: 'Simulados',
    texto: 'Monte simulados personalizados e treine como será na prova.',
    cta: 'Criar simulado',
  },
]

const PASSOS = [
  { icon: Search, titulo: 'Escolha e filtre', texto: 'Selecione a disciplina, banca, órgão, cargo e ano que deseja estudar.' },
  { icon: Pencil, titulo: 'Resolva questões', texto: 'Responda questões de concursos reais e marque suas opções.' },
  { icon: PlayCircle, titulo: 'Estude os comentários', texto: 'Confira os comentários e assista às resoluções em vídeo.' },
  { icon: BarChart2, titulo: 'Acompanhe sua evolução', texto: 'Veja suas estatísticas e evolua de forma consistente até a aprovação.' },
]

export default function Inicio() {
  const navigate = useNavigate()
  const { usuario, perfil, isAdmin } = useAuth()
  const nome = perfil?.nome || usuario?.email?.split('@')[0] || ''

  const { data: questoes = [] } = useQuery({ queryKey: ['questoes', {}], queryFn: () => listarQuestoes({}) })
  const { data: respostas = [] } = useQuery({ queryKey: ['respostas'], queryFn: listarRespostas })
  const { data: destaques = [] } = useQuery({ queryKey: ['destaques-ativos'], queryFn: listarDestaquesAtivos })
  const { data: revisoesHoje = 0 } = useQuery({ queryKey: ['revisoes-hoje'], queryFn: contarRevisoesHoje })

  function abrirDestaque(d) {
    const destino = destinoDestaque(d)
    if (!destino) return
    if (/^https?:\/\//.test(destino)) window.open(destino, '_blank', 'noopener')
    else navigate(destino)
  }

  // Ofensiva (streak) + metas (localStorage)
  const ofensiva = useMemo(() => calcularOfensiva(respostas), [respostas])
  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: listarDisciplinas })
  const { data: facetas = [] } = useQuery({ queryKey: ['facetas'], queryFn: listarFacetas })
  const [cfg, setCfg] = useState(lerCfgMeta)
  const [modalMeta, setModalMeta] = useState(false)
  // Sincroniza as metas do banco (fonte durável) para o cache local usado no app
  useEffect(() => { lerMetas().then(setCfg).catch(() => {}) }, [])
  const somaDisc = Object.values(cfg.porDisciplina || {}).reduce((a, b) => a + (Number(b) || 0), 0)
  const metaEfetiva = Math.max(Number(cfg.metaDiaria) || 0, somaDisc) || 1
  const pctMeta = Math.min(100, Math.round((ofensiva.hoje / metaEfetiva) * 100))

  // Questões de hoje por disciplina
  const hojePorDisc = useMemo(() => {
    const hojeStr = new Date().toLocaleDateString('en-CA')
    const m = {}
    for (const r of respostas) {
      if (new Date(r.respondido_em).toLocaleDateString('en-CA') !== hojeStr) continue
      const d = r.questoes?.disciplinas
      if (d) m[d.id] = (m[d.id] || 0) + 1
    }
    return m
  }, [respostas])

  const metasDisc = Object.entries(cfg.porDisciplina || {})
    .filter(([, goal]) => Number(goal) > 0)
    .map(([id, goal]) => {
      const d = disciplinas.find(x => String(x.id) === String(id))
      return { id, nome: d?.nome || 'Disciplina', cor: d?.cor, goal: Number(goal), feito: hojePorDisc[id] || 0 }
    })

  // Últimos acessos: desempenho por disciplina, mais recente primeiro
  const acessos = useMemo(() => {
    const grupos = new Map()
    for (const r of respostas) {
      const d = r.questoes?.disciplinas?.nome
      if (!d) continue
      const g = grupos.get(d) ?? { nome: d, total: 0, acertos: 0, bancas: new Map(), ultimo: r.respondido_em }
      g.total += 1
      if (r.acertou) g.acertos += 1
      const b = r.questoes?.bancas?.nome
      if (b) g.bancas.set(b, (g.bancas.get(b) ?? 0) + 1)
      if (r.respondido_em > g.ultimo) g.ultimo = r.respondido_em
      grupos.set(d, g)
    }
    return [...grupos.values()]
      .map(g => ({
        ...g,
        percentual: Math.round((g.acertos / g.total) * 100),
        banca: [...g.bancas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      }))
      .sort((a, b) => new Date(b.ultimo) - new Date(a.ultimo))
      .slice(0, 4)
  }, [respostas])

  // Disciplinas do banco com contagem de questões
  const disciplinasBanco = useMemo(() => {
    const grupos = new Map()
    for (const q of questoes) {
      if (!q.disciplinas) continue
      const g = grupos.get(q.disciplinas.id) ?? { ...q.disciplinas, total: 0 }
      g.total += 1
      grupos.set(q.disciplinas.id, g)
    }
    return [...grupos.values()].sort((a, b) => b.total - a.total)
  }, [questoes])

  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroConteudo}>
          <p className={styles.heroKicker}>{isAdmin ? 'Professor' : 'Bem-vindo(a)'}</p>
          <h1 className={styles.heroNome}>{nome || 'Matheus Próspero'}</h1>
          <div className={styles.heroDivisor} />
          <h2 className={styles.heroSubtitulo}>Banco de Questões para Concursos Públicos</h2>
          <p className={styles.heroTexto}>
            Questões organizadas por disciplina, banca, órgão, cargo e ano,
            com comentários, resolução em vídeo, simulados e acompanhamento
            da sua evolução.
          </p>
          <div className={styles.heroBotoes}>
            <Link to="/estudo" className={styles.heroBtnPrimario}>
              <BookOpen size={16} /> Resolver Questões
            </Link>
            <Link to="/questoes" className={styles.heroBtnGhost}>
              <Compass size={16} /> Explorar o Banco
            </Link>
          </div>
        </div>
        <div className={styles.heroArte}>
          <ArteBanner />
        </div>
      </section>

      {/* ── Ofensiva + metas ── */}
      <section className={styles.ofensiva}>
        <div className={styles.ofTopo}>
          <div className={styles.ofStreak}>
            <Flame size={26} className={ofensiva.streak > 0 ? styles.ofFlameOn : styles.ofFlameOff} />
            <div>
              <div className={styles.ofNum}>{ofensiva.streak}</div>
              <div className={styles.ofLabel}>
                {ofensiva.streak === 1 ? 'dia seguido' : 'dias seguidos'}
                {cfg.metaDias > 0 && <> · meta {cfg.metaDias}{ofensiva.streak >= cfg.metaDias ? ' ✅' : ''}</>}
              </div>
            </div>
          </div>
          <div className={styles.ofMeta}>
            <div className={styles.ofMetaTopo}>
              <span className={styles.ofMetaTitulo}><Target size={14} /> Meta de hoje</span>
              <button className={styles.ofAjustar} onClick={() => setModalMeta(true)}>ajustar metas</button>
            </div>
            <div className={styles.ofBarra}>
              <div className={styles.ofBarraFill} style={{ width: `${pctMeta}%` }} />
            </div>
            <div className={styles.ofMetaTexto}>
              {ofensiva.hoje} / {metaEfetiva} questões {ofensiva.hoje >= metaEfetiva ? '— concluída! 🎉' : ''}
            </div>
          </div>
          <div className={styles.ofAcoes}>
            <button className={styles.ofMetaBtn} onClick={() => navigate('/estudo?meta=1')}>
              <Target size={16} /> {ofensiva.hoje >= metaEfetiva ? 'Meta do dia concluída 🎉'
                : ofensiva.hoje > 0 ? `Continuar meta (faltam ${metaEfetiva - ofensiva.hoje})`
                : 'Começar meta do dia'}
            </button>
            {revisoesHoje > 0 && (
              <button className={styles.ofRevisao} onClick={() => navigate('/estudo?revisao=1')}>
                <RotateCcw size={16} />
                <span><strong>{revisoesHoje}</strong> para revisar</span>
              </button>
            )}
          </div>
        </div>

        {metasDisc.length > 0 && (
          <div className={styles.ofDiscs}>
            {metasDisc.map(m => (
              <div key={m.id} className={`${styles.ofDiscChip} ${m.feito >= m.goal ? styles.ofDiscOk : ''}`}>
                <span className={styles.ofDiscCor} style={{ background: m.cor || 'var(--color-primary)' }} />
                {m.nome} <strong>{m.feito}/{m.goal}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      {modalMeta && (
        <ModalMeta
          cfgInicial={cfg}
          facetas={facetas}
          onFechar={() => setModalMeta(false)}
          onSalvar={(novo) => { salvarCfgMeta(novo); salvarMetas(novo).catch(() => {}); setCfg(novo); setModalMeta(false) }}
        />
      )}

      {/* ── Cards em destaque (propaganda do professor) ── */}
      {destaques.length > 0 && (
        <section className={styles.destaques}>
          {destaques.map(d => (
            <CardDestaque key={d.id} destaque={d} onClick={() => abrirDestaque(d)} />
          ))}
        </section>
      )}

      {/* ── Cards de recursos ── */}
      <section className={styles.recursos}>
        {RECURSOS.map(r => (
          <div key={r.to} className={`${styles.recursoCard} ${r.emBreve ? styles.recursoEmBreve : ''}`}>
            <div className={styles.recursoIcone}><r.icon size={22} /></div>
            <h3 className={styles.recursoTitulo}>
              {r.titulo}
              {r.badge && <span className={styles.recursoBadge}>{r.badge}</span>}
            </h3>
            <p className={styles.recursoTexto}>{r.texto}</p>
            {r.emBreve ? (
              <span className={styles.recursoCtaBloqueado}>
                <Lock size={13} /> Em breve
              </span>
            ) : (
              <Link to={r.to} className={styles.recursoCta}>
                {r.cta} <ArrowRight size={14} />
              </Link>
            )}
          </div>
        ))}
      </section>

      {/* ── Como funciona + últimos acessos ── */}
      <section className={styles.duasColunas}>
        <div>
          <h2 className={styles.secaoTitulo}>Como funciona</h2>
          <div className={styles.passos}>
            {PASSOS.map((p, i) => (
              <div key={i} className={styles.passo}>
                <div className={styles.passoTopo}>
                  <span className={styles.passoNum}>{i + 1}</span>
                  <div className={styles.passoIcone}><p.icon size={22} /></div>
                </div>
                <div className={styles.passoTitulo}>{p.titulo}</div>
                <p className={styles.passoTexto}>{p.texto}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className={styles.painelAcessos}>
          <div className={styles.painelHeader}>
            <h2 className={styles.painelTitulo}>Seus últimos acessos</h2>
            <Link to="/estatisticas" className={styles.painelLink}>Ver todos</Link>
          </div>
          {acessos.length === 0 ? (
            <p className={styles.painelVazio}>
              Você ainda não respondeu questões.{' '}
              <Link to="/estudo">Comece agora</Link> e seu histórico aparece aqui.
            </p>
          ) : (
            acessos.map(a => (
              <button key={a.nome} className={styles.acessoRow} onClick={() => navigate('/estatisticas')}>
                {a.banca && <span className={styles.acessoBanca}>{a.banca}</span>}
                <span className={styles.acessoInfo}>
                  <span className={styles.acessoNome}>{a.nome}</span>
                  <span className={styles.acessoMeta}>
                    Questões: {a.total} &nbsp;•&nbsp; {a.percentual}% de acerto
                  </span>
                </span>
                <ChevronRight size={15} className={styles.acessoSeta} />
              </button>
            ))
          )}
        </aside>
      </section>

      {/* ── Disciplinas do banco ── */}
      {disciplinasBanco.length > 0 && (
        <section>
          <div className={styles.painelHeader}>
            <h2 className={styles.secaoTitulo}>Disciplinas no banco</h2>
            <Link to="/questoes" className={styles.painelLink}>Ver todas</Link>
          </div>
          <div className={styles.disciplinas}>
            {disciplinasBanco.map(d => (
              <Link key={d.id} to={`/questoes?disciplina=${d.id}`} className={styles.disciplinaChip}>
                <span className={styles.disciplinaCor} style={{ background: d.cor || 'var(--color-primary)' }} />
                <span>
                  <span className={styles.disciplinaNome}>{d.nome}</span>
                  <span className={styles.disciplinaTotal}>{d.total} questões</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
