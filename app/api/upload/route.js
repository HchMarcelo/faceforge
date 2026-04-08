export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url)
    const apiKey = searchParams.get('apiKey')

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file) {
      return Response.json({ error: 'Nenhum arquivo recebido' }, { status: 400 })
    }

    const uploadForm = new FormData()
    uploadForm.append('content', file, 'training_images.zip')

    const resp = await fetch('https://api.replicate.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadForm,
    })

    const text = await resp.text()

    let data
    try {
      data = JSON.parse(text)
    } catch {
      return Response.json({ error: `Replicate retornou: ${text.substring(0, 200)}` }, { status: 500 })
    }

    if (!resp.ok) {
      return Response.json({ error: JSON.stringify(data) }, { status: 400 })
    }

    return Response.json({ url: data.urls.get })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 60

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}
