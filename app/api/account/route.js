export async function POST(req) {
  const { apiKey } = await req.json()
  const resp = await fetch('https://api.replicate.com/v1/account', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!resp.ok) return Response.json({ error: 'API key inválida' }, { status: 401 })
  const data = await resp.json()
  return Response.json({ username: data.username })
}
