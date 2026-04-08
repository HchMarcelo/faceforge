'use client'
import { useState, useRef } from 'react'
import styles from './page.module.css'

export default function Home() {
  const [step, setStep] = useState(1)
  const [apiKey, setApiKey] = useState('')
  const [username, setUsername] = useState('')
  const [photos, setPhotos] = useState([])
  const [logs, setLogs] = useState([])
  const [trainStatus, setTrainStatus] = useState('Aguardando...')
  const [loraVersion, setLoraVersion] = useState('')
  const [prompt, setPrompt] = useState('a photo of TOK person, natural expression, soft lighting, sharp focus, photorealistic')
  const [fixPhoto, setFixPhoto] = useState(null)
  const [resultUrl, setResultUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDrag, setIsDrag] = useState(false)
  const pollRef = useRef(null)

  const addLog = (msg, type = '') => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(l => [...l, { time, msg, type }])
  }

  // ── STEP 1: Validate Key ──────────────────────────
  async function validateKey() {
    if (!apiKey.trim()) { setError('Cole sua API key do Replicate.'); return }
    setError(''); setLoading(true)
    try {
      const r = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setUsername(d.username)
      setStep(2)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  // ── STEP 2: Photos ────────────────────────────────
  function handleFiles(files) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    arr.forEach(file => {
      if (photos.length >= 20) return
      const reader = new FileReader()
      reader.onload = e => setPhotos(p => p.length < 20 ? [...p, { file, b64: e.target.result }] : p)
      reader.readAsDataURL(file)
    })
  }

  // ── STEP 3: Train ─────────────────────────────────
  async function startTraining() {
    if (photos.length < 10) { setError(`Mínimo 10 fotos (você tem ${photos.length}).`); return }
    setError(''); setStep(3); setLogs([])
    try {
      // 1. Create ZIP
      addLog('Comprimindo imagens em ZIP...')
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      photos.forEach((p, i) => {
        const ext = p.file.type.split('/')[1] || 'jpg'
        zip.file(`photo_${String(i+1).padStart(3,'0')}.${ext}`, p.b64.split(',')[1], { base64: true })
      })
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      addLog(`ZIP criado: ${(zipBlob.size/1024).toFixed(0)} KB`)

      // 2. Create model
      addLog('Criando modelo privado...', 'info')
      const modelName = `faceforge-${Date.now()}`
      const mr = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, username, modelName }),
      })
      const md = await mr.json()
      if (!mr.ok) throw new Error(md.error)
      addLog(`Modelo criado: ${username}/${modelName}`, 'ok')

      // 3. Upload ZIP
      addLog('Enviando imagens para o Replicate...', 'info')
      setTrainStatus('Enviando imagens...')
      // Upload direto do browser para o Replicate
const uploadForm = new FormData()
uploadForm.append('content', zipBlob, 'training_images.zip')

