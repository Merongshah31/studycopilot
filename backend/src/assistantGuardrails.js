const POLICY_VERSION = '1.0.0'

const BLOCK_PATTERNS = [
  /how to (kill|hurt|harm) someone/i,
  /\bself-harm\b/i,
  /\bsuicide\b/i,
  /\bphishing\b/i,
  /\bransomware\b/i,
  /\bsteal\b.*\b(account|password|data)\b/i,
]

const REVIEW_PATTERNS = [
  /\bpanic\b/i,
  /\boverwhelmed\b/i,
  /\bdepressed\b/i,
  /\banxious\b/i,
  /\bmedical\b/i,
  /\blegal\b/i,
  /\bexam cheat|cheating\b/i,
]

function normalizeText(value) {
  return String(value || '').trim()
}

function checkUserInputSafety(inputText) {
  const text = normalizeText(inputText)
  if (!text) {
    return { action: 'allow', reason: 'empty_input', policyVersion: POLICY_VERSION }
  }

  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(text)) {
      return { action: 'block', reason: 'blocked_pattern', policyVersion: POLICY_VERSION }
    }
  }

  for (const pattern of REVIEW_PATTERNS) {
    if (pattern.test(text)) {
      return { action: 'review', reason: 'sensitive_pattern', policyVersion: POLICY_VERSION }
    }
  }

  return { action: 'allow', reason: 'clean_input', policyVersion: POLICY_VERSION }
}

function refusalMessage() {
  return 'I can’t help with that request. I can help with a safe study-focused alternative.'
}

function fallbackStudySupport(inputText) {
  const text = normalizeText(inputText)
  const intro = text ? 'Let us reset with one small step.' : 'Let us start with one small step.'
  return [
    intro,
    '1) Choose one task you can finish in 20-30 minutes.',
    '2) Set a timer and start now.',
    '3) After that, we can plan your next two tasks together.',
  ].join('\n')
}

function postProcessAssistantText(outputText, options = {}) {
  const text = normalizeText(outputText)
  const trimmed = text || 'I can help you with a practical study plan. Tell me your top priority today.'

  if (options.mode === 'review') {
    return `${trimmed}\n\nIf this feels overwhelming, consider reaching out to a trusted person or a qualified professional for support.`
  }

  return trimmed
}

function buildSystemGuardrailAppendix() {
  return [
    'Nexa guardrails:',
    '- Be supportive, concise, and actionable.',
    '- Do not provide harmful, illegal, or cheating instructions.',
    '- Do not fabricate facts or deadlines.',
    '- If context is missing, ask one short clarifying question.',
  ].join('\n')
}

module.exports = {
  POLICY_VERSION,
  checkUserInputSafety,
  refusalMessage,
  fallbackStudySupport,
  postProcessAssistantText,
  buildSystemGuardrailAppendix,
}

