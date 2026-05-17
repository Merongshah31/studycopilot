const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
const dbPath = process.env.STORE_PATH || path.join(dataDir, 'studypilot.json')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

function readStore() {
  if (!fs.existsSync(dbPath)) {
    return { users: [], tasks: [] }
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  } catch {
    return { users: [], tasks: [] }
  }
}

function writeStore(store) {
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), 'utf8')
}

function parseSubjects(subjects) {
  if (Array.isArray(subjects)) return subjects
  if (!subjects) return []
  try {
    return JSON.parse(subjects)
  } catch {
    return []
  }
}

const db = {
  prepare(sql) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()

    return {
      get(...args) {
        const store = readStore()

        if (normalized.includes('from users where email = ?')) {
          return store.users.find((user) => user.email === args[0]) || undefined
        }
        if (normalized.includes('from users where provider = ? and providerid = ?')) {
          const [provider, providerId] = args
          return store.users.find((user) => user.provider === provider && user.providerId === providerId) || undefined
        }
        if (normalized.includes('from users where id = ?')) {
          return store.users.find((user) => user.id === args[0]) || undefined
        }
        if (normalized.includes('from tasks where id = ? and userid = ?')) {
          const [id, userId] = args
          return store.tasks.find((task) => task.id === id && task.userId === userId) || undefined
        }
        if (normalized.includes('from tasks where id = ?')) {
          return store.tasks.find((task) => task.id === args[0]) || undefined
        }
        return undefined
      },

      all(...args) {
        const store = readStore()
        if (normalized.includes('from tasks where userid = ?')) {
          return store.tasks
            .filter((task) => task.userId === args[0])
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        }
        return []
      },

      run(...args) {
        const store = readStore()

        if (normalized.startsWith('insert into users')) {
          const [id, name, email, password, course, subjects, provider, providerId, createdAt] = args
          const user = {
            id,
            name,
            email,
            password,
            course,
            subjects: parseSubjects(subjects),
            provider: provider || '',
            providerId: providerId || '',
            createdAt,
          }
          store.users = store.users.filter((row) => row.id !== id && row.email !== email)
          store.users.push(user)
          writeStore(store)
          return { changes: 1 }
        }

        if (normalized.startsWith('update users set provider = ?, providerid = ? where id = ?')) {
          const [provider, providerId, id] = args
          const user = store.users.find((row) => row.id === id)
          if (!user) return { changes: 0 }
          user.provider = provider
          user.providerId = providerId
          writeStore(store)
          return { changes: 1 }
        }

        if (normalized.startsWith('update users set name = ?')) {
          const [name, email, password, course, subjects, id] = args
          const user = store.users.find((row) => row.id === id)
          if (!user) return { changes: 0 }
          user.name = name
          user.email = email
          user.password = password
          user.course = course
          user.subjects = parseSubjects(subjects)
          writeStore(store)
          return { changes: 1 }
        }

        if (normalized.startsWith('insert into tasks')) {
          const [id, userId, title, deadline, priority, completed, createdAt] = args
          store.tasks.unshift({
            id,
            userId,
            title,
            deadline,
            priority,
            completed: Number(completed) ? 1 : 0,
            createdAt,
          })
          writeStore(store)
          return { changes: 1 }
        }

        if (normalized.startsWith('update tasks set title = ?, deadline = ?, priority = ?, completed = ? where id = ?')) {
          const [title, deadline, priority, completed, id] = args
          const task = store.tasks.find((row) => row.id === id)
          if (!task) return { changes: 0 }
          task.title = title
          task.deadline = deadline
          task.priority = priority
          task.completed = Number(completed) ? 1 : 0
          writeStore(store)
          return { changes: 1 }
        }

        if (normalized.startsWith('delete from tasks where id = ? and userid = ?')) {
          const [id, userId] = args
          const initial = store.tasks.length
          store.tasks = store.tasks.filter((task) => !(task.id === id && task.userId === userId))
          writeStore(store)
          return { changes: initial - store.tasks.length }
        }

        return { changes: 0 }
      },
    }
  },
}

module.exports = db

