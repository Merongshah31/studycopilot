const { google } = require('googleapis')

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5050/api/calendar/callback'
  )
}

function buildOAuthUrl(state) {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    state,
  })
}

async function exchangeCode(code) {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

function createAuthenticatedClient(tokens) {
  const client = createOAuthClient()
  client.setCredentials(tokens)
  return client
}

async function listEvents(tokens, timeMin, timeMax) {
  const auth = createAuthenticatedClient(tokens)
  const calendar = google.calendar({ version: 'v3', auth })
  const result = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  })
  return result.data.items || []
}

module.exports = {
  buildOAuthUrl,
  exchangeCode,
  listEvents,
}
