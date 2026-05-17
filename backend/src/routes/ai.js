const express = require('express')
const authMiddleware = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

function extractText(data) {
  const text = data?.choices?.[0]?.message?.content
  if (typeof text === 'string' && text.trim()) return text
  if (Array.isArray(data?.content)) {
    const joined = data.content.filter((x) => x?.type === 'text').map((x) => x.text || '').join('\n').trim()
    if (joined) return joined
  }
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text
  return ''
}

async function callProvider(url, key, messages) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages }),
  })
  const raw = await res.text()
  let data = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = {}
  }
  return { res, raw, data }
}

router.post('/chat', async (req, res) => {
  const { messages } = req.body || {}
  if (!messages) return res.status(400).json({ message: 'messages required' })
  const url = process.env.DEEPSEEK_API_URL
  const key = process.env.DEEPSEEK_API_KEY

  if (!url || !key) {
    return res.json({
      choices: [{ message: { content: 'AI provider is not configured yet.' } }],
    })
  }

  try {
    let { res: providerRes, raw, data } = await callProvider(url, key, messages)
    if (providerRes.status === 404) {
      ;({ res: providerRes, raw, data } = await callProvider('https://api.deepseek.com/chat/completions', key, messages))
    }
    if (!providerRes.ok || data?.error) {
      const providerMessage = data?.error?.message || raw || `Provider request failed (${providerRes.status})`
      return res.status(502).json({
        message: 'AI provider error',
        providerMessage,
        choices: [{ message: { content: `AI provider is currently unavailable: ${providerMessage}.` } }],
      })
    }
    const content = extractText(data) || 'I could not generate a response right now.'
    return res.json({ raw: data, choices: [{ message: { content } }] })
  } catch (error) {
    return res.status(500).json({ message: `AI request failed: ${error.message}` })
  }
})

module.exports = router

