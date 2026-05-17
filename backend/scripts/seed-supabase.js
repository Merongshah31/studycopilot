const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

function parseSubjects(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env')
  }

  const sourcePath = path.join(__dirname, '..', 'data', 'studypilot.json')
  const raw = fs.readFileSync(sourcePath, 'utf8')
  const source = JSON.parse(raw)

  const demoUser = (source.users || []).find((u) => u.email === 'user@gmail.com')
  if (!demoUser) throw new Error('Demo user user@gmail.com not found in backend/data/studypilot.json')

  const demoTasks = (source.tasks || []).filter((t) => t.userId === demoUser.id)
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const userRow = {
    id: demoUser.id,
    name: demoUser.name || 'Demo Student',
    email: demoUser.email,
    password: demoUser.password || '',
    course: demoUser.course || '',
    subjects: parseSubjects(demoUser.subjects),
    provider: demoUser.provider || '',
    provider_id: demoUser.providerId || '',
    created_at: demoUser.createdAt || new Date().toISOString(),
  }

  const { error: userError } = await supabase.from('users').upsert(userRow, { onConflict: 'id' })
  if (userError) throw new Error(`User seed failed: ${userError.message}`)

  if (demoTasks.length > 0) {
    const taskRows = demoTasks.map((task) => ({
      id: task.id,
      user_id: task.userId,
      title: task.title || 'Untitled task',
      deadline: task.deadline || null,
      priority: task.priority || 'low',
      completed: !!task.completed,
      created_at: task.createdAt || new Date().toISOString(),
    }))
    const { error: taskError } = await supabase.from('tasks').upsert(taskRows, { onConflict: 'id' })
    if (taskError) throw new Error(`Task seed failed: ${taskError.message}`)
  }

  const { count: totalTasks, error: countError } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', demoUser.id)
  if (countError) throw new Error(`Count check failed: ${countError.message}`)

  console.log(`Seed success: ${demoUser.email} with ${totalTasks || 0} tasks.`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