const ur = await fetch('https://api.replicate.com/v1/files', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}` },
  body: uploadForm,
})
const ud = await ur.json()
if (!ur.ok) throw new Error(JSON.stringify(ud))
addLog('Upload concluído.', 'ok')

      // 4. Start training
      addLog('Iniciando FLUX LoRA trainer...', 'info')
      setTrainStatus('Treinando... (20–30 min)')
      const tr = await fetch('/api/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, username, modelName, zipUrl: ud.url }),
      })
      const td = await tr.json()
      if (!tr.ok) throw new Error(td.error)
      addLog(`Treino iniciado. ID: ${td.id}`, 'ok')

      // 5. Poll
      pollRef.current = setInterval(async () => {
        const pr = await fetch('/api/training', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, trainingId: td.id }),
        })
        const pd = await pr.json()
        if (pd.status === 'succeeded') {
          clearInterval(pollRef.current)
          const version = pd.output?.version || `${username}/${modelName}`
          setLoraVersion(version)
          setTrainStatus('Concluído!')
          addLog('Modelo treinado com sucesso!', 'ok')
        }
        if (pd.status === 'failed') {
          clearInterval(pollRef.current)
          setTrainStatus('Falhou.')
          addLog(pd.error || 'Treino falhou.', 'err')
        }
        if (pd.logs) {
          const lines = pd.logs.split('\n').filter(Boolean).slice(-2)
          lines.forEach(l => addLog(l))
        }
      }, 8000)

    } catch (e) {
      setError(e.message)
      addLog(e.message, 'err')
      setTrainStatus('Erro.')
    }
  }

  // ── STEP 4: Fix Photo ─────────────────────────────
  async function runFix() {
    const version = loraVersion.trim()
    if (!version) { setError('Cole o ID do modelo treinado.'); return }
    if (!fixPhoto) { setError('Selecione uma foto para corrigir.'); return }
    setError(''); setLoading(true); setResultUrl('')

    try {
      const pr = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, modelVersion: version, prompt }),
      })
      const pd = await pr.json()
      if (!pr.ok) throw new Error(pd.error)

      // Poll prediction
      const interval = setInterval(async () => {
        const sr = await fetch('/api/prediction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, predictionId: pd.id }),
        })
        const sd = await sr.json()
        if (sd.status === 'succeeded') {
          clearInterval(interval)
          setResultUrl(Array.isArray(sd.output) ? sd.output[0] : sd.output)
          setLoading(false)
        }
        if (sd.status === 'failed') {
          clearInterval(interval)
          setError(sd.error || 'Geração falhou.')
          setLoading(false)
        }
      }, 3000)

    } catch (e) { setError(e.message); setLoading(false) }
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.logo}>Face<span>Forge</span></div>
        <div className={styles.badge}>Replicate · FLUX LoRA</div>
      </header>

      <main className={styles.container}>
        <div className={styles.intro}>
          <h1 className={styles.h1}>Seu rosto,<br /><em>sempre perfeito</em></h1>
          <p className={styles.subtitle}>Treina um modelo pessoal com suas fotos via Replicate. Qualidade máxima com FLUX LoRA.</p>
        </div>

        {/* STEPS */}
        <div className={styles.steps}>
          {['API Key','Suas Fotos','Treino','Corrigir'].map((label, i) => (
            <div key={i} className={`${styles.step} ${step === i+1 ? styles.active : ''} ${step > i+1 ? styles.done : ''}`}>
              <div className={styles.stepNum}>{step > i+1 ? '✓' : i+1}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* ── PANEL 1 ── */}
        {step === 1 && (
          <div className={styles.panel}>
            <div className={styles.panelLabel}>// Configuração</div>
            <div className={styles.infoBox}>
              <strong>Como obter sua API Key:</strong><br />
              1. Acesse <a href="https://replicate.com/account/api-tokens" target="_blank">replicate.com/account/api-tokens</a><br />
              2. Copie o token que começa com <strong>r8_</strong>
            </div>
            <div className={styles.field}>
              <label>Replicate API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            </div>
            {error && <div className={styles.errorBox}>⚠ {error}</div>}
            <div className={styles.btnRow}>
              <button className={styles.btnPrimary} onClick={validateKey} disabled={loading}>
                {loading ? 'Verificando...' : 'Continuar →'}
              </button>
            </div>
          </div>
        )}

        {/* ── PANEL 2 ── */}
        {step === 2 && (
          <div className={styles.panel}>
            <div className={styles.panelLabel}>// Upload das fotos de referência</div>
            <div className={styles.infoBox}>
              · Entre <strong>10 e 20 fotos</strong> onde você gosta do resultado<br />
              · Variedade de ângulos, iluminações e expressões<br />
              · Quanto maior a resolução, melhor o resultado
            </div>
            <div
              className={`${styles.uploadZone} ${isDrag ? styles.drag : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDrag(true) }}
              onDragLeave={() => setIsDrag(false)}
              onDrop={e => { e.preventDefault(); setIsDrag(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => document.getElementById('fileInput').click()}
            >
              <input id="fileInput" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
              <div className={styles.uploadIcon}>⬚</div>
              <div className={styles.uploadTitle}>Arraste ou clique para selecionar</div>
              <div className={styles.uploadSub}>JPG · PNG · WEBP</div>
            </div>
            {photos.length > 0 && (
              <>
                <p className={styles.photoCount}><span>{photos.length}</span> fotos — mínimo 10, máximo 20</p>
                <div className={styles.photoGrid}>
                  {photos.map((p, i) => (
                    <div key={i} className={styles.photoThumb}>
                      <img src={p.b64} alt="" />
                      <button className={styles.removeBtn} onClick={() => setPhotos(ps => ps.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {error && <div className={styles.errorBox}>⚠ {error}</div>}
            <div className={styles.btnRow}>
              <button className={styles.btnGhost} onClick={() => setStep(1)}>← Voltar</button>
              <button className={styles.btnPrimary} onClick={startTraining} disabled={photos.length < 10}>
                Treinar modelo →
              </button>
            </div>
          </div>
        )}

        {/* ── PANEL 3 ── */}
        {step === 3 && (
          <div className={styles.panel}>
            <div className={styles.panelLabel}>// Treinando seu modelo pessoal</div>
            <div className={styles.progressBlock}>
              <div className={styles.progressLabel}>
                <span className={styles.statusRow}><span className={styles.dot} />  {trainStatus}</span>
              </div>
              <div className={styles.progressBar}><div className={`${styles.progressFill} ${styles.indeterminate}`} /></div>
              <div className={styles.logBox}>
                {logs.map((l, i) => (
                  <div key={i} className={styles.logLine}>
                    <span className={styles.logTime}>{l.time}</span>
                    <span className={`${styles.logMsg} ${l.type === 'ok' ? styles.ok : l.type === 'err' ? styles.err : l.type === 'info' ? styles.info : ''}`}>{l.msg}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className={styles.hint}>O treino leva <strong>20–30 minutos</strong> e custa ~$1.80. Deixe a aba aberta.</p>
            {error && <div className={styles.errorBox}>⚠ {error}</div>}
            {loraVersion && (
              <>
                <div className={styles.successBlock}>
                  <div className={styles.successLabel}>✓ Modelo treinado</div>
                  <div className={styles.successValue}>{loraVersion}</div>
                </div>
                <div className={styles.btnRow}>
                  <button className={styles.btnPrimary} onClick={() => setStep(4)}>Corrigir uma foto →</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PANEL 4 ── */}
        {step === 4 && (
          <div className={styles.panel}>
            <div className={styles.panelLabel}>// Corrigir uma foto</div>
            <div className={styles.field}>
              <label>ID do modelo treinado</label>
              <input type="text" value={loraVersion} onChange={e => setLoraVersion(e.target.value)} placeholder="owner/model-name:version-hash" />
            </div>
            <div className={styles.field}>
              <label>Prompt</label>
              <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)} />
            </div>
            <div className={styles.uploadZone} style={{ padding: '20px' }} onClick={() => document.getElementById('fixInput').click()}>
              <input id="fixInput" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                const f = e.target.files[0]
                if (!f) return
                const r = new FileReader()
                r.onload = ev => setFixPhoto(ev.target.result)
                r.readAsDataURL(f)
              }} />
              {fixPhoto
                ? <img src={fixPhoto} alt="Foto selecionada" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                : <><div className={styles.uploadIcon} style={{ fontSize: '22px', marginBottom: '8px' }}>⬚</div><div className={styles.uploadTitle} style={{ fontSize: '16px' }}>Selecione a foto para corrigir</div></>
              }
            </div>
            {error && <div className={styles.errorBox}>⚠ {error}</div>}
            <div className={styles.btnRow}>
              <button className={styles.btnGhost} onClick={() => setStep(3)}>← Voltar</button>
              <button className={styles.btnPrimary} onClick={runFix} disabled={loading || !fixPhoto}>
                {loading ? 'Gerando...' : 'Corrigir →'}
              </button>
            </div>
            {resultUrl && (
              <div className={styles.resultGrid}>
                <div className={styles.resultCard}>
                  <div className={styles.resultLabel}>Original</div>
                  <img src={fixPhoto} alt="Original" />
                </div>
                <div className={styles.resultCard}>
                  <div className={styles.resultLabel}>Corrigida</div>
                  <img src={resultUrl} alt="Resultado" className={styles.resultEnhanced} />
                </div>
                <div className={styles.btnRow} style={{ gridColumn: '1/-1' }}>
                  <a href={resultUrl} download="faceforge.jpg" target="_blank" className={styles.btnPrimary}>↓ Baixar</a>
                  <button className={styles.btnGhost} onClick={() => { setFixPhoto(null); setResultUrl('') }}>Corrigir outra →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
