import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Maximize } from 'lucide-react'
import styles from './VideoYouTube.module.css'

// Player embutido de YouTube a partir de qualquer formato de URL:
// youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID
export function extrairIdYouTube(url) {
  if (!url) return null
  const padroes = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/live\/)([\w-]{11})/,
  ]
  for (const p of padroes) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// Carrega a IFrame API do YouTube uma única vez
let apiPromise = null
function carregarApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    tag.onerror = reject
    document.head.appendChild(tag)
    const anterior = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { anterior && anterior(); resolve(window.YT) }
    setTimeout(() => reject(new Error('timeout')), 6000)
  })
  return apiPromise
}

const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60), seg = Math.floor(s % 60)
  return `${m}:${String(seg).padStart(2, '0')}`
}

export default function VideoYouTube({ url, titulo = 'Resolução em vídeo' }) {
  const id = extrairIdYouTube(url)
  const wrapRef = useRef(null)
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const [iniciado, setIniciado] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [tocando, setTocando] = useState(false)
  const [dur, setDur] = useState(0)
  const [pos, setPos] = useState(0)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    if (!iniciado || !id) return
    let cancelado = false
    carregarApi().then(YT => {
      if (cancelado || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        width: '100%', height: '100%', videoId: id,
        playerVars: {
          autoplay: 1, controls: 0, modestbranding: 1, rel: 0,
          iv_load_policy: 3, playsinline: 1, fs: 0, disablekb: 1,
        },
        events: {
          onReady: (e) => { setPronto(true); setDur(e.target.getDuration() || 0); e.target.playVideo() },
          onStateChange: (e) => setTocando(e.data === YT.PlayerState.PLAYING),
          onError: () => setFalhou(true),
        },
      })
    }).catch(() => setFalhou(true))

    const timer = setInterval(() => {
      const p = playerRef.current
      if (p?.getCurrentTime) { setPos(p.getCurrentTime() || 0); if (!dur && p.getDuration) setDur(p.getDuration() || 0) }
    }, 400)
    return () => { cancelado = true; clearInterval(timer); try { playerRef.current?.destroy() } catch { /* noop */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iniciado, id])

  if (!id) return null

  // Fallback seguro: se a API falhar, usa o embed simples (garante que o vídeo toca)
  if (falhou) {
    return (
      <div className={styles.wrap}>
        <iframe
          className={styles.frame}
          src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&iv_load_policy=3`}
          title={titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  // Capa (sem título do YouTube) — só carrega o player ao clicar
  if (!iniciado) {
    return (
      <button className={styles.wrap} onClick={() => setIniciado(true)}
        onContextMenu={e => e.preventDefault()} aria-label="Reproduzir vídeo">
        <img className={styles.capa} src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" draggable={false} />
        <span className={styles.capaSombra} />
        <span className={styles.playGrande}><Play size={30} fill="currentColor" /></span>
      </button>
    )
  }

  const toggle = () => {
    const p = playerRef.current; if (!p) return
    tocando ? p.pauseVideo() : p.playVideo()
  }
  const buscar = (e) => {
    const p = playerRef.current; if (!p?.seekTo || !dur) return
    p.seekTo((Number(e.target.value) / 1000) * dur, true)
  }
  const tela = () => {
    const el = wrapRef.current; if (!el) return
    const fn = el.requestFullscreen || el.webkitRequestFullscreen
    fn && fn.call(el)
  }

  return (
    <div ref={wrapRef} className={styles.wrap} onContextMenu={e => e.preventDefault()}>
      <div className={styles.host}><div ref={hostRef} /></div>

      {/* Overlay: bloqueia clique-direito e o clique-para-YouTube; clique = play/pause */}
      <div className={styles.overlay} onClick={toggle}>
        {pronto && !tocando && <span className={styles.playGrande}><Play size={30} fill="currentColor" /></span>}
      </div>

      {/* Controles próprios */}
      <div className={styles.barra} onClick={e => e.stopPropagation()}>
        <button className={styles.ctrlBtn} onClick={toggle} aria-label={tocando ? 'Pausar' : 'Reproduzir'}>
          {tocando ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <span className={styles.tempo}>{fmt(pos)}</span>
        <input className={styles.seek} type="range" min="0" max="1000"
          value={dur ? Math.round((pos / dur) * 1000) : 0} onChange={buscar} aria-label="Avançar" />
        <span className={styles.tempo}>{fmt(dur)}</span>
        <button className={styles.ctrlBtn} onClick={tela} aria-label="Tela cheia">
          <Maximize size={15} />
        </button>
      </div>
    </div>
  )
}
