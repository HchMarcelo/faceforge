export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url)
    const apiKey = searchParams.get('apiKey')
    const { zipBase64, filename } = await req.json()

    const zipBuffer = Buffer.from(zipBase64, 'base64')
    const blob = new Blob([zipBuffer], { type: 'application/zip' })

    const uploadForm = new FormData()
    uploadForm.append('content', blob, filename)

    const resp = await fetch('https://api.replicate.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadForm,
    })

    const text = await resp.text()
    let data
    try { data = JSON.parse(text) }
    catch { return Response.json({ error: text.substring(0, 300) }, { status: 500 }) }

    if (!resp.ok) return Response.json({ error: JSON.stringify(data) }, { status: 400 })
    return Response.json({ url: data.urls.get })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 60
