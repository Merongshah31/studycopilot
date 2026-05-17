function extractQuoted(text) {
  const m = String(text || '').match(/["“”](.+?)["“”]/)
  return m?.[1]?.trim() || ''
}

function extractDate(text) {
  const m = String(text || '').match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  return m?.[1] || null
}

function extractPriority(text) {
  const t = String(text || '').toLowerCase()
  if (/(high|urgent|tinggi)/.test(t)) return 'high'
  if (/(medium|sederhana)/.test(t)) return 'medium'
  if (/(low|rendah)/.test(t)) return 'low'
  return null
}

const INTENT_REGISTRY = [
  {
    intent: 'task_complete',
    confidence: 0.92,
    patterns: [/((complete|finish|done)\s+task|(siap|selesai|tamatkan)\s+tugas)/i],
    build: ({ quoted }) => ({
      requires_clarification: !quoted,
      clarification_question: quoted ? '' : 'Which task title should I mark complete?',
      plan_steps: quoted ? [{ step_id: 'task-1', agent: 'task', action: 'complete_by_title', payload: { title: quoted } }] : [],
    }),
  },
  {
    intent: 'task_create',
    confidence: 0.9,
    patterns: [/((add)\s+task|(tambah)\s+tugas)/i],
    build: ({ text, quoted, date, priority }) => {
      const title = quoted || text.replace(/^(add task|tambah tugas)\s*/i, '').trim()
      return {
        requires_clarification: !title,
        clarification_question: title ? '' : 'What task title should I create?',
        plan_steps: title ? [{ step_id: 'task-1', agent: 'task', action: 'create_task', payload: { title, deadline: date, priority: priority || 'medium' } }] : [],
      }
    },
  },
  {
    intent: 'task_reschedule',
    confidence: 0.88,
    patterns: [/((reschedule|move)\s+task|(jadual semula|pindah)\s+tugas)/i],
    build: ({ quoted, date }) => ({
      requires_clarification: !(quoted && date),
      clarification_question: quoted && date ? '' : 'Which task and date (YYYY-MM-DD) should I reschedule?',
      plan_steps: quoted && date ? [{ step_id: 'task-1', agent: 'task', action: 'reschedule_by_title', payload: { title: quoted, deadline: date } }] : [],
    }),
  },
  {
    intent: 'task_priority_update',
    confidence: 0.88,
    patterns: [/((set|change)\s+priority|(tetapkan|tukar)\s+keutamaan)/i],
    build: ({ quoted, priority }) => ({
      requires_clarification: !(quoted && priority),
      clarification_question: quoted && priority ? '' : 'Which task and priority (high/medium/low) should I set?',
      plan_steps: quoted && priority ? [{ step_id: 'task-1', agent: 'task', action: 'set_priority_by_title', payload: { title: quoted, priority } }] : [],
    }),
  },
  {
    intent: 'calendar_create_event',
    confidence: 0.8,
    patterns: [/((create|add)\s+(calendar\s+)?event|(cipta|tambah)\s+(acara\s+)?kalendar)/i],
    build: ({ text }) => ({
      requires_clarification: false,
      clarification_question: '',
      plan_steps: [{ step_id: 'cal-1', agent: 'calendar', action: 'create_event', payload: { raw_text: text } }],
    }),
  },
  {
    intent: 'planner_generate',
    confidence: 0.86,
    patterns: [/((exam|final|quiz|revision)\s+(plan|planning|schedule))|((rancang|jadual).*(exam|peperiksaan|ulangkaji))/i],
    build: ({ text }) => ({
      requires_clarification: false,
      clarification_question: '',
      plan_steps: [{ step_id: 'planner-1', agent: 'planner', action: 'generate_exam_plan', payload: { raw_text: text } }],
    }),
  },
  {
    intent: 'schedule_management',
    confidence: 0.84,
    patterns: [/((schedule management)|(manage schedule)|atur jadual|urus jadual)/i],
    build: ({ text }) => ({
      requires_clarification: false,
      clarification_question: '',
      plan_steps: [{ step_id: 'planner-1', agent: 'planner', action: 'optimize_schedule', payload: { raw_text: text } }],
    }),
  },
  {
    intent: 'weekly_schedule_rebalance',
    confidence: 0.9,
    patterns: [/((reschedule|rearrange|rebalance).*(week|weekly))|((susun|jadualkan semula).*(minggu|mingguan))/i],
    build: ({ text }) => ({
      requires_clarification: false,
      clarification_question: '',
      plan_steps: [{ step_id: 'task-1', agent: 'task', action: 'rebalance_weekly_schedule', payload: { raw_text: text } }],
    }),
  },
  {
    intent: 'schedule_pdf_import',
    confidence: 0.9,
    patterns: [/((upload|import).*(pdf|schedule))|((muat naik|import).*(pdf|jadual))/i],
    build: () => ({
      requires_clarification: false,
      clarification_question: '',
      plan_steps: [{ step_id: 'ui-1', agent: 'ui', action: 'open_schedule_import', payload: {} }],
    }),
  },
]

function buildPlanFromRegistry(requestText) {
  const text = String(requestText || '').trim()
  const lower = text.toLowerCase()
  const context = {
    text,
    lower,
    quoted: extractQuoted(text),
    date: extractDate(text),
    priority: extractPriority(text),
  }

  for (const item of INTENT_REGISTRY) {
    if (item.patterns.some((p) => p.test(lower))) {
      const details = item.build(context)
      return {
        intent: item.intent,
        confidence: item.confidence,
        requires_clarification: details.requires_clarification,
        clarification_question: details.clarification_question,
        plan_steps: details.plan_steps,
      }
    }
  }

  return {
    intent: 'fallback_chat',
    confidence: 0.6,
    requires_clarification: false,
    clarification_question: '',
    plan_steps: [],
  }
}

module.exports = {
  INTENT_REGISTRY,
  buildPlanFromRegistry,
}
