import { useRef, useEffect, useState } from 'react'
import { uploadImagem } from '../services/upload'
import {
  Image, Bold, Italic, List, ChevronDown, ChevronUp,
  RefreshCw, Trash2, AlignCenter,
} from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './RichEditor.module.css'

const CATEGORIAS = [
  {
    nome: 'Operações',
    itens: [
      { label: '×', insert: '×' }, { label: '÷', insert: '÷' },
      { label: '±', insert: '±' }, { label: '√', insert: '√' },
      { label: '∛', insert: '∛' }, { label: '∜', insert: '∜' },
    ],
  },
  {
    nome: 'Comparação',
    itens: [
      { label: '≠', insert: '≠' }, { label: '≤', insert: '≤' },
      { label: '≥', insert: '≥' }, { label: '≈', insert: '≈' },
    ],
  },
  {
    nome: 'Frações',
    itens: [
      { label: '½', insert: '½' }, { label: '⅓', insert: '⅓' },
      { label: '⅔', insert: '⅔' }, { label: '¼', insert: '¼' },
      { label: '¾', insert: '¾' }, { label: '⅕', insert: '⅕' },
    ],
  },
  {
    nome: 'Potência / Índice',
    itens: [
      { label: 'x²', insert: '²' }, { label: 'x³', insert: '³' },
      { label: '²', insert: '²' }, { label: '³', insert: '³' },
      { label: '₁', insert: '₁' }, { label: '₂', insert: '₂' },
      { label: '₃', insert: '₃' },
    ],
  },
  {
    nome: 'Geometria',
    itens: [
      { label: '°', insert: '°' }, { label: 'π', insert: 'π' },
      { label: '∠', insert: '∠' }, { label: '△', insert: '△' },
      { label: '⊥', insert: '⊥' }, { label: '∥', insert: '∥' },
      { label: '∞', insert: '∞' },
    ],
  },
  {
    nome: 'Conjuntos',
    itens: [
      { label: '∈', insert: '∈' }, { label: '∉', insert: '∉' },
      { label: '⊂', insert: '⊂' }, { label: '⊃', insert: '⊃' },
      { label: '∪', insert: '∪' }, { label: '∩', insert: '∩' },
      { label: '∅', insert: '∅' },
    ],
  },
  {
    nome: 'Cálculo',
    itens: [
      { label: '∑', insert: '∑' }, { label: '∫', insert: '∫' },
      { label: '∂', insert: '∂' }, { label: '∆', insert: '∆' },
      { label: '∇', insert: '∇' }, { label: 'lim', insert: 'lim' },
    ],
  },
  {
    nome: 'Letras Gregas',
    itens: [
      { label: 'α', insert: 'α' }, { label: 'β', insert: 'β' },
      { label: 'γ', insert: 'γ' }, { label: 'δ', insert: 'δ' },
      { label: 'λ', insert: 'λ' }, { label: 'μ', insert: 'μ' },
      { label: 'σ', insert: 'σ' }, { label: 'θ', insert: 'θ' },
      { label: 'φ', insert: 'φ' }, { label: 'ω', insert: 'ω' },
    ],
  },
]

