const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const authRouter = require('./routes/auth')
const tasksRouter = require('./routes/tasks')
const usersRouter = require('./routes/users')
const plannerRouter = require('./routes/planner')
const analyticsRouter = require('./routes/analytics')
const aiRouter = require('./routes/ai')
const assistantRouter = require('./routes/assistant')
const calendarRouter = require('./routes/calendar')
const agentRouter = require('./routes/agent')
const scheduleImportRouter = require('./routes/scheduleImport')

const app = express()
app.use(cors())
app.use(express.json({ limit: '20mb' }))

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON body' })
  }
  return next(err)
})

app.get('/', (req, res) => res.json({ message: 'StudyCopilot API', status: 'running' }))
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/users', usersRouter)
app.use('/api/planner', plannerRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/assistant', assistantRouter)
app.use('/api/calendar', calendarRouter)
app.use('/api/agent', agentRouter)
app.use('/api/schedule-import', scheduleImportRouter)

module.exports = app

if (require.main === module) {
  const PORT = process.env.PORT || 5050
  const server = app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the existing backend or change PORT in backend/.env.`)
      process.exit(1)
    }
    throw error
  })
}
