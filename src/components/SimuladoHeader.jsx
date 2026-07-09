import { useRef, useEffect } from 'react'
import { uploadImagem } from '../services/upload'
import { ChevronDown, ChevronUp, Image } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './SimuladoHeader.module.css'

export const CABECALHO_PADRAO = `<div style="text-align:center;padding:10px 0 6px">
  <p style="font-size:13pt;font-weight:800;margin:0">SIMULADO — CONCURSO PÚBLICO</p>
  <hr style="margin:8px 0;border:none;border-top:1px solid #999"/>
  <p style="font-size:10pt;margin:4px 0 0">Candidato(a): ________________________________&nbsp;&nbsp;&nbsp;Data: ___/___/_____</p>
  <p style="font-size:10pt;margin:4px 0 0">Cargo: ____________________________________&nbsp;&nbsp;&nbsp;Tempo: ________&nbsp;&nbsp;&nbsp;Nota: ______</p>
</div>`

// O componente é UNCONTROLLED internamente: o contentEditable é a fonte da verdade.
// O pai controla só via prop value (para carregar) e onChange (para salvar).
export default function SimuladoHeader({ value, onChange, aberto, setAberto }) {
  const fileRef = useRef(null)
  const editorRef = useRef(null)
  const initialized = useRef(false)

  const html = value || CABECALHO_PADRAO

  // Carrega o HTML no editor quando:
  // 1. Primeira montagem
  // 2. value muda externamente E o editor não está focado
  useEffect(() => {
    if (!editorRef.current) return
    // Sempre força sincronização quando value muda (vem do banco)
    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html
    }
    initialized.current = true
  }, [html])

  function handleInput() {
    if (onChange) onChange(editorRef.current.innerHTML)
  }

  async function handleLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { url } = await uploadImagem(file, 'cabecalhos')
      editorRef.current?.focus()
      document.execCommand('insertHTML', false,
        `<img src="${url}" style="max-height:70px;width:auto;vertical-align:middle;margin:4px 8px 4px 0" />`
      )
      if (onChange) onChange(editorRef.current.innerHTML)
      toast.success('Logo inserida!')
    } catch (err) {
      toast.error('Erro ao enviar logo: ' + err.message)
    } finally {
      e.target.value = ''
    }
  }

  function fmt(cmd, val) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val || undefined)
    if (onChange) onChange(editorRef.current.innerHTML)
  }

  function resetar() {
    if (!confirm('Restaurar o cabeçalho padrão?')) return
    if (editorRef.current) editorRef.current.innerHTML = CABECALHO_PADRAO
    if (onChange) onChange(CABECALHO_PADRAO)
  }

  return (
    <div className={styles.wrap}>

      {/* Preview — sempre visível, renderiza o HTML atual */}
      <div className={styles.preview}
        dangerouslySetInnerHTML={{ __html: html }} />

      {/* Botões de controle */}
      <div className={styles.toggleRow}>
        <button type="button" className={styles.toggleBtn}
          onClick={() => setAberto(v => !v)}>
          {aberto ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
          {aberto ? 'Fechar editor' : 'Editar cabeçalho'}
        </button>
        <button type="button" className={styles.resetBtn} onClick={resetar}>
          Restaurar padrão
        </button>
      </div>

      {/* Editor — sempre montado, visível só quando aberto */}
      <div className={styles.editorWrap} style={{ display: aberto ? 'block' : 'none' }}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.toolBtn}
            onMouseDown={e => { e.preventDefault(); fmt('bold') }}><b>B</b></button>
          <button type="button" className={styles.toolBtn}
            onMouseDown={e => { e.preventDefault(); fmt('italic') }}><i>I</i></button>
          <button type="button" className={styles.toolBtn}
            onMouseDown={e => { e.preventDefault(); fmt('underline') }}><u>U</u></button>

          <div className={styles.sep}/>

          <button type="button" className={styles.toolBtn}
            onMouseDown={e => { e.preventDefault(); fmt('justifyLeft') }}
            title="Alinhar à esquerda">⇤</button>
          <button type="button" className={styles.toolBtn}
            onMouseDown={e => { e.preventDefault(); fmt('justifyCenter') }}
            title="Centralizar">⇔</button>
          <button type="button" className={styles.toolBtn}
            onMouseDown={e => { e.preventDefault(); fmt('justifyRight') }}
            title="Alinhar à direita">⇥</button>

          <div className={styles.sep}/>

          <span className={styles.toolLabel}>Fonte</span>
          <select className={styles.toolSelect}
            defaultValue="3"
            onChange={e => fmt('fontSize', e.target.value)}>
            <option value="1">8pt</option>
            <option value="2">10pt</option>
            <option value="3">12pt</option>
            <option value="4">14pt</option>
            <option value="5">18pt</option>
            <option value="6">24pt</option>
            <option value="7">36pt</option>
          </select>

          <span className={styles.toolLabel}>Cor</span>
          <input type="color" className={styles.toolColor} defaultValue="#000000"
            onChange={e => fmt('foreColor', e.target.value)} />

          <div className={styles.sep}/>

          <button type="button" className={`${styles.toolBtn} ${styles.toolBtnImg}`}
            onClick={() => fileRef.current?.click()}>
            <Image size={12}/> Logo
          </button>
          <input ref={fileRef} type="file" accept="image/*"
            style={{display:'none'}} onChange={handleLogo}/>
        </div>

        {/* contentEditable — sempre montado para preservar o conteúdo */}
        <div
          ref={editorRef}
          className={styles.editor}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
        />
      </div>
    </div>
  )
}
