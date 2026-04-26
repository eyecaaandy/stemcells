import { useState, useRef, useCallback, useEffect } from 'react'

// ── Univers-first font stack (used everywhere) ────────────────────────────────
const UNIVERS = `'Univers', 'Univers LT Std', 'HelveticaNeue-Light', 'Helvetica Neue Light', 'Helvetica Neue', Arial, sans-serif`

// ── Stem metadata ────────────────────────────────────────────────────────────
const STEMS = [
  { key: 'vocals', label: 'Vocals', color: '#a78bfa', desc: 'Lead & backing vocals' },
  { key: 'drums',  label: 'Drums',  color: '#f97316', desc: 'Kick, snare & percussion' },
  { key: 'bass',   label: 'Bass',   color: '#34d399', desc: 'Bass guitar & low-end' },
  { key: 'other',  label: 'Melody', color: '#38bdf8', desc: 'Keys, guitars & synths' },
]

// ── SVG Icons (no emojis) ─────────────────────────────────────────────────────
function IconMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

function IconDrum() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="8" rx="10" ry="4"/>
      <path d="M2 8v8c0 2.21 4.48 4 10 4s10-1.79 10-4V8"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
  )
}

function IconBass() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  )
}

function IconKeys() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="20" height="12" rx="2"/>
      <path d="M6 8V6M10 8V6M14 8V6M18 8V6"/>
      <path d="M8 8v5M12 8v5M16 8v5"/>
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

function IconUpload() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

function IconZip() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

const STEM_ICONS = { vocals: IconMic, drums: IconDrum, bass: IconBass, other: IconKeys }

