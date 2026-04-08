export async function POST(req) {
  const { apiKey, username, modelName } = await req.json()
  const resp = await fetch('https://api.replicate.com/v1/models', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      owner: username,
      name: modelName,
      visibility: 'private',
      hardware: 'gpu-t4',
      description: 'FaceForge personal LoRA',
    }),
  })
  const data = await resp.json()
  if (!resp.ok) return Response.json({ error: JSON.stringify(data) }, { status: 400 })
  return Response.json(data)
}
