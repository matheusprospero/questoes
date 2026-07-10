import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listarAlunos, definirAssinante } from '../../services/alunos'
import { Users, Copy, Download, Search, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './Alunos.module.css'

export default function Alunos() {
  const [busca, setBusca] = useState('')
  const queryClient = useQueryClient()

  const { data: perfis = [], isLoading } = useQuery({
    queryKey: ['alunos'],
    queryFn: listarAlunos,
  })

  const assinatura = useMutation({
    mutationFn: ({ id, assinante }) => definirAssinante(id, assinante),
    onSuccess: (_, { assinante }) => {
      queryClient.invalidateQueries({ queryKey: ['alunos'] })
      toast.success(assinante ? 'Assinante liberado — já vê os vídeos.' : 'Assinatura retirada.')
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  const alunos = perfis.filter(p => p.papel !== 'admin')
  const emails = alunos.map(a => a.email).filter(Boolean)
  const assinantes = alunos.filter(a => a.assinante).length

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
    const linhas = [['nome', 'email', 'papel', 'assinante', 'cadastro']]
    perfis.forEach(p => linhas.push([
      p.nome ?? '',
      p.email ?? '',
      p.papel ?? '',
      p.assinante ? 'sim' : 'não',
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
            {` · ${assinantes} assinante(s)`}
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
                <th>Assinante</th>
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
                  <td>
                    {p.papel === 'admin' ? (
                      <span className={styles.assinanteFixo}>Acesso total</span>
                    ) : (
                      <button
                        className={`${styles.assinanteBtn} ${p.assinante ? styles.assinanteOn : ''}`}
                        onClick={() => assinatura.mutate({ id: p.id, assinante: !p.assinante })}
                        disabled={assinatura.isPending}
                        title={p.assinante ? 'Retirar acesso aos vídeos' : 'Liberar acesso aos vídeos'}>
                        <Star size={13} /> {p.assinante ? 'Assinante' : 'Liberar'}
                      </button>
                    )}
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
