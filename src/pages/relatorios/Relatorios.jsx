import { useQuery } from '@tanstack/react-query'
import { carregarRelatorios } from '../../services/relatorios'
import {
  FileText, ClipboardList, BookOpen, Folder, Heart, Users, Star, CheckCircle2,
} from 'lucide-react'
import styles from './Relatorios.module.css'

const STATUS_LABEL = { rascunho: 'Rascunho', em_revisao: 'Em revisão', publicado: 'Publicado', arquivado: 'Arquivado' }
const STATUS_COR = { rascunho: '#94a3b8', em_revisao: '#f59e0b', publicado: '#10b981', arquivado: '#cbd5e1' }
const PAPEL_LABEL = { professor: 'Professores', formador: 'Formadores', administrador: 'Administradores' }

export default function Relatorios() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['relatorios'],
    queryFn: carregarRelatorios,
  })

  if (isLoading) return <div className={styles.loading}>Carregando relatórios...</div>
  if (error) return <div className={styles.loading}>Erro ao carregar: {error.message}</div>

  const { totais, porStatus, porDisciplina, porAno, porDificuldade, avaliacoes, provasPorVisibilidade, planosPorStatus, materiaisPorTipo, usuariosPorPapel } = data

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.titulo}>Relatórios</h1>
        <p className={styles.subtitulo}>Visão geral do acervo pedagógico da rede</p>
      </div>

      {/* Cartões de totais */}
      <div className={styles.statsGrid}>
        <StatCard icone={FileText} cor="#6366f1" valor={totais.questoes} label="Questões" sub={`${totais.publicadas} publicadas`} />
        <StatCard icone={ClipboardList} cor="#0ea5e9" valor={totais.provas} label="Provas" />
        <StatCard icone={BookOpen} cor="#f59e0b" valor={totais.planos} label="Planos de aula" />
        <StatCard icone={Folder} cor="#10b981" valor={totais.materiais} label="Materiais" />
        <StatCard icone={Heart} cor="#e11d48" valor={totais.favoritos} label="Favoritos" />
        <StatCard icone={Users} cor="#8b5cf6" valor={totais.usuarios} label="Usuários" sub={`${totais.usuariosAtivos} ativos`} />
      </div>

      <div className={styles.cardsRow}>
        {/* Questões por status */}
        <Painel titulo="Questões por status">
          <BarChart data={porStatus.map(s => ({ rotulo: STATUS_LABEL[s.chave] ?? s.chave, total: s.total, cor: STATUS_COR[s.chave] ?? '#6366f1' }))} />
        </Painel>

        {/* Questões por disciplina */}
        <Painel titulo="Questões por disciplina">
          {porDisciplina.length === 0
            ? <Vazio />
            : <BarChart data={porDisciplina.map(d => ({ rotulo: d.nome, total: d.total, cor: d.cor }))} />}
        </Painel>
      </div>

      <div className={styles.cardsRow}>
        {/* Por ano escolar */}
        <Painel titulo="Questões por ano escolar">
          {porAno.length === 0 ? <Vazio /> : <BarChart data={porAno.map(a => ({ rotulo: a.chave, total: a.total, cor: '#0ea5e9' }))} />}
        </Painel>

        {/* Por dificuldade */}
        <Painel titulo="Questões por dificuldade">
          <BarChart data={porDificuldade.map(d => ({ rotulo: d.chave, total: d.total, cor: '#f59e0b' }))} />
        </Painel>
      </div>

      <div className={styles.cardsRow}>
        {/* Avaliações */}
        <Painel titulo="Avaliações das questões">
          <div className={styles.mediaBox}>
            <Star size={20} fill="#f59e0b" color="#f59e0b" />
            <div>
              <div className={styles.mediaValor}>
                {avaliacoes.mediaGeral != null ? avaliacoes.mediaGeral.toFixed(2) : '—'}
                <span className={styles.mediaMax}> / 5</span>
              </div>
              <div className={styles.mediaLabel}>{avaliacoes.total} avaliação(ões) registrada(s)</div>
            </div>
          </div>
          {avaliacoes.total > 0 && (
            <BarChart data={avaliacoes.distribuicaoNotas.map(n => ({ rotulo: n.chave, total: n.total, cor: '#f59e0b' }))} />
          )}
        </Painel>

        {/* Conteúdos diversos */}
        <Painel titulo="Conteúdos da rede">
          <SubBloco titulo="Provas" icone={ClipboardList}>
            <BarChart compact data={provasPorVisibilidade.map(p => ({ rotulo: p.chave, total: p.total, cor: '#0ea5e9' }))} />
          </SubBloco>
          <SubBloco titulo="Planos de aula" icone={BookOpen}>
            <BarChart compact data={planosPorStatus.map(p => ({ rotulo: STATUS_LABEL[p.chave] ?? p.chave, total: p.total, cor: '#f59e0b' }))} />
          </SubBloco>
          <SubBloco titulo="Materiais" icone={Folder}>
            <BarChart compact data={materiaisPorTipo.map(m => ({ rotulo: capitalizar(m.chave), total: m.total, cor: '#10b981' }))} />
          </SubBloco>
        </Painel>
      </div>

      {/* Usuários por papel */}
      <div className={styles.cardsRow}>
        <Painel titulo="Usuários por papel">
          <BarChart data={usuariosPorPapel.map(u => ({ rotulo: PAPEL_LABEL[u.chave] ?? u.chave, total: u.total, cor: '#8b5cf6' }))} />
        </Painel>
        <Painel titulo="Resumo">
          <ul className={styles.resumoLista}>
            <li><CheckCircle2 size={14} /> {totais.publicadas} de {totais.questoes} questões publicadas</li>
            <li><CheckCircle2 size={14} /> {totais.provas} provas montadas</li>
            <li><CheckCircle2 size={14} /> {totais.planos} planos de aula</li>
            <li><CheckCircle2 size={14} /> {totais.materiais} materiais compartilhados</li>
            <li><CheckCircle2 size={14} /> {totais.usuariosAtivos} usuários ativos na rede</li>
          </ul>
        </Painel>
      </div>
    </div>
  )
}

