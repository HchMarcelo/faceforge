export async function POST(req) {
  const { apiKey, username, modelName, zipUrl } = await req.json()

  const resp = await fetch('https://api.replicate.com/v1/trainings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'ostris/flux-dev-lora-trainer:4ffd32160efd92e956d39c5338a9b8fbafca58e03f791f6d8011f3e20e8ea6fa',
      input: {
        steps: 1000,
        lora_rank: 16,
        optimizer: 'adamw8bit',
        batch_size: 1,
        resolution: '512,768,1024',
        autocaption: true,
        input_images: zipUrl,
        trigger_word: 'TOK',
        learning_rate: 0.0004,
      },
      destination: `${username}/${modelName}`,
    }),
  })

  const data = await resp.json()
  if (!resp.ok) return Response.json({ error: JSON.stringify(data) }, { status: 400 })
  return Response.json(data)
}
