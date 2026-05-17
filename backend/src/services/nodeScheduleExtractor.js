const pdfParse = require('pdf-parse')

function normalizeDays(daysRaw) {
  if (Array.isArray(daysRaw)) return daysRaw.map((d) => String(d || '').trim()).filter(Boolean)
  if (!daysRaw) return []
  return String(daysRaw)
    .split(/[,\s/]+/)
    .map((d) => d.trim())
    .filter(Boolean)
}

function safeCourse(raw) {
  const courseCode = String(raw?.course_code || '').trim()
  const courseName = String(raw?.course_name || courseCode || 'Untitled Course').trim()
  return {
    course_name: courseName,
    course_code: courseCode,
    time: String(raw?.time || '').trim(),
    days: normalizeDays(raw?.days),
    location: String(raw?.location || '').trim(),
    instructor: String(raw?.instructor || 'TBA').trim(),
    credits: Number(raw?.credits || 0) || 0,
    description: String(raw?.description || '').trim(),
  }
}

function extractJsonArray(text) {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return []
  const slice = text.slice(start, end + 1)
  const parsed = JSON.parse(slice)
  if (!Array.isArray(parsed)) return []
  return parsed.map(safeCourse)
}

async function extractScheduleWithNode({ fileBuffer, deepseekUrl, deepseekKey, deepseekModel }) {
  if (!deepseekUrl || !deepseekKey) {
    throw new Error('DeepSeek is not configured on backend')
  }

  let textContent = ''
  try {
    const parsed = await pdfParse(fileBuffer)
    textContent = String(parsed?.text || '').trim()
  } catch (error) {
    throw new Error(`PDF text extraction failed: ${error.message}`)
  }
  if (!textContent) throw new Error('PDF text extraction returned empty content')

  const prompt = [
    'Extract class schedule entries from this text.',
    'Return ONLY a JSON array with objects containing:',
    'course_name, course_code, time, days (array), location, instructor, credits, description.',
    'If missing, use defaults: instructor="TBA", credits=0, strings="", days=[].',
    '',
    'Schedule text:',
    textContent.slice(0, 32000),
  ].join('\n')

  const response = await fetch(deepseekUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deepseekKey}`,
    },
    body: JSON.stringify({
      model: deepseekModel || 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You output strict JSON only.' },
        {
          role: 'user',
          content: JSON.stringify({
            schema: {
              courses: [
                {
                  course_name: 'string',
                  course_code: 'string',
                  time: 'string',
                  days: ['string'],
                  location: 'string',
                  instructor: 'string',
                  credits: 0,
                  description: 'string',
                },
              ],
            },
            instruction: prompt,
          }),
        },
      ],
      temperature: 0.1,
    }),
  })

  const raw = await response.text()
  let data = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = {}
  }
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || raw || `DeepSeek request failed (${response.status})`)
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') throw new Error('DeepSeek returned empty extraction content')

  try {
    const parsedObject = JSON.parse(content)
    const list = Array.isArray(parsedObject?.courses) ? parsedObject.courses : []
    if (list.length > 0) return list.map(safeCourse)
  } catch {
    // fallback to array extraction below
  }

  const fallback = extractJsonArray(content)
  if (fallback.length === 0) throw new Error('Could not parse extracted schedule JSON')
  return fallback
}

module.exports = {
  extractScheduleWithNode,
}
