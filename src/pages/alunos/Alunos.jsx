import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listarAlunos } from '../../services/alunos'
import { Users, Copy, Download, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Alunos.module.css'

export default function Alunos() {
  const [busca, setBusca] = useState('')

  const { data: perfis = [], isLoading } = useQuery({
    queryKey: ['alunos'],
    queryFn: listarAlunos,
  })

  const alunos = perfis.filter(p => p.papel !== 'admin')
  const emails = alunos.map(a => a.email).filter(Boolean)

  const filtrados = perfis.filter(p => {
    const t = busca.toLowerCase()
    return !busca || [p.nome, p.email].some(c => c?.toLowerCase().includes(t))
  })

  function copiarEmails() {
    if (emails.length === 0) { toast.error('Nenhum e-mail para copiar.'); return }
    navigator.clipboard.writeText(emails.join(', '))
    toast.success(`${emails.length} e-mail(s) copiado(s)!`)
  }

  function exportarCSV() {
    const linhas = [['nome', 'email', 'papel', 'cadastro']]
    perfis.forEach(p => linhas.push([
      p.nome ?? '',
      p.email ?? '',
      p.papel ?? '',
      p.criado_em ? new Date(p.criado_em).toLocaleString('pt-BR') : '',
    ]))
    const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alunos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Alunos</h1>
          <p className={styles.subtitulo}>
            {alunos.length} aluno(s) cadastrado(s){emails.length > 0 && ` · ${emails.length} com e-mail`}
          </p>
        </div>
        <div className={styles.acoes}>
          <button className={styles.btnGhost} onClick={copiarEmails}>
            <Copy size={14} /> Copiar e-mails
          </button>
          <button className={styles.btnPrimary} onClick={exportarCSV}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por nome ou e-mail..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Carregando alunos...</div>
      ) : filtrados.length === 0 ? (
        <div className={styles.vazio}>
          <Users size={36} strokeWidth={1.5} />
          <p>Nenhum cadastro ainda.</p>
        </div>
      ) : (
        <div className={styles.tabelaWrap}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id}>
                  <td>{p.nome ?? '—'}</td>
                  <td>{p.email ?? '—'}</td>
                  <td>
                    <span className={`${styles.badge} ${p.papel === 'admin' ? styles.badgeAdmin : ''}`}>
                      {p.papel === 'admin' ? 'Professor' : 'Aluno'}
                    </span>
                  </td>
                  <td>{p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