// ── Custom audio player (blob-based so scrubbing always works) ────────────────
function AudioPlayer({ url, color }) {
  const [blobUrl,   setBlobUrl]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [playing,   setPlaying]   = useState(false)
  const [progress,  setProgress]  = useState(0)      // 0–1
  const [duration,  setDuration]  = useState(0)
  const [currentT,  setCurrentT]  = useState(0)
  const audioRef  = useRef(null)
  const trackRef  = useRef(null)

  // Fetch the file as a blob once — this is the key to reliable scrubbing
  useEffect(() => {
    let objectUrl = null
    setLoading(true)
    setPlaying(false)
    setProgress(0)
    setCurrentT(0)
    setDuration(0)

    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [url])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause() } else { a.play() }
    setPlaying(!playing)
  }

  const onTimeUpdate = () => {
    const a = audioRef.current
    if (!a || !a.duration) return
    setCurrentT(a.currentTime)
    setProgress(a.currentTime / a.duration)
  }

  const onLoaded = () => {
    const a = audioRef.current
    if (a) setDuration(a.duration)
  }

  const onEnded = () => setPlaying(false)

  const seek = (e) => {
    const a = audioRef.current
    if (!a || !a.duration) return
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * a.duration
    setProgress(ratio)
    setCurrentT(ratio * a.duration)
  }

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Play icon
  const PlayIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  )
  const PauseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
    </svg>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {blobUrl && (
        <audio
          ref={audioRef}
          src={blobUrl}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoaded}
          onEnded={onEnded}
          preload="auto"
        />
      )}

      {/* Play/pause button */}
      <button
        onClick={togglePlay}
        disabled={loading || !blobUrl}
        style={{
          width: 36, height: 36, borderRadius: '50%', border: 'none',
          background: color, color: '#0a0a0f', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          cursor: loading ? 'wait' : 'pointer', flexShrink: 0,
          opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s',
        }}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Scrub track */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          ref={trackRef}
          onClick={seek}
          style={{
            height: 4, borderRadius: 2, background: '#1e1e2e',
            cursor: 'pointer', position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${progress * 100}%`, background: color,
            borderRadius: 2, transition: 'width 0.1s linear',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b6b8a', fontFamily: UNIVERS }}>
          <span>{fmt(currentT)}</span>
          <span>{loading ? 'Loading…' : fmt(duration)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Single stem card ──────────────────────────────────────────────────────────
function StemCard({ stem, url }) {
  const fullUrl = `http://localhost:8000${url}`
  const Icon = STEM_ICONS[stem.key]

  const handleDownload = async () => {
    try {
      const res = await fetch(fullUrl)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${stem.key}.mp3`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    } catch {
      const a = document.createElement('a')
      a.href = fullUrl
      a.download = `${stem.key}.mp3`
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${stem.color}20`, color: stem.color }}
        >
          <Icon />
        </div>
        <div>
          <p className="text-sm font-bold text-forge-text leading-none" style={{ fontFamily: UNIVERS }}>{stem.label}</p>
          <p className="text-xs text-forge-muted mt-1" style={{ fontFamily: UNIVERS }}>{stem.desc}</p>
        </div>
      </div>

      {/* Custom scrub-capable audio player */}
      <AudioPlayer url={fullUrl} color={stem.color} />

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm transition-all duration-200 hover:opacity-90 active:scale-95 cursor-pointer"
        style={{
          backgroundColor: `${stem.color}18`, color: stem.color,
          border: `1px solid ${stem.color}40`, fontFamily: UNIVERS,
        }}
      >
        <IconDownload />
        Download {stem.label}
      </button>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin-slow w-12 h-12" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" stroke="#1e1e2e" strokeWidth="4" />
      <path d="M24 4a20 20 0 0 1 20 20" stroke="#7c6aff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ progress }) {
  return (
    <div className="w-full bg-forge-border rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c6aff, #a78bfa)' }}
      />
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [file,        setFile]     = useState(null)
  const [dragging,    setDragging] = useState(false)
  const [status,      setStatus]   = useState('idle')
  const [progress,    setProgress] = useState(0)
  const [stems,       setStems]    = useState(null)
  const [zipUrl,      setZipUrl]   = useState(null)
  const [errorMsg,    setErrorMsg] = useState('')

  const inputRef      = useRef(null)
  const progressTimer = useRef(null)

  const validateFile = (f) => {
    if (!f) return 'No file selected.'
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['mp3', 'wav'].includes(ext)) return 'Only MP3 and WAV files are supported.'
    if (f.size > 20 * 1024 * 1024) return 'File must be under 20 MB.'
    return null
  }

  const pickFile = (f) => {
    const err = validateFile(f)
    if (err) { setErrorMsg(err); return }
    setFile(f)
    setErrorMsg('')
    setStatus('idle')
    setStems(null)
    setZipUrl(null)
  }

  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true)  }, [])
  const onDragLeave = useCallback((e) => { e.preventDefault(); setDragging(false) }, [])
  const onDrop      = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files[0])
  }, [])

  const startProgress = () => {
    setProgress(0)
    let p = 0
    progressTimer.current = setInterval(() => {
      p += p < 80 ? Math.random() * 4 + 1 : 0.3
      if (p >= 95) p = 95
      setProgress(Math.min(p, 95))
    }, 400)
  }

  const finishProgress = () => {
    clearInterval(progressTimer.current)
    setProgress(100)
  }

  const handleSeparate = async () => {
    if (!file || status === 'processing') return
    setStatus('processing')
    setErrorMsg('')
    setStems(null)
    startProgress()

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/separate', { method: 'POST', body: formData })
      finishProgress()
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.detail || `Server error: ${res.status}`)
      }
      const data = await res.json()
      setStems(data.stems)
      setZipUrl(data.zip_url)
      setStatus('done')
    } catch (err) {
      clearInterval(progressTimer.current)
      setErrorMsg(err.message || 'Something went wrong. Is the backend running?')
      setStatus('error')
      setProgress(0)
    }
  }

  const handleZipDownload = async () => {
    const fullUrl = `http://localhost:8000${zipUrl}`
    try {
      const res = await fetch(fullUrl)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'stems.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    } catch {
      const a = document.createElement('a')
      a.href = fullUrl
      a.download = 'stems.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  // Reset everything and open the file picker
  const uploadNew = (e) => {
    e.stopPropagation()
    setFile(null)
    setStatus('idle')
    setStems(null)
    setZipUrl(null)
    setErrorMsg('')
    setProgress(0)
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.click()
    }
  }

  const isProcessing = status === 'processing'

  return (
    <div className="min-h-screen bg-forge-bg text-forge-text flex flex-col" style={{ fontFamily: UNIVERS }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-forge-border px-6 py-4 flex items-center">
        <span className="text-lg tracking-tight" style={{ fontFamily: UNIVERS, fontWeight: 300 }}>
          StemCells
        </span>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 flex flex-col gap-10">

        {/* Hero */}
        <div className="text-center flex flex-col gap-3">
          <h1 className="text-4xl sm:text-5xl leading-tight" style={{ letterSpacing: '-0.02em', fontWeight: 300 }}>
            Split any track{' '}
            <span style={{ background: 'linear-gradient(135deg, #7c6aff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              into its stems
            </span>
          </h1>
          <p className="text-forge-muted text-sm max-w-lg mx-auto leading-relaxed" style={{ fontFamily: UNIVERS }}>
            Drag and drop an MP3 or WAV and we'll separate vocals, drums, bass, and melody. Then, throw the stems into your favourite DAW and start cooking tracks.
          </p>
        </div>

        {/* ── Upload zone ───────────────────────────────────────────────────── */}
        <div
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
            ${dragging ? 'drop-active' : 'border-forge-border hover:border-forge-dim'}
            ${isProcessing ? 'pointer-events-none opacity-50' : ''}
          `}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !isProcessing && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            className="hidden"
            onChange={(e) => pickFile(e.target.files[0])}
          />

          <div className="py-12 flex flex-col items-center gap-4 text-center px-6">
            <div className="text-forge-muted"><IconUpload /></div>

            {file ? (
              <>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-forge-text" style={{ fontWeight: 400 }}>{file.name}</p>
                  <p className="text-sm text-forge-muted">
                    {(file.size / 1e6).toFixed(2)} MB · {file.name.split('.').pop().toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={uploadNew}
                  className="text-xs px-3 py-1.5 rounded-lg border border-forge-border text-forge-muted hover:text-forge-text hover:border-forge-dim transition-all duration-150"
                  style={{ fontFamily: UNIVERS }}
                >
                  Upload new file
                </button>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 400 }}>Drop your audio file here</p>
                <p className="text-sm text-forge-muted">or click to browse · MP3 / WAV · max 20 MB</p>
              </>
            )}
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-red-400 text-sm animate-fade-up" style={{ fontFamily: UNIVERS }}>
            ⚠ {errorMsg}
          </div>
        )}

        {/* ── Separate button ───────────────────────────────────────────────── */}
        {status !== 'done' && (
          <button
            disabled={!file || isProcessing}
            onClick={handleSeparate}
            className="w-full py-4 rounded-xl text-base transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:brightness-110 enabled:active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #5b4adb, #7c6aff)', fontFamily: UNIVERS, fontWeight: 400 }}
          >
            {isProcessing ? 'Separating…' : 'Separate Stems'}
          </button>
        )}

        {/* ── Processing ────────────────────────────────────────────────────── */}
        {isProcessing && (
          <div className="flex flex-col items-center gap-6 py-4 animate-fade-up">
            <Spinner />
            <div className="w-full flex flex-col gap-2">
              <div className="flex justify-between text-xs text-forge-muted" style={{ fontFamily: UNIVERS }}>
                <span>Separating stems…</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <ProgressBar progress={progress} />
              <p className="text-center text-xs text-forge-muted mt-1" style={{ fontFamily: UNIVERS }}>
                This can take 30–120 s depending on file length & hardware
              </p>
            </div>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────────────── */}
        {status === 'done' && stems && (
          <div className="flex flex-col gap-6 animate-fade-up">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl" style={{ fontFamily: UNIVERS, fontWeight: 300 }}>Stems ready</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleZipDownload}
                  className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm bg-forge-surface border border-forge-border hover:border-forge-accent text-forge-text transition-all duration-200 cursor-pointer"
                  style={{ fontFamily: UNIVERS }}
                >
                  <IconZip />
                  Download All (.zip)
                </button>
                <button
                  onClick={uploadNew}
                  className="py-2 px-4 rounded-lg text-sm bg-forge-surface border border-forge-border hover:border-forge-dim text-forge-muted transition-all duration-200"
                  style={{ fontFamily: UNIVERS }}
                >
                  New File
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STEMS.map((stem, i) =>
                stems[stem.key] ? (
                  <div key={stem.key} className="animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
                    <StemCard stem={stem} url={stems[stem.key]} />
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
