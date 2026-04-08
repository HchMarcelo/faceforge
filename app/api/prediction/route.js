export async function POST(req) {
  const { apiKey, predictionId } = await req.json()
  const resp = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const data = await resp.json()
  if (!resp.ok) return Response.json({ error: JSON.stringify(data) }, { status: 400 })
  return Response.json(data)
}
