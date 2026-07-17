import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { buscarSimulado } from '../../services/simulados'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, Printer, Pencil, FileText, Play } from 'lucide-react'
import { gerarWordSimulado } from '../../services/gerarWord'
import { useState } from 'react'
import { CABECALHO_PADRAO } from '../../components/SimuladoHeader'
import toast from 'react-hot-toast'
import styles from './SimuladoDetalhe.module.css'

// Gabarito em texto de uma questão do simulado
function gabaritoLinha(q, idx) {
  if (q.tipo === 'multipla_escolha') {
    const correta = q.alternativas?.find(a => a.correta)
    return correta ? `${idx + 1} - ${correta.letra}` : `${idx + 1} - ?`
  }
  if (q.tipo === 'certo_errado') {
    if (q.gabarito_certo === true)  return `${idx + 1} - Certo`
    if (q.gabarito_certo === false) return `${idx + 1} - Errado`
    return `${idx + 1} - ?`
  }
  return null
}

export default function SimuladoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()

  const [modoVisualizacao, setModoVisualizacao] = useState('normal')

  const { data: simulado, isLoading } = useQuery({
    queryKey: ['simulado', id],
    queryFn: () => buscarSimulado(id),
  })

  async function handleWord() {
    try {
      toast.loading('Gerando Word...')
      await gerarWordSimulado(simulado)
      toast.dismiss()
      toast.success('Arquivo Word gerado!')
    } catch (err) {
      toast.dismiss()
      toast.error('Erro ao gerar Word: ' + err.message)
    }
  }

  function buildHtml(simulado, opcoes = {}) {
    const { comGabarito = false, soGabarito = false } = opcoes
    const cfg = simulado.cfg_impressao || {}
    const fontSize = cfg.tamanhoFonte ? `${cfg.tamanhoFonte}pt` : '11pt'
    const separador = cfg.separadorQuestoes !== false
    const semQuebra = cfg.quebrarPagina !== false
    const cabecalhoHtml = simulado.cabecalho || CABECALHO_PADRAO
    // Questões por folha + espaço para resolução (aulas/gravação)
    const porFolha = Number(cfg.questoesPorFolha) || 0            // 0 = todas
    const evitaCorte = semQuebra || porFolha > 0                   // com N por folha, nunca corta a questão
    const comResolucao = cfg.espacoResolucao && !soGabarito       // reserva espaço para resolver
    const alturaFixaResol = 60                                    // mm, usado só no modo "Todas" (fluxo contínuo)

    // ── Gabarito resumido: "1 - A, 2 - Certo, ..." ───────────
    const linhasGab = (simulado.questoes || [])
      .map((q, idx) => gabaritoLinha(q, idx))
      .filter(Boolean)

    // Rodapé configurável
    const rodapeEsq = (cfg.rodapeEsquerda ?? 'Total: {total} questões')
      .replace('{total}', String((simulado.questoes || []).length))
    const rodapeDir = cfg.rodapeDireita ?? ''
    const rodapeHtml = `<div style="display:flex;justify-content:space-between;margin-top:24px;padding-top:8px;border-top:1px solid #ccc;font-size:9pt;color:#555">
      <span>${rodapeEsq}</span><span>${rodapeDir}</span>
    </div>`

    // Gabarito fixo no rodapé da ÚLTIMA página
    const gabRodapeHtml = linhasGab.length > 0
      ? `<div style="position:fixed;bottom:0;left:0;right:0;padding:6px 12mm 4px;border-top:1.5px solid #000;background:#fff;font-size:9pt;font-family:'Times New Roman',serif;color:#000">
          <strong>Gabarito:</strong>&nbsp;&nbsp;${linhasGab.join('&nbsp;&nbsp;&nbsp;&nbsp;')}
        </div>
        <div style="height:32px"></div>`
      : ''

    const instrHtml = simulado.instrucoes
      ? `<div style="font-size:10pt;background:#f8f8f8;border-left:3px solid #999;padding:8px 12px;margin:10px 0">
          <strong>Instruções:</strong> ${simulado.instrucoes}
        </div>`
      : ''

    // ── Questões ──────────────────────────────────────────────
    // Conteúdo (título + enunciado + alternativas) de cada questão, sem paginação.
    const blocosInner = (simulado.questoes || []).map((q, idx) => {
      const alts = q.tipo === 'multipla_escolha' && q.alternativas?.length
        ? q.alternativas.map(a =>
            `<div style="display:flex;gap:8px;margin:3px 0;font-size:${fontSize}">
              <span style="font-weight:700;min-width:18px">${a.letra})</span>
              <span>${a.texto}</span>
            </div>`
          ).join('')
        : q.tipo === 'certo_errado'
          ? `<div style="margin:6px 0;font-size:${fontSize}">
              (&nbsp;&nbsp;) Certo&nbsp;&nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;) Errado
            </div>`
          : ''
      const origem = [q.bancas?.nome, q.orgaos?.nome, q.ano].filter(Boolean).join(' · ')
      const origemHtml = origem
        ? `<span style="font-size:9pt;color:#666;margin-left:8px">(${origem})</span>`
        : ''
      return `<p style="font-weight:700;font-size:${fontSize};margin:0 0 6px">Questão ${idx + 1}${origemHtml}</p>
        <div style="font-size:${fontSize};margin-bottom:8px;text-align:justify">${q.enunciado}</div>
        ${alts}`
    })

    const boxResol = '<div class="resol"><span class="resollb">Resolução</span></div>'

    let questoesHtml
    if (porFolha > 0) {
      // N questões por folha: cada folha ocupa a página; com espaço de resolução,
      // a área em branco cresce e é dividida igualmente entre as questões da folha.
      const paginas = []
      for (let i = 0; i < blocosInner.length; i += porFolha) paginas.push(blocosInner.slice(i, i + porFolha))
      const tituloTopo = `<h2 style="text-align:center;font-size:14pt;font-weight:700;margin:0 0 6px">${simulado.titulo}</h2>`
      const topoHtml = `${cabecalhoHtml}${tituloTopo}${instrHtml}`
      questoesHtml = paginas.map((pag, p) => {
        const qs = pag.map(inner =>
          `<div class="q">${inner}${comResolucao ? boxResol : ''}</div>`).join('')
        const topo = p === 0 ? `<div class="folhaTopo">${topoHtml}</div>` : ''
        return `<div class="folha${comResolucao ? ' resolOn' : ''}">${topo}${qs}</div>`
      }).join('')
    } else {
      questoesHtml = blocosInner.map((inner, idx) => {
        const sep = idx === 0 ? ''
          : separador ? `<hr style="border:none;border-top:1px solid #ddd;margin:14px 0"/>`
          : '<div style="margin-top:16px"></div>'
        const resol = comResolucao
          ? `<div style="height:${alturaFixaResol}mm;margin-top:8px;border:1px dashed #bbb;border-radius:4px;position:relative"><span style="position:absolute;top:4px;left:6px;font-size:8pt;color:#999">Resolução</span></div>`
          : ''
        return `${sep}<div style="page-break-inside:${evitaCorte ? 'avoid' : 'auto'}">${inner}${resol}</div>`
      }).join('')
    }

    // ── Modo: só gabarito ─────────────────────────────────────
    if (soGabarito) {
      const linhasFormatadas = linhasGab.join('<br/>')
      return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Gabarito — ${simulado.titulo}</title>
  <style>
    @page { size: A4; margin: 15mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; margin: 0; color: #000; font-size: 12pt; }
  </style>
</head>
<body>
  <h2 style="text-align:center;font-size:14pt;font-weight:700;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:16px">
    GABARITO — ${simulado.titulo}
  </h2>
  <div style="font-size:12pt;line-height:2">${linhasFormatadas}</div>
</body>
</html>`
    }

    // ── Modo: simulado normal ou com gabarito no rodapé ───────
    // Com N por folha, cada folha ocupa a página e o corpo é só as folhas
    // (o topo já vai dentro da primeira folha; sem rodapé para não gerar página extra).
    const corpo = porFolha > 0
      ? questoesHtml
      : `${cabecalhoHtml}
  <h2 style="text-align:center;font-size:14pt;font-weight:700;margin:12px 0 6px">${simulado.titulo}</h2>
  ${instrHtml}
  <div>${questoesHtml}</div>
  ${rodapeHtml}
  ${comGabarito ? gabRodapeHtml : ''}`

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>${simulado.titulo}</title>
  <style>
    @page { size: A4; margin: 8mm 12mm 10mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 0; color: #000; }
    img { max-width: 100%; height: auto; }
    @media print { body { margin: 0; } }
    /* Folhas com N questões: cada uma ocupa a página e divide o espaço de resolução */
    .folha { height: 276mm; display: flex; flex-direction: column; box-sizing: border-box; }
    .folha:not(:last-child) { page-break-after: always; }
    .folhaTopo { flex: 0 0 auto; }
    .q { flex: 0 0 auto; margin-bottom: 6mm; }
    .resolOn .q { flex: 1 1 0; display: flex; flex-direction: column; min-height: 0; margin-bottom: 6mm; }
    .resol { flex: 1 1 auto; border: 1px dashed #bbb; border-radius: 4px; margin-top: 6px; min-height: 16mm; position: relative; }
    .resollb { position: absolute; top: 3px; left: 6px; font-size: 8pt; color: #999; }
  </style>
</head>
<body>
  ${corpo}
</body>
</html>`
  }

  function abrirJanela(html) {
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  function handleImprimir() {
    if (modoVisualizacao === 'com_gabarito') abrirJanela(buildHtml(simulado, { comGabarito: true }))
    else if (modoVisualizacao === 'gabarito') abrirJanela(buildHtml(simulado, { soGabarito: true }))
    else abrirJanela(buildHtml(simulado))
  }

  if (isLoading) return <div className={styles.loading}>Carregando simulado...</div>
  if (!simulado) return <div className={styles.loading}>Simulado não encontrado.</div>

  const cfg = simulado.cfg_impressao || {}
  const fontSize = cfg.tamanhoFonte ? `${cfg.tamanhoFonte}pt` : '11pt'
  const separador = cfg.separadorQuestoes !== false
  const semQuebra = cfg.quebrarPagina !== false
  const cabecalhoHtml = simulado.cabecalho || CABECALHO_PADRAO

  const gabarito = (simulado.questoes || [])
    .map((q, idx) => gabaritoLinha(q, idx))
    .filter(Boolean)

  return (
    <div className={styles.page}>
      {/* Topbar — não aparece na impressão */}
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/simulados')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className={styles.topbarInfo}>
          <span className={styles.topbarTitulo}>{simulado.titulo}</span>
          <span className={styles.topbarMeta}>
            {simulado.questoes?.length || 0} questões
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
                Simulado
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

          <button className={styles.btnSecondary} onClick={() => navigate(`/estudo?simulado=${id}`)}>
            <Play size={14} /> Resolver online
          </button>
          <button className={styles.btnSecondary} onClick={handleImprimir}>
            <Printer size={14} /> Imprimir / PDF
          </button>
          <button className={styles.btnSecondary} onClick={handleWord}>
            <FileText size={14} /> Word
          </button>
          {simulado.usuario_id === usuario?.id && (
            <button className={styles.btnSecondary}
              onClick={() => navigate(`/simulados/${id}/editar`)}>
              <Pencil size={14} /> Editar
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo imprimível */}
      <div className={styles.printArea} style={{ fontSize }}>

        {/* Modo: Só gabarito */}
        {modoVisualizacao === 'gabarito' ? (
          <div className={styles.soGabarito}>
            <h2 className={styles.gabTitulo}>GABARITO — {simulado.titulo}</h2>
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

            {/* Título do simulado */}
            <h1 className={styles.tituloprova}>{simulado.titulo}</h1>

            {simulado.instrucoes && (
              <div className={styles.instrucoes}>
                <strong>Instruções:</strong> {simulado.instrucoes}
              </div>
            )}

            {/* Questões */}
            <div className={styles.questoes}>
              {simulado.questoes?.length === 0 ? (
                <p className={styles.vazio}>Nenhuma questão neste simulado.</p>
              ) : (
                simulado.questoes.map((q, idx) => (
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
                      {(q.bancas || q.orgaos || q.ano) && (
                        <span className={styles.qDif}>
                          {[q.bancas?.nome, q.orgaos?.nome, q.ano].filter(Boolean).join(' · ')}
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

                    {q.tipo === 'certo_errado' && (
                      <div className={styles.alternativas}>
                        <div className={styles.altItem} style={{ fontSize }}>
                          (&nbsp;&nbsp;) Certo&nbsp;&nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;) Errado
                        </div>
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
                    .replace('{total}', String(simulado.questoes?.length || 0))}
                </span>
                <span>{cfg.rodapeDireita ?? ''}</span>
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
