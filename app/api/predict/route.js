export async function POST(req) {
  const { apiKey, modelVersion, prompt } = await req.json()

  const resp = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: modelVersion,
      input: {
        prompt,
        num_outputs: 1,
        guidance_scale: 3.5,
        num_inference_steps: 28,
        lora_scale: 0.8,
      },
    }),
  })

  const data = await resp.json()
  if (!resp.ok) return Response.json({ error: JSON.stringify(data) }, { status: 400 })
  return Response.json(data)
}
