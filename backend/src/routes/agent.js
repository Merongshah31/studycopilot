const express = require('express')
const { v4: uuidv4 } = require('uuid')
const authMiddleware = require('../middleware/auth')
const { buildPlanFromRegistry } = require('../agents/intentRegistry')
const { getSupabaseServerClient } = require('../supabase')
const { executeTaskStep } = require('../agents/taskExecutor')
const { executeSchedulerStep } = require('../agents/schedulerExecutor')

const router = express.Router()
router.use(authMiddleware)

router.post('/run', async (req, res) => {
  const requestText = String(req.body?.request_text || '').trim()
  if (!requestText) return res.status(400).json({ message: 'request_text is required' })

  const runId = uuidv4()
  const state = {
    run_id: runId,
    user_id: req.user.id,
    request_text: requestText,
    intent: 'fallback_chat',
    plan_steps: [],
    tool_results: [],
    ui_events: [],
    errors: [],
  }

  const plan = buildPlanFromRegistry(requestText)
  state.intent = plan.intent
  state.plan_steps = plan.plan_steps

  if (plan.requires_clarification) {
    return res.json({
      ...state,
      status: 'partial',
      summary: plan.clarification_question || 'Need more details.',
    })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return res.status(500).json({
      run_id: state.run_id,
      intent: state.intent,
      status: 'failed',
      confidence: plan.confidence ?? 0.6,
      plan_steps: state.plan_steps,
      tool_results: [],
      ui_events: [],
      errors: ['Supabase is not configured on backend'],
      summary: 'Agent run failed: Supabase is not configured.',
    })
  }

  for (const step of state.plan_steps) {
    try {
      if (step.agent === 'task') {
        const result = await executeTaskStep({ supabase, userId: req.user.id, step })
        state.tool_results.push(result)
        state.ui_events.push(...(result.ui_events || []))
      } else if (step.agent === 'planner' || step.agent === 'calendar') {
        const result = await executeSchedulerStep({ supabase, userId: req.user.id, step })
        state.tool_results.push(result)
        state.ui_events.push(...(result.ui_events || []))
      } else if (step.agent === 'ui') {
        const uiEvent = step.action === 'open_schedule_import' ? 'NAVIGATE_SCHEDULE_IMPORT' : 'UI_UPDATED'
        state.tool_results.push({
          status: 'ok',
          action: step.action,
          changed_count: 0,
          changed: [],
          ui_events: [uiEvent],
          message: uiEvent === 'NAVIGATE_SCHEDULE_IMPORT'
            ? 'Opening Schedule Import page.'
            : `UI action processed: ${step.action}`,
        })
        state.ui_events.push(uiEvent)
      } else {
        state.tool_results.push({
          status: 'partial',
          action: step.action,
          changed_count: 0,
          changed: [],
          ui_events: [],
          message: `Agent "${step.agent}" is planned but not yet executable.`,
        })
      }
    } catch (error) {
      state.errors.push(`${step.action || 'unknown_action'}: ${error.message}`)
      state.tool_results.push({
        status: 'failed',
        action: step.action || 'unknown_action',
        changed_count: 0,
        changed: [],
        ui_events: [],
        message: error.message,
      })
    }
  }

  const uniqueUiEvents = [...new Set(state.ui_events)]
  const hasFailed = state.tool_results.some((r) => r.status === 'failed') || state.errors.length > 0
  const hasPartial = state.tool_results.some((r) => r.status === 'partial')
  const status = hasFailed ? 'failed' : hasPartial ? 'partial' : state.tool_results.length > 0 ? 'ok' : 'planned'
  const summary = state.tool_results.length > 0
    ? state.tool_results.map((r) => r.message).filter(Boolean).join(' | ')
    : (state.plan_steps.length > 0 ? 'Router planned actions successfully.' : 'Router classified as fallback_chat.')

  return res.json({
    run_id: state.run_id,
    intent: state.intent,
    status,
    confidence: plan.confidence ?? 0.6,
    plan_steps: state.plan_steps,
    tool_results: state.tool_results,
    ui_events: uniqueUiEvents,
    errors: state.errors,
    summary,
  })
})

module.exports = router
