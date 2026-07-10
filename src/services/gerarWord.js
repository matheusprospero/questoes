import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, BorderStyle, WidthType,
} from 'docx'
import { CABECALHO_PADRAO } from '../components/SimuladoHeader'

// Busca imagem e retorna { data: Uint8Array, type: 'png'|'jpg'|'gif' }
async function fetchImagem(url) {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const buffer = await resp.arrayBuffer()
    const contentType = resp.headers.get('content-type') || ''
    const type = contentType.includes('png') ? 'png'
               : contentType.includes('gif') ? 'gif'
               : 'jpg'
    return { data: new Uint8Array(buffer), type }
  } catch {
    return null
  }
}

// Processa um nó HTML e retorna array de { tipo: 'texto'|'imagem', ... }
async function processarNo(no) {
  const itens = []

  if (no.nodeType === Node.TEXT_NODE) {
    const txt = no.textContent
    if (txt) itens.push({ tipo: 'texto', texto: txt })
    return itens
  }

  if (no.nodeType !== Node.ELEMENT_NODE) return itens

  const tag = no.tagName?.toUpperCase()

  if (tag === 'IMG') {
    const src = no.getAttribute('src')
    if (src) {
      const img = await fetchImagem(src)
      if (img) {
        // Tenta pegar dimensões do atributo style ou padrão
        const styleW = parseInt(no.style?.width)   || no.width  || 0
        const styleH = parseInt(no.style?.height)  || no.height || 0
        const maxW = 500  // px — largura máxima na página
        const maxH = 300

        // Calcula proporção se tiver dimensões, senão usa padrão
        let w = styleW || maxW
        let h = styleH || 200
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH }

        itens.push({ tipo: 'imagem', data: img.data, type: img.type, w, h })
      }
    }
    return itens
  }

  // Processa filhos recursivamente
  for (const filho of no.childNodes) {
    const sub = await processarNo(filho)
    itens.push(...sub)
  }

  // Adiciona quebra de linha para elementos de bloco
  if (['P', 'DIV', 'BR', 'LI', 'H1', 'H2', 'H3', 'H4'].includes(tag)) {
    if (itens.length > 0 && itens[itens.length - 1]?.tipo !== 'br') {
      itens.push({ tipo: 'br' })
    }
  }

  return itens
}

// Converte lista de itens em Paragraphs do docx
// Agrupa texto e imagens por linha (separados por 'br')
function itensParagrafos(itens, opts = {}) {
  const { fontSize = 22, bold = false, alignment = AlignmentType.LEFT,
          keepNext = false, indent = 0, spacingBefore = 20, spacingAfter = 60 } = opts

  const paragrafos = []
  let runAtual = []

  function flushParagrafo() {
    if (runAtual.length === 0) return
    paragrafos.push(new Paragraph({
      alignment,
      spacing: { before: spacingBefore, after: spacingAfter },
      keepNext,
      indent: indent ? { left: indent } : undefined,
      children: runAtual.map(item => {
        if (item.tipo === 'texto') {
          return new TextRun({ text: item.texto, bold, size: fontSize })
        }
        if (item.tipo === 'imagem') {
          return new ImageRun({
            data: item.data,
            type: item.type,
            transformation: {
              // docx espera as dimensões em PIXELS (converte para EMU internamente).
              width: item.w,
              height: item.h,
            },
          })
        }
        return new TextRun({ text: '' })
      }),
    }))
    runAtual = []
  }

  for (const item of itens) {
    if (item.tipo === 'br') {
      flushParagrafo()
    } else {
      runAtual.push(item)
    }
  }
  flushParagrafo()

  return paragrafos.length > 0 ? paragrafos
    : [new Paragraph({ children: [new TextRun('')] })]
}

// Converte HTML do cabeçalho em parágrafos do docx
async function cabecalhoParaParagrafos(html) {
  const div = document.createElement('div')
  div.innerHTML = html || CABECALHO_PADRAO

  const paragrafos = []
  const elementos = div.querySelectorAll('p, h1, h2, h3')

  if (elementos.length > 0) {
    for (const el of elementos) {
      const itens = await processarNo(el)
      const style = el.getAttribute('style') || ''
      const bold = style.includes('font-weight:7') || style.includes('font-weight:8') ||
                   style.includes('bold') || ['H1','H2','H3'].includes(el.tagName)
      const matchSize = style.match(/font-size:\s*([\d.]+)pt/)
      const fontSize = matchSize ? Math.round(parseFloat(matchSize[1]) * 2) : 22
      const matchAlign = style.match(/text-align:\s*(\w+)/)
      const align = matchAlign
        ? matchAlign[1] === 'right' ? AlignmentType.RIGHT
        : matchAlign[1] === 'left'  ? AlignmentType.LEFT
        :                              AlignmentType.CENTER
        : AlignmentType.CENTER

      const pars = itensParagrafos(itens.filter(i => i.tipo !== 'br'), {
        fontSize, bold, alignment: align,
        spacingBefore: 30, spacingAfter: 30,
      })
      paragrafos.push(...pars)
    }
  } else {
    // Fallback: processa o div inteiro
    const itens = await processarNo(div)
    paragrafos.push(...itensParagrafos(itens, {
      alignment: AlignmentType.CENTER,
      spacingBefore: 30, spacingAfter: 30,
    }))
  }

  return paragrafos.length > 0 ? paragrafos
    : [new Paragraph({ children: [new TextRun('')] })]
}

