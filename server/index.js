import express from 'express'
import fetch from 'node-fetch'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const HF_KEY = process.env.HF_API_KEY
const HF_MODEL = process.env.HF_MODEL || 'google/flan-t5-large'
const PORT = process.env.PORT || 4321

if (!HF_KEY) {
  console.warn('Warning: HF_API_KEY is not set. The /api/ai endpoint will return an error until you set it in the environment.')
}

app.post('/api/ai', async (req, res) => {
  try {
    const { prompt, maxTokens = 256 } = req.body
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing prompt' })
    if (!HF_KEY) return res.status(500).json({ error: 'HF_API_KEY not configured on server' })

    const url = `https://api-inference.huggingface.co/models/${HF_MODEL}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: maxTokens } })
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({ error: 'Model error', detail: text })
    }

    const data = await response.json()
    // Hugging Face may return array or object. Try to extract text.
    let text = ''
    if (Array.isArray(data)) {
      if (data[0] && data[0].generated_text) text = data[0].generated_text
      else if (typeof data[0] === 'string') text = data.join('\n')
      else text = JSON.stringify(data)
    } else if (data.generated_text) text = data.generated_text
    else if (data.error) return res.status(500).json({ error: data.error })
    else text = JSON.stringify(data)

    return res.json({ text })
  } catch (err) {
    console.error('AI proxy error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

app.listen(PORT, () => console.log(`AI proxy listening on http://localhost:${PORT} (model=${HF_MODEL})`))