function StatCard({ icone: Icone, cor, valor, label, sub }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcone} style={{ background: cor + '1a', color: cor }}>
        <Icone size={20} />
      </div>
      <div className={styles.statInfo}>
        <div className={styles.statValor}>{valor}</div>
        <div className={styles.statLabel}>{label}</div>
        {sub && <div className={styles.statSub}>{sub}</div>}
      </div>
    </div>
  )
}

function Painel({ titulo, children }) {
  return (
    <div className={styles.painel}>
      <h2 className={styles.painelTitulo}>{titulo}</h2>
      {children}
    </div>
  )
}

function SubBloco({ titulo, icone: Icone, children }) {
  return (
    <div className={styles.subBloco}>
      <div className={styles.subBlocoTitulo}><Icone size={13} /> {titulo}</div>
      {children}
    </div>
  )
}

function BarChart({ data, compact }) {
  const max = Math.max(1, ...data.map(d => d.total))
  if (data.every(d => d.total === 0)) return <Vazio />
  return (
    <div className={`${styles.barChart} ${compact ? styles.barChartCompact : ''}`}>
      {data.map((d, i) => (
        <div key={i} className={styles.barRow}>
          <span className={styles.barRotulo} title={d.rotulo}>{d.rotulo}</span>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${(d.total / max) * 100}%`, background: d.cor }} />
          </div>
          <span className={styles.barValor}>{d.total}</span>
        </div>
      ))}
    </div>
  )
}

function Vazio() {
  return <p className={styles.vazioPainel}>Sem dados ainda.</p>
}

function capitalizar(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
