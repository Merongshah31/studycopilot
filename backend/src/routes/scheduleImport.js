const express = require('express')
const { v4: uuidv4 } = require('uuid')
const authMiddleware = require('../middleware/auth')
const { getSupabaseServerClient } = require('../supabase')
const { importTasksFromItems } = require('../agents/taskExecutor')
const { extractScheduleWithNode } = require('../services/nodeScheduleExtractor')

const router = express.Router()
router.use(authMiddleware)

function priorityFromCourse(course) {
  const text = `${course?.course_name || ''} ${course?.course_code || ''}`.toLowerCase()
  if (/(final|exam|project|capstone)/.test(text)) return 'high'
  if (/(lab|assignment|report)/.test(text)) return 'medium'
  return 'low'
}

function toTaskItem(course) {
  const name = String(course?.course_name || course?.course_code || 'Untitled course').trim()
  const code = String(course?.course_code || '').trim()
  const days = Array.isArray(course?.days) ? course.days.filter(Boolean).join(', ') : ''
  const location = String(course?.location || '').trim()
  const time = String(course?.time || '').trim()
  return {
    source: 'pdf_schedule',
    title: code ? `${name} (${code})` : name,
    description: [
      code ? `Code: ${code}` : '',
      time ? `Time: ${time}` : '',
      days ? `Days: ${days}` : '',
      location ? `Location: ${location}` : '',
      course?.instructor ? `Instructor: ${course.instructor}` : '',
    ].filter(Boolean).join('\n'),
    deadline: null,
    priority: priorityFromCourse(course),
    raw: course,
  }
}

async function savePdfToSupabaseStorage(supabase, userId, fileName, fileBuffer) {
  const safeName = String(fileName || 'schedule.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')
  const objectPath = `${userId}/${Date.now()}-${uuidv4()}-${safeName}`
  const { error } = await supabase.storage.from('schedule-pdfs').upload(objectPath, fileBuffer, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return objectPath
}

router.post('/preview', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  try {
    const base64 = String(req.body?.fileDataBase64 || '')
    const fileName = String(req.body?.fileName || 'schedule.pdf')
    if (!base64) return res.status(400).json({ message: 'fileDataBase64 is required' })
    if (!/\.pdf$/i.test(fileName)) return res.status(400).json({ message: 'Only PDF files are supported' })

    const fileBuffer = Buffer.from(base64, 'base64')
    const storagePath = await savePdfToSupabaseStorage(supabase, req.user.id, fileName, fileBuffer)

    const courses = await extractScheduleWithNode({
      fileBuffer,
      deepseekUrl: process.env.DEEPSEEK_API_URL,
      deepseekKey: process.env.DEEPSEEK_API_KEY,
      deepseekModel: process.env.DEEPSEEK_MODEL,
    })

    const previewItems = courses.map(toTaskItem)
    const importId = uuidv4()
    const { error: insertError } = await supabase.from('schedule_imports').insert({
      id: importId,
      user_id: req.user.id,
      file_name: fileName,
      storage_path: storagePath,
      status: 'previewed',
      total_items: previewItems.length,
      inserted_count: 0,
      skipped_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (insertError) return res.status(500).json({ message: `Failed to save import metadata: ${insertError.message}` })

    return res.json({
      importId,
      sourceFile: fileName,
      storagePath,
      totalCourses: courses.length,
      previewItems,
    })
  } catch (error) {
    console.error('[schedule-import/preview] error:', error)
    return res.status(500).json({ message: `Failed to preview schedule import: ${error.message}` })
  }
})

router.post('/confirm', async (req, res) => {
  const supabase = getSupabaseServerClient()
  if (!supabase) return res.status(500).json({ message: 'Supabase is not configured on backend' })
  try {
    const importId = String(req.body?.importId || '').trim()
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (items.length === 0) return res.status(400).json({ message: 'No items selected for import' })
    const result = await importTasksFromItems(supabase, req.user.id, items)
    if (importId) {
      await supabase
        .from('schedule_imports')
        .update({
          status: 'imported',
          inserted_count: result.inserted || 0,
          skipped_count: result.skipped || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', importId)
        .eq('user_id', req.user.id)
    }

    return res.json({
      inserted: result.inserted || 0,
      skipped: result.skipped || 0,
      ui_events: result.ui_events || ['TASKS_UPDATED'],
      message: result.message || 'Import completed.',
    })
  } catch (error) {
    console.error('[schedule-import/confirm] error:', error)
    return res.status(500).json({ message: `Failed to confirm schedule import: ${error.message}` })
  }
})

module.exports = router
