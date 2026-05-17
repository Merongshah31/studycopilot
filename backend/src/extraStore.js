const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
const extraPath = path.join(dataDir, 'studypilot-extra.json')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

function baseState() {
  return {
    sessions: [],
    chats: [],
    chatMessages: [],
  }
}

function readExtraStore() {
  if (!fs.existsSync(extraPath)) return baseState()
  try {
    const parsed = JSON.parse(fs.readFileSync(extraPath, 'utf8'))
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
    }
  } catch {
    return baseState()
  }
}

function writeExtraStore(state) {
  fs.writeFileSync(extraPath, JSON.stringify(state, null, 2), 'utf8')
}

module.exports = { readExtraStore, writeExtraStore }