// compact = true → modo alternativa (menor, sem lista/negrito)
export default function RichEditor({ value = '', onChange, label = '', placeholder = '', compact = false }) {
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const trocaImgRef = useRef(null)
  const [mostraSimbolos, setMostraSimbolos] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imgSel, setImgSel] = useState(null) // <img> selecionada para edição
  const lastSelection = useRef(null)
  const isFocused = useRef(false)

  // Emite o HTML sem a classe de seleção (marcação só visual do editor)
  function emitir() {
    const clone = editorRef.current.cloneNode(true)
    clone.querySelectorAll('img').forEach(i => {
      i.classList.remove(styles.imgSelecionada)
      if (!i.getAttribute('class')) i.removeAttribute('class')
    })
    onChange(clone.innerHTML)
  }

  // Sincroniza quando value chega de fora (ex: carregamento de questão para edição)
  useEffect(() => {
    if (editorRef.current && !isFocused.current) {
      const incoming = value ?? ''
      if (editorRef.current.innerHTML !== incoming) {
        editorRef.current.innerHTML = incoming
      }
    }
  }, [value])

  function salvarSelecao() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      lastSelection.current = sel.getRangeAt(0).cloneRange()
    }
  }

  function inserirNoEditor(texto) {
    editorRef.current?.focus()
    const sel = window.getSelection()
    if (lastSelection.current) {
      sel.removeAllRanges()
      sel.addRange(lastSelection.current)
    }
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const node = document.createTextNode(texto)
      range.insertNode(node)
      range.setStartAfter(node)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      editorRef.current.innerHTML += texto
    }
    emitir()
  }

  function inserirImagem(url) {
    editorRef.current?.focus()
    const img = `<img src="${url}" style="max-width:100%;height:auto;margin:6px 0;border-radius:6px;display:block;" />`
    const sel = window.getSelection()
    if (lastSelection.current) {
      sel.removeAllRanges()
      sel.addRange(lastSelection.current)
    }
    document.execCommand('insertHTML', false, img)
    emitir()
  }

  // ── Edição de imagem já inserida (clicar na imagem seleciona) ──
  function limparSelecaoImg() {
    editorRef.current?.querySelectorAll('img').forEach(i =>
      i.classList.remove(styles.imgSelecionada))
  }

  function handleEditorClick(e) {
    if (e.target.tagName === 'IMG') {
      limparSelecaoImg()
      e.target.classList.add(styles.imgSelecionada)
      setImgSel(e.target)
    } else if (imgSel) {
      limparSelecaoImg()
      setImgSel(null)
    }
  }

  function larguraImg(pct) {
    if (!imgSel) return
    imgSel.style.width = pct ? `${pct}%` : ''
    imgSel.style.maxWidth = '100%'
    imgSel.style.height = 'auto'
    emitir()
  }

  function centralizarImg() {
    if (!imgSel) return
    const centralizada = imgSel.style.marginLeft === 'auto'
    imgSel.style.display = 'block'
    imgSel.style.marginLeft = centralizada ? '' : 'auto'
    imgSel.style.marginRight = centralizada ? '' : 'auto'
    emitir()
  }

  function removerImg() {
    if (!imgSel) return
    imgSel.remove()
    setImgSel(null)
    emitir()
  }

  async function handleTrocaImagem(e) {
    const file = e.target.files?.[0]
    if (!file || !imgSel) return
    try {
      setUploading(true)
      const { url } = await uploadImagem(file)
      imgSel.src = url
      emitir()
      toast.success('Imagem substituída!')
    } catch (err) {
      toast.error('Erro ao substituir imagem: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleUploadImagem(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const { url } = await uploadImagem(file)
      inserirImagem(url)
      toast.success('Imagem inserida!')
    } catch (err) {
      toast.error('Erro ao enviar imagem: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function formatar(comando) {
    editorRef.current?.focus()
    document.execCommand(comando, false)
    emitir()
  }

  function handleInput() {
    emitir()
  }

  return (
    <div className={`${styles.container} ${compact ? styles.containerCompact : ''}`}>
      {label && <label className={styles.label}>{label}</label>}

      {/* Barra de formatação */}
      <div className={`${styles.formatBar} ${compact ? styles.formatBarCompact : ''}`}>
        {!compact && (
          <>
            <button type="button" className={styles.fmtBtn} onClick={() => formatar('bold')} title="Negrito">
              <Bold size={13} />
            </button>
            <button type="button" className={styles.fmtBtn} onClick={() => formatar('italic')} title="Itálico">
              <Italic size={13} />
            </button>
            <button type="button" className={styles.fmtBtn} onClick={() => formatar('insertUnorderedList')} title="Lista">
              <List size={13} />
            </button>
            <div className={styles.sep} />
          </>
        )}

        <button
          type="button"
          className={`${styles.fmtBtn} ${styles.fmtBtnSymbols} ${mostraSimbolos ? styles.ativo : ''}`}
          onMouseDown={salvarSelecao}
          onClick={() => setMostraSimbolos(v => !v)}
        >
          Σ {!compact && 'Símbolos'} {mostraSimbolos ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        <button
          type="button"
          className={`${styles.fmtBtn} ${uploading ? styles.fmtBtnDisabled : ''}`}
          onMouseDown={salvarSelecao}
          onClick={() => fileInputRef.current?.click()}
          title="Inserir imagem"
          disabled={uploading}
        >
          <Image size={13} /> {!compact && (uploading ? 'Enviando...' : 'Imagem')}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleUploadImagem}
        />
      </div>

      {/* Barra de edição da imagem selecionada */}
      {imgSel && (
        <div className={styles.imgBar}>
          <span className={styles.imgBarLabel}>Imagem selecionada — largura:</span>
          {[25, 50, 75, 100].map(p => (
            <button key={p} type="button" className={styles.imgBtn}
              onMouseDown={e => e.preventDefault()}
              onClick={() => larguraImg(p)}>
              {p}%
            </button>
          ))}
          <button type="button" className={styles.imgBtn}
            onMouseDown={e => e.preventDefault()}
            onClick={() => larguraImg(null)}>
            Original
          </button>
          <div className={styles.sep} />
          <button type="button" className={styles.imgBtn}
            onMouseDown={e => e.preventDefault()}
            onClick={centralizarImg} title="Centralizar / alinhar à esquerda">
            <AlignCenter size={12} /> Centralizar
          </button>
          <button type="button" className={styles.imgBtn}
            onMouseDown={e => e.preventDefault()}
            onClick={() => trocaImgRef.current?.click()}
            disabled={uploading} title="Enviar outra imagem no lugar">
            <RefreshCw size={12} /> {uploading ? 'Enviando...' : 'Substituir'}
          </button>
          <button type="button" className={`${styles.imgBtn} ${styles.imgBtnDanger}`}
            onMouseDown={e => e.preventDefault()}
            onClick={removerImg} title="Remover imagem">
            <Trash2 size={12} /> Remover
          </button>
          <input
            ref={trocaImgRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleTrocaImagem}
          />
        </div>
      )}

      {/* Painel de símbolos */}
      {mostraSimbolos && (
        <div className={`${styles.symbolsPanel} ${compact ? styles.symbolsPanelCompact : ''}`}>
          {CATEGORIAS.map(cat => (
            <div key={cat.nome} className={styles.symbolCat}>
              <span className={styles.catNome}>{cat.nome}</span>
              <div className={styles.catItens}>
                {cat.itens.map(s => (
                  <button
                    key={s.insert + s.label}
                    type="button"
                    className={styles.symbolBtn}
                    onMouseDown={(e) => { e.preventDefault(); salvarSelecao() }}
                    onClick={() => inserirNoEditor(s.insert)}
                    title={s.label}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Área de edição */}
      <div
        ref={editorRef}
        className={`${styles.editor} ${compact ? styles.editorCompact : ''}`}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onClick={handleEditorClick}
        onMouseUp={salvarSelecao}
        onKeyUp={salvarSelecao}
        data-placeholder={placeholder}
        onFocus={() => { isFocused.current = true }}
        onBlur={() => { isFocused.current = false }}
      />
    </div>
  )
}