export async function gerarWordSimulado(prova) {
  const cfg = prova.cfg_impressao || {}
  const fontSize = (cfg.tamanhoFonte || 11) * 2  // half-points
  const separador = cfg.separadorQuestoes !== false
  const semQuebra = cfg.quebrarPagina !== false

  // ── Cabeçalho ──────────────────────────────────────────────
  const parsCabecalho = await cabecalhoParaParagrafos(prova.cabecalho)

  const linhaSep = new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
    spacing: { before: 60, after: 120 },
    children: [],
  })

  // ── Título ─────────────────────────────────────────────────
  const parTitulo = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: prova.titulo, bold: true, size: fontSize + 4 })],
  })

  // ── Instruções ─────────────────────────────────────────────
  const parsInstrucoes = prova.instrucoes ? [
    new Paragraph({
      spacing: { before: 60, after: 120 },
      border: { left: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 8 } },
      indent: { left: 240 },
      children: [
        new TextRun({ text: 'Instruções: ', bold: true, size: fontSize }),
        new TextRun({ text: prova.instrucoes, size: fontSize }),
      ],
    }),
  ] : []

  // ── Questões ───────────────────────────────────────────────
  const parsQuestoes = []

  for (const [idx, q] of (prova.questoes || []).entries()) {

    // Linha separadora entre questões
    if (separador && idx > 0) {
      parsQuestoes.push(new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 6 } },
        spacing: { before: 80, after: 0 },
        children: [],
      }))
    }

    // Número + origem (banca · órgão · ano)
    const origem = [q.bancas?.nome, q.orgaos?.nome, q.ano].filter(Boolean).join(' · ')

    parsQuestoes.push(new Paragraph({
      spacing: { before: separador && idx > 0 ? 60 : 140, after: 60 },
      keepNext: semQuebra,
      children: [
        new TextRun({ text: `Questão ${idx + 1}`, bold: true, size: fontSize + 2 }),
        ...(origem ? [new TextRun({ text: `  (${origem})`, size: fontSize - 2, color: '666666' })] : []),
      ],
    }))

    // Enunciado com imagens
    const divEnunciado = document.createElement('div')
    divEnunciado.innerHTML = q.enunciado || ''
    const itensEnunciado = await processarNo(divEnunciado)
    const parsEnunciado = itensParagrafos(itensEnunciado, {
      fontSize, keepNext: semQuebra,
      alignment: AlignmentType.JUSTIFIED,
      spacingBefore: 20, spacingAfter: 80,
    })
    parsQuestoes.push(...parsEnunciado)

    // Alternativas com imagens
    if (q.tipo === 'multipla_escolha' && q.alternativas?.length) {
      for (const alt of q.alternativas) {
        const divAlt = document.createElement('div')
        divAlt.innerHTML = alt.texto || ''
        const itensAlt = await processarNo(divAlt)

        // Prefixo da letra
        const prefixo = [{ tipo: 'texto', texto: `${alt.letra})  ` }]
        const parsAlt = itensParagrafos([...prefixo, ...itensAlt.filter(i => i.tipo !== 'br')], {
          fontSize, keepNext: semQuebra,
          indent: 360, spacingBefore: 20, spacingAfter: 20,
        })
        parsQuestoes.push(...parsAlt)
      }
    }

    // Opções Certo/Errado (estilo Cebraspe)
    if (q.tipo === 'certo_errado') {
      parsQuestoes.push(new Paragraph({
        spacing: { before: 40, after: 40 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: '(     ) Certo        (     ) Errado', size: fontSize }),
        ],
      }))
    }
  }

  // ── Rodapé ─────────────────────────────────────────────────
  const rodapeEsq = (cfg.rodapeEsquerda ?? 'Total: {total} questões')
    .replace('{total}', String(prova.questoes?.length || 0))
  const rodapeDir = cfg.rodapeDireita ?? ''
  const parRodape = new Paragraph({
    spacing: { before: 200 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 4 } },
    tabStops: [{ type: 'right', position: 8640 }],
    children: [
      new TextRun({ text: rodapeEsq, size: 18 }),
      new TextRun({ text: `\t${rodapeDir}`, size: 18 }),
    ],
  })

  // ── Documento ──────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: fontSize } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 720, right: 1080, bottom: 720, left: 1080 },
        },
      },
      children: [
        ...parsCabecalho,
        linhaSep,
        parTitulo,
        ...parsInstrucoes,
        ...parsQuestoes,
        parRodape,
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${prova.titulo.replace(/[^a-zA-Z0-9\s]/g, '').trim()}.docx`
  link.click()
  URL.revokeObjectURL(url)
}
