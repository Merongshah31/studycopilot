# Agent Contracts (Phase 1)

This document defines strict JSON contracts for the first multi-agent backend flow:

- `Router Agent` (intent + plan)
- `Task Agent` (task CRUD execution)

## 1) Request Contract

`POST /api/agent/run`

```json
{
  "request_text": "Siap tugas \"Ulang kaji Bab 5\""
}
```

## 2) Shared Runtime State Contract

```json
{
  "run_id": "uuid",
  "user_id": "uuid",
  "request_text": "string",
  "intent": "task_complete | task_create | task_reschedule | task_priority_update | fallback_chat",
  "plan_steps": [
    {
      "step_id": "string",
      "agent": "task",
      "action": "complete_by_title",
      "payload": {}
    }
  ],
  "tool_results": [],
  "ui_events": [],
  "errors": []
}
```

## 3) Router Agent Output Contract

```json
{
  "intent": "task_complete",
  "confidence": 0.92,
  "plan_steps": [
    {
      "step_id": "task-1",
      "agent": "task",
      "action": "complete_by_title",
      "payload": {
        "title": "Ulang kaji Bab 5"
      }
    }
  ],
  "requires_clarification": false,
  "clarification_question": ""
}
```

Allowed `intent`:
- `task_create`
- `task_complete`
- `task_reschedule`
- `task_priority_update`
- `fallback_chat`

Allowed `action` for phase 1:
- `create_task`
- `complete_by_title`
- `reschedule_by_title`
- `set_priority_by_title`

## 4) Task Agent Output Contract

```json
{
  "status": "ok | partial | failed",
  "action": "complete_by_title",
  "changed_count": 1,
  "changed": [
    {
      "id": "task-uuid",
      "title": "Ulang kaji Bab 5",
      "completed": true
    }
  ],
  "ui_events": [
    "TASKS_UPDATED",
    "PLANNER_UPDATED",
    "ANALYTICS_UPDATED"
  ],
  "message": "Marked complete: Ulang kaji Bab 5"
}
```

## 5) Final API Response Contract

```json
{
  "run_id": "uuid",
  "intent": "task_complete",
  "status": "ok | partial | failed",
  "plan_steps": [],
  "tool_results": [],
  "ui_events": [],
  "errors": [],
  "summary": "Marked complete: Ulang kaji Bab 5"
}
```

