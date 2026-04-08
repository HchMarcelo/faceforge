export async function POST(req) {
  const { apiKey } = Object.fromEntries(new URL(req.url).searchParams)
  const formData = await req.formData()
  const file = formData.get('file')

  const uploadForm = new FormData()
  uploadForm.append('content', file, 'training_images.zip')

  const resp = await fetch('https://api.replicate.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: uploadForm,
  })

  const data = await resp.json()
  if (!resp.ok) return Response.json({ error: JSON.stringify(data) }, { status: 400 })
  return Response.json({ url: data.urls.get })
}

export const runtime = 'nodejs'
export const maxDuration = 60
