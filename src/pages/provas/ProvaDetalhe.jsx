import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buscarProva, registrarUsoProva, criarProva, mudarStatusProva } from '../../services/provas'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, Printer, Pencil, FileText, Copy, BookOpen, ListChecks, Clock, CheckCircle, XCircle, Send } from 'lucide-react'
import { gerarWordProva } from '../../services/gerarWord'
import { useState, useEffect } from 'react'
import { CABECALHO_PADRAO } from '../../components/ProvaHeader'
import toast from 'react-hot-toast'
import styles from './ProvaDetalhe.module.css'

export default function ProvaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isFormador, isAdmin, usuario } = useAuth()
  const podeEditar = isFormador || isAdmin

  const queryClient = useQueryClient()

  const copiarProva = useMutation({
    mutationFn: async () => {
      const dados = {
        titulo: `${prova.titulo} (cópia)`,
        descricao: prova.descricao || null,
        disciplina_id: prova.disciplina_id || null,
        disciplinas_ids: prova.disciplinas_ids || [],
        tipo_prova: prova.tipo_prova || 'disciplina',
        ano_escolar: prova.ano_escolar || null,
        instrucoes: prova.instrucoes || null,
        visibilidade: 'pessoal',
        cabecalho: prova.cabecalho || '',
        cfg_impressao: prova.cfg_impressao || {},
        autor_id: usuario.id,
      }
      const questaoIds = (prova.questoes || []).map(q => q.id)
      return criarProva(dados, questaoIds)
    },
    onSuccess: (novaProva) => {
      queryClient.invalidateQueries(['provas'])
      toast.success('Cópia criada! Redirecionando para edição...')
      setTimeout(() => navigate(`/provas/${novaProva.id}/editar`), 1200)
    },
    onError: (err) => toast.error('Erro ao copiar: ' + err.message),
  })

  const [modoVisualizacao, setModoVisualizacao] = useState('normal')

  const mutarStatus = useMutation({
    mutationFn: ({ status, justificativa }) => mudarStatusProva(id, status, justificativa),
    onSuccess: () => {
      queryClient.invalidateQueries(['prova', id])
      queryClient.invalidateQueries(['provas'])
      toast.success('Status atualizado!')
    },
    onError: (err) => toast.error('Erro: ' + err.message),
  })

  const { data: prova, isLoading } = useQuery({
    queryKey: ['prova', id],
    queryFn: () => buscarProva(id),
  })

  useEffect(() => {
    if (id) registrarUsoProva(id)
  }, [id])

  async function handleWord() {
    try {
      toast.loading('Gerando Word...')
      await gerarWordProva(prova)
      toast.dismiss()
      toast.success('Arquivo Word gerado!')
    } catch (err) {
      toast.dismiss()
      toast.error('Erro ao gerar Word: ' + err.message)
    }
  }

  function handleImprimir() {
    abrirJanela(buildHtml(prova), prova.titulo)
  }



  function buildHtml(prova, opcoes = {}) {
    const { comGabarito = false, soGabarito = false } = opcoes
    const cfg = prova.cfg_impressao || {}
    const fontSize = cfg.tamanhoFonte ? `${cfg.tamanhoFonte}pt` : '11pt'
    const separador = cfg.separadorQuestoes !== false
    const semQuebra = cfg.quebrarPagina !== false
    const cabecalhoHtml = prova.cabecalho || CABECALHO_PADRAO

    // ── Gabarito resumido: "1 - A, 2 - B, ..." ───────────────
    const linhasGab = (prova.questoes || []).map((q, idx) => {
      if (q.tipo === 'multipla_escolha') {
        const correta = q.alternativas?.find(a => a.correta)
        return correta ? `${idx + 1} - ${correta.letra}` : `${idx + 1} - ?`
      }
      if (q.tipo === 'dissertativa' && q.gabarito?.texto) {
        const txt = q.gabarito.texto.replace(/<[^>]*>/g, '').trim().slice(0, 60)
        return `${idx + 1} - ${txt}${txt.length >= 60 ? '...' : ''}`
      }
      return null
    }).filter(Boolean)

    // Rodapé configurável
    const rodapeEsq = (cfg.rodapeEsquerda ?? 'Total: {total} questões')
      .replace('{total}', String((prova.questoes || []).length))
    const rodapeDir = cfg.rodapeDireita ?? 'Assinatura: ___________________________'
    const rodapeHtml = `<div style="display:flex;justify-content:space-between;margin-top:24px;padding-top:8px;border-top:1px solid #ccc;font-size:9pt;color:#555">
      <span>${rodapeEsq}</span><span>${rodapeDir}</span>
    </div>`

    // Gabarito fixo no rodapé da ÚLTIMA página
    // position:fixed + bottom:0 garante que fica sempre no fim da última página no print
    const gabRodapeHtml = linhasGab.length > 0
      ? `<div style="position:fixed;bottom:0;left:0;right:0;padding:6px 12mm 4px;border-top:1.5px solid #000;background:#fff;font-size:9pt;font-family:'Times New Roman',serif;color:#000">
          <strong>Gabarito:</strong>&nbsp;&nbsp;${linhasGab.join('&nbsp;&nbsp;&nbsp;&nbsp;')}
        </div>
        <div style="height:32px"></div>`
      : ''

    // ── Questões ──────────────────────────────────────────────
    const questoesHtml = (prova.questoes || []).map((q, idx) => {
      const alts = q.tipo === 'multipla_escolha' && q.alternativas?.length
        ? q.alternativas.map(a =>
            `<div style="display:flex;gap:8px;margin:3px 0;font-size:${fontSize}">
              <span style="font-weight:700;min-width:18px">${a.letra})</span>
              <span>${a.texto}</span>
            </div>`
          ).join('')
        : q.tipo === 'dissertativa'
          ? Array(4).fill('<div style="border-bottom:1px solid #888;height:18px;margin-bottom:10px"></div>').join('')
          : ''

      const dif = q.nivel_dificuldade
        ? `<span style="font-size:9pt;color:#666;margin-left:8px">${'●'.repeat(q.nivel_dificuldade)}${'○'.repeat(5-q.nivel_dificuldade)}</span>`
        : ''
      const sep = separador && idx > 0
        ? `<hr style="border:none;border-top:1px solid #ddd;margin:14px 0"/>`
        : idx > 0 ? '<div style="margin-top:16px"></div>' : ''

      return `${sep}
        <div style="page-break-inside:${semQuebra ? 'avoid' : 'auto'}">
          <p style="font-weight:700;font-size:${fontSize};margin:0 0 6px">
            Questão ${idx + 1}${dif}
          </p>
          <div style="font-size:${fontSize};margin-bottom:8px">${q.enunciado}</div>
          ${alts}
        </div>`
    }).join('')

    const instrHtml = prova.instrucoes
      ? `<div style="font-size:10pt;background:#f8f8f8;border-left:3px solid #999;padding:8px 12px;margin:10px 0">
          <strong>Instruções:</strong> ${prova.instrucoes}
        </div>`
      : ''

    // ── Modo: só gabarito ─────────────────────────────────────
    if (soGabarito) {
      const linhasFormatadas = linhasGab.join('<br/>')
      return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Gabarito — ${prova.titulo}</title>
  <style>
    @page { size: A4; margin: 15mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; margin: 0; color: #000; font-size: 12pt; }
  </style>
</head>
<body>
  <h2 style="text-align:center;font-size:14pt;font-weight:700;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:16px">
    GABARITO — ${prova.titulo}
  </h2>
  <p style="font-size:10pt;color:#555;margin-bottom:14px">
    ${prova.disciplinas?.nome ? prova.disciplinas.nome + ' · ' : ''}${prova.ano_escolar || ''}
  </p>
  <div style="font-size:12pt;line-height:2">${linhasFormatadas}</div>
</body>
</html>`
    }

    // ── Modo: prova normal ou com gabarito no rodapé ──────────
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>${prova.titulo}</title>
  <style>
    @page { size: A4; margin: 8mm 12mm 10mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 0; color: #000; }
    img { max-width: 100%; height: auto; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  ${cabecalhoHtml}
  <h2 style="text-align:center;font-size:14pt;font-weight:700;margin:12px 0 6px">${prova.titulo}</h2>
  ${instrHtml}
  <div>${questoesHtml}</div>
  ${rodapeHtml}
  ${comGabarito ? gabRodapeHtml : ''}
</body>
</html>`
  }

  function abrirJanela(html, titulo) {
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  function handleImprimirComGabarito() {
    abrirJanela(buildHtml(prova, { comGabarito: true }), prova.titulo)
  }

  function handleGabarito() {
    abrirJanela(buildHtml(prova, { soGabarito: true }), `Gabarito — ${prova.titulo}`)
  }

  if (isLoading) return <div className={styles.loading}>Carregando prova...</div>
  if (!prova) return <div className={styles.loading}>Prova não encontrada.</div>

  const cfg = prova.cfg_impressao || {}
  const fontSize = cfg.tamanhoFonte ? `${cfg.tamanhoFonte}pt` : '11pt'
  const separador = cfg.separadorQuestoes !== false
  const semQuebra = cfg.quebrarPagina !== false
  const cabecalhoHtml = prova.cabecalho || CABECALHO_PADRAO

  const gabarito = (prova.questoes || []).map((q, idx) => {
    if (q.tipo === 'multipla_escolha') {
      const correta = q.alternativas?.find(a => a.correta)
      return correta ? `${idx + 1} - ${correta.letra}` : null
    }
    return null
  }).filter(Boolean)

  return (
    <div className={styles.page}>
      {/* Topbar — não aparece na impressão */}
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/provas')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className={styles.topbarInfo}>
          <span className={styles.topbarTitulo}>{prova.titulo}</span>
          <span className={styles.topbarMeta}>
            {prova.questoes?.length || 0} questões
            {prova.ano_escolar && ` · ${prova.ano_escolar}`}
          </span>
        </div>
        <div className={styles.topbarAcoes}>
          {/* Seletor de modo de visualização */}
          <div className={styles.modoGroup}>
            <span className={styles.modoLabel}>Visualizar:</span>
            <div className={styles.modoBtns}>
              <button
                className={`${styles.modoBtn} ${modoVisualizacao === 'normal' ? styles.modoBtnOn : ''}`}
                onClick={() => setModoVisualizacao('normal')}>
                Prova
              </button>
              <button
                className={`${styles.modoBtn} ${modoVisualizacao === 'com_gabarito' ? styles.modoBtnOn : ''}`}
                onClick={() => setModoVisualizacao('com_gabarito')}>
                + Gabarito
              </button>
              <button
                className={`${styles.modoBtn} ${modoVisualizacao === 'gabarito' ? styles.modoBtnOn : ''}`}
                onClick={() => setModoVisualizacao('gabarito')}>
                Só gabarito
              </button>
            </div>
          </div>

          <div className={styles.topbarSep} />

          <button className={styles.btnSecondary} onClick={() => {
            if (modoVisualizacao === 'com_gabarito') handleImprimirComGabarito()
            else if (modoVisualizacao === 'gabarito') handleGabarito()
            else handleImprimir()
          }}>
            <Printer size={14} /> Imprimir / PDF
          </button>
          <button className={styles.btnSecondary} onClick={handleWord}>
            <FileText size={14} /> Word
          </button>
          {prova.visibilidade === 'rede' && prova.autor_id !== usuario?.id && (
            <button className={styles.btnCopiar}
              onClick={() => copiarProva.mutate()}
              disabled={copiarProva.isPending}>
              <Copy size={14} />
              {copiarProva.isPending ? 'Copiando...' : 'Copiar para minhas provas'}
            </button>
          )}
          {(podeEditar || prova.autor_id === usuario?.id) && (
            <button className={styles.btnSecondary}
              onClick={() => navigate(`/provas/${id}/editar`)}>
              <Pencil size={14} /> Editar
            </button>
          )}
        </div>
      </div>

      {/* Painel de revisão — não aparece na impressão */}
      {(prova.autor_id === usuario?.id || podeEditar) && (
        <div className={styles.revisaoBar}>

          {/* Professor — dono da prova */}
          {prova.autor_id === usuario?.id && !podeEditar && (
            <div className={styles.revisaoContent}>
              <div className={`${styles.revisaoStatus} ${styles['rs_' + (prova.status_revisao || 'rascunho')]}`}>
                {prova.status_revisao === 'em_revisao'
                  ? <><Clock size={14}/> Aguardando revisão de um formador</>
                  : prova.status_revisao === 'publicado'
                  ? <><CheckCircle size={14}/> Disponível na rede para todos os professores</>
                  : <><Clock size={14}/> Rascunho — apenas você tem acesso</>
                }
              </div>
              {(!prova.status_revisao || prova.status_revisao === 'rascunho') && (
                <div className={styles.revisaoAcao}>
                  <p className={styles.revisaoHint}>
                    Quer disponibilizar esta prova para outros professores? Envie para avaliação dos formadores.
                  </p>
                  <button className={styles.btnEnviar}
                    onClick={() => {
                      if (confirm('Enviar esta prova para avaliação dos formadores?'))
                        mutarStatus.mutate({ status: 'em_revisao' })
                    }}
                    disabled={mutarStatus.isPending}>
                    <Send size={13}/> Enviar para avaliação
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Formador/Admin — controle completo */}
          {podeEditar && (
            <div className={styles.revisaoContent}>
              <span className={styles.revisaoLabel}>Revisão da prova:</span>
              <div className={styles.revisaoAcoes}>
                {prova.status_revisao === 'em_revisao' && (
                  <>
                    <button className={styles.btnAprovarProva}
                      onClick={() => mutarStatus.mutate({ status: 'publicado' })}
                      disabled={mutarStatus.isPending}>
                      <CheckCircle size={13}/> Publicar na rede
                    </button>
                    <button className={styles.btnRejeitarProva}
                      onClick={() => {
                        const motivo = window.prompt('Motivo da devolução:')
                        if (motivo) mutarStatus.mutate({ status: 'rascunho', justificativa: motivo })
                      }}
                      disabled={mutarStatus.isPending}>
                      <XCircle size={13}/> Devolver ao professor
                    </button>
                  </>
                )}
                {(!prova.status_revisao || prova.status_revisao === 'rascunho') && (
                  <button className={styles.btnAprovarProva}
                    onClick={() => mutarStatus.mutate({ status: 'publicado' })}
                    disabled={mutarStatus.isPending}>
                    <CheckCircle size={13}/> Publicar diretamente na rede
                  </button>
                )}
                {prova.status_revisao === 'publicado' && (
                  <button className={styles.btnRejeitarProva}
                    onClick={() => mutarStatus.mutate({ status: 'rascunho' })}
                    disabled={mutarStatus.isPending}>
                    <XCircle size={13}/> Retirar da rede
                  </button>
                )}
                <span className={`${styles.revisaoStatusBadge} ${styles['rs_' + (prova.status_revisao || 'rascunho')]}`}>
                  {prova.status_revisao === 'em_revisao' ? '🔍 Em revisão'
                   : prova.status_revisao === 'publicado' ? '✅ Na rede'
                   : '📝 Rascunho'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo imprimível */}
      <div className={styles.printArea} style={{ fontSize }}>

        {/* Modo: Só gabarito */}
        {modoVisualizacao === 'gabarito' ? (
          <div className={styles.soGabarito}>
            <h2 className={styles.gabTitulo}>GABARITO — {prova.titulo}</h2>
            {prova.disciplinas?.nome && (
              <p className={styles.gabMeta}>{prova.disciplinas.nome}{prova.ano_escolar ? ` · ${prova.ano_escolar}` : ''}</p>
            )}
            <div className={styles.gabLista}>
              {gabarito.map((linha, i) => (
                <div key={i} className={styles.gabLinha}>{linha}</div>
              ))}
              {gabarito.length === 0 && (
                <p className={styles.gabVazio}>Nenhuma questão com gabarito definido.</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Cabeçalho HTML personalizado */}
            <div className={styles.cabecalho}
              dangerouslySetInnerHTML={{ __html: cabecalhoHtml }} />

            {/* Título da prova */}
            <h1 className={styles.tituloprova}>{prova.titulo}</h1>

            {prova.instrucoes && (
              <div className={styles.instrucoes}>
                <strong>Instruções:</strong> {prova.instrucoes}
              </div>
            )}

        {/* Questões */}
        <div className={styles.questoes}>
          {prova.questoes?.length === 0 ? (
            <p className={styles.vazio}>Nenhuma questão nesta prova.</p>
          ) : (
            prova.questoes.map((q, idx) => (
              <div key={q.id}
                className={styles.questao}
                style={{
                  pageBreakInside: semQuebra ? 'avoid' : 'auto',
                  borderTop: separador && idx > 0
                    ? '1px solid #e2e8f0' : 'none',
                  paddingTop: separador && idx > 0 ? '14px' : '0',
                  marginTop: idx > 0 ? '14px' : '0',
                }}>
                <div className={styles.qHeader}>
                  <span className={styles.qNum}>Questão {idx + 1}</span>
                  {q.nivel_dificuldade && (
                    <span className={styles.qDif}>
                      {'●'.repeat(q.nivel_dificuldade)}{'○'.repeat(5 - q.nivel_dificuldade)}
                    </span>
                  )}
                </div>

                <div className={styles.enunciado}
                  style={{ fontSize }}
                  dangerouslySetInnerHTML={{ __html: q.enunciado }} />

                {q.tipo === 'multipla_escolha' && q.alternativas?.length > 0 && (
                  <div className={styles.alternativas}>
                    {q.alternativas.map(alt => (
                      <div key={alt.id} className={styles.altItem} style={{ fontSize }}>
                        <span className={styles.altLetra}>{alt.letra})</span>
                        <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
                      </div>
                    ))}
                  </div>
                )}

                {q.tipo === 'dissertativa' && (
                  <div className={styles.espacoResposta}>
                    {Array(4).fill(null).map((_, i) => (
                      <div key={i} className={styles.linhaResposta} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Rodapé configurável */}
        {(cfg.rodapeEsquerda !== '' || cfg.rodapeDireita !== '') && (
          <div className={styles.rodape}>
            <span>
              {(cfg.rodapeEsquerda ?? 'Total: {total} questões')
                .replace('{total}', String(prova.questoes?.length || 0))}
            </span>
            <span>{cfg.rodapeDireita ?? 'Assinatura: ___________________________'}</span>
          </div>
        )}

        {/* Gabarito no rodapé — modo com_gabarito (exibição na tela) */}
        {modoVisualizacao === 'com_gabarito' && gabarito.length > 0 && (
          <div className={styles.gabRodape}>
            <strong>Gabarito:</strong>{' '}
            {gabarito.join('    ')}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}
